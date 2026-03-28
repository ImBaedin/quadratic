import { createServer, type IncomingMessage } from "node:http";
import { mkdtemp, readdir, readFile, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, join, relative } from "node:path";
import { promisify } from "node:util";
import { execFile as execFileCallback } from "node:child_process";

import {
  repositoryExecutionRequestSchema,
  repositoryExecutionResultSchema,
  taskPlanningRequestSchema,
  taskPlanningResultSchema,
} from "@quadratic/agent-runtime";

const port = Number(process.env.PORT ?? "8080");
const serviceToken = process.env.SERVICE_TOKEN;
const execFile = promisify(execFileCallback);

if (!serviceToken) {
  throw new Error("SERVICE_TOKEN is required");
}

const ignoredDirectories = new Set([
  ".git",
  "node_modules",
  "dist",
  "build",
  ".next",
  ".turbo",
  ".cache",
]);

type RepoMetadata = {
  installationToken: string;
  prompt?: string;
  title?: string;
};

type RepoSnapshot = {
  repositoryRoot: string;
  files: string[];
  preview: Array<{ path: string; snippet: string }>;
};

const server = createServer(async (incomingRequest, outgoingResponse) => {
  const body = await readIncomingBody(incomingRequest);
  const request = new Request(`http://127.0.0.1:${port}${incomingRequest.url ?? "/"}`, {
    method: incomingRequest.method,
    headers: incomingRequest.headers as HeadersInit,
    body: body.length > 0 ? body : undefined,
  });

  const response = await handleRequest(request);
  outgoingResponse.statusCode = response.status;

  response.headers.forEach((value, key) => {
    outgoingResponse.setHeader(key, value);
  });

  outgoingResponse.end(await response.text());
});

server.listen(port, () => {
  console.log(`repo-actions listening on http://0.0.0.0:${port}`);
});

async function handleRequest(request: Request) {
  try {
    if (request.method !== "POST") {
      return text("Method not allowed", 405);
    }

    const authError = authorize(request);
    if (authError) {
      return authError;
    }

    if (request.url.endsWith("/tasks/planning")) {
      return await handleTaskPlanning(request);
    }

    if (request.url.endsWith("/runs")) {
      return await handleRun(request);
    }

    return text("Not found", 404);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown service error";
    return json({ error: message }, 500);
  }
}

async function readIncomingBody(request: IncomingMessage) {
  const chunks: Buffer[] = [];

  for await (const chunk of request) {
    chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
  }

  return Buffer.concat(chunks);
}

function authorize(request: Request) {
  const authorization = request.headers.get("authorization");
  if (authorization !== `Bearer ${serviceToken}`) {
    return text("Unauthorized", 401);
  }

  return null;
}

async function handleTaskPlanning(request: Request) {
  const payload = taskPlanningRequestSchema.parse(await request.json());
  const startedAt = new Date().toISOString();

  try {
    const metadata = parseRepoMetadata(payload.metadata);
    const snapshot = await inspectRepository({
      repositoryFullName: payload.repositoryFullName,
      branch: payload.branch,
      installationToken: metadata.installationToken,
    });

    const prompt = normalizePrompt(metadata.prompt);
    const questions = buildQuestions(prompt, snapshot.files);
    const result = taskPlanningResultSchema.parse({
      taskId: payload.taskId,
      runId: payload.runId,
      status: "succeeded",
      startedAt,
      completedAt: new Date().toISOString(),
      draft: {
        title: metadata.title?.trim() || buildTitle(prompt, payload.repositoryFullName),
        normalizedPrompt: prompt,
        plan: buildPlan(payload.repositoryFullName, payload.branch, snapshot),
        acceptanceCriteria: buildAcceptanceCriteria(prompt, snapshot.files),
        suggestedFiles: buildSuggestedFiles(snapshot.files),
      },
      questions,
      summary: `Inspected ${snapshot.files.length} files in ${payload.repositoryFullName}.`,
      events: [
        {
          type: "planning.repository_scanned",
          payload: {
            repositoryFullName: payload.repositoryFullName,
            branch: payload.branch,
            fileCount: snapshot.files.length,
          },
        },
      ],
    });

    return json(result);
  } catch (error) {
    const result = taskPlanningResultSchema.parse({
      taskId: payload.taskId,
      runId: payload.runId,
      status: "failed",
      startedAt,
      completedAt: new Date().toISOString(),
      error: error instanceof Error ? error.message : "Task planning failed",
      summary: "Repository planning service failed.",
    });

    return json(result, 500);
  }
}

async function handleRun(request: Request) {
  const payload = repositoryExecutionRequestSchema.parse(await request.json());
  const startedAt = new Date().toISOString();

  try {
    const metadata = parseRepoMetadata(payload.metadata);
    const snapshot = await inspectRepository({
      repositoryFullName: payload.repositoryFullName,
      branch: payload.branch,
      installationToken: metadata.installationToken,
    });

    const result = repositoryExecutionResultSchema.parse({
      runId: payload.runId,
      status: "succeeded",
      startedAt,
      completedAt: new Date().toISOString(),
      summary: buildRunSummary(payload.kind, payload.repositoryFullName, snapshot),
      artifacts: [
        {
          kind: "repository_snapshot",
          key: `run:${payload.runId}:snapshot`,
          label: "Repository snapshot",
          metadata: {
            branch: payload.branch,
            fileCount: String(snapshot.files.length),
            topFiles: snapshot.files.slice(0, 10).join(", "),
          },
        },
      ],
    });

    return json(result);
  } catch (error) {
    const result = repositoryExecutionResultSchema.parse({
      runId: payload.runId,
      status: "failed",
      startedAt,
      completedAt: new Date().toISOString(),
      error: error instanceof Error ? error.message : "Repository action failed",
      summary: "Repository action service failed.",
    });

    return json(result, 500);
  }
}

function parseRepoMetadata(metadata: Record<string, unknown>): RepoMetadata {
  const installationToken = metadata.installationToken;
  if (typeof installationToken !== "string" || !installationToken.trim()) {
    throw new Error("metadata.installationToken is required");
  }

  return {
    installationToken,
    prompt: typeof metadata.prompt === "string" ? metadata.prompt : undefined,
    title: typeof metadata.title === "string" ? metadata.title : undefined,
  };
}

function normalizePrompt(prompt: string | undefined) {
  return (prompt?.trim() || "Inspect the repository and prepare a safe implementation plan.").replace(
    /\s+/g,
    " ",
  );
}

function buildTitle(prompt: string, repositoryFullName: string) {
  const shortened = prompt.length > 72 ? `${prompt.slice(0, 69).trimEnd()}...` : prompt;
  return `${shortened} (${basename(repositoryFullName)})`;
}

function buildPlan(repositoryFullName: string, branch: string, snapshot: RepoSnapshot) {
  const lines = [
    `Repository: ${repositoryFullName}`,
    `Branch: ${branch}`,
    `Repository sample: ${snapshot.files.slice(0, 8).join(", ") || "No files detected"}`,
    "",
    "Proposed approach:",
    "1. Confirm the existing implementation boundaries in the files above.",
    "2. Make the smallest change that satisfies the prompt.",
    "3. Validate the affected code paths with focused checks before shipping.",
  ];

  return lines.join("\n");
}

function buildAcceptanceCriteria(prompt: string, files: string[]) {
  return [
    `The repository changes clearly address: ${prompt}`,
    files.length > 0
      ? `The implementation is consistent with the existing patterns in ${files[0]}.`
      : "The implementation identifies the correct file targets before editing.",
    "Any touched behavior has a focused verification step or test plan.",
  ];
}

function buildSuggestedFiles(files: string[]) {
  return files.slice(0, 6).map((path) => ({
    path,
    reason: "Likely relevant based on shallow repository inspection.",
  }));
}

function buildQuestions(prompt: string, files: string[]) {
  const questions: Array<{ key: string; question: string }> = [];

  if (!/\b(test|spec|coverage|verify|validation)\b/i.test(prompt)) {
    questions.push({
      key: "testing-scope",
      question: "Should this change include new or updated automated tests?",
    });
  }

  if (files.length === 0) {
    questions.push({
      key: "repo-shape",
      question: "The repository scan returned no useful files. Is the target branch correct?",
    });
  }

  return questions.slice(0, 2);
}

function buildRunSummary(kind: string, repositoryFullName: string, snapshot: RepoSnapshot) {
  const topFiles = snapshot.files.slice(0, 5).join(", ");
  return `${kind} inspected ${repositoryFullName} and sampled ${snapshot.files.length} files${topFiles ? ` (${topFiles})` : ""}.`;
}

async function inspectRepository(args: {
  repositoryFullName: string;
  branch: string;
  installationToken: string;
}): Promise<RepoSnapshot> {
  const repositoryRoot = await cloneRepository(args);

  try {
    const files = await listFiles(repositoryRoot, repositoryRoot);
    const preview = await Promise.all(
      files.slice(0, 5).map(async (path) => ({
        path,
        snippet: await readSnippet(join(repositoryRoot, path)),
      })),
    );

    return {
      repositoryRoot,
      files: files.slice(0, 50),
      preview,
    };
  } finally {
    await rm(repositoryRoot, { recursive: true, force: true });
  }
}

async function cloneRepository(args: {
  repositoryFullName: string;
  branch: string;
  installationToken: string;
}) {
  const directory = await mkdtemp(join(tmpdir(), "quadratic-repo-actions-"));
  const remote = `https://x-access-token:${encodeURIComponent(args.installationToken)}@github.com/${args.repositoryFullName}.git`;

  try {
    await execFile("git", [
      "clone",
      "--depth",
      "1",
      "--branch",
      args.branch,
      remote,
      directory,
    ]);
  } catch (error) {
    const stderr =
      typeof error === "object" && error !== null && "stderr" in error
        ? String(error.stderr)
        : "";
    throw new Error(stderr.trim() || "git clone failed");
  }

  return directory;
}

async function listFiles(root: string, directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const files: string[] = [];

  for (const entry of entries) {
    if (entry.name.startsWith(".") && entry.name !== ".github") {
      continue;
    }

    if (ignoredDirectories.has(entry.name)) {
      continue;
    }

    const fullPath = join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await listFiles(root, fullPath)));
      continue;
    }

    if (!entry.isFile()) {
      continue;
    }

    const fileStat = await stat(fullPath);
    if (fileStat.size > 128_000) {
      continue;
    }

    files.push(relative(root, fullPath));
    if (files.length >= 50) {
      break;
    }
  }

  return files.sort();
}

async function readSnippet(path: string) {
  const contents = await readFile(path, "utf8");
  return contents.slice(0, 400).trim();
}

function json(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload, null, 2), {
    status,
    headers: {
      "content-type": "application/json",
    },
  });
}

function text(payload: string, status = 200) {
  return new Response(payload, { status });
}

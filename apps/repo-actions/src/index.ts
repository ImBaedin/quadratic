import { createServer, type IncomingMessage } from "node:http";
import {
  mkdtemp,
  mkdir,
  readdir,
  readFile,
  rm,
  stat,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, dirname, join, normalize, relative } from "node:path";
import { promisify } from "node:util";
import { execFile as execFileCallback } from "node:child_process";

import { openRouterText } from "@tanstack/ai-openrouter";
import {
  repositoryExecutionRequestSchema,
  repositoryExecutionResultSchema,
  runArtifactSchema,
  taskPlanningRequestSchema,
  taskPlanningResultSchema,
  toolDefinition,
  runRepositoryAgent,
  type RunArtifact,
  type RunLogger,
  type ToolCall,
  type ToolResult,
} from "@quadratic/agent-runtime";
import { z } from "zod";

const port = Number(process.env.PORT ?? "8080");
const serviceToken = process.env.SERVICE_TOKEN;
const openRouterApiKey = process.env.OPENROUTER_API_KEY;
const repositoryModel = process.env.REPO_ACTIONS_MODEL ?? "openai/gpt-5.4-nano";
const repositoryModelId = repositoryModel as Parameters<typeof openRouterText>[0];
const execFile = promisify(execFileCallback);

if (!serviceToken) {
  throw new Error("SERVICE_TOKEN is required");
}

if (!openRouterApiKey) {
  throw new Error("OPENROUTER_API_KEY is required");
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

const taskPlanningDraftSchema = z.object({
  title: z.string().min(1),
  normalizedPrompt: z.string().min(1),
  plan: z.string().min(1),
  acceptanceCriteria: z.array(z.string().min(1)).min(1),
  suggestedFiles: z.array(
    z.object({
      path: z.string().min(1),
      reason: z.string().min(1).optional(),
    }),
  ),
});

type RepoMetadata = {
  installationToken: string;
  prompt?: string;
  title?: string;
  plan?: string;
  acceptanceCriteria?: string[];
  suggestedFiles?: Array<{ path: string; reason?: string }>;
  answeredQuestions?: Array<{ key: string; question: string; answer: string }>;
  taskId?: string;
};

type RepoSnapshot = {
  repositoryRoot: string;
  files: string[];
  preview: Array<{ path: string; snippet: string }>;
};

type ExecutionEvent = {
  type: string;
  payload: Record<string, unknown>;
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
    const snapshot = await withClonedRepository(
      {
        repositoryFullName: payload.repositoryFullName,
        branch: payload.branch,
        installationToken: metadata.installationToken,
      },
      async (repositoryRoot) => await inspectRepository(repositoryRoot),
    );

    const prompt = normalizePrompt(metadata.prompt);
    const questions = buildQuestions(prompt, snapshot.files);
    const result = taskPlanningResultSchema.parse({
      taskId: payload.taskId,
      runId: payload.runId,
      status: "succeeded",
      startedAt,
      completedAt: new Date().toISOString(),
      draft: taskPlanningDraftSchema.parse({
        title: metadata.title?.trim() || buildTitle(prompt, payload.repositoryFullName),
        normalizedPrompt: prompt,
        plan: buildPlan(payload.repositoryFullName, payload.branch, snapshot),
        acceptanceCriteria: buildAcceptanceCriteria(prompt, snapshot.files),
        suggestedFiles: buildSuggestedFiles(snapshot.files),
      }),
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
    const result = await withClonedRepository(
      {
        repositoryFullName: payload.repositoryFullName,
        branch: payload.branch,
        installationToken: metadata.installationToken,
      },
      async (repositoryRoot) => {
        const logger = new InMemoryRunLogger(payload.runId);
        const runtime = await runRepositoryAgent({
          repositoryFullName: payload.repositoryFullName,
          branch: payload.branch,
          workingDirectory: repositoryRoot,
          task: buildExecutionTask(metadata, payload.repositoryFullName, payload.branch),
          extraInstructions: [
            "Inspect the repository before making changes.",
            "Use the available tools to read files, edit files, and run focused verification commands.",
            "Prefer small, targeted changes that satisfy the task prompt and existing repository patterns.",
            "Before you finish, run the narrowest validation command that gives confidence in the touched code path.",
            "In the final response, summarize what changed and what you verified.",
          ],
          logger,
          maxIterations: 16,
          tools: createRepositoryTools(repositoryRoot),
          adapter: openRouterText(repositoryModelId),
          modelOptions: {
            provider: {
              data_collection: "deny",
              sort: "throughput",
            },
          },
          metadata: {
            taskId: metadata.taskId,
            repositoryFullName: payload.repositoryFullName,
            branch: payload.branch,
          },
        });

        const artifacts = await collectArtifacts(repositoryRoot, payload.runId, logger);
        const summary = summarizeExecution(runtime.outputText, artifacts);

        return repositoryExecutionResultSchema.parse({
          runId: payload.runId,
          status: runtime.finishReason === "stop" ? "succeeded" : "failed",
          startedAt,
          completedAt: new Date().toISOString(),
          summary,
          error:
            runtime.finishReason === "stop"
              ? undefined
              : `Model finished with reason: ${runtime.finishReason ?? "unknown"}`,
          artifacts,
          events: logger.events,
        });
      },
    );

    return json(result, result.status === "succeeded" ? 200 : 500);
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
    plan: typeof metadata.plan === "string" ? metadata.plan : undefined,
    acceptanceCriteria: Array.isArray(metadata.acceptanceCriteria)
      ? metadata.acceptanceCriteria.filter((value): value is string => typeof value === "string")
      : undefined,
    suggestedFiles: Array.isArray(metadata.suggestedFiles)
      ? metadata.suggestedFiles
          .filter(
            (value): value is { path: string; reason?: string } =>
              typeof value === "object" &&
              value !== null &&
              "path" in value &&
              typeof value.path === "string" &&
              (!("reason" in value) || value.reason === undefined || typeof value.reason === "string"),
          )
      : undefined,
    answeredQuestions: Array.isArray(metadata.answeredQuestions)
      ? metadata.answeredQuestions
          .filter(
            (value): value is { key: string; question: string; answer: string } =>
              typeof value === "object" &&
              value !== null &&
              "key" in value &&
              "question" in value &&
              "answer" in value &&
              typeof value.key === "string" &&
              typeof value.question === "string" &&
              typeof value.answer === "string",
          )
      : undefined,
    taskId: typeof metadata.taskId === "string" ? metadata.taskId : undefined,
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

function buildExecutionTask(
  metadata: RepoMetadata,
  repositoryFullName: string,
  branch: string,
) {
  const lines = [
    `Repository: ${repositoryFullName}`,
    `Branch: ${branch}`,
    "",
    `Task: ${normalizePrompt(metadata.prompt)}`,
  ];

  if (metadata.plan?.trim()) {
    lines.push("", "Planned approach:", metadata.plan.trim());
  }

  if (metadata.acceptanceCriteria?.length) {
    lines.push("", "Acceptance criteria:");
    for (const criterion of metadata.acceptanceCriteria) {
      lines.push(`- ${criterion}`);
    }
  }

  if (metadata.suggestedFiles?.length) {
    lines.push("", "Suggested files:");
    for (const file of metadata.suggestedFiles) {
      lines.push(`- ${file.path}${file.reason ? `: ${file.reason}` : ""}`);
    }
  }

  if (metadata.answeredQuestions?.length) {
    lines.push("", "Clarifications:");
    for (const question of metadata.answeredQuestions) {
      lines.push(`- ${question.question}: ${question.answer}`);
    }
  }

  return lines.join("\n");
}

async function withClonedRepository<T>(
  args: {
    repositoryFullName: string;
    branch: string;
    installationToken: string;
  },
  callback: (repositoryRoot: string) => Promise<T>,
) {
  const repositoryRoot = await cloneRepository(args);

  try {
    return await callback(repositoryRoot);
  } finally {
    await rm(repositoryRoot, { recursive: true, force: true });
  }
}

async function inspectRepository(repositoryRoot: string): Promise<RepoSnapshot> {
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
      if (files.length >= 200) {
        break;
      }
      continue;
    }

    if (!entry.isFile()) {
      continue;
    }

    const fileStat = await stat(fullPath);
    if (fileStat.size > 256_000) {
      continue;
    }

    files.push(relative(root, fullPath));
    if (files.length >= 200) {
      break;
    }
  }

  return files.sort();
}

async function readSnippet(path: string) {
  const contents = await readFile(path, "utf8");
  return contents.slice(0, 400).trim();
}

function createRepositoryTools(repositoryRoot: string) {
  const listFilesTool = toolDefinition({
    name: "list_files",
    description: "List repository files. Use this before reading or editing unfamiliar areas.",
    inputSchema: z.object({
      pattern: z.string().optional(),
      limit: z.number().int().min(1).max(200).optional(),
    }),
    outputSchema: z.object({
      files: z.array(z.string()),
    }),
  }).server(async ({ pattern, limit }) => {
    const files = await listFiles(repositoryRoot, repositoryRoot);
    const filtered =
      pattern && pattern.trim().length > 0
        ? files.filter((file) => file.toLowerCase().includes(pattern.toLowerCase()))
        : files;

    return {
      files: filtered.slice(0, limit ?? 100),
    };
  });

  const readFileTool = toolDefinition({
    name: "read_file",
    description: "Read a text file from the repository, optionally constrained to a line range.",
    inputSchema: z.object({
      path: z.string(),
      startLine: z.number().int().min(1).optional(),
      endLine: z.number().int().min(1).optional(),
    }),
    outputSchema: z.object({
      path: z.string(),
      content: z.string(),
    }),
  }).server(async ({ path, startLine, endLine }) => {
    const absolutePath = resolveRepositoryPath(repositoryRoot, path);
    const contents = await readFile(absolutePath, "utf8");
    const lines = contents.split("\n");
    const from = Math.max((startLine ?? 1) - 1, 0);
    const to = Math.max(endLine ?? lines.length, from + 1);

    return {
      path,
      content: lines.slice(from, to).join("\n"),
    };
  });

  const writeFileTool = toolDefinition({
    name: "write_file",
    description: "Write a full file in the repository. Use after reading the current file content.",
    inputSchema: z.object({
      path: z.string(),
      content: z.string(),
    }),
    outputSchema: z.object({
      path: z.string(),
      bytesWritten: z.number().int().nonnegative(),
    }),
  }).server(async ({ path, content }) => {
    const absolutePath = resolveRepositoryPath(repositoryRoot, path);
    await mkdir(dirname(absolutePath), { recursive: true });
    await writeFile(absolutePath, content, "utf8");

    return {
      path,
      bytesWritten: Buffer.byteLength(content, "utf8"),
    };
  });

  const runCommandTool = toolDefinition({
    name: "run_command",
    description:
      "Run a shell command inside the repository root. Use this for ripgrep, tests, formatting, and git inspection.",
    inputSchema: z.object({
      command: z.string().min(1),
      timeoutMs: z.number().int().min(1000).max(120000).optional(),
    }),
    outputSchema: z.object({
      exitCode: z.number().int(),
      stdout: z.string(),
      stderr: z.string(),
    }),
  }).server(async ({ command, timeoutMs }) => await runShellCommand(repositoryRoot, command, timeoutMs));

  return [listFilesTool, readFileTool, writeFileTool, runCommandTool];
}

function resolveRepositoryPath(repositoryRoot: string, requestedPath: string) {
  const normalizedPath = normalize(requestedPath);
  if (normalizedPath === ".." || normalizedPath.startsWith(`..${"/"}`)) {
    throw new Error(`Path escapes repository root: ${requestedPath}`);
  }

  const absolutePath = join(repositoryRoot, normalizedPath);
  const relativePath = relative(repositoryRoot, absolutePath);
  if (relativePath === ".." || relativePath.startsWith(`..${"/"}`)) {
    throw new Error(`Path escapes repository root: ${requestedPath}`);
  }

  return absolutePath;
}

async function runShellCommand(repositoryRoot: string, command: string, timeoutMs = 30_000) {
  try {
    const { stdout, stderr } = await execFile("bash", ["-lc", command], {
      cwd: repositoryRoot,
      timeout: timeoutMs,
      maxBuffer: 2 * 1024 * 1024,
      env: {
        ...process.env,
        OPENROUTER_API_KEY: openRouterApiKey,
      },
    });

    return {
      exitCode: 0,
      stdout: trimOutput(stdout),
      stderr: trimOutput(stderr),
    };
  } catch (error) {
    if (typeof error === "object" && error !== null) {
      const stderr = "stderr" in error ? trimOutput(String(error.stderr ?? "")) : "";
      const stdout = "stdout" in error ? trimOutput(String(error.stdout ?? "")) : "";
      const exitCode = "code" in error && typeof error.code === "number" ? error.code : 1;

      return {
        exitCode,
        stdout,
        stderr,
      };
    }

    return {
      exitCode: 1,
      stdout: "",
      stderr: String(error),
    };
  }
}

function trimOutput(output: string, maxLength = 12000) {
  if (output.length <= maxLength) {
    return output;
  }

  return `${output.slice(0, maxLength)}\n...[truncated]`;
}

async function collectArtifacts(
  repositoryRoot: string,
  runId: string,
  logger: InMemoryRunLogger,
): Promise<RunArtifact[]> {
  const status = await runShellCommand(repositoryRoot, "git status --short");
  const diffStat = await runShellCommand(repositoryRoot, "git diff --stat");
  const changedFiles = status.stdout
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => line.slice(3))
    .filter(Boolean);

  const artifacts: RunArtifact[] = [
    runArtifactSchema.parse({
      kind: "repository_diff",
      key: `run:${runId}:diff`,
      label: "Repository diff summary",
      metadata: {
        changedFiles: String(changedFiles.length),
        topFiles: changedFiles.slice(0, 10).join(", "),
        diffStat: diffStat.stdout.replace(/\s+/g, " ").trim().slice(0, 4000),
      },
    }),
  ];

  for (const artifact of artifacts) {
    await logger.artifact(artifact);
  }

  return artifacts;
}

function summarizeExecution(outputText: string, artifacts: RunArtifact[]) {
  const summary = outputText.trim();
  if (summary.length > 0) {
    return summary.slice(0, 4000);
  }

  const diffSummary = artifacts[0]?.metadata?.diffStat ?? "";
  if (diffSummary.trim().length > 0) {
    return `Execution completed. ${diffSummary}`;
  }

  return "Execution completed.";
}

class InMemoryRunLogger implements RunLogger {
  events: ExecutionEvent[] = [];

  constructor(private readonly runId: string) {}

  async log(message: string, metadata?: Record<string, unknown>) {
    this.push("run.progress", {
      runId: this.runId,
      message,
      ...(metadata ?? {}),
    });
  }

  async stdout(chunk: string) {
    this.push("run.stdout", {
      runId: this.runId,
      chunk: trimOutput(chunk, 4000),
    });
  }

  async stderr(chunk: string) {
    this.push("run.stderr", {
      runId: this.runId,
      chunk: trimOutput(chunk, 4000),
    });
  }

  async toolCalled(call: ToolCall) {
    this.push("run.tool_called", {
      runId: this.runId,
      toolName: call.toolName,
      callId: call.id,
    });
  }

  async toolResult(result: ToolResult) {
    this.push("run.tool_result", {
      runId: this.runId,
      toolName: result.toolName,
      callId: result.callId,
      ok: result.ok,
      ...(result.error ? { error: result.error } : {}),
    });
  }

  async artifact(artifact: RunArtifact) {
    this.push("run.artifact", {
      runId: this.runId,
      kind: artifact.kind,
      key: artifact.key,
      ...(artifact.label ? { label: artifact.label } : {}),
      ...(artifact.metadata ? { metadata: artifact.metadata } : {}),
    });
  }

  private push(type: string, payload: Record<string, unknown>) {
    this.events.push({ type, payload });
  }
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

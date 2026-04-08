import {
  chat,
  maxIterations,
  toolDefinition,
  type AnyTextAdapter,
  type ServerTool,
} from "@tanstack/ai";
import { Duration, Effect, Schedule } from "effect";
import { execFile as execFileCallback } from "node:child_process";
import { mkdtemp, mkdir, readFile, readdir, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, dirname, join, normalize, relative } from "node:path";
import { promisify } from "node:util";
import { z } from "zod";

import {
  proposalEnvelopeSchema,
  runResultSchema,
  type ProposalEnvelope,
  type RunArtifact,
  type RunEnvelope,
  type RunEvent,
  type RunResult,
  type RunUsage,
} from "./events";
import {
  executionWorkflowOutputSchema,
  getWorkflowDefinition,
  proposalWorkflowOutputSchema,
} from "./workflows";

const execFile = promisify(execFileCallback);

const ignoredDirectories = new Set([
  ".git",
  "node_modules",
  "dist",
  "build",
  ".next",
  ".turbo",
  ".cache",
]);

export interface ExecuteRunEnvelopeOptions {
  envelope: RunEnvelope;
  adapter: AnyTextAdapter;
  installationToken?: string;
  openRouterApiKey?: string;
}

class InMemoryRunEventSink {
  private readonly events: RunEvent[] = [];
  private sequence = 0;

  async append(
    event: Omit<RunEvent, "sequence" | "timestamp"> & { sequence?: number; timestamp?: number },
  ) {
    this.events.push({
      sequence: event.sequence ?? this.sequence++,
      timestamp: event.timestamp ?? Date.now(),
      type: event.type,
      payload: event.payload,
    });
  }

  async list() {
    return [...this.events].sort((left, right) => left.sequence - right.sequence);
  }
}

class InMemoryArtifactSink {
  private readonly artifacts: RunArtifact[] = [];

  async append(artifact: RunArtifact) {
    this.artifacts.push(artifact);
  }

  async list() {
    return [...this.artifacts];
  }
}

class InMemoryUsageSink {
  private usage: RunUsage | undefined;

  async set(usage: RunUsage) {
    this.usage = usage;
  }

  async get() {
    return this.usage;
  }
}

class InMemoryProposalSink {
  private proposal: ProposalEnvelope | undefined;

  async set(proposal: ProposalEnvelope) {
    this.proposal = proposal;
  }

  async get() {
    return this.proposal;
  }
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

function trimOutput(output: string, maxLength = 12_000) {
  if (output.length <= maxLength) {
    return output;
  }

  return `${output.slice(0, maxLength)}\n...[truncated]`;
}

async function runShellCommand(
  repositoryRoot: string,
  command: string,
  openRouterApiKey: string | undefined,
  timeoutMs = 30_000,
) {
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

async function applyUnifiedPatch(repositoryRoot: string, patch: string) {
  const patchPath = join(repositoryRoot, ".quadratic.patch");
  await writeFile(patchPath, patch, "utf8");

  try {
    await execFile("git", ["apply", "--whitespace=nowarn", patchPath], {
      cwd: repositoryRoot,
    });
  } finally {
    await rm(patchPath, { force: true });
  }
}

async function collectArtifacts(repositoryRoot: string, runId: string) {
  const status = await runShellCommand(repositoryRoot, "git status --short", undefined);
  const diffStat = await runShellCommand(repositoryRoot, "git diff --stat", undefined);
  const changedFiles = status.stdout
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => line.slice(3))
    .filter(Boolean);

  const artifacts: RunArtifact[] = [
    {
      kind: "repository_diff",
      key: `run:${runId}:diff`,
      label: "Repository diff summary",
      metadata: {
        changedFiles: String(changedFiles.length),
        topFiles: changedFiles.slice(0, 10).join(", "),
        diffStat: diffStat.stdout.replace(/\s+/g, " ").trim().slice(0, 4000),
      },
    },
  ];

  const patchOutput = await runShellCommand(
    repositoryRoot,
    "git diff --patch --minimal",
    undefined,
    60_000,
  );
  if (patchOutput.stdout.trim().length > 0) {
    artifacts.push({
      kind: "repository_patch",
      key: `run:${runId}:patch`,
      label: "Repository patch",
      metadata: {
        patch: patchOutput.stdout,
      },
    });
  }

  return artifacts;
}

async function checkoutRepository(envelope: RunEnvelope, installationToken: string | undefined) {
  const repository = envelope.repository ?? envelope.task?.repository;
  if (!repository) {
    return undefined;
  }

  if (!installationToken) {
    throw new Error("Repository workflows require an installation token.");
  }

  const directory = await mkdtemp(join(tmpdir(), "quadratic-repo-actions-"));
  const remote = `https://x-access-token:${encodeURIComponent(installationToken)}@github.com/${repository.fullName}.git`;
  await execFile("git", [
    "clone",
    "--depth",
    "1",
    "--branch",
    envelope.branch ?? repository.defaultBranch,
    remote,
    directory,
  ]);

  return directory;
}

async function createTools(args: {
  envelope: RunEnvelope;
  repositoryRoot?: string;
  openRouterApiKey?: string;
}) {
  const workflow = getWorkflowDefinition(args.envelope.runKind);
  if (!args.repositoryRoot || workflow.toolset === "none") {
    return [];
  }

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
    const files = await listFiles(args.repositoryRoot!, args.repositoryRoot!);
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
    const absolutePath = resolveRepositoryPath(args.repositoryRoot!, path);
    const contents = await readFile(absolutePath, "utf8");
    const lines = contents.split("\n");
    const from = Math.max((startLine ?? 1) - 1, 0);
    const to = Math.max(endLine ?? lines.length, from + 1);

    return {
      path,
      content: lines.slice(from, to).join("\n"),
    };
  });

  const runCommandTool = toolDefinition({
    name: "run_command",
    description: "Run a shell command inside the repository root.",
    inputSchema: z.object({
      command: z.string().min(1),
      timeoutMs: z.number().int().min(1000).max(120000).optional(),
    }),
    outputSchema: z.object({
      exitCode: z.number().int(),
      stdout: z.string(),
      stderr: z.string(),
    }),
  }).server(
    async ({ command, timeoutMs }) =>
      await runShellCommand(args.repositoryRoot!, command, args.openRouterApiKey, timeoutMs),
  );

  if (!workflow.writable) {
    return [listFilesTool, readFileTool, runCommandTool];
  }

  const applyPatchTool = toolDefinition({
    name: "apply_patch",
    description: "Apply a unified patch to existing repository files.",
    inputSchema: z.object({
      patch: z.string().min(1),
    }),
    outputSchema: z.object({
      ok: z.boolean(),
    }),
  }).server(async ({ patch }) => {
    await applyUnifiedPatch(args.repositoryRoot!, patch);
    return { ok: true };
  });

  const writeFileTool = toolDefinition({
    name: "write_file",
    description: "Create a brand new file in the repository. Fails if the file already exists.",
    inputSchema: z.object({
      path: z.string(),
      content: z.string(),
    }),
    outputSchema: z.object({
      path: z.string(),
      bytesWritten: z.number().int().nonnegative(),
    }),
  }).server(async ({ path, content }) => {
    const absolutePath = resolveRepositoryPath(args.repositoryRoot!, path);

    try {
      await stat(absolutePath);
      throw new Error(`Refusing to overwrite existing file: ${path}`);
    } catch (error) {
      if (error instanceof Error && error.message.startsWith("Refusing")) {
        throw error;
      }
    }

    await mkdir(dirname(absolutePath), { recursive: true });
    await writeFile(absolutePath, content, "utf8");

    return {
      path,
      bytesWritten: Buffer.byteLength(content, "utf8"),
    };
  });

  return [listFilesTool, readFileTool, applyPatchTool, writeFileTool, runCommandTool];
}

async function runWorkflow(args: {
  envelope: RunEnvelope;
  adapter: AnyTextAdapter;
  tools: Array<ServerTool<any, any, string>>;
  workingDirectory?: string;
  runEvents: InMemoryRunEventSink;
  usageSink: InMemoryUsageSink;
  proposalSink: InMemoryProposalSink;
}) {
  const workflow = getWorkflowDefinition(args.envelope.runKind);

  const commonOptions = {
    adapter: args.adapter,
    messages: [
      {
        role: "user" as const,
        content: workflow.userPrompt(args.envelope),
      },
    ],
    systemPrompts: workflow
      .systemPrompts()
      .concat(args.workingDirectory ? [`Working directory: ${args.workingDirectory}`] : []),
    tools: args.tools,
    metadata: {
      runId: args.envelope.runId,
      workflowKind: args.envelope.runKind,
    },
    agentLoopStrategy: maxIterations(workflow.writable ? 16 : 12),
  };

  if (workflow.kind !== "repo_execution") {
    await args.runEvents.append({
      type: "run.started",
      payload: {
        provider: args.adapter.name,
        model: args.adapter.model,
        mode: "structured",
      },
    });

    const structured = await chat({
      ...commonOptions,
      outputSchema: proposalWorkflowOutputSchema,
    });

    const proposal = proposalEnvelopeSchema.parse({
      workflowKind: workflow.kind,
      ...structured,
    });

    await args.proposalSink.set(proposal);
    await args.runEvents.append({
      type: "run.summary",
      payload: {
        summary: proposal.summary,
        itemCount: proposal.items.length,
      },
    });

    return {
      summary: proposal.summary ?? "",
      proposal,
    };
  }

  const stream = chat(commonOptions);
  let outputText = "";
  let finishReason: string | null = null;

  for await (const chunk of stream) {
    if (chunk.type === "RUN_STARTED") {
      await args.runEvents.append({
        type: "run.started",
        payload: {
          runId: chunk.runId,
          provider: args.adapter.name,
          model: args.adapter.model,
        },
      });
    }

    if (chunk.type === "TEXT_MESSAGE_CONTENT") {
      outputText = chunk.content ?? `${outputText}${chunk.delta}`;
      if (chunk.delta.length > 0) {
        await args.runEvents.append({
          type: "run.stdout",
          payload: {
            chunk: chunk.delta,
          },
        });
      }
    }

    if (chunk.type === "TOOL_CALL_START") {
      await args.runEvents.append({
        type: "run.tool_called",
        payload: {
          toolCallId: chunk.toolCallId,
          toolName: chunk.toolName,
        },
      });
    }

    if (chunk.type === "TOOL_CALL_END") {
      await args.runEvents.append({
        type: "run.tool_result",
        payload: {
          toolCallId: chunk.toolCallId,
          toolName: chunk.toolName,
          result: chunk.result,
        },
      });
    }

    if (chunk.type === "RUN_ERROR") {
      await args.runEvents.append({
        type: "run.stderr",
        payload: {
          error: chunk.error.message,
        },
      });
    }

    if (chunk.type === "RUN_FINISHED") {
      finishReason = chunk.finishReason;
      if (chunk.usage) {
        await args.usageSink.set({
          provider: args.adapter.name,
          model: args.adapter.model,
          inputTokens: chunk.usage.promptTokens ?? 0,
          outputTokens: chunk.usage.completionTokens ?? 0,
          totalTokens: chunk.usage.totalTokens ?? 0,
        });
      }
    }
  }

  const execution = executionWorkflowOutputSchema.parse({
    summary: outputText.trim() || "Execution completed.",
    status: finishReason === "stop" ? "completed" : "failed",
    error:
      finishReason === "stop"
        ? undefined
        : `Model finished with reason: ${finishReason ?? "unknown"}`,
  });

  await args.runEvents.append({
    type: "run.summary",
    payload: {
      summary: execution.summary,
      status: execution.status,
    },
  });

  return {
    summary: execution.summary,
    execution: {
      status: execution.status,
      summary: execution.summary,
      error: execution.error,
    },
  };
}

export async function executeRunEnvelope(options: ExecuteRunEnvelopeOptions): Promise<RunResult> {
  const runEvents = new InMemoryRunEventSink();
  const artifacts = new InMemoryArtifactSink();
  const usageSink = new InMemoryUsageSink();
  const proposalSink = new InMemoryProposalSink();

  const program = Effect.gen(function* () {
    yield* Effect.tryPromise(() =>
      runEvents.append({
        type: "run.preparing",
        payload: {
          workflowKind: options.envelope.runKind,
          targetType: options.envelope.targetType,
        },
      }),
    );

    const repositoryRoot = yield* Effect.acquireRelease(
      Effect.tryPromise(() => checkoutRepository(options.envelope, options.installationToken)),
      (directory) =>
        directory
          ? Effect.tryPromise(() => rm(directory, { recursive: true, force: true }))
          : Effect.void,
    );

    const tools = yield* Effect.tryPromise(() =>
      createTools({
        envelope: options.envelope,
        repositoryRoot,
        openRouterApiKey: options.openRouterApiKey,
      }),
    );

    const modelResult = yield* Effect.retry(
      Effect.tryPromise(() =>
        runWorkflow({
          envelope: options.envelope,
          adapter: options.adapter,
          tools,
          workingDirectory: repositoryRoot,
          runEvents,
          usageSink,
          proposalSink,
        }),
      ),
      Schedule.recurs(2),
    );

    if (repositoryRoot) {
      const collectedArtifacts = yield* Effect.tryPromise(() =>
        collectArtifacts(repositoryRoot, options.envelope.runId),
      );
      for (const artifact of collectedArtifacts) {
        yield* Effect.tryPromise(() => artifacts.append(artifact));
      }
    }

    const [events, artifactList, usage, proposal] = yield* Effect.all([
      Effect.tryPromise(() => runEvents.list()),
      Effect.tryPromise(() => artifacts.list()),
      Effect.tryPromise(() => usageSink.get()),
      Effect.tryPromise(() => proposalSink.get()),
    ]);

    return runResultSchema.parse({
      runId: options.envelope.runId,
      status: modelResult.execution?.status === "failed" ? "failed" : "succeeded",
      summary: modelResult.summary,
      error: modelResult.execution?.error,
      events,
      artifacts: artifactList,
      usage,
      proposal,
      execution: modelResult.execution,
    });
  }).pipe(Effect.timeout(Duration.seconds(180)));

  const result = await Effect.runPromise(Effect.scoped(program));
  if (!result) {
    return runResultSchema.parse({
      runId: options.envelope.runId,
      status: "timed_out",
      error: "Run timed out.",
      events: [],
      artifacts: [],
    });
  }

  return result;
}

export function buildFallbackTaskTitle(envelope: RunEnvelope) {
  if (envelope.task?.title?.trim()) {
    return envelope.task.title;
  }

  const prompt = envelope.task?.rawPrompt?.trim();
  if (prompt) {
    return prompt.length > 72 ? `${prompt.slice(0, 69).trimEnd()}...` : prompt;
  }

  const repository = envelope.repository ?? envelope.task?.repository;
  return repository ? `Repository task for ${basename(repository.fullName)}` : "Quadratic task";
}

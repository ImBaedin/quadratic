import {
  chat,
  maxIterations,
  type AnyTextAdapter,
  type ModelMessage,
  type RunFinishedEvent,
  type ServerTool,
  type StreamChunk,
  type ToolCallEndEvent,
  type ToolCallStartEvent,
} from "@tanstack/ai";

export interface ToolCall {
  id: string;
  toolName: string;
  input: Record<string, unknown>;
  startedAt: string;
}

export interface ToolResult {
  callId: string;
  toolName: string;
  ok: boolean;
  output?: Record<string, unknown>;
  error?: string;
  finishedAt: string;
}

export interface RunArtifact {
  kind: string;
  key: string;
  label?: string;
  contentType?: string;
  url?: string;
  metadata?: Record<string, string>;
}

export interface RunLogger {
  log(message: string, metadata?: Record<string, unknown>): Promise<void>;
  stdout(chunk: string): Promise<void>;
  stderr(chunk: string): Promise<void>;
  toolCalled(call: ToolCall): Promise<void>;
  toolResult(result: ToolResult): Promise<void>;
  artifact(artifact: RunArtifact): Promise<void>;
}

class NoopRunLogger implements RunLogger {
  async log(): Promise<void> {}
  async stdout(): Promise<void> {}
  async stderr(): Promise<void> {}
  async toolCalled(): Promise<void> {}
  async toolResult(): Promise<void> {}
  async artifact(): Promise<void> {}
}

export interface AgentRuntimeOptions {
  adapter: AnyTextAdapter;
  messages: Array<ModelMessage>;
  systemPrompts?: Array<string>;
  tools?: Array<ServerTool<any, any, string>>;
  logger?: RunLogger;
  maxIterations?: number;
  temperature?: number;
  maxTokens?: number;
  metadata?: Record<string, unknown>;
  conversationId?: string;
  abortController?: AbortController;
  modelOptions?: Record<string, unknown>;
}

export interface AgentRuntimeResult {
  outputText: string;
  finishReason: RunFinishedEvent["finishReason"];
  usage?: RunFinishedEvent["usage"];
  runId?: string;
  toolCalls: Array<ToolCall>;
  toolResults: Array<ToolResult>;
  events: Array<StreamChunk>;
}

export interface RepositoryAgentOptions {
  adapter: AnyTextAdapter;
  repositoryFullName: string;
  branch: string;
  workingDirectory: string;
  task: string;
  extraInstructions?: Array<string>;
  tools?: Array<ServerTool<any, any, string>>;
  logger?: RunLogger;
  maxIterations?: number;
  temperature?: number;
  maxTokens?: number;
  metadata?: Record<string, unknown>;
  conversationId?: string;
  abortController?: AbortController;
  modelOptions?: Record<string, unknown>;
}

export async function runRepositoryAgent(
  options: RepositoryAgentOptions,
): Promise<AgentRuntimeResult> {
  return await runAgentRuntime({
    adapter: options.adapter,
    messages: [
      {
        role: "user",
        content: options.task,
      },
    ],
    systemPrompts: [
      [
        "You are the repository runtime for Quadratic.",
        "Operate on the checked out repository and complete the user's requested task with the available tools.",
        "Prefer inspecting the repository before making changes.",
        "Keep edits minimal, preserve existing patterns, and do not invent project structure.",
        `Repository: ${options.repositoryFullName}`,
        `Branch: ${options.branch}`,
        `Working directory: ${options.workingDirectory}`,
        ...(options.extraInstructions ?? []),
      ].join("\n"),
    ],
    tools: options.tools,
    logger: options.logger,
    maxIterations: options.maxIterations,
    temperature: options.temperature,
    maxTokens: options.maxTokens,
    metadata: {
      repositoryFullName: options.repositoryFullName,
      branch: options.branch,
      workingDirectory: options.workingDirectory,
      ...options.metadata,
    },
    conversationId: options.conversationId,
    abortController: options.abortController,
    modelOptions: options.modelOptions,
  });
}

async function runAgentRuntime(options: AgentRuntimeOptions): Promise<AgentRuntimeResult> {
  const logger = options.logger ?? new NoopRunLogger();
  const toolCalls = new Map<string, ToolCall>();
  const toolResults: Array<ToolResult> = [];
  const events: Array<StreamChunk> = [];

  let outputText = "";
  let runId: string | undefined;
  let finishReason: RunFinishedEvent["finishReason"] = null;
  let usage: RunFinishedEvent["usage"];

  const stream = chat({
    adapter: options.adapter,
    messages: options.messages,
    systemPrompts: options.systemPrompts,
    tools: options.tools,
    temperature: options.temperature,
    maxTokens: options.maxTokens,
    metadata: options.metadata,
    conversationId: options.conversationId,
    abortController: options.abortController,
    modelOptions: options.modelOptions,
    agentLoopStrategy: maxIterations(options.maxIterations ?? 8),
  });

  for await (const chunk of stream) {
    events.push(chunk);

    switch (chunk.type) {
      case "RUN_STARTED":
        runId = chunk.runId;
        await logger.log("TanStack AI run started", {
          runId: chunk.runId,
          model: options.adapter.model,
          provider: options.adapter.name,
        });
        break;
      case "TEXT_MESSAGE_CONTENT":
        outputText = chunk.content ?? `${outputText}${chunk.delta}`;
        if (chunk.delta.length > 0) {
          await logger.stdout(chunk.delta);
        }
        break;
      case "TOOL_CALL_START": {
        const call = createToolCall(chunk);
        toolCalls.set(call.id, call);
        await logger.toolCalled(call);
        break;
      }
      case "TOOL_CALL_END": {
        const result = createToolResult(chunk);
        toolResults.push(result);
        await logger.toolResult(result);
        break;
      }
      case "CUSTOM":
        await logger.log(`Tool event: ${chunk.name}`, {
          eventName: chunk.name,
          value: asRecord(chunk.value),
        });
        break;
      case "RUN_ERROR":
        await logger.stderr(chunk.error.message);
        break;
      case "RUN_FINISHED":
        finishReason = chunk.finishReason;
        usage = chunk.usage;
        await logger.log("TanStack AI run finished", {
          runId: chunk.runId,
          finishReason: chunk.finishReason,
          usage: chunk.usage,
        });
        break;
      default:
        break;
    }
  }

  return {
    outputText,
    finishReason,
    usage,
    runId,
    toolCalls: Array.from(toolCalls.values()),
    toolResults,
    events,
  };
}

function createToolCall(chunk: ToolCallStartEvent): ToolCall {
  return {
    id: chunk.toolCallId,
    toolName: chunk.toolName,
    input: {},
    startedAt: new Date(chunk.timestamp).toISOString(),
  };
}

function createToolResult(chunk: ToolCallEndEvent): ToolResult {
  const output = parseToolPayload(chunk.result);
  const error =
    typeof chunk.result === "string" && chunk.result.startsWith("Error executing tool:")
      ? chunk.result
      : undefined;

  return {
    callId: chunk.toolCallId,
    toolName: chunk.toolName,
    ok: error === undefined,
    output,
    error,
    finishedAt: new Date(chunk.timestamp).toISOString(),
  };
}

function parseToolPayload(value: string | undefined): Record<string, unknown> | undefined {
  if (!value) {
    return undefined;
  }

  try {
    return asRecord(JSON.parse(value));
  } catch {
    return { value };
  }
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return undefined;
  }

  return value as Record<string, unknown>;
}

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

import type { ToolCall, ToolResult } from "./events";
import type { RunLogger } from "./provider";

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

export class NoopRunLogger implements RunLogger {
  async log(): Promise<void> {}

  async stdout(): Promise<void> {}

  async stderr(): Promise<void> {}

  async toolCalled(): Promise<void> {}

  async toolResult(): Promise<void> {}

  async artifact(): Promise<void> {}
}

export async function runAgentRuntime(options: AgentRuntimeOptions): Promise<AgentRuntimeResult> {
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
      case "RUN_STARTED": {
        runId = chunk.runId;
        await logger.log("TanStack AI run started", {
          runId: chunk.runId,
          model: options.adapter.model,
          provider: options.adapter.name,
        });
        break;
      }
      case "TEXT_MESSAGE_CONTENT": {
        outputText = chunk.content ?? `${outputText}${chunk.delta}`;
        if (chunk.delta.length > 0) {
          await logger.stdout(chunk.delta);
        }
        break;
      }
      case "TOOL_CALL_START": {
        const call = createToolCall(chunk);
        toolCalls.set(call.id, call);
        await logger.toolCalled(call);
        break;
      }
      case "TOOL_CALL_END": {
        const result = createToolResult(chunk, toolCalls.get(chunk.toolCallId));
        toolResults.push(result);
        await logger.toolResult(result);
        break;
      }
      case "CUSTOM": {
        await logger.log(`Tool event: ${chunk.name}`, {
          eventName: chunk.name,
          value: asRecord(chunk.value),
        });
        break;
      }
      case "RUN_ERROR": {
        await logger.stderr(chunk.error.message);
        break;
      }
      case "RUN_FINISHED": {
        finishReason = chunk.finishReason;
        usage = chunk.usage;
        await logger.log("TanStack AI run finished", {
          runId: chunk.runId,
          finishReason: chunk.finishReason,
          usage: chunk.usage,
        });
        break;
      }
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

function createToolResult(chunk: ToolCallEndEvent, call?: ToolCall): ToolResult {
  const output = parseToolPayload(chunk.result);
  const error = typeof chunk.result === "string" && chunk.result.startsWith("Error executing tool:")
    ? chunk.result
    : undefined;

  return {
    callId: chunk.toolCallId,
    toolName: chunk.toolName,
    ok: error === undefined,
    output: output ?? call?.input,
    error,
    finishedAt: new Date(chunk.timestamp).toISOString(),
  };
}

function parseToolPayload(value: string | undefined): Record<string, unknown> | undefined {
  if (!value) {
    return undefined;
  }

  try {
    const parsed: unknown = JSON.parse(value);
    return asRecord(parsed);
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

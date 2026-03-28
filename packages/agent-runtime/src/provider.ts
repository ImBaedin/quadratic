import { z } from "zod";

import type { RunArtifact, ToolCall, ToolResult } from "./events";

export const modelInvocationSchema = z.object({
  provider: z.string(),
  model: z.string(),
  temperature: z.number().min(0).max(2).optional(),
  maxOutputTokens: z.number().int().positive().optional(),
  system: z.string().optional(),
  prompt: z.string(),
  metadata: z.record(z.string(), z.unknown()).default({}),
});

export type ModelInvocation = z.infer<typeof modelInvocationSchema>;

export const modelInvocationResultSchema = z.object({
  provider: z.string(),
  model: z.string(),
  outputText: z.string(),
  usage: z
    .object({
      inputTokens: z.number().int().nonnegative().optional(),
      outputTokens: z.number().int().nonnegative().optional(),
      totalTokens: z.number().int().nonnegative().optional(),
    })
    .optional(),
  finishReason: z.string().optional(),
  metadata: z.record(z.string(), z.unknown()).default({}),
});

export type ModelInvocationResult = z.infer<typeof modelInvocationResultSchema>;

export interface ModelProvider {
  invoke(input: ModelInvocation): Promise<ModelInvocationResult>;
}

export interface ToolDefinition<TInput = Record<string, unknown>, TResult = Record<string, unknown>> {
  name: string;
  description: string;
  execute(input: TInput): Promise<TResult>;
}

export interface ToolRegistry {
  list(): ToolDefinition[];
  get(name: string): ToolDefinition | undefined;
}

export interface RunLogger {
  log(message: string, metadata?: Record<string, unknown>): Promise<void>;
  stdout(chunk: string): Promise<void>;
  stderr(chunk: string): Promise<void>;
  toolCalled(call: ToolCall): Promise<void>;
  toolResult(result: ToolResult): Promise<void>;
  artifact(artifact: RunArtifact): Promise<void>;
}

export interface CancellationSignalLike {
  readonly aborted: boolean;
  throwIfAborted(): void;
}

export interface TimeoutPolicy {
  timeoutMs: number;
  startedAt: string;
}

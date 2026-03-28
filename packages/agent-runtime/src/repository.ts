import type { AnyTextAdapter, ModelMessage, ServerTool } from "@tanstack/ai";

import type { RunLogger } from "./provider";
import { runAgentRuntime, type AgentRuntimeResult } from "./runtime";

export interface RepositoryAgentContext {
  repositoryFullName: string;
  branch: string;
  workingDirectory: string;
  task: string;
  extraInstructions?: Array<string>;
}

export interface RepositoryAgentOptions extends RepositoryAgentContext {
  adapter: AnyTextAdapter;
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

export function buildRepositorySystemPrompt(context: Omit<RepositoryAgentContext, "task">): string {
  const instructions = [
    "You are the repository runtime for Quadratic.",
    "Operate on the checked out repository and complete the user's requested task with the available tools.",
    "Prefer inspecting the repository before making changes.",
    "Keep edits minimal, preserve existing patterns, and do not invent project structure.",
    `Repository: ${context.repositoryFullName}`,
    `Branch: ${context.branch}`,
    `Working directory: ${context.workingDirectory}`,
  ];

  if (context.extraInstructions?.length) {
    instructions.push(...context.extraInstructions);
  }

  return instructions.join("\n");
}

export function buildRepositoryMessages(task: string): Array<ModelMessage> {
  return [
    {
      role: "user",
      content: task,
    },
  ];
}

export async function runRepositoryAgent(
  options: RepositoryAgentOptions,
): Promise<AgentRuntimeResult> {
  return await runAgentRuntime({
    adapter: options.adapter,
    messages: buildRepositoryMessages(options.task),
    systemPrompts: [
      buildRepositorySystemPrompt({
        repositoryFullName: options.repositoryFullName,
        branch: options.branch,
        workingDirectory: options.workingDirectory,
        extraInstructions: options.extraInstructions,
      }),
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

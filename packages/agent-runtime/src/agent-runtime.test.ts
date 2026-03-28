import { describe, expect, test } from "bun:test";
import { toolDefinition, type AnyTextAdapter, type StreamChunk } from "@tanstack/ai";
import { z } from "zod";

import {
  assertRunStatusTransition,
  canTransitionRunStatus,
  isTerminalRunStatus,
  repositoryExecutionRequestSchema,
  taskPlanningRequestSchema,
  taskPlanningResultSchema,
  runAgentRuntime,
} from "./index";

describe("run status transitions", () => {
  test("allows forward transitions", () => {
    expect(canTransitionRunStatus("queued", "requested")).toBe(true);
    expect(canTransitionRunStatus("requested", "launching")).toBe(true);
    expect(canTransitionRunStatus("running", "succeeded")).toBe(true);
  });

  test("rejects terminal regressions", () => {
    expect(canTransitionRunStatus("succeeded", "running")).toBe(false);
    expect(() => assertRunStatusTransition("failed", "queued")).toThrow(
      "Invalid run status transition",
    );
  });

  test("tracks terminal statuses", () => {
    expect(isTerminalRunStatus("succeeded")).toBe(true);
    expect(isTerminalRunStatus("running")).toBe(false);
  });
});

describe("repository execution request schema", () => {
  test("validates worker payloads", () => {
    const result = repositoryExecutionRequestSchema.parse({
      runId: "run_123",
      workspaceId: "ws_123",
      repositoryId: "repo_123",
      githubInstallationId: "inst_123",
      repositoryFullName: "acme/platform",
      branch: "main",
      kind: "repository_sync",
      requestedAt: "2026-03-27T18:00:00.000Z",
    });

    expect(result.branch).toBe("main");
  });
});

describe("task planning schemas", () => {
  test("validates task planning worker payloads", () => {
    const result = taskPlanningRequestSchema.parse({
      taskId: "task_123",
      runId: "run_123",
      workspaceId: "ws_123",
      repositoryId: "repo_123",
      githubInstallationId: "inst_123",
      repositoryFullName: "acme/platform",
      branch: "main",
      requestedAt: "2026-03-27T18:00:00.000Z",
    });

    expect(result.taskId).toBe("task_123");
  });

  test("rejects successful task planning results without a draft", () => {
    expect(() =>
      taskPlanningResultSchema.parse({
        taskId: "task_123",
        runId: "run_123",
        status: "succeeded",
      }),
    ).toThrow("Successful task planning results must include a draft.");
  });
});

describe("TanStack AI runtime", () => {
  test("runs a tool-backed agent loop", async () => {
    const lookupRepository = toolDefinition({
      name: "lookup_repository",
      description: "Returns repository metadata for a full name.",
      inputSchema: z.object({
        fullName: z.string(),
      }),
      outputSchema: z.object({
        defaultBranch: z.string(),
      }),
    }).server(async () => ({
      defaultBranch: "main",
    }));

    const adapter: AnyTextAdapter = {
      kind: "text",
      name: "test",
      model: "test-model",
      "~types": {
        providerOptions: {},
        inputModalities: ["text"],
        messageMetadataByModality: {},
      },
      async *chatStream(): AsyncIterable<StreamChunk> {
        yield {
          type: "RUN_STARTED",
          timestamp: Date.now(),
          runId: "run_123",
          model: "test-model",
        };
        yield {
          type: "TOOL_CALL_START",
          timestamp: Date.now(),
          toolCallId: "call_123",
          toolName: "lookup_repository",
          model: "test-model",
        };
        yield {
          type: "TOOL_CALL_END",
          timestamp: Date.now(),
          toolCallId: "call_123",
          toolName: "lookup_repository",
          input: { fullName: "acme/platform" },
          result: JSON.stringify({ defaultBranch: "main" }),
          model: "test-model",
        };
        yield {
          type: "TEXT_MESSAGE_START",
          timestamp: Date.now(),
          messageId: "msg_123",
          role: "assistant",
          model: "test-model",
        };
        yield {
          type: "TEXT_MESSAGE_CONTENT",
          timestamp: Date.now(),
          messageId: "msg_123",
          delta: "Default branch is main.",
          model: "test-model",
        };
        yield {
          type: "TEXT_MESSAGE_END",
          timestamp: Date.now(),
          messageId: "msg_123",
          model: "test-model",
        };
        yield {
          type: "RUN_FINISHED",
          timestamp: Date.now(),
          runId: "run_123",
          finishReason: "stop",
          usage: {
            promptTokens: 12,
            completionTokens: 8,
            totalTokens: 20,
          },
          model: "test-model",
        };
      },
      async structuredOutput() {
        return {
          data: {},
          rawText: "",
        };
      },
    };

    const result = await runAgentRuntime({
      adapter,
      messages: [
        {
          role: "user",
          content: "Check the repository metadata.",
        },
      ],
      tools: [lookupRepository],
      systemPrompts: ["You are a repository agent."],
    });

    expect(result.runId).toBe("run_123");
    expect(result.outputText).toBe("Default branch is main.");
    expect(result.finishReason).toBe("stop");
    expect(result.toolCalls).toHaveLength(1);
    expect(result.toolResults).toHaveLength(1);
    expect(result.toolResults[0]?.ok).toBe(true);
    expect(result.toolResults[0]?.output).toEqual({ defaultBranch: "main" });
  });
});

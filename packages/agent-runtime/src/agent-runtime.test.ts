import { describe, expect, test } from "bun:test";

import {
  assertRunStatusTransition,
  canTransitionRunStatus,
  isTerminalRunStatus,
  repositoryExecutionRequestSchema,
} from "./index";

describe("run status transitions", () => {
  test("allows forward transitions", () => {
    expect(canTransitionRunStatus("queued", "preparing")).toBe(true);
    expect(canTransitionRunStatus("running", "completed")).toBe(true);
  });

  test("rejects terminal regressions", () => {
    expect(canTransitionRunStatus("completed", "running")).toBe(false);
    expect(() => assertRunStatusTransition("failed", "queued")).toThrow(
      "Invalid run status transition",
    );
  });

  test("tracks terminal statuses", () => {
    expect(isTerminalRunStatus("completed")).toBe(true);
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
      callback: {
        url: "https://example.com/internal/runs/callback",
        auth: {
          kind: "bearer",
          token: "secret",
        },
      },
    });

    expect(result.branch).toBe("main");
  });
});

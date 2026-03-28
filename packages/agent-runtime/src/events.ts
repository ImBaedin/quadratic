import { z } from "zod";

export const runStatusSchema = z.enum([
  "queued",
  "preparing",
  "running",
  "canceling",
  "completed",
  "failed",
  "canceled",
  "timed_out",
]);

export type RunStatus = z.infer<typeof runStatusSchema>;

export const runKindSchema = z.enum(["repository_sync", "repository_explore", "agent_tool"]);

export type RunKind = z.infer<typeof runKindSchema>;

export const runArtifactSchema = z.object({
  kind: z.string(),
  key: z.string(),
  label: z.string().optional(),
  contentType: z.string().optional(),
  url: z.string().url().optional(),
  metadata: z.record(z.string(), z.string()).optional(),
});

export type RunArtifact = z.infer<typeof runArtifactSchema>;

export const toolCallSchema = z.object({
  id: z.string(),
  toolName: z.string(),
  input: z.record(z.string(), z.unknown()),
  startedAt: z.string().datetime(),
});

export type ToolCall = z.infer<typeof toolCallSchema>;

export const toolResultSchema = z.object({
  callId: z.string(),
  toolName: z.string(),
  ok: z.boolean(),
  output: z.record(z.string(), z.unknown()).optional(),
  error: z.string().optional(),
  finishedAt: z.string().datetime(),
});

export type ToolResult = z.infer<typeof toolResultSchema>;

export const runEventTypeSchema = z.enum([
  "run.created",
  "run.preparing",
  "run.started",
  "run.progress",
  "run.stdout",
  "run.stderr",
  "run.tool_called",
  "run.tool_result",
  "run.artifact",
  "run.summary",
  "run.completed",
  "run.failed",
  "run.canceled",
  "run.timeout",
]);

export type RunEventType = z.infer<typeof runEventTypeSchema>;

export const runEventSchema = z.object({
  runId: z.string(),
  type: runEventTypeSchema,
  timestamp: z.string().datetime(),
  sequence: z.number().int().nonnegative(),
  payload: z.record(z.string(), z.unknown()),
});

export type RunEvent = z.infer<typeof runEventSchema>;

export const workerCallbackAuthSchema = z.object({
  kind: z.enum(["bearer", "hmac"]),
  token: z.string(),
  headerName: z.string().default("authorization"),
});

export type WorkerCallbackAuth = z.infer<typeof workerCallbackAuthSchema>;

export const workerCallbackSchema = z.object({
  url: z.string().url(),
  auth: workerCallbackAuthSchema,
});

export type WorkerCallback = z.infer<typeof workerCallbackSchema>;

export const repositoryExecutionRequestSchema = z.object({
  runId: z.string(),
  workspaceId: z.string(),
  repositoryId: z.string(),
  githubInstallationId: z.string(),
  repositoryFullName: z.string(),
  branch: z.string(),
  kind: runKindSchema,
  requestedAt: z.string().datetime(),
  callback: workerCallbackSchema,
  metadata: z.record(z.string(), z.unknown()).default({}),
});

export type RepositoryExecutionRequest = z.infer<
  typeof repositoryExecutionRequestSchema
>;

export const repositoryExecutionResultSchema = z.object({
  runId: z.string(),
  status: runStatusSchema,
  startedAt: z.string().datetime().optional(),
  completedAt: z.string().datetime().optional(),
  summary: z.string().optional(),
  error: z.string().optional(),
  artifacts: z.array(runArtifactSchema).default([]),
});

export type RepositoryExecutionResult = z.infer<
  typeof repositoryExecutionResultSchema
>;

export const inngestEventNameSchema = z.enum([
  "workspace.created",
  "github.installation.connected",
  "github.installation.repositories_changed",
  "repository.selected",
  "repository.push_detected",
  "agent.run.requested",
]);

export type InngestEventName = z.infer<typeof inngestEventNameSchema>;

export const inngestEventSchema = z.object({
  name: inngestEventNameSchema,
  data: z.object({
    workspaceId: z.string(),
    userId: z.string().optional(),
    repositoryId: z.string().optional(),
    runId: z.string().optional(),
    githubInstallationId: z.string().optional(),
    source: z.string().optional(),
    payload: z.record(z.string(), z.unknown()).default({}),
  }),
});

export type InngestEvent = z.infer<typeof inngestEventSchema>;

import { z } from "zod";

export const runStatusSchema = z.enum([
  "queued",
  "requested",
  "launching",
  "running",
  "succeeded",
  "failed",
  "cancelled",
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

export const repositoryExecutionRequestSchema = z.object({
  runId: z.string(),
  workspaceId: z.string(),
  repositoryId: z.string(),
  githubInstallationId: z.string(),
  repositoryFullName: z.string(),
  branch: z.string(),
  kind: runKindSchema,
  requestedAt: z.string().datetime(),
  metadata: z.record(z.string(), z.unknown()).default({}),
});

export type RepositoryExecutionRequest = z.infer<
  typeof repositoryExecutionRequestSchema
>;

export const repositoryExecutionEventSchema = z.object({
  type: z.string().min(1),
  payload: z.record(z.string(), z.unknown()),
});

export type RepositoryExecutionEvent = z.infer<
  typeof repositoryExecutionEventSchema
>;

export const taskPlanningRequestSchema = z.object({
  taskId: z.string(),
  runId: z.string(),
  workspaceId: z.string(),
  repositoryId: z.string(),
  githubInstallationId: z.string(),
  repositoryFullName: z.string(),
  branch: z.string(),
  requestedAt: z.string().datetime(),
  metadata: z.record(z.string(), z.unknown()).default({}),
});

export type TaskPlanningRequest = z.infer<typeof taskPlanningRequestSchema>;

export const repositoryExecutionResultSchema = z.object({
  runId: z.string(),
  status: runStatusSchema,
  startedAt: z.string().datetime().optional(),
  completedAt: z.string().datetime().optional(),
  summary: z.string().optional(),
  error: z.string().optional(),
  artifacts: z.array(runArtifactSchema).default([]),
  events: z.array(repositoryExecutionEventSchema).optional(),
});

export type RepositoryExecutionResult = z.infer<
  typeof repositoryExecutionResultSchema
>;

export const taskPlanningDraftSchema = z.object({
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

export type TaskPlanningDraft = z.infer<typeof taskPlanningDraftSchema>;

export const taskPlanningQuestionSchema = z.object({
  key: z.string().min(1),
  question: z.string().min(1),
});

export type TaskPlanningQuestion = z.infer<typeof taskPlanningQuestionSchema>;

export const taskPlanningEventSchema = z.object({
  type: z.string().min(1),
  payload: z.record(z.string(), z.unknown()),
});

export type TaskPlanningEvent = z.infer<typeof taskPlanningEventSchema>;

export const taskPlanningResultSchema = z
  .object({
    taskId: z.string(),
    runId: z.string(),
    status: runStatusSchema,
    startedAt: z.string().datetime().optional(),
    completedAt: z.string().datetime().optional(),
    draft: taskPlanningDraftSchema.optional(),
    questions: z.array(taskPlanningQuestionSchema).optional(),
    summary: z.string().optional(),
    error: z.string().optional(),
    events: z.array(taskPlanningEventSchema).optional(),
  })
  .superRefine((value, ctx) => {
    if (value.status === "succeeded" && !value.draft) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Successful task planning results must include a draft.",
        path: ["draft"],
      });
    }
  });

export type TaskPlanningResult = z.infer<typeof taskPlanningResultSchema>;

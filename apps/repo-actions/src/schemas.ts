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

export const runArtifactSchema = z.object({
  kind: z.string(),
  key: z.string(),
  label: z.string().optional(),
  contentType: z.string().optional(),
  url: z.string().url().optional(),
  metadata: z.record(z.string(), z.string()).optional(),
});

export type RunArtifact = z.infer<typeof runArtifactSchema>;

export const repositoryExecutionEventSchema = z.object({
  type: z.string().min(1),
  payload: z.record(z.string(), z.unknown()),
});

export const repositoryExecutionRequestSchema = z.object({
  runId: z.string(),
  workspaceId: z.string(),
  repositoryId: z.string(),
  githubInstallationId: z.string(),
  repositoryFullName: z.string(),
  branch: z.string(),
  kind: z.enum(["repository_sync", "repository_explore", "agent_tool"]),
  requestedAt: z.string().datetime(),
  metadata: z.record(z.string(), z.unknown()).default({}),
});

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

export const taskPlanningQuestionSchema = z.object({
  key: z.string().min(1),
  question: z.string().min(1),
});

export const taskPlanningEventSchema = z.object({
  type: z.string().min(1),
  payload: z.record(z.string(), z.unknown()),
});

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

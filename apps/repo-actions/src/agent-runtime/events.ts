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

export const workflowKindSchema = z.enum([
  "context_enrichment",
  "task_breakdown",
  "discussion_rereview",
  "repo_analysis",
  "repo_execution",
  "repository_sync",
  "repository_explore",
]);

export type WorkflowKind = z.infer<typeof workflowKindSchema>;

export const toolsetKindSchema = z.enum(["none", "read_only_repository", "writable_repository"]);

export type ToolsetKind = z.infer<typeof toolsetKindSchema>;

export const runTargetTypeSchema = z.enum(["task", "repository"]);

export type RunTargetType = z.infer<typeof runTargetTypeSchema>;

export const runArtifactSchema = z.object({
  kind: z.string(),
  key: z.string(),
  label: z.string().optional(),
  contentType: z.string().optional(),
  url: z.string().url().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export type RunArtifact = z.infer<typeof runArtifactSchema>;

export const runEventSchema = z.object({
  type: z.string(),
  sequence: z.number().int().nonnegative(),
  timestamp: z.number().int().nonnegative(),
  payload: z.record(z.string(), z.unknown()).default({}),
});

export type RunEvent = z.infer<typeof runEventSchema>;

export const runUsageSchema = z.object({
  provider: z.string(),
  model: z.string(),
  inputTokens: z.number().int().nonnegative(),
  outputTokens: z.number().int().nonnegative(),
  totalTokens: z.number().int().nonnegative(),
  estimatedCostUsd: z.number().nonnegative().optional(),
});

export type RunUsage = z.infer<typeof runUsageSchema>;

export const taskFieldDefinitionSchema = z.object({
  key: z.string(),
  label: z.string(),
  description: z.string().optional(),
  valueKind: z.enum([
    "text",
    "markdown",
    "string_list",
    "json",
    "boolean",
    "number",
    "suggested_files",
  ]),
  visibility: z.enum(["primary", "secondary", "telemetry", "hidden"]),
  aiBehavior: z.enum(["manual_only", "suggestable", "ai_default"]),
  promptHint: z.string().optional(),
  value: z.unknown().optional(),
});

export type TaskFieldDefinition = z.infer<typeof taskFieldDefinitionSchema>;

export const taskVersionSnapshotSchema = z.object({
  taskId: z.string(),
  workspaceId: z.string(),
  primaryRepositoryId: z.string().nullable().optional(),
  branch: z.string().optional(),
  taskKind: z.string(),
  title: z.string(),
  status: z.string(),
  phase: z.string(),
  parentTaskId: z.string().optional(),
  latestSummary: z.string().optional(),
  latestError: z.string().optional(),
  rawPrompt: z.string().default(""),
  fieldValues: z.array(taskFieldDefinitionSchema).default([]),
  contextEntries: z
    .array(
      z.object({
        contextEntryId: z.string().optional(),
        kind: z.string(),
        title: z.string().optional(),
        body: z.string(),
        metadata: z.record(z.string(), z.unknown()).optional(),
        createdAt: z.number().optional(),
      }),
    )
    .default([]),
  questions: z
    .array(
      z.object({
        questionId: z.string().optional(),
        key: z.string(),
        question: z.string(),
        status: z.string(),
        source: z.string(),
        answer: z.string().optional(),
        answeredAt: z.number().optional(),
      }),
    )
    .default([]),
  relations: z
    .array(
      z.object({
        relationId: z.string().optional(),
        taskId: z.string(),
        relatedTaskId: z.string(),
        relationType: z.string(),
        createdAt: z.number().optional(),
      }),
    )
    .default([]),
  repository: z
    .object({
      repositoryId: z.string(),
      fullName: z.string(),
      owner: z.string(),
      name: z.string(),
      defaultBranch: z.string(),
      selected: z.boolean(),
      archived: z.boolean(),
      githubInstallationId: z.number(),
    })
    .nullable()
    .optional(),
});

export type TaskVersionSnapshot = z.infer<typeof taskVersionSnapshotSchema>;

export const proposalItemSchema = z.object({
  itemType: z.enum([
    "core_patch",
    "field_value",
    "context_entry",
    "question",
    "child_task",
    "relation",
  ]),
  action: z.enum(["set", "add", "remove", "create"]),
  label: z.string().optional(),
  fieldKey: z.string().optional(),
  payload: z.record(z.string(), z.unknown()),
});

export type ProposalItem = z.infer<typeof proposalItemSchema>;

export const proposalEnvelopeSchema = z.object({
  workflowKind: workflowKindSchema,
  summary: z.string().optional(),
  rationale: z.string().optional(),
  items: z.array(proposalItemSchema).default([]),
});

export type ProposalEnvelope = z.infer<typeof proposalEnvelopeSchema>;

export const repositoryContextSchema = z.object({
  repositoryId: z.string(),
  fullName: z.string(),
  owner: z.string(),
  name: z.string(),
  defaultBranch: z.string(),
  selected: z.boolean(),
  archived: z.boolean(),
  githubInstallationId: z.number(),
});

export type RepositoryContext = z.infer<typeof repositoryContextSchema>;

export const runEnvelopeSchema = z.object({
  runId: z.string(),
  workspaceId: z.string(),
  targetType: runTargetTypeSchema,
  targetTaskId: z.string().optional(),
  targetRepositoryId: z.string().optional(),
  branch: z.string().optional(),
  runKind: workflowKindSchema,
  requestedAt: z.string().datetime(),
  provider: z.string().default("openrouter"),
  model: z.string().default("openai/gpt-5.4-nano"),
  promptTemplateVersion: z.string().default("planner-first-v1"),
  toolsetVersion: z.string().default("planner-first-v1"),
  effectWorkflowKey: z.string().default("planner-first-v1"),
  metadata: z.record(z.string(), z.unknown()).default({}),
  task: taskVersionSnapshotSchema.optional(),
  repository: repositoryContextSchema.optional(),
});

export type RunEnvelope = z.infer<typeof runEnvelopeSchema>;

export const executionResultSchema = z.object({
  status: z.enum(["completed", "failed"]),
  summary: z.string().optional(),
  error: z.string().optional(),
});

export const runResultSchema = z.object({
  runId: z.string(),
  status: runStatusSchema,
  summary: z.string().optional(),
  error: z.string().optional(),
  events: z.array(runEventSchema).default([]),
  artifacts: z.array(runArtifactSchema).default([]),
  usage: runUsageSchema.optional(),
  proposal: proposalEnvelopeSchema.optional(),
  execution: executionResultSchema.optional(),
});

export type RunResult = z.infer<typeof runResultSchema>;

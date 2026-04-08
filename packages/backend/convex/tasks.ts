import { ConvexError, v } from "convex/values";

import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import {
  internalMutation,
  internalQuery,
  mutation,
  query,
  type MutationCtx,
  type QueryCtx,
} from "./_generated/server";
import { requireWorkspaceMembership } from "./lib/auth";

const taskKindValidator = v.union(
  v.literal("general"),
  v.literal("bug"),
  v.literal("feature"),
  v.literal("research"),
  v.literal("chore"),
  v.literal("breakdown"),
);

const taskStatusValidator = v.union(
  v.literal("draft"),
  v.literal("in_review"),
  v.literal("awaiting_clarification"),
  v.literal("ready"),
  v.literal("in_progress"),
  v.literal("completed"),
  v.literal("failed"),
  v.literal("cancelled"),
);

const taskPhaseValidator = v.union(
  v.literal("intake"),
  v.literal("planning"),
  v.literal("clarification"),
  v.literal("execution"),
  v.literal("delivery"),
);

const questionSourceValidator = v.union(
  v.literal("human"),
  v.literal("context_enrichment"),
  v.literal("task_breakdown"),
  v.literal("discussion_rereview"),
  v.literal("repo_analysis"),
  v.literal("repo_execution"),
);

const fieldValueKindValidator = v.union(
  v.literal("text"),
  v.literal("markdown"),
  v.literal("string_list"),
  v.literal("json"),
  v.literal("boolean"),
  v.literal("number"),
  v.literal("suggested_files"),
);

const fieldVisibilityValidator = v.union(
  v.literal("primary"),
  v.literal("secondary"),
  v.literal("telemetry"),
  v.literal("hidden"),
);

const fieldAiBehaviorValidator = v.union(
  v.literal("manual_only"),
  v.literal("suggestable"),
  v.literal("ai_default"),
);

const relationTypeValidator = v.union(
  v.literal("parent_child"),
  v.literal("blocked_by"),
  v.literal("blocks"),
  v.literal("references"),
  v.literal("duplicate_of"),
  v.literal("spawned_from"),
);

const fieldDefinitionInputValidator = v.object({
  key: v.string(),
  label: v.string(),
  description: v.optional(v.string()),
  valueKind: fieldValueKindValidator,
  visibility: fieldVisibilityValidator,
  aiBehavior: fieldAiBehaviorValidator,
  promptHint: v.optional(v.string()),
  taskKinds: v.array(taskKindValidator),
});

const contextEntryInputValidator = v.object({
  kind: v.string(),
  title: v.optional(v.string()),
  body: v.string(),
  metadata: v.optional(v.any()),
});

const defaultFieldDefinitions = [
  {
    key: "normalized_prompt",
    label: "Normalized prompt",
    description: "Cleaned-up task request text for AI workflows.",
    valueKind: "text",
    visibility: "secondary",
    aiBehavior: "ai_default",
    promptHint: "Normalize the user request into concise implementation intent.",
    taskKinds: ["general", "bug", "feature", "research", "chore", "breakdown"],
  },
  {
    key: "implementation_plan",
    label: "Implementation plan",
    description: "Canonical accepted implementation plan.",
    valueKind: "markdown",
    visibility: "primary",
    aiBehavior: "ai_default",
    promptHint: "Provide a concrete implementation plan tied to real repository structure.",
    taskKinds: ["general", "bug", "feature", "research", "chore", "breakdown"],
  },
  {
    key: "acceptance_criteria",
    label: "Acceptance criteria",
    description: "Accepted success criteria for the task.",
    valueKind: "string_list",
    visibility: "primary",
    aiBehavior: "ai_default",
    promptHint: "List acceptance criteria as concise standalone checks.",
    taskKinds: ["general", "bug", "feature", "research", "chore", "breakdown"],
  },
  {
    key: "suggested_files",
    label: "Suggested files",
    description: "Repository files most relevant to the task.",
    valueKind: "suggested_files",
    visibility: "secondary",
    aiBehavior: "ai_default",
    promptHint: "Name the files the implementation is likely to touch and why.",
    taskKinds: ["general", "bug", "feature", "research", "chore", "breakdown"],
  },
  {
    key: "telemetry_summary",
    label: "Telemetry summary",
    description: "Compact AI summary suitable for a collapsed telemetry section.",
    valueKind: "text",
    visibility: "telemetry",
    aiBehavior: "ai_default",
    promptHint: "Summarize the AI run outcome briefly without duplicating the full transcript.",
    taskKinds: ["general", "bug", "feature", "research", "chore", "breakdown"],
  },
] as const satisfies ReadonlyArray<{
  key: string;
  label: string;
  description: string;
  valueKind: "text" | "markdown" | "string_list" | "suggested_files";
  visibility: "primary" | "secondary" | "telemetry";
  aiBehavior: "ai_default";
  promptHint: string;
  taskKinds: Array<"general" | "bug" | "feature" | "research" | "chore" | "breakdown">;
}>;

type ReaderCtx = QueryCtx | MutationCtx;

function assertTruthy<T>(value: T | null | undefined, message: string): T {
  if (value === null || value === undefined) {
    throw new ConvexError({
      code: "NOT_FOUND",
      message,
    });
  }

  return value;
}

async function ensureDefaultFieldDefinitions(ctx: MutationCtx, workspaceId: Id<"workspaces">) {
  const existing = await ctx.db
    .query("taskFieldDefinitions")
    .withIndex("by_workspace", (query) => query.eq("workspaceId", workspaceId))
    .collect();
  const keys = new Set(existing.map((definition) => definition.key));

  await Promise.all(
    defaultFieldDefinitions
      .filter((definition) => !keys.has(definition.key))
      .map((definition) =>
        ctx.db.insert("taskFieldDefinitions", {
          workspaceId,
          ...definition,
          archived: false,
        }),
      ),
  );
}

async function loadTaskRepository(ctx: ReaderCtx, repositoryId: Id<"repositories"> | undefined) {
  if (!repositoryId) {
    return null;
  }

  return await ctx.db.get(repositoryId);
}

async function loadTaskFieldState(ctx: ReaderCtx, task: Doc<"tasks">) {
  const [definitions, values] = await Promise.all([
    ctx.db
      .query("taskFieldDefinitions")
      .withIndex("by_workspace", (query) => query.eq("workspaceId", task.workspaceId))
      .collect(),
    ctx.db
      .query("taskFieldValues")
      .withIndex("by_task", (query) => query.eq("taskId", task._id))
      .collect(),
  ]);

  const valuesByDefinitionId = new Map(
    values.map((value) => [value.fieldDefinitionId, value] as const),
  );

  return definitions
    .filter((definition) => !definition.archived)
    .map((definition) => ({
      definitionId: definition._id,
      key: definition.key,
      label: definition.label,
      description: definition.description,
      valueKind: definition.valueKind,
      visibility: definition.visibility,
      aiBehavior: definition.aiBehavior,
      promptHint: definition.promptHint,
      value: valuesByDefinitionId.get(definition._id)?.value,
    }));
}

async function loadTaskContextEntries(ctx: ReaderCtx, taskId: Id<"tasks">) {
  const entries = await ctx.db
    .query("taskContextEntries")
    .withIndex("by_task", (query) => query.eq("taskId", taskId))
    .collect();

  return entries
    .filter((entry) => !entry.archived)
    .map((entry) => ({
      contextEntryId: entry._id,
      kind: entry.kind,
      title: entry.title,
      body: entry.body,
      metadata: entry.metadata,
      createdAt: entry._creationTime,
    }));
}

async function loadTaskQuestions(ctx: ReaderCtx, taskId: Id<"tasks">) {
  const questions = await ctx.db
    .query("taskQuestions")
    .withIndex("by_task", (query) => query.eq("taskId", taskId))
    .collect();

  return questions.map((question) => ({
    questionId: question._id,
    key: question.key,
    question: question.question,
    status: question.status,
    source: question.source,
    answer: question.answer,
    answeredAt: question.answeredAt,
  }));
}

async function loadTaskDiscussions(ctx: ReaderCtx, taskId: Id<"tasks">) {
  const discussions = await ctx.db
    .query("taskDiscussions")
    .withIndex("by_task", (query) => query.eq("taskId", taskId))
    .collect();

  return discussions.map((discussion) => ({
    discussionId: discussion._id,
    authorType: discussion.authorType,
    authorUserId: discussion.authorUserId,
    runId: discussion.runId,
    body: discussion.body,
    triggerRereview: discussion.triggerRereview,
    createdAt: discussion._creationTime,
  }));
}

async function loadTaskRelations(ctx: ReaderCtx, task: Doc<"tasks">) {
  const [directRelations, childRelations] = await Promise.all([
    ctx.db
      .query("taskRelations")
      .withIndex("by_task", (query) => query.eq("taskId", task._id))
      .collect(),
    ctx.db
      .query("taskRelations")
      .withIndex("by_related_task_id", (query) => query.eq("relatedTaskId", task._id))
      .collect(),
  ]);

  return [...directRelations, ...childRelations].map((relation) => ({
    relationId: relation._id,
    taskId: relation.taskId,
    relatedTaskId: relation.relatedTaskId,
    relationType: relation.relationType,
    createdAt: relation._creationTime,
  }));
}

async function loadTaskVersions(ctx: ReaderCtx, taskId: Id<"tasks">) {
  const versions = await ctx.db
    .query("taskVersions")
    .withIndex("by_task", (query) => query.eq("taskId", taskId))
    .order("desc")
    .collect();

  return versions.map((version) => ({
    versionId: version._id,
    sourceType: version.sourceType,
    sourceId: version.sourceId,
    summary: version.summary,
    createdAt: version._creationTime,
    snapshot: version.snapshot,
  }));
}

async function loadTaskProposals(ctx: ReaderCtx, taskId: Id<"tasks">) {
  const proposals = await ctx.db
    .query("taskProposals")
    .withIndex("by_task", (query) => query.eq("taskId", taskId))
    .order("desc")
    .collect();

  return await Promise.all(
    proposals.map(async (proposal) => {
      const items = await ctx.db
        .query("taskProposalItems")
        .withIndex("by_proposal", (query) => query.eq("proposalId", proposal._id))
        .collect();

      return {
        proposalId: proposal._id,
        runId: proposal.runId,
        workflowKind: proposal.workflowKind,
        status: proposal.status,
        summary: proposal.summary,
        rationale: proposal.rationale,
        createdAt: proposal._creationTime,
        items: items.map((item) => ({
          itemId: item._id,
          itemType: item.itemType,
          action: item.action,
          label: item.label,
          fieldKey: item.fieldKey,
          status: item.status,
          payload: item.payload,
          appliedEntityId: item.appliedEntityId,
        })),
      };
    }),
  );
}

async function loadTaskRuns(ctx: ReaderCtx, taskId: Id<"tasks">) {
  const runs = await ctx.db
    .query("runs")
    .withIndex("by_target_task_id", (query) => query.eq("targetTaskId", taskId))
    .order("desc")
    .collect();

  return await Promise.all(
    runs.map(async (run) => {
      const [events, artifacts, usage] = await Promise.all([
        ctx.db
          .query("runEvents")
          .withIndex("by_run", (query) => query.eq("runId", run._id))
          .collect(),
        ctx.db
          .query("runArtifacts")
          .withIndex("by_run", (query) => query.eq("runId", run._id))
          .collect(),
        ctx.db
          .query("runUsage")
          .withIndex("by_run", (query) => query.eq("runId", run._id))
          .unique(),
      ]);

      return {
        runId: run._id,
        runKind: run.runKind,
        status: run.status,
        branch: run.branch,
        provider: run.provider,
        model: run.model,
        promptTemplateVersion: run.promptTemplateVersion,
        toolsetVersion: run.toolsetVersion,
        effectWorkflowKey: run.effectWorkflowKey,
        startedAt: run.startedAt,
        completedAt: run.completedAt,
        summary: run.summary,
        error: run.error,
        usage: usage
          ? {
              inputTokens: usage.inputTokens,
              outputTokens: usage.outputTokens,
              totalTokens: usage.totalTokens,
              estimatedCostUsd: usage.estimatedCostUsd,
            }
          : null,
        artifacts: artifacts.map((artifact) => ({
          artifactId: artifact._id,
          kind: artifact.kind,
          key: artifact.key,
          label: artifact.label,
          contentType: artifact.contentType,
          url: artifact.url,
          metadata: artifact.metadata,
        })),
        events: events
          .sort((left, right) => left.sequence - right.sequence)
          .map((event) => ({
            eventId: event._id,
            sequence: event.sequence,
            timestamp: event.timestamp,
            type: event.type,
            payload: event.payload,
          })),
      };
    }),
  );
}

function findFieldValue(fields: Array<{ key: string; value: unknown }>, key: string): unknown {
  return fields.find((field) => field.key === key)?.value;
}

function getPromptFromContext(entries: Array<{ kind: string; body: string }>) {
  return entries.find((entry) => entry.kind === "intake_prompt")?.body ?? "";
}

async function buildTaskSnapshot(ctx: ReaderCtx, taskId: Id<"tasks">) {
  const task = assertTruthy(await ctx.db.get(taskId), "Task not found.");
  const [repository, fieldValues, contextEntries, questions, relations] = await Promise.all([
    loadTaskRepository(ctx, task.primaryRepositoryId),
    loadTaskFieldState(ctx, task),
    loadTaskContextEntries(ctx, task._id),
    loadTaskQuestions(ctx, task._id),
    loadTaskRelations(ctx, task),
  ]);

  return {
    taskId: task._id,
    workspaceId: task.workspaceId,
    primaryRepositoryId: task.primaryRepositoryId,
    repository: repository
      ? {
          repositoryId: repository._id,
          fullName: repository.fullName,
          owner: repository.owner,
          name: repository.name,
          defaultBranch: repository.defaultBranch,
          selected: repository.selected,
          archived: repository.archived,
          githubInstallationId: repository.githubInstallationId,
        }
      : null,
    branch: task.branch,
    taskKind: task.taskKind,
    title: task.title,
    status: task.status,
    phase: task.phase,
    parentTaskId: task.parentTaskId,
    latestSummary: task.latestSummary,
    latestError: task.latestError,
    rawPrompt: getPromptFromContext(contextEntries),
    fieldValues,
    contextEntries,
    questions,
    relations,
  };
}

async function recordTaskVersion(
  ctx: MutationCtx,
  args: {
    taskId: Id<"tasks">;
    createdByUserId?: Id<"users">;
    createdByRunId?: Id<"runs">;
    sourceType:
      | "create"
      | "manual_edit"
      | "proposal_apply"
      | "run_completion"
      | "question_answered";
    sourceId?: string;
    summary?: string;
  },
) {
  const snapshot = await buildTaskSnapshot(ctx, args.taskId);
  const versionId = await ctx.db.insert("taskVersions", {
    taskId: args.taskId,
    createdByUserId: args.createdByUserId,
    createdByRunId: args.createdByRunId,
    sourceType: args.sourceType,
    sourceId: args.sourceId,
    summary: args.summary,
    snapshot,
  });

  await ctx.db.patch(args.taskId, {
    latestVersionId: versionId,
  });

  return versionId;
}

async function resolveFieldDefinitionByKey(
  ctx: ReaderCtx,
  workspaceId: Id<"workspaces">,
  key: string,
) {
  return await ctx.db
    .query("taskFieldDefinitions")
    .withIndex("by_workspace_and_key", (query) =>
      query.eq("workspaceId", workspaceId).eq("key", key),
    )
    .unique();
}

async function upsertFieldValue(
  ctx: MutationCtx,
  args: {
    taskId: Id<"tasks">;
    workspaceId: Id<"workspaces">;
    fieldKey: string;
    value: unknown;
    updatedByUserId?: Id<"users">;
    updatedByRunId?: Id<"runs">;
    appliedFromProposalItemId?: Id<"taskProposalItems">;
  },
) {
  const definition = await resolveFieldDefinitionByKey(ctx, args.workspaceId, args.fieldKey);
  if (!definition) {
    throw new ConvexError({
      code: "NOT_FOUND",
      message: `Task field definition '${args.fieldKey}' does not exist.`,
    });
  }

  const existing = await ctx.db
    .query("taskFieldValues")
    .withIndex("by_task_and_field_definition_id", (query) =>
      query.eq("taskId", args.taskId).eq("fieldDefinitionId", definition._id),
    )
    .unique();

  if (existing) {
    await ctx.db.patch(existing._id, {
      value: args.value,
      updatedByUserId: args.updatedByUserId,
      updatedByRunId: args.updatedByRunId,
      appliedFromProposalItemId: args.appliedFromProposalItemId,
    });
    return existing._id;
  }

  return await ctx.db.insert("taskFieldValues", {
    taskId: args.taskId,
    fieldDefinitionId: definition._id,
    value: args.value,
    updatedByUserId: args.updatedByUserId,
    updatedByRunId: args.updatedByRunId,
    appliedFromProposalItemId: args.appliedFromProposalItemId,
  });
}

export const list = query({
  args: {
    workosUserId: v.string(),
    workspaceId: v.id("workspaces"),
  },
  returns: v.any(),
  handler: async (ctx, args) => {
    await requireWorkspaceMembership({
      ctx,
      workspaceId: args.workspaceId,
      workosUserId: args.workosUserId,
    });

    const [tasks, repositories] = await Promise.all([
      ctx.db
        .query("tasks")
        .withIndex("by_workspace", (query) => query.eq("workspaceId", args.workspaceId))
        .order("desc")
        .collect(),
      ctx.db
        .query("repositories")
        .withIndex("by_workspace", (query) => query.eq("workspaceId", args.workspaceId))
        .collect(),
    ]);

    const repositoryNames = new Map(
      repositories.map((repository) => [repository._id, repository.fullName] as const),
    );

    return await Promise.all(
      tasks.map(async (task) => {
        const [contextEntries, pendingProposals] = await Promise.all([
          loadTaskContextEntries(ctx, task._id),
          ctx.db
            .query("taskProposals")
            .withIndex("by_task", (query) => query.eq("taskId", task._id))
            .collect(),
        ]);

        return {
          taskId: task._id,
          repositoryId: task.primaryRepositoryId,
          repositoryFullName: task.primaryRepositoryId
            ? (repositoryNames.get(task.primaryRepositoryId) ?? "Unknown repository")
            : "No repository",
          branch: task.branch,
          title: task.title,
          taskKind: task.taskKind,
          status: task.status,
          phase: task.phase,
          createdAt: task._creationTime,
          latestSummary: task.latestSummary,
          latestError: task.latestError,
          completedAt: task.completedAt,
          rawPrompt: getPromptFromContext(contextEntries),
          pendingProposalCount: pendingProposals.filter((proposal) => proposal.status === "pending")
            .length,
          parentTaskId: task.parentTaskId,
        };
      }),
    );
  },
});

export const listForWorkspace = list;

export const get = query({
  args: {
    workosUserId: v.string(),
    taskId: v.id("tasks"),
  },
  returns: v.any(),
  handler: async (ctx, args) => {
    const task = await ctx.db.get(args.taskId);
    if (!task) {
      return null;
    }

    await requireWorkspaceMembership({
      ctx,
      workspaceId: task.workspaceId,
      workosUserId: args.workosUserId,
    });

    const [
      repository,
      fieldValues,
      contextEntries,
      questions,
      discussions,
      relations,
      versions,
      proposals,
      runs,
    ] = await Promise.all([
      loadTaskRepository(ctx, task.primaryRepositoryId),
      loadTaskFieldState(ctx, task),
      loadTaskContextEntries(ctx, task._id),
      loadTaskQuestions(ctx, task._id),
      loadTaskDiscussions(ctx, task._id),
      loadTaskRelations(ctx, task),
      loadTaskVersions(ctx, task._id),
      loadTaskProposals(ctx, task._id),
      loadTaskRuns(ctx, task._id),
    ]);

    return {
      taskId: task._id,
      workspaceId: task.workspaceId,
      repositoryId: task.primaryRepositoryId,
      repositoryFullName: repository?.fullName ?? "No repository",
      branch: task.branch,
      title: task.title,
      rawPrompt: getPromptFromContext(contextEntries),
      taskKind: task.taskKind,
      status: task.status,
      phase: task.phase,
      createdAt: task._creationTime,
      latestSummary: task.latestSummary,
      latestError: task.latestError,
      activeRunId: task.activeRunId,
      latestVersionId: task.latestVersionId,
      parentTaskId: task.parentTaskId,
      completedAt: task.completedAt,
      plan: findFieldValue(fieldValues, "implementation_plan"),
      acceptanceCriteria: findFieldValue(fieldValues, "acceptance_criteria"),
      suggestedFiles: findFieldValue(fieldValues, "suggested_files"),
      fieldValues,
      contextEntries,
      questions,
      discussions,
      relations,
      versions,
      proposals,
      runs,
    };
  },
});

export const getHistory = query({
  args: {
    workosUserId: v.string(),
    taskId: v.id("tasks"),
  },
  returns: v.any(),
  handler: async (ctx, args) => {
    const task = assertTruthy(await ctx.db.get(args.taskId), "Task not found.");
    await requireWorkspaceMembership({
      ctx,
      workspaceId: task.workspaceId,
      workosUserId: args.workosUserId,
    });

    return await loadTaskVersions(ctx, task._id);
  },
});

export const create = mutation({
  args: {
    workosUserId: v.string(),
    workspaceId: v.id("workspaces"),
    repositoryId: v.optional(v.id("repositories")),
    branch: v.optional(v.string()),
    prompt: v.string(),
    title: v.optional(v.string()),
    taskKind: v.optional(taskKindValidator),
    parentTaskId: v.optional(v.id("tasks")),
  },
  returns: v.id("tasks"),
  handler: async (ctx, args) => {
    const { user } = await requireWorkspaceMembership({
      ctx,
      workspaceId: args.workspaceId,
      workosUserId: args.workosUserId,
    });

    if (args.repositoryId) {
      const repository = await ctx.db.get(args.repositoryId);
      if (!repository || repository.workspaceId !== args.workspaceId) {
        throw new ConvexError({
          code: "NOT_FOUND",
          message: "Repository not found in this workspace.",
        });
      }
    }

    if (args.parentTaskId) {
      const parentTask = await ctx.db.get(args.parentTaskId);
      if (!parentTask || parentTask.workspaceId !== args.workspaceId) {
        throw new ConvexError({
          code: "NOT_FOUND",
          message: "Parent task not found in this workspace.",
        });
      }
    }

    const prompt = args.prompt.trim();
    if (!prompt) {
      throw new ConvexError({
        code: "INVALID_ARGUMENT",
        message: "Task prompt is required.",
      });
    }

    await ensureDefaultFieldDefinitions(ctx, args.workspaceId);

    const taskId = await ctx.db.insert("tasks", {
      workspaceId: args.workspaceId,
      primaryRepositoryId: args.repositoryId,
      branch: args.branch?.trim() || undefined,
      taskKind: args.taskKind ?? "general",
      title: args.title?.trim() || prompt,
      status: "draft",
      phase: "intake",
      parentTaskId: args.parentTaskId,
      createdByUserId: user._id,
    });

    await ctx.db.insert("taskContextEntries", {
      taskId,
      kind: "intake_prompt",
      body: prompt,
      createdByUserId: user._id,
      archived: false,
    });

    if (args.parentTaskId) {
      await ctx.db.insert("taskRelations", {
        taskId: args.parentTaskId,
        relatedTaskId: taskId,
        relationType: "parent_child",
        createdByUserId: user._id,
      });
    }

    await recordTaskVersion(ctx, {
      taskId,
      createdByUserId: user._id,
      sourceType: "create",
      summary: "Task created.",
    });

    return taskId;
  },
});

export const updateCore = mutation({
  args: {
    workosUserId: v.string(),
    taskId: v.id("tasks"),
    title: v.optional(v.string()),
    taskKind: v.optional(taskKindValidator),
    status: v.optional(taskStatusValidator),
    phase: v.optional(taskPhaseValidator),
    branch: v.optional(v.union(v.string(), v.null())),
    repositoryId: v.optional(v.union(v.id("repositories"), v.null())),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const task = assertTruthy(await ctx.db.get(args.taskId), "Task not found.");
    const { user } = await requireWorkspaceMembership({
      ctx,
      workspaceId: task.workspaceId,
      workosUserId: args.workosUserId,
    });

    if (args.repositoryId !== undefined && args.repositoryId !== null) {
      const repository = await ctx.db.get(args.repositoryId);
      if (!repository || repository.workspaceId !== task.workspaceId) {
        throw new ConvexError({
          code: "NOT_FOUND",
          message: "Repository not found in this workspace.",
        });
      }
    }

    await ctx.db.patch(task._id, {
      title: args.title?.trim() || task.title,
      taskKind: args.taskKind ?? task.taskKind,
      status: args.status ?? task.status,
      phase: args.phase ?? task.phase,
      branch:
        args.branch === undefined
          ? task.branch
          : args.branch === null
            ? undefined
            : args.branch.trim(),
      primaryRepositoryId:
        args.repositoryId === undefined
          ? task.primaryRepositoryId
          : (args.repositoryId ?? undefined),
    });

    await recordTaskVersion(ctx, {
      taskId: task._id,
      createdByUserId: user._id,
      sourceType: "manual_edit",
      summary: "Core task fields updated.",
    });

    return null;
  },
});

export const upsertFieldDefinition = mutation({
  args: {
    workosUserId: v.string(),
    workspaceId: v.id("workspaces"),
    definition: fieldDefinitionInputValidator,
  },
  returns: v.id("taskFieldDefinitions"),
  handler: async (ctx, args) => {
    await requireWorkspaceMembership({
      ctx,
      workspaceId: args.workspaceId,
      workosUserId: args.workosUserId,
      minimumRole: "admin",
    });

    const existing = await resolveFieldDefinitionByKey(ctx, args.workspaceId, args.definition.key);
    if (existing) {
      await ctx.db.patch(existing._id, {
        ...args.definition,
        archived: false,
      });
      return existing._id;
    }

    return await ctx.db.insert("taskFieldDefinitions", {
      workspaceId: args.workspaceId,
      ...args.definition,
      archived: false,
    });
  },
});

export const setFieldValue = mutation({
  args: {
    workosUserId: v.string(),
    taskId: v.id("tasks"),
    fieldKey: v.string(),
    value: v.any(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const task = assertTruthy(await ctx.db.get(args.taskId), "Task not found.");
    const { user } = await requireWorkspaceMembership({
      ctx,
      workspaceId: task.workspaceId,
      workosUserId: args.workosUserId,
    });

    await upsertFieldValue(ctx, {
      taskId: task._id,
      workspaceId: task.workspaceId,
      fieldKey: args.fieldKey,
      value: args.value,
      updatedByUserId: user._id,
    });

    await recordTaskVersion(ctx, {
      taskId: task._id,
      createdByUserId: user._id,
      sourceType: "manual_edit",
      summary: `Field '${args.fieldKey}' updated.`,
    });

    return null;
  },
});

export const addContextEntry = mutation({
  args: {
    workosUserId: v.string(),
    taskId: v.id("tasks"),
    entry: contextEntryInputValidator,
  },
  returns: v.id("taskContextEntries"),
  handler: async (ctx, args) => {
    const task = assertTruthy(await ctx.db.get(args.taskId), "Task not found.");
    const { user } = await requireWorkspaceMembership({
      ctx,
      workspaceId: task.workspaceId,
      workosUserId: args.workosUserId,
    });

    const contextEntryId = await ctx.db.insert("taskContextEntries", {
      taskId: task._id,
      ...args.entry,
      createdByUserId: user._id,
      archived: false,
    });

    await recordTaskVersion(ctx, {
      taskId: task._id,
      createdByUserId: user._id,
      sourceType: "manual_edit",
      summary: `Context entry '${args.entry.kind}' added.`,
    });

    return contextEntryId;
  },
});

export const addDiscussionMessage = mutation({
  args: {
    workosUserId: v.string(),
    taskId: v.id("tasks"),
    body: v.string(),
    triggerRereview: v.optional(v.boolean()),
  },
  returns: v.id("taskDiscussions"),
  handler: async (ctx, args) => {
    const task = assertTruthy(await ctx.db.get(args.taskId), "Task not found.");
    const { user } = await requireWorkspaceMembership({
      ctx,
      workspaceId: task.workspaceId,
      workosUserId: args.workosUserId,
    });

    return await ctx.db.insert("taskDiscussions", {
      taskId: task._id,
      authorType: "user",
      authorUserId: user._id,
      body: args.body.trim(),
      triggerRereview: args.triggerRereview ?? false,
    });
  },
});

export const requestRereview = mutation({
  args: {
    workosUserId: v.string(),
    taskId: v.id("tasks"),
    body: v.string(),
  },
  returns: v.id("runs"),
  handler: async (ctx, args) => {
    const discussionId = await ctx.runMutation(internal.tasks.addDiscussionMessageInternal, {
      workosUserId: args.workosUserId,
      taskId: args.taskId,
      body: args.body,
      triggerRereview: true,
    });

    void discussionId;

    const runId: Id<"runs"> = await ctx.runMutation(internal.runs.requestTaskRun, {
      workosUserId: args.workosUserId,
      taskId: args.taskId,
      runKind: "discussion_rereview",
    });

    return runId;
  },
});

export const answerQuestion = mutation({
  args: {
    workosUserId: v.string(),
    questionId: v.id("taskQuestions"),
    answer: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const question = assertTruthy(await ctx.db.get(args.questionId), "Question not found.");
    const task = assertTruthy(await ctx.db.get(question.taskId), "Task not found.");
    const { user } = await requireWorkspaceMembership({
      ctx,
      workspaceId: task.workspaceId,
      workosUserId: args.workosUserId,
    });

    await ctx.db.patch(question._id, {
      answer: args.answer.trim(),
      answeredAt: Date.now(),
      answeredByUserId: user._id,
      answerSource: "human",
      status: "answered",
    });

    const pendingQuestions = await ctx.db
      .query("taskQuestions")
      .withIndex("by_task_and_status", (query) =>
        query.eq("taskId", task._id).eq("status", "pending"),
      )
      .collect();

    if (pendingQuestions.length === 0 && task.status === "awaiting_clarification") {
      await ctx.db.patch(task._id, {
        status: "ready",
        phase: "planning",
        latestSummary: "All clarification questions have been answered.",
        latestError: undefined,
      });
    }

    await recordTaskVersion(ctx, {
      taskId: task._id,
      createdByUserId: user._id,
      sourceType: "question_answered",
      sourceId: String(question._id),
      summary: "Clarification question answered.",
    });

    return null;
  },
});

export const dismissQuestion = mutation({
  args: {
    workosUserId: v.string(),
    questionId: v.id("taskQuestions"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const question = assertTruthy(await ctx.db.get(args.questionId), "Question not found.");
    const task = assertTruthy(await ctx.db.get(question.taskId), "Task not found.");
    await requireWorkspaceMembership({
      ctx,
      workspaceId: task.workspaceId,
      workosUserId: args.workosUserId,
    });

    await ctx.db.patch(question._id, {
      status: "dismissed",
      answeredAt: Date.now(),
      answerSource: "dismissed",
    });

    return null;
  },
});

export const requestPlanning = mutation({
  args: {
    workosUserId: v.string(),
    taskId: v.id("tasks"),
  },
  returns: v.id("runs"),
  handler: async (ctx, args): Promise<Id<"runs">> => {
    return await ctx.runMutation(internal.runs.requestTaskRun, {
      workosUserId: args.workosUserId,
      taskId: args.taskId,
      runKind: "repo_analysis",
    });
  },
});

export const startExecution = mutation({
  args: {
    workosUserId: v.string(),
    taskId: v.id("tasks"),
  },
  returns: v.id("runs"),
  handler: async (ctx, args): Promise<Id<"runs">> => {
    return await ctx.runMutation(internal.runs.requestTaskRun, {
      workosUserId: args.workosUserId,
      taskId: args.taskId,
      runKind: "repo_execution",
    });
  },
});

export const addDiscussionMessageInternal = internalMutation({
  args: {
    workosUserId: v.string(),
    taskId: v.id("tasks"),
    body: v.string(),
    triggerRereview: v.boolean(),
  },
  returns: v.id("taskDiscussions"),
  handler: async (ctx, args) => {
    const task = assertTruthy(await ctx.db.get(args.taskId), "Task not found.");
    const { user } = await requireWorkspaceMembership({
      ctx,
      workspaceId: task.workspaceId,
      workosUserId: args.workosUserId,
    });

    return await ctx.db.insert("taskDiscussions", {
      taskId: task._id,
      authorType: "user",
      authorUserId: user._id,
      body: args.body.trim(),
      triggerRereview: args.triggerRereview,
    });
  },
});

export const getAutomationContext = internalQuery({
  args: {
    taskId: v.id("tasks"),
  },
  returns: v.any(),
  handler: async (ctx, args) => {
    return await buildTaskSnapshot(ctx, args.taskId);
  },
});

export const createQuestionFromRun = internalMutation({
  args: {
    taskId: v.id("tasks"),
    runId: v.optional(v.id("runs")),
    key: v.string(),
    question: v.string(),
    source: questionSourceValidator,
  },
  returns: v.id("taskQuestions"),
  handler: async (ctx, args) => {
    const task = assertTruthy(await ctx.db.get(args.taskId), "Task not found.");
    await ctx.db.patch(task._id, {
      status: "awaiting_clarification",
      phase: "clarification",
    });

    return await ctx.db.insert("taskQuestions", {
      taskId: task._id,
      key: args.key,
      question: args.question,
      status: "pending",
      source: args.source,
      createdByRunId: args.runId,
    });
  },
});

export const applyFieldValueFromProposal = internalMutation({
  args: {
    taskId: v.id("tasks"),
    proposalItemId: v.id("taskProposalItems"),
    fieldKey: v.string(),
    value: v.any(),
    runId: v.optional(v.id("runs")),
    userId: v.optional(v.id("users")),
  },
  returns: v.id("taskFieldValues"),
  handler: async (ctx, args) => {
    const task = assertTruthy(await ctx.db.get(args.taskId), "Task not found.");
    return await upsertFieldValue(ctx, {
      taskId: task._id,
      workspaceId: task.workspaceId,
      fieldKey: args.fieldKey,
      value: args.value,
      updatedByUserId: args.userId,
      updatedByRunId: args.runId,
      appliedFromProposalItemId: args.proposalItemId,
    });
  },
});

export const addContextFromProposal = internalMutation({
  args: {
    taskId: v.id("tasks"),
    body: v.string(),
    kind: v.string(),
    title: v.optional(v.string()),
    metadata: v.optional(v.any()),
    runId: v.optional(v.id("runs")),
    userId: v.optional(v.id("users")),
  },
  returns: v.id("taskContextEntries"),
  handler: async (ctx, args) => {
    assertTruthy(await ctx.db.get(args.taskId), "Task not found.");
    return await ctx.db.insert("taskContextEntries", {
      taskId: args.taskId,
      kind: args.kind,
      title: args.title,
      body: args.body,
      metadata: args.metadata,
      createdByUserId: args.userId,
      createdByRunId: args.runId,
      archived: false,
    });
  },
});

export const addRelationFromProposal = internalMutation({
  args: {
    taskId: v.id("tasks"),
    relatedTaskId: v.id("tasks"),
    relationType: relationTypeValidator,
    runId: v.optional(v.id("runs")),
    userId: v.optional(v.id("users")),
  },
  returns: v.id("taskRelations"),
  handler: async (ctx, args) => {
    return await ctx.db.insert("taskRelations", {
      taskId: args.taskId,
      relatedTaskId: args.relatedTaskId,
      relationType: args.relationType,
      createdByUserId: args.userId,
      createdByRunId: args.runId,
    });
  },
});

export const createChildTaskFromProposal = internalMutation({
  args: {
    parentTaskId: v.id("tasks"),
    title: v.string(),
    prompt: v.string(),
    taskKind: taskKindValidator,
    branch: v.optional(v.string()),
    runId: v.optional(v.id("runs")),
    userId: v.optional(v.id("users")),
  },
  returns: v.id("tasks"),
  handler: async (ctx, args) => {
    const parentTask = assertTruthy(await ctx.db.get(args.parentTaskId), "Parent task not found.");
    await ensureDefaultFieldDefinitions(ctx, parentTask.workspaceId);

    const taskId = await ctx.db.insert("tasks", {
      workspaceId: parentTask.workspaceId,
      primaryRepositoryId: parentTask.primaryRepositoryId,
      branch: args.branch ?? parentTask.branch,
      taskKind: args.taskKind,
      title: args.title,
      status: "draft",
      phase: "intake",
      parentTaskId: parentTask._id,
      createdByUserId: args.userId ?? parentTask.createdByUserId,
    });

    await ctx.db.insert("taskContextEntries", {
      taskId,
      kind: "intake_prompt",
      body: args.prompt,
      createdByUserId: args.userId,
      createdByRunId: args.runId,
      archived: false,
    });

    await ctx.db.insert("taskRelations", {
      taskId: parentTask._id,
      relatedTaskId: taskId,
      relationType: "parent_child",
      createdByUserId: args.userId,
      createdByRunId: args.runId,
    });

    await recordTaskVersion(ctx, {
      taskId,
      createdByUserId: args.userId,
      createdByRunId: args.runId,
      sourceType: "proposal_apply",
      sourceId: args.runId ? String(args.runId) : undefined,
      summary: "Child task created from accepted proposal.",
    });

    return taskId;
  },
});

export const patchTaskFromExecution = internalMutation({
  args: {
    taskId: v.id("tasks"),
    runId: v.id("runs"),
    status: taskStatusValidator,
    phase: taskPhaseValidator,
    summary: v.optional(v.string()),
    error: v.optional(v.string()),
    completedAt: v.optional(v.number()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    assertTruthy(await ctx.db.get(args.taskId), "Task not found.");
    await ctx.db.patch(args.taskId, {
      activeRunId: undefined,
      status: args.status,
      phase: args.phase,
      latestSummary: args.summary,
      latestError: args.error,
      completedAt: args.completedAt,
    });

    await recordTaskVersion(ctx, {
      taskId: args.taskId,
      createdByRunId: args.runId,
      sourceType: "run_completion",
      sourceId: String(args.runId),
      summary: args.summary,
    });

    return null;
  },
});

export const recordVersionAfterProposal = internalMutation({
  args: {
    taskId: v.id("tasks"),
    proposalId: v.id("taskProposals"),
    runId: v.optional(v.id("runs")),
    userId: v.optional(v.id("users")),
    summary: v.optional(v.string()),
  },
  returns: v.id("taskVersions"),
  handler: async (ctx, args) => {
    return await recordTaskVersion(ctx, {
      taskId: args.taskId,
      createdByUserId: args.userId,
      createdByRunId: args.runId,
      sourceType: "proposal_apply",
      sourceId: String(args.proposalId),
      summary: args.summary,
    });
  },
});

import { ConvexError, v } from "convex/values";

import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import { internalMutation, internalQuery, mutation, query } from "./_generated/server";
import { requireWorkspaceMembership } from "./lib/auth";

const workflowKindValidator = v.union(
  v.literal("context_enrichment"),
  v.literal("task_breakdown"),
  v.literal("discussion_rereview"),
  v.literal("repo_analysis"),
  v.literal("repo_execution"),
  v.literal("repository_sync"),
  v.literal("repository_explore"),
);

const runStatusValidator = v.union(
  v.literal("queued"),
  v.literal("requested"),
  v.literal("launching"),
  v.literal("running"),
  v.literal("succeeded"),
  v.literal("failed"),
  v.literal("cancelled"),
  v.literal("timed_out"),
);

function isTerminal(status: Doc<"runs">["status"]) {
  return (
    status === "succeeded" ||
    status === "failed" ||
    status === "cancelled" ||
    status === "timed_out"
  );
}

function assertTaskExecutionReady(
  task: Doc<"tasks">,
  pendingQuestions: Array<Doc<"taskQuestions">>,
) {
  if (task.status === "cancelled" || task.status === "completed") {
    throw new ConvexError({
      code: "INVALID_STATE",
      message: "This task can no longer execute.",
    });
  }

  if (pendingQuestions.length > 0) {
    throw new ConvexError({
      code: "TASK_REQUIRES_CLARIFICATION",
      message: "Answer or dismiss all pending questions before execution.",
    });
  }
}

export const listForTask = query({
  args: {
    workosUserId: v.string(),
    taskId: v.id("tasks"),
  },
  returns: v.any(),
  handler: async (ctx, args) => {
    const task = await ctx.db.get(args.taskId);
    if (!task) {
      return [];
    }

    await requireWorkspaceMembership({
      ctx,
      workspaceId: task.workspaceId,
      workosUserId: args.workosUserId,
    });

    return await ctx.db
      .query("runs")
      .withIndex("by_target_task_id", (query) => query.eq("targetTaskId", args.taskId))
      .order("desc")
      .collect();
  },
});

export const listForWorkspace = query({
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

    return await ctx.db
      .query("runs")
      .withIndex("by_workspace", (query) => query.eq("workspaceId", args.workspaceId))
      .order("desc")
      .collect();
  },
});

export const get = query({
  args: {
    workosUserId: v.string(),
    runId: v.id("runs"),
  },
  returns: v.any(),
  handler: async (ctx, args) => {
    const run = await ctx.db.get(args.runId);
    if (!run) {
      return null;
    }

    await requireWorkspaceMembership({
      ctx,
      workspaceId: run.workspaceId,
      workosUserId: args.workosUserId,
    });

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
      ...run,
      events: events.sort((left, right) => left.sequence - right.sequence),
      artifacts,
      usage,
    };
  },
});

export const requestRepositoryRun = mutation({
  args: {
    workosUserId: v.string(),
    workspaceId: v.id("workspaces"),
    repositoryId: v.id("repositories"),
    branch: v.string(),
    runKind: workflowKindValidator,
  },
  returns: v.id("runs"),
  handler: async (ctx, args): Promise<Id<"runs">> => {
    return await ctx.runMutation(internal.runs.requestRepositoryRunInternal, args);
  },
});

export const requestTaskRun = internalMutation({
  args: {
    workosUserId: v.string(),
    taskId: v.id("tasks"),
    runKind: workflowKindValidator,
  },
  returns: v.id("runs"),
  handler: async (ctx, args): Promise<Id<"runs">> => {
    const task = await ctx.db.get(args.taskId);
    if (!task) {
      throw new ConvexError({
        code: "NOT_FOUND",
        message: "Task not found.",
      });
    }

    const { user } = await requireWorkspaceMembership({
      ctx,
      workspaceId: task.workspaceId,
      workosUserId: args.workosUserId,
    });

    const existingActiveRun =
      task.activeRunId !== undefined ? await ctx.db.get(task.activeRunId) : null;
    if (existingActiveRun && !isTerminal(existingActiveRun.status)) {
      return existingActiveRun._id;
    }

    if (args.runKind === "repo_execution") {
      const pendingQuestions = await ctx.db
        .query("taskQuestions")
        .withIndex("by_task_and_status", (query) =>
          query.eq("taskId", task._id).eq("status", "pending"),
        )
        .collect();
      assertTaskExecutionReady(task, pendingQuestions);
    }

    const reservation: {
      reservationId: Id<"workspaceAiReservations">;
      policyId: Id<"workspaceAiPolicies">;
      usagePeriodId: Id<"workspaceAiUsagePeriods">;
      periodKey: string;
      reservedTokens: number;
    } = await ctx.runMutation(internal.usage.reserveBudget, {
      workspaceId: task.workspaceId,
      requestedByUserId: user._id,
      reason: `run:${args.runKind}`,
    });

    const runId: Id<"runs"> = await ctx.db.insert("runs", {
      workspaceId: task.workspaceId,
      targetType: "task",
      targetTaskId: task._id,
      targetRepositoryId: task.primaryRepositoryId,
      branch: task.branch,
      runKind: args.runKind,
      status: "requested",
      requestedByUserId: user._id,
      reservationId: reservation.reservationId,
      provider: "openrouter",
      model: "openai/gpt-5.4-nano",
      promptTemplateVersion: "planner-first-v1",
      toolsetVersion: "planner-first-v1",
      effectWorkflowKey: args.runKind,
    });

    await ctx.runMutation(internal.usage.attachReservationToRun, {
      reservationId: reservation.reservationId,
      runId,
    });

    await ctx.db.patch(task._id, {
      activeRunId: runId,
      status: args.runKind === "repo_execution" ? "in_progress" : "in_review",
      phase: args.runKind === "repo_execution" ? "execution" : "planning",
      latestError: undefined,
    });

    await ctx.scheduler.runAfter(0, internal.orchestration.dispatchRun, {
      runId,
    });

    return runId;
  },
});

export const requestRepositoryRunInternal = internalMutation({
  args: {
    workosUserId: v.string(),
    workspaceId: v.id("workspaces"),
    repositoryId: v.id("repositories"),
    branch: v.string(),
    runKind: workflowKindValidator,
  },
  returns: v.id("runs"),
  handler: async (ctx, args): Promise<Id<"runs">> => {
    const { user } = await requireWorkspaceMembership({
      ctx,
      workspaceId: args.workspaceId,
      workosUserId: args.workosUserId,
    });

    const repository = await ctx.db.get(args.repositoryId);
    if (!repository || repository.workspaceId !== args.workspaceId) {
      throw new ConvexError({
        code: "NOT_FOUND",
        message: "Repository not found in this workspace.",
      });
    }

    const reservation: {
      reservationId: Id<"workspaceAiReservations">;
      policyId: Id<"workspaceAiPolicies">;
      usagePeriodId: Id<"workspaceAiUsagePeriods">;
      periodKey: string;
      reservedTokens: number;
    } = await ctx.runMutation(internal.usage.reserveBudget, {
      workspaceId: args.workspaceId,
      requestedByUserId: user._id,
      reason: `run:${args.runKind}`,
    });

    const runId: Id<"runs"> = await ctx.db.insert("runs", {
      workspaceId: args.workspaceId,
      targetType: "repository",
      targetRepositoryId: repository._id,
      branch: args.branch.trim(),
      runKind: args.runKind,
      status: "requested",
      requestedByUserId: user._id,
      reservationId: reservation.reservationId,
      provider: "openrouter",
      model: "openai/gpt-5.4-nano",
      promptTemplateVersion: "planner-first-v1",
      toolsetVersion: "planner-first-v1",
      effectWorkflowKey: args.runKind,
    });

    await ctx.runMutation(internal.usage.attachReservationToRun, {
      reservationId: reservation.reservationId,
      runId,
    });

    await ctx.scheduler.runAfter(0, internal.orchestration.dispatchRun, {
      runId,
    });

    return runId;
  },
});

export const transitionStatus = internalMutation({
  args: {
    runId: v.id("runs"),
    status: runStatusValidator,
    summary: v.optional(v.string()),
    error: v.optional(v.string()),
    externalJobId: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const run = await ctx.db.get(args.runId);
    if (!run) {
      throw new ConvexError({
        code: "NOT_FOUND",
        message: "Run not found.",
      });
    }

    await ctx.db.patch(run._id, {
      status: args.status,
      summary: args.summary ?? run.summary,
      error: args.error ?? run.error,
      externalJobId: args.externalJobId ?? run.externalJobId,
      startedAt: run.startedAt ?? (args.status === "running" ? Date.now() : undefined),
      completedAt: isTerminal(args.status) ? Date.now() : run.completedAt,
    });

    return null;
  },
});

export const getDispatchContext = internalQuery({
  args: {
    runId: v.id("runs"),
  },
  returns: v.any(),
  handler: async (ctx, args) => {
    const run = await ctx.db.get(args.runId);
    if (!run) {
      throw new ConvexError({
        code: "NOT_FOUND",
        message: "Run not found.",
      });
    }

    const repository =
      run.targetRepositoryId !== undefined ? await ctx.db.get(run.targetRepositoryId) : null;

    return {
      ...run,
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
    };
  },
});

export const persistWorkerResult = internalMutation({
  args: {
    runId: v.id("runs"),
    status: runStatusValidator,
    summary: v.optional(v.string()),
    error: v.optional(v.string()),
    events: v.optional(
      v.array(
        v.object({
          type: v.string(),
          sequence: v.number(),
          payload: v.any(),
          timestamp: v.number(),
        }),
      ),
    ),
    artifacts: v.optional(
      v.array(
        v.object({
          kind: v.string(),
          key: v.string(),
          label: v.optional(v.string()),
          contentType: v.optional(v.string()),
          url: v.optional(v.string()),
          metadata: v.optional(v.any()),
        }),
      ),
    ),
    usage: v.optional(
      v.object({
        provider: v.string(),
        model: v.string(),
        inputTokens: v.number(),
        outputTokens: v.number(),
        totalTokens: v.number(),
        estimatedCostUsd: v.optional(v.number()),
      }),
    ),
    proposal: v.optional(
      v.object({
        workflowKind: workflowKindValidator,
        summary: v.optional(v.string()),
        rationale: v.optional(v.string()),
        items: v.array(
          v.object({
            itemType: v.union(
              v.literal("core_patch"),
              v.literal("field_value"),
              v.literal("context_entry"),
              v.literal("question"),
              v.literal("child_task"),
              v.literal("relation"),
            ),
            action: v.union(
              v.literal("set"),
              v.literal("add"),
              v.literal("remove"),
              v.literal("create"),
            ),
            label: v.optional(v.string()),
            fieldKey: v.optional(v.string()),
            payload: v.any(),
          }),
        ),
      }),
    ),
    execution: v.optional(
      v.object({
        status: v.union(v.literal("completed"), v.literal("failed")),
        summary: v.optional(v.string()),
        error: v.optional(v.string()),
      }),
    ),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const run = await ctx.db.get(args.runId);
    if (!run) {
      throw new ConvexError({
        code: "NOT_FOUND",
        message: "Run not found.",
      });
    }

    if (args.events?.length) {
      await Promise.all(
        args.events.map((event) =>
          ctx.db.insert("runEvents", {
            runId: run._id,
            sequence: event.sequence,
            timestamp: event.timestamp,
            type: event.type,
            payload: event.payload,
          }),
        ),
      );
    }

    if (args.artifacts?.length) {
      await Promise.all(
        args.artifacts.map((artifact) =>
          ctx.db.insert("runArtifacts", {
            runId: run._id,
            kind: artifact.kind,
            key: artifact.key,
            label: artifact.label,
            contentType: artifact.contentType,
            url: artifact.url,
            metadata: artifact.metadata,
          }),
        ),
      );
    }

    await ctx.db.patch(run._id, {
      status: args.status,
      summary: args.summary ?? run.summary,
      error: args.error,
      startedAt: run.startedAt ?? Date.now(),
      completedAt: isTerminal(args.status) ? Date.now() : run.completedAt,
    });

    if (run.reservationId) {
      if (args.usage) {
        await ctx.runMutation(internal.usage.consumeReservation, {
          reservationId: run.reservationId,
          runId: run._id,
          workspaceId: run.workspaceId,
          provider: args.usage.provider,
          model: args.usage.model,
          inputTokens: args.usage.inputTokens,
          outputTokens: args.usage.outputTokens,
          totalTokens: args.usage.totalTokens,
          estimatedCostUsd: args.usage.estimatedCostUsd,
        });
      } else {
        await ctx.runMutation(internal.usage.releaseReservation, {
          reservationId: run.reservationId,
        });
      }
    }

    if (run.targetType === "task" && run.targetTaskId) {
      if (args.proposal) {
        await ctx.runMutation(internal.proposals.createFromRun, {
          taskId: run.targetTaskId,
          runId: run._id,
          workflowKind: args.proposal.workflowKind,
          summary: args.proposal.summary,
          rationale: args.proposal.rationale,
          items: args.proposal.items,
        });

        await ctx.db.patch(run.targetTaskId, {
          activeRunId: undefined,
          latestSummary: args.proposal.summary ?? args.summary,
          latestError: undefined,
          status: "in_review",
          phase: "planning",
        });
      } else if (run.runKind === "repo_execution") {
        await ctx.runMutation(internal.tasks.patchTaskFromExecution, {
          taskId: run.targetTaskId,
          runId: run._id,
          status: args.execution?.status === "completed" ? "completed" : "failed",
          phase: "delivery",
          summary: args.execution?.summary ?? args.summary,
          error: args.execution?.error ?? args.error,
          completedAt: args.execution?.status === "completed" ? Date.now() : undefined,
        });
      } else {
        await ctx.db.patch(run.targetTaskId, {
          activeRunId: undefined,
          latestSummary: args.summary,
          latestError: args.error,
        });
      }
    }

    return null;
  },
});

import { ConvexError, v } from "convex/values";

import { internal } from "./_generated/api";
import {
  internalMutation,
  internalQuery,
  mutation,
  query,
  type MutationCtx,
} from "./_generated/server";
import type { Doc } from "./_generated/dataModel";
import { requireWorkspaceMembership } from "./lib/auth";

const taskStatusValidator = v.union(
  v.literal("drafting"),
  v.literal("awaiting_clarification"),
  v.literal("ready"),
  v.literal("executing"),
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

const taskRunKindValidator = v.union(
  v.literal("planning"),
  v.literal("clarification"),
  v.literal("execution"),
);

const taskQuestionStatusValidator = v.union(
  v.literal("pending"),
  v.literal("answered"),
  v.literal("dismissed"),
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

const suggestedFileValidator = v.object({
  path: v.string(),
  reason: v.optional(v.string()),
});

const questionInputValidator = v.object({
  key: v.string(),
  question: v.string(),
});

const draftInputValidator = v.object({
  title: v.string(),
  normalizedPrompt: v.string(),
  plan: v.string(),
  acceptanceCriteria: v.array(v.string()),
  suggestedFiles: v.array(suggestedFileValidator),
});

const questionRecordValidator = v.object({
  questionId: v.id("taskQuestions"),
  key: v.string(),
  question: v.string(),
  status: taskQuestionStatusValidator,
  answer: v.optional(v.string()),
  answeredAt: v.optional(v.number()),
});

const runRecordValidator = v.object({
  runId: v.id("taskRuns"),
  kind: taskRunKindValidator,
  status: runStatusValidator,
  startedAt: v.optional(v.number()),
  completedAt: v.optional(v.number()),
  externalJobId: v.optional(v.string()),
  provider: v.optional(v.string()),
  model: v.optional(v.string()),
  summary: v.optional(v.string()),
  error: v.optional(v.string()),
});

function assertTaskCanMoveToExecution(task: Doc<"tasks">, pendingQuestions: Doc<"taskQuestions">[]) {
  if (task.status === "cancelled" || task.status === "completed") {
    throw new ConvexError({
      code: "INVALID_STATE",
      message: "This task can no longer move into execution.",
    });
  }

  if (pendingQuestions.length > 0) {
    throw new ConvexError({
      code: "TASK_REQUIRES_CLARIFICATION",
      message: "Answer or dismiss all pending questions before execution.",
    });
  }
}

function isTerminalRunStatus(status: Doc<"taskRuns">["status"]) {
  return (
    status === "succeeded" ||
    status === "failed" ||
    status === "cancelled" ||
    status === "timed_out"
  );
}

async function replaceTaskQuestions(
  ctx: MutationCtx,
  taskId: Doc<"tasks">["_id"],
  questions: Array<{ key: string; question: string }>,
) {
  const existing = await ctx.db
    .query("taskQuestions")
    .withIndex("by_task", (query) => query.eq("taskId", taskId))
    .take(100);

  await Promise.all(existing.map((question) => ctx.db.delete(question._id)));

  await Promise.all(
    questions.map((question) =>
      ctx.db.insert("taskQuestions", {
        taskId,
        key: question.key,
        question: question.question,
        status: "pending",
      }),
    ),
  );
}

export const listForWorkspace = query({
  args: {
    workosUserId: v.string(),
    workspaceId: v.id("workspaces"),
  },
  returns: v.array(
    v.object({
      taskId: v.id("tasks"),
      repositoryId: v.id("repositories"),
      repositoryFullName: v.string(),
      branch: v.string(),
      title: v.string(),
      status: taskStatusValidator,
      phase: taskPhaseValidator,
      createdAt: v.number(),
      latestSummary: v.optional(v.string()),
      latestError: v.optional(v.string()),
      readyForExecutionAt: v.optional(v.number()),
      completedAt: v.optional(v.number()),
    }),
  ),
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
        .take(100),
      ctx.db
        .query("repositories")
        .withIndex("by_workspace", (query) => query.eq("workspaceId", args.workspaceId))
        .collect(),
    ]);

    const repositoriesById = new Map(
      repositories.map((repository) => [repository._id, repository.fullName] as const),
    );

    return tasks.map((task) => ({
      taskId: task._id,
      repositoryId: task.repositoryId,
      repositoryFullName: repositoriesById.get(task.repositoryId) ?? "Unknown repository",
      branch: task.branch,
      title: task.title,
      status: task.status,
      phase: task.phase,
      createdAt: task._creationTime,
      latestSummary: task.latestSummary,
      latestError: task.latestError,
      readyForExecutionAt: task.readyForExecutionAt,
      completedAt: task.completedAt,
    }));
  },
});

export const get = query({
  args: {
    workosUserId: v.string(),
    taskId: v.id("tasks"),
  },
  returns: v.union(
    v.null(),
    v.object({
      taskId: v.id("tasks"),
      workspaceId: v.id("workspaces"),
      repositoryId: v.id("repositories"),
      repositoryFullName: v.string(),
      branch: v.string(),
      title: v.string(),
      rawPrompt: v.string(),
      normalizedPrompt: v.optional(v.string()),
      status: taskStatusValidator,
      phase: taskPhaseValidator,
      createdAt: v.number(),
      plan: v.optional(v.string()),
      acceptanceCriteria: v.optional(v.array(v.string())),
      suggestedFiles: v.optional(v.array(suggestedFileValidator)),
      latestSummary: v.optional(v.string()),
      latestError: v.optional(v.string()),
      activeRunId: v.optional(v.id("taskRuns")),
      planningRunId: v.optional(v.id("taskRuns")),
      executionRunId: v.optional(v.id("taskRuns")),
      questions: v.array(questionRecordValidator),
      runs: v.array(runRecordValidator),
    }),
  ),
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

    const [repository, questions, runs] = await Promise.all([
      ctx.db.get(task.repositoryId),
      ctx.db
        .query("taskQuestions")
        .withIndex("by_task", (query) => query.eq("taskId", args.taskId))
        .take(100),
      ctx.db
        .query("taskRuns")
        .withIndex("by_task", (query) => query.eq("taskId", args.taskId))
        .order("desc")
        .take(50),
    ]);

    return {
      taskId: task._id,
      workspaceId: task.workspaceId,
      repositoryId: task.repositoryId,
      repositoryFullName: repository?.fullName ?? "Unknown repository",
      branch: task.branch,
      title: task.title,
      rawPrompt: task.rawPrompt,
      normalizedPrompt: task.normalizedPrompt,
      status: task.status,
      phase: task.phase,
      createdAt: task._creationTime,
      plan: task.plan,
      acceptanceCriteria: task.acceptanceCriteria,
      suggestedFiles: task.suggestedFiles,
      latestSummary: task.latestSummary,
      latestError: task.latestError,
      activeRunId: task.activeRunId,
      planningRunId: task.planningRunId,
      executionRunId: task.executionRunId,
      questions: questions.map((question) => ({
        questionId: question._id,
        key: question.key,
        question: question.question,
        status: question.status,
        answer: question.answer,
        answeredAt: question.answeredAt,
      })),
      runs: runs.map((run) => ({
        runId: run._id,
        kind: run.kind,
        status: run.status,
        startedAt: run.startedAt,
        completedAt: run.completedAt,
        externalJobId: run.externalJobId,
        provider: run.provider,
        model: run.model,
        summary: run.summary,
        error: run.error,
      })),
    };
  },
});

export const create = mutation({
  args: {
    workosUserId: v.string(),
    workspaceId: v.id("workspaces"),
    repositoryId: v.id("repositories"),
    branch: v.string(),
    prompt: v.string(),
    title: v.optional(v.string()),
  },
  returns: v.id("tasks"),
  handler: async (ctx, args) => {
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

    const prompt = args.prompt.trim();
    if (!prompt) {
      throw new ConvexError({
        code: "INVALID_ARGUMENT",
        message: "Task prompt is required.",
      });
    }

    return await ctx.db.insert("tasks", {
      workspaceId: args.workspaceId,
      repositoryId: args.repositoryId,
      branch: args.branch.trim(),
      title: args.title?.trim() || prompt,
      rawPrompt: prompt,
      status: "drafting",
      phase: "intake",
      createdByUserId: user._id,
    });
  },
});

export const requestPlanning = mutation({
  args: {
    workosUserId: v.string(),
    taskId: v.id("tasks"),
  },
  returns: v.id("taskRuns"),
  handler: async (ctx, args): Promise<Doc<"taskRuns">["_id"]> => {
    const task = await ctx.db.get(args.taskId);
    if (!task) {
      throw new ConvexError({
        code: "NOT_FOUND",
        message: "Task not found.",
      });
    }

    await requireWorkspaceMembership({
      ctx,
      workspaceId: task.workspaceId,
      workosUserId: args.workosUserId,
    });

    const existingActiveRun =
      task.activeRunId !== undefined ? await ctx.db.get(task.activeRunId) : null;
    if (existingActiveRun && !isTerminalRunStatus(existingActiveRun.status)) {
      return existingActiveRun._id;
    }

    const runId = await ctx.runMutation(internal.tasks.startPlanningRun, {
      taskId: task._id,
    });

    await ctx.scheduler.runAfter(0, internal.orchestration.dispatchTaskPlanning, {
      taskId: task._id,
      runId,
    });

    return runId;
  },
});

export const reportPlanningResult = mutation({
  args: {
    taskId: v.id("tasks"),
    runId: v.id("taskRuns"),
    status: runStatusValidator,
    draft: v.optional(draftInputValidator),
    questions: v.optional(v.array(questionInputValidator)),
    summary: v.optional(v.string()),
    error: v.optional(v.string()),
    events: v.optional(
      v.array(
        v.object({
          type: v.string(),
          payload: v.any(),
        }),
      ),
    ),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    if (args.events?.length) {
      await ctx.runMutation(internal.tasks.recordRunEvents, {
        runId: args.runId,
        events: args.events,
      });
    }

    if (args.status === "succeeded") {
      if (!args.draft) {
        throw new ConvexError({
          code: "INVALID_ARGUMENT",
          message: "Planning draft is required for successful results.",
        });
      }

      await ctx.runMutation(internal.tasks.applyPlanningResult, {
        taskId: args.taskId,
        runId: args.runId,
        draft: args.draft,
        questions: args.questions ?? [],
        summary: args.summary,
      });

      return null;
    }

    await ctx.runMutation(internal.tasks.failPlanningRun, {
      taskId: args.taskId,
      runId: args.runId,
      error: args.error ?? "Task planning failed.",
      summary: args.summary,
    });

    return null;
  },
});

export const getPlanningContext = internalQuery({
  args: {
    taskId: v.id("tasks"),
  },
  returns: v.object({
    taskId: v.id("tasks"),
    workspaceId: v.id("workspaces"),
    repositoryId: v.id("repositories"),
    branch: v.string(),
    rawPrompt: v.string(),
    normalizedPrompt: v.optional(v.string()),
    status: taskStatusValidator,
    phase: taskPhaseValidator,
    repository: v.object({
      repositoryId: v.id("repositories"),
      fullName: v.string(),
      owner: v.string(),
      name: v.string(),
      defaultBranch: v.string(),
      selected: v.boolean(),
      archived: v.boolean(),
      githubInstallationId: v.number(),
    }),
    questions: v.array(questionRecordValidator),
    draft: v.object({
      title: v.string(),
      plan: v.optional(v.string()),
      acceptanceCriteria: v.optional(v.array(v.string())),
      suggestedFiles: v.optional(v.array(suggestedFileValidator)),
    }),
  }),
  handler: async (ctx, args) => {
    const task = await ctx.db.get(args.taskId);
    if (!task) {
      throw new ConvexError({
        code: "NOT_FOUND",
        message: "Task not found.",
      });
    }

    const repository = await ctx.db.get(task.repositoryId);
    if (!repository || repository.workspaceId !== task.workspaceId) {
      throw new ConvexError({
        code: "NOT_FOUND",
        message: "Repository not found for task.",
      });
    }

    const questions = await ctx.db
      .query("taskQuestions")
      .withIndex("by_task", (query) => query.eq("taskId", task._id))
      .take(100);

    return {
      taskId: task._id,
      workspaceId: task.workspaceId,
      repositoryId: task.repositoryId,
      branch: task.branch,
      rawPrompt: task.rawPrompt,
      normalizedPrompt: task.normalizedPrompt,
      status: task.status,
      phase: task.phase,
      repository: {
        repositoryId: repository._id,
        fullName: repository.fullName,
        owner: repository.owner,
        name: repository.name,
        defaultBranch: repository.defaultBranch,
        selected: repository.selected,
        archived: repository.archived,
        githubInstallationId: repository.githubInstallationId,
      },
      questions: questions.map((question) => ({
        questionId: question._id,
        key: question.key,
        question: question.question,
        status: question.status,
        answer: question.answer,
        answeredAt: question.answeredAt,
      })),
      draft: {
        title: task.title,
        plan: task.plan,
        acceptanceCriteria: task.acceptanceCriteria,
        suggestedFiles: task.suggestedFiles,
      },
    };
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
    const question = await ctx.db.get(args.questionId);
    if (!question) {
      return null;
    }

    const task = await ctx.db.get(question.taskId);
    if (!task) {
      return null;
    }

    await requireWorkspaceMembership({
      ctx,
      workspaceId: task.workspaceId,
      workosUserId: args.workosUserId,
    });

    await ctx.db.patch(args.questionId, {
      answer: args.answer.trim(),
      answeredAt: Date.now(),
      status: "answered",
    });

    const remainingQuestions = await ctx.db
      .query("taskQuestions")
      .withIndex("by_task_and_status", (query) =>
        query.eq("taskId", task._id).eq("status", "pending"),
      )
      .take(1);

    if (remainingQuestions.length === 0 && task.status === "awaiting_clarification") {
      await ctx.db.patch(task._id, {
        status: "ready",
        phase: task.phase,
        readyForExecutionAt: Date.now(),
        latestSummary: "All clarification questions have been answered.",
      });
    }

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
    const question = await ctx.db.get(args.questionId);
    if (!question) {
      return null;
    }

    const task = await ctx.db.get(question.taskId);
    if (!task) {
      return null;
    }

    await requireWorkspaceMembership({
      ctx,
      workspaceId: task.workspaceId,
      workosUserId: args.workosUserId,
    });

    await ctx.db.patch(args.questionId, {
      status: "dismissed",
      answeredAt: Date.now(),
    });

    const remainingQuestions = await ctx.db
      .query("taskQuestions")
      .withIndex("by_task_and_status", (query) =>
        query.eq("taskId", task._id).eq("status", "pending"),
      )
      .take(1);

    if (remainingQuestions.length === 0 && task.status === "awaiting_clarification") {
      await ctx.db.patch(task._id, {
        status: "ready",
        phase: task.phase,
        readyForExecutionAt: Date.now(),
        latestSummary: "Clarification is complete.",
      });
    }

    return null;
  },
});

export const startExecution = mutation({
  args: {
    workosUserId: v.string(),
    taskId: v.id("tasks"),
  },
  returns: v.id("taskRuns"),
  handler: async (ctx, args) => {
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

    const pendingQuestions = await ctx.db
      .query("taskQuestions")
      .withIndex("by_task_and_status", (query) =>
        query.eq("taskId", args.taskId).eq("status", "pending"),
      )
      .take(10);

    assertTaskCanMoveToExecution(task, pendingQuestions);

    const runId = await ctx.db.insert("taskRuns", {
      taskId: task._id,
      workspaceId: task.workspaceId,
      repositoryId: task.repositoryId,
      branch: task.branch,
      kind: "execution",
      status: "requested",
      requestedByUserId: user._id,
    });

    await ctx.db.patch(task._id, {
      status: "executing",
      phase: "execution",
      activeRunId: runId,
      executionRunId: runId,
      latestError: undefined,
    });

    return runId;
  },
});

export const cancel = mutation({
  args: {
    workosUserId: v.string(),
    taskId: v.id("tasks"),
  },
  returns: v.null(),
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

    await ctx.db.patch(task._id, {
      status: "cancelled",
      latestSummary: task.latestSummary ?? "Task cancelled.",
      cancelledAt: Date.now(),
      activeRunId: undefined,
    });

    return null;
  },
});

export const startPlanningRun = internalMutation({
  args: {
    taskId: v.id("tasks"),
  },
  returns: v.id("taskRuns"),
  handler: async (ctx, args) => {
    const task = await ctx.db.get(args.taskId);
    if (!task) {
      throw new ConvexError({
        code: "NOT_FOUND",
        message: "Task not found.",
      });
    }

    const existingActiveRun =
      task.activeRunId !== undefined ? await ctx.db.get(task.activeRunId) : null;
    if (existingActiveRun && !isTerminalRunStatus(existingActiveRun.status)) {
      return existingActiveRun._id;
    }

    const runId = await ctx.db.insert("taskRuns", {
      taskId: task._id,
      workspaceId: task.workspaceId,
      repositoryId: task.repositoryId,
      branch: task.branch,
      kind: "planning",
      status: "requested",
      requestedByUserId: task.createdByUserId,
    });

    await ctx.db.patch(task._id, {
      activeRunId: runId,
      planningRunId: runId,
      status: "drafting",
      phase: "planning",
      latestError: undefined,
      latestSummary: undefined,
      readyForExecutionAt: undefined,
    });

    return runId;
  },
});

export const createRun = internalMutation({
  args: {
    taskId: v.id("tasks"),
    kind: taskRunKindValidator,
    requestedByUserId: v.id("users"),
    externalJobId: v.optional(v.string()),
    provider: v.optional(v.string()),
    model: v.optional(v.string()),
  },
  returns: v.id("taskRuns"),
  handler: async (ctx, args) => {
    const task = await ctx.db.get(args.taskId);
    if (!task) {
      throw new ConvexError({
        code: "NOT_FOUND",
        message: "Task not found.",
      });
    }

    const runId = await ctx.db.insert("taskRuns", {
      taskId: task._id,
      workspaceId: task.workspaceId,
      repositoryId: task.repositoryId,
      branch: task.branch,
      kind: args.kind,
      status: "requested",
      requestedByUserId: args.requestedByUserId,
      externalJobId: args.externalJobId,
      provider: args.provider,
      model: args.model,
    });

    const taskPatch: Partial<Doc<"tasks">> = {
      activeRunId: runId,
      latestError: undefined,
    };

    if (args.kind === "planning" || args.kind === "clarification") {
      taskPatch.planningRunId = runId;
      taskPatch.phase = "planning";
      taskPatch.status = "drafting";
    }

    if (args.kind === "execution") {
      taskPatch.executionRunId = runId;
      taskPatch.phase = "execution";
      taskPatch.status = "executing";
    }

    await ctx.db.patch(task._id, taskPatch);

    return runId;
  },
});

export const transitionRunStatus = internalMutation({
  args: {
    runId: v.id("taskRuns"),
    status: runStatusValidator,
    externalJobId: v.optional(v.string()),
    summary: v.optional(v.string()),
    error: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const run = await ctx.db.get(args.runId);
    if (!run) {
      throw new ConvexError({
        code: "NOT_FOUND",
        message: "Task run not found.",
      });
    }

    await ctx.db.patch(run._id, {
      status: args.status,
      externalJobId: args.externalJobId ?? run.externalJobId,
      summary: args.summary ?? run.summary,
      error: args.error ?? run.error,
      startedAt: run.startedAt ?? (args.status === "running" ? Date.now() : undefined),
      completedAt:
        args.status === "succeeded" ||
        args.status === "failed" ||
        args.status === "cancelled" ||
        args.status === "timed_out"
          ? Date.now()
          : run.completedAt,
    });

    const task = await ctx.db.get(run.taskId);
    if (!task) {
      return null;
    }

    const terminal = args.status === "succeeded" || args.status === "failed" || args.status === "cancelled" || args.status === "timed_out";
    if (terminal && task.activeRunId === run._id) {
      await ctx.db.patch(task._id, {
        activeRunId: undefined,
      });
    }

    return null;
  },
});

export const recordRunEvent = internalMutation({
  args: {
    runId: v.id("taskRuns"),
    type: v.string(),
    payload: v.any(),
  },
  returns: v.id("taskRunEvents"),
  handler: async (ctx, args) => {
    return await ctx.db.insert("taskRunEvents", {
      runId: args.runId,
      timestamp: Date.now(),
      type: args.type,
      payload: args.payload,
    });
  },
});

export const recordRunEvents = internalMutation({
  args: {
    runId: v.id("taskRuns"),
    events: v.array(
      v.object({
        type: v.string(),
        payload: v.any(),
      }),
    ),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await Promise.all(
      args.events.map((event) =>
        ctx.db.insert("taskRunEvents", {
          runId: args.runId,
          timestamp: Date.now(),
          type: event.type,
          payload: event.payload,
        }),
      ),
    );

    return null;
  },
});

export const applyPlanningResult = internalMutation({
  args: {
    taskId: v.id("tasks"),
    runId: v.id("taskRuns"),
    draft: draftInputValidator,
    questions: v.array(questionInputValidator),
    summary: v.optional(v.string()),
  },
  returns: v.union(v.null(), taskStatusValidator),
  handler: async (ctx, args) => {
    const [task, run] = await Promise.all([ctx.db.get(args.taskId), ctx.db.get(args.runId)]);
    if (!task) {
      throw new ConvexError({
        code: "NOT_FOUND",
        message: "Task not found.",
      });
    }

    if (!run || run.taskId !== task._id || run.kind !== "planning") {
      throw new ConvexError({
        code: "NOT_FOUND",
        message: "Planning run not found.",
      });
    }

    if (isTerminalRunStatus(run.status)) {
      return null;
    }

    await replaceTaskQuestions(ctx, task._id, args.questions);

    const nextStatus = args.questions.length > 0 ? "awaiting_clarification" : "ready";
    const now = Date.now();

    await ctx.db.patch(run._id, {
      status: "succeeded",
      summary: args.summary ?? run.summary,
      error: undefined,
      startedAt: run.startedAt ?? now,
      completedAt: now,
    });

    await ctx.db.patch(task._id, {
      title: args.draft.title,
      normalizedPrompt: args.draft.normalizedPrompt,
      plan: args.draft.plan,
      acceptanceCriteria: args.draft.acceptanceCriteria,
      suggestedFiles: args.draft.suggestedFiles,
      status: nextStatus,
      phase: nextStatus === "ready" ? "planning" : "clarification",
      latestSummary: args.summary ?? task.latestSummary,
      latestError: undefined,
      activeRunId: task.activeRunId === run._id ? undefined : task.activeRunId,
      readyForExecutionAt: nextStatus === "ready" ? now : undefined,
    });

    return nextStatus;
  },
});

export const failPlanningRun = internalMutation({
  args: {
    taskId: v.id("tasks"),
    runId: v.id("taskRuns"),
    error: v.string(),
    summary: v.optional(v.string()),
  },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    const [task, run] = await Promise.all([ctx.db.get(args.taskId), ctx.db.get(args.runId)]);
    if (!task) {
      throw new ConvexError({
        code: "NOT_FOUND",
        message: "Task not found.",
      });
    }

    if (!run || run.taskId !== task._id || run.kind !== "planning") {
      throw new ConvexError({
        code: "NOT_FOUND",
        message: "Planning run not found.",
      });
    }

    if (isTerminalRunStatus(run.status)) {
      return false;
    }

    const now = Date.now();

    await ctx.db.patch(run._id, {
      status: "failed",
      summary: args.summary ?? run.summary,
      error: args.error,
      startedAt: run.startedAt ?? now,
      completedAt: now,
    });

    await ctx.db.patch(task._id, {
      status: "failed",
      latestError: args.error,
      latestSummary: args.summary ?? task.latestSummary,
      activeRunId: task.activeRunId === run._id ? undefined : task.activeRunId,
    });

    return true;
  },
});

export const replaceQuestions = internalMutation({
  args: {
    taskId: v.id("tasks"),
    questions: v.array(questionInputValidator),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const task = await ctx.db.get(args.taskId);
    if (!task) {
      throw new ConvexError({
        code: "NOT_FOUND",
        message: "Task not found.",
      });
    }

    const existing = await ctx.db
      .query("taskQuestions")
      .withIndex("by_task", (query) => query.eq("taskId", args.taskId))
      .take(100);

    await Promise.all(existing.map((question) => ctx.db.delete(question._id)));

    await Promise.all(
      args.questions.map((question) =>
        ctx.db.insert("taskQuestions", {
          taskId: args.taskId,
          key: question.key,
          question: question.question,
          status: "pending",
        }),
      ),
    );

    await ctx.db.patch(task._id, {
      status:
        args.questions.length > 0
          ? "awaiting_clarification"
          : task.status === "awaiting_clarification"
            ? "ready"
            : task.status,
      phase: args.questions.length > 0 ? "clarification" : task.phase,
      readyForExecutionAt:
        args.questions.length === 0 && task.status === "awaiting_clarification"
          ? Date.now()
          : task.readyForExecutionAt,
    });

    return null;
  },
});

export const setDraft = internalMutation({
  args: {
    taskId: v.id("tasks"),
    title: v.optional(v.string()),
    normalizedPrompt: v.optional(v.string()),
    plan: v.optional(v.string()),
    acceptanceCriteria: v.optional(v.array(v.string())),
    suggestedFiles: v.optional(v.array(suggestedFileValidator)),
    summary: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const task = await ctx.db.get(args.taskId);
    if (!task) {
      throw new ConvexError({
        code: "NOT_FOUND",
        message: "Task not found.",
      });
    }

    await ctx.db.patch(task._id, {
      title: args.title ?? task.title,
      normalizedPrompt: args.normalizedPrompt ?? task.normalizedPrompt,
      plan: args.plan ?? task.plan,
      acceptanceCriteria: args.acceptanceCriteria ?? task.acceptanceCriteria,
      suggestedFiles: args.suggestedFiles ?? task.suggestedFiles,
      latestSummary: args.summary ?? task.latestSummary,
      phase: "planning",
      status: "drafting",
    });

    return null;
  },
});

export const markReadyForExecution = internalMutation({
  args: {
    taskId: v.id("tasks"),
    summary: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const task = await ctx.db.get(args.taskId);
    if (!task) {
      throw new ConvexError({
        code: "NOT_FOUND",
        message: "Task not found.",
      });
    }

    const pendingQuestions = await ctx.db
      .query("taskQuestions")
      .withIndex("by_task_and_status", (query) =>
        query.eq("taskId", args.taskId).eq("status", "pending"),
      )
      .take(1);

    if (pendingQuestions.length > 0) {
      throw new ConvexError({
        code: "TASK_REQUIRES_CLARIFICATION",
        message: "Task still has pending clarification questions.",
      });
    }

    await ctx.db.patch(task._id, {
      status: "ready",
      phase: task.phase,
      readyForExecutionAt: Date.now(),
      latestSummary: args.summary ?? task.latestSummary,
      latestError: undefined,
    });

    return null;
  },
});

export const completeTask = internalMutation({
  args: {
    taskId: v.id("tasks"),
    summary: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const task = await ctx.db.get(args.taskId);
    if (!task) {
      throw new ConvexError({
        code: "NOT_FOUND",
        message: "Task not found.",
      });
    }

    await ctx.db.patch(task._id, {
      status: "completed",
      phase: "delivery",
      latestSummary: args.summary ?? task.latestSummary,
      latestError: undefined,
      activeRunId: undefined,
      completedAt: Date.now(),
    });

    return null;
  },
});

export const failTask = internalMutation({
  args: {
    taskId: v.id("tasks"),
    error: v.string(),
    summary: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const task = await ctx.db.get(args.taskId);
    if (!task) {
      throw new ConvexError({
        code: "NOT_FOUND",
        message: "Task not found.",
      });
    }

    await ctx.db.patch(task._id, {
      status: "failed",
      latestError: args.error,
      latestSummary: args.summary ?? task.latestSummary,
      activeRunId: undefined,
    });

    return null;
  },
});

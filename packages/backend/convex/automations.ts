import { ConvexError, v } from "convex/values";

import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { mutation } from "./_generated/server";

const workflowKindValidator = v.union(
  v.literal("context_enrichment"),
  v.literal("task_breakdown"),
  v.literal("discussion_rereview"),
  v.literal("repo_analysis"),
  v.literal("repo_execution"),
  v.literal("repository_sync"),
  v.literal("repository_explore"),
);

export const requestRun = mutation({
  args: {
    workosUserId: v.string(),
    taskId: v.optional(v.id("tasks")),
    repositoryId: v.optional(v.id("repositories")),
    workspaceId: v.optional(v.id("workspaces")),
    branch: v.optional(v.string()),
    runKind: workflowKindValidator,
  },
  returns: v.id("runs"),
  handler: async (ctx, args): Promise<Id<"runs">> => {
    if (args.taskId) {
      return await ctx.runMutation(internal.runs.requestTaskRun, {
        workosUserId: args.workosUserId,
        taskId: args.taskId,
        runKind: args.runKind,
      });
    }

    if (args.workspaceId && args.repositoryId && args.branch) {
      return await ctx.runMutation(internal.runs.requestRepositoryRunInternal, {
        workosUserId: args.workosUserId,
        workspaceId: args.workspaceId,
        repositoryId: args.repositoryId,
        branch: args.branch,
        runKind: args.runKind,
      });
    }

    throw new ConvexError({
      code: "INVALID_ARGUMENT",
      message: "A task target or a repository target is required.",
    });
  },
});

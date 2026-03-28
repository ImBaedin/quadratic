import { ConvexError, v } from "convex/values";

import { mutation, query, internalMutation } from "./_generated/server";
import { requireWorkspaceMembership } from "./lib/auth";

const runStatusArg = v.union(
  v.literal("queued"),
  v.literal("requested"),
  v.literal("launching"),
  v.literal("running"),
  v.literal("succeeded"),
  v.literal("failed"),
  v.literal("cancelled"),
  v.literal("timed_out"),
);

export const listForWorkspace = query({
  args: {
    workosUserId: v.string(),
    workspaceId: v.id("workspaces"),
  },
  returns: v.array(
    v.object({
      runId: v.id("agentRuns"),
      repositoryId: v.id("repositories"),
      branch: v.string(),
      kind: v.string(),
      status: v.string(),
      startedAt: v.optional(v.number()),
      completedAt: v.optional(v.number()),
      summary: v.optional(v.string()),
      error: v.optional(v.string()),
    }),
  ),
  handler: async (ctx, args) => {
    await requireWorkspaceMembership({
      ctx,
      workspaceId: args.workspaceId,
      workosUserId: args.workosUserId,
    });

    const runs = await ctx.db
      .query("agentRuns")
      .withIndex("by_workspace", (query) => query.eq("workspaceId", args.workspaceId))
      .order("desc")
      .collect();

    return runs.map((run) => ({
      runId: run._id,
      repositoryId: run.repositoryId,
      branch: run.branch,
      kind: run.kind,
      status: run.status,
      startedAt: run.startedAt,
      completedAt: run.completedAt,
      summary: run.summary,
      error: run.error,
    }));
  },
});

export const get = query({
  args: {
    workosUserId: v.string(),
    runId: v.id("agentRuns"),
  },
  returns: v.union(
    v.null(),
    v.object({
      runId: v.id("agentRuns"),
      workspaceId: v.id("workspaces"),
      repositoryId: v.id("repositories"),
      branch: v.string(),
      kind: v.string(),
      status: v.string(),
      summary: v.optional(v.string()),
      error: v.optional(v.string()),
      events: v.array(
        v.object({
          eventId: v.id("agentRunEvents"),
          type: v.string(),
          timestamp: v.number(),
          payload: v.any(),
        }),
      ),
    }),
  ),
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

    const events = await ctx.db
      .query("agentRunEvents")
      .withIndex("by_run", (query) => query.eq("runId", args.runId))
      .collect();

    return {
      runId: run._id,
      workspaceId: run.workspaceId,
      repositoryId: run.repositoryId,
      branch: run.branch,
      kind: run.kind,
      status: run.status,
      summary: run.summary,
      error: run.error,
      events: events.map((event) => ({
        eventId: event._id,
        type: event.type,
        timestamp: event.timestamp,
        payload: event.payload,
      })),
    };
  },
});

export const request = mutation({
  args: {
    workosUserId: v.string(),
    workspaceId: v.id("workspaces"),
    repositoryId: v.id("repositories"),
    branch: v.string(),
    kind: v.string(),
  },
  returns: v.id("agentRuns"),
  handler: async (ctx, args) => {
    const { user } = await requireWorkspaceMembership({
      ctx,
      workspaceId: args.workspaceId,
      workosUserId: args.workosUserId,
    });

    return await ctx.db.insert("agentRuns", {
      workspaceId: args.workspaceId,
      repositoryId: args.repositoryId,
      branch: args.branch,
      kind: args.kind,
      status: "requested",
      requestedByUserId: user._id,
    });
  },
});

export const recordEvent = internalMutation({
  args: {
    runId: v.id("agentRuns"),
    type: v.string(),
    payload: v.any(),
  },
  returns: v.id("agentRunEvents"),
  handler: async (ctx, args) => {
    return await ctx.db.insert("agentRunEvents", {
      runId: args.runId,
      timestamp: Date.now(),
      type: args.type,
      payload: args.payload,
    });
  },
});

export const transitionStatus = internalMutation({
  args: {
    runId: v.id("agentRuns"),
    status: runStatusArg,
    externalJobId: v.optional(v.string()),
    summary: v.optional(v.string()),
    error: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const run = await ctx.db.get(args.runId);
    if (!run) {
      throw new ConvexError("Run not found");
    }

    await ctx.db.patch(args.runId, {
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

    return null;
  },
});

export const reportResult = mutation({
  args: {
    runId: v.id("agentRuns"),
    status: runStatusArg,
    externalJobId: v.optional(v.string()),
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
    const run = await ctx.db.get(args.runId);
    if (!run) {
      throw new ConvexError("Run not found");
    }

    if (args.events?.length) {
      await Promise.all(
        args.events.map((event) =>
          ctx.db.insert("agentRunEvents", {
            runId: args.runId,
            timestamp: Date.now(),
            type: event.type,
            payload: event.payload,
          }),
        ),
      );
    }

    await ctx.db.patch(args.runId, {
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

    return null;
  },
});

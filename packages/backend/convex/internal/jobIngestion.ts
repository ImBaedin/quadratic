import { v } from "convex/values";

import { internalMutation } from "../_generated/server";

export const recordWebhookReceipt = internalMutation({
  args: {
    runId: v.optional(v.id("runs")),
    workspaceId: v.optional(v.id("workspaces")),
    eventType: v.string(),
    payload: v.any(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const runId = args.runId;
    if (runId) {
      const existingEvents = await ctx.db
        .query("runEvents")
        .withIndex("by_run", (query) => query.eq("runId", runId))
        .collect();

      await ctx.db.insert("runEvents", {
        runId,
        sequence: existingEvents.length,
        timestamp: Date.now(),
        type: args.eventType,
        payload: args.payload,
      });
    }

    return null;
  },
});

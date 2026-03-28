import { v } from "convex/values";

import { internalMutation } from "../_generated/server";

export const recordWebhookReceipt = internalMutation({
  args: {
    runId: v.optional(v.id("agentRuns")),
    workspaceId: v.optional(v.id("workspaces")),
    eventType: v.string(),
    payload: v.any(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    if (args.runId) {
      await ctx.db.insert("agentRunEvents", {
        runId: args.runId,
        timestamp: Date.now(),
        type: args.eventType,
        payload: args.payload,
      });
    }

    return null;
  },
});

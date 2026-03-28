import { v } from "convex/values";

import { mutation, internalMutation } from "./_generated/server";

const authUserArgs = {
  workosUserId: v.string(),
  email: v.string(),
  firstName: v.optional(v.string()),
  lastName: v.optional(v.string()),
  avatarUrl: v.optional(v.string()),
} as const;

export const upsertFromAuth = internalMutation({
  args: authUserArgs,
  returns: v.id("users"),
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("users")
      .withIndex("by_workos_user_id", (query) => query.eq("workosUserId", args.workosUserId))
      .unique();

    if (existing) {
      await ctx.db.patch(existing._id, {
        email: args.email,
        firstName: args.firstName,
        lastName: args.lastName,
        avatarUrl: args.avatarUrl,
        lastLoginAt: Date.now(),
      });
      return existing._id;
    }

    return await ctx.db.insert("users", {
      ...args,
      lastLoginAt: Date.now(),
    });
  },
});

export const syncCurrentUser = mutation({
  args: authUserArgs,
  returns: v.id("users"),
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("users")
      .withIndex("by_workos_user_id", (query) => query.eq("workosUserId", args.workosUserId))
      .unique();

    if (existing) {
      await ctx.db.patch(existing._id, {
        email: args.email,
        firstName: args.firstName,
        lastName: args.lastName,
        avatarUrl: args.avatarUrl,
        lastLoginAt: Date.now(),
      });
      return existing._id;
    }

    return await ctx.db.insert("users", {
      ...args,
      lastLoginAt: Date.now(),
    });
  },
});

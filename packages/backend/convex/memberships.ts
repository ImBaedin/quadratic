import { v } from "convex/values";

import { query } from "./_generated/server";
import { requireWorkspaceMembership } from "./lib/auth";

export const listForWorkspace = query({
  args: {
    workosUserId: v.string(),
    workspaceId: v.id("workspaces"),
  },
  returns: v.array(
    v.object({
      membershipId: v.id("workspaceMemberships"),
      userId: v.id("users"),
      role: v.union(v.literal("owner"), v.literal("admin"), v.literal("member")),
      joinedAt: v.number(),
      email: v.string(),
      firstName: v.optional(v.string()),
      lastName: v.optional(v.string()),
    }),
  ),
  handler: async (ctx, args) => {
    await requireWorkspaceMembership({
      ctx,
      workspaceId: args.workspaceId,
      workosUserId: args.workosUserId,
    });

    const memberships = await ctx.db
      .query("workspaceMemberships")
      .withIndex("by_workspace", (query) => query.eq("workspaceId", args.workspaceId))
      .collect();

    const users = await Promise.all(memberships.map((membership) => ctx.db.get(membership.userId)));

    return memberships.flatMap((membership, index) => {
      const user = users[index];
      return user
        ? [
            {
              membershipId: membership._id,
              userId: user._id,
              role: membership.role,
              joinedAt: membership.joinedAt,
              email: user.email,
              firstName: user.firstName,
              lastName: user.lastName,
            },
          ]
        : [];
    });
  },
});

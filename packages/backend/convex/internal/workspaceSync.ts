import { v } from "convex/values";

import { internalMutation } from "../_generated/server";

export const applyMemberships = internalMutation({
  args: {
    workspaceId: v.id("workspaces"),
    memberships: v.array(
      v.object({
        userId: v.id("users"),
        role: v.union(v.literal("owner"), v.literal("admin"), v.literal("member")),
        workosMembershipId: v.optional(v.string()),
      }),
    ),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("workspaceMemberships")
      .withIndex("by_workspace", (query) => query.eq("workspaceId", args.workspaceId))
      .collect();

    const byMembershipId = new Map(
      existing
        .filter((membership) => membership.workosMembershipId)
        .map((membership) => [membership.workosMembershipId, membership] as const),
    );

    await Promise.all(
      args.memberships.map(async (membership) => {
        const current = membership.workosMembershipId
          ? byMembershipId.get(membership.workosMembershipId)
          : existing.find((item) => item.userId === membership.userId);

        if (current) {
          await ctx.db.patch(current._id, {
            userId: membership.userId,
            role: membership.role,
            workosMembershipId: membership.workosMembershipId,
          });
          return;
        }

        await ctx.db.insert("workspaceMemberships", {
          workspaceId: args.workspaceId,
          userId: membership.userId,
          role: membership.role,
          workosMembershipId: membership.workosMembershipId,
          joinedAt: Date.now(),
        });
      }),
    );

    return null;
  },
});

import { v } from "convex/values";

import { mutation, query } from "./_generated/server";
import { requireWorkspaceMembership } from "./lib/auth";

export const create = mutation({
  args: {
    workosUserId: v.string(),
    workspaceId: v.id("workspaces"),
    email: v.string(),
    role: v.union(v.literal("owner"), v.literal("admin"), v.literal("member")),
    workosInvitationId: v.optional(v.string()),
  },
  returns: v.id("workspaceInvites"),
  handler: async (ctx, args) => {
    const { user } = await requireWorkspaceMembership({
      ctx,
      workspaceId: args.workspaceId,
      workosUserId: args.workosUserId,
      minimumRole: "admin",
    });

    const existing = await ctx.db
      .query("workspaceInvites")
      .withIndex("by_workspace_and_email", (query) =>
        query.eq("workspaceId", args.workspaceId).eq("email", args.email.toLowerCase()),
      )
      .unique();

    if (existing) {
      await ctx.db.patch(existing._id, {
        role: args.role,
        status: "pending",
        invitedByUserId: user._id,
        workosInvitationId: args.workosInvitationId,
        createdAt: Date.now(),
      });
      return existing._id;
    }

    return await ctx.db.insert("workspaceInvites", {
      workspaceId: args.workspaceId,
      email: args.email.toLowerCase(),
      role: args.role,
      status: "pending",
      invitedByUserId: user._id,
      workosInvitationId: args.workosInvitationId,
      createdAt: Date.now(),
    });
  },
});

export const listForWorkspace = query({
  args: {
    workosUserId: v.string(),
    workspaceId: v.id("workspaces"),
  },
  returns: v.array(
    v.object({
      inviteId: v.id("workspaceInvites"),
      email: v.string(),
      role: v.union(v.literal("owner"), v.literal("admin"), v.literal("member")),
      status: v.string(),
      createdAt: v.number(),
    }),
  ),
  handler: async (ctx, args) => {
    await requireWorkspaceMembership({
      ctx,
      workspaceId: args.workspaceId,
      workosUserId: args.workosUserId,
      minimumRole: "admin",
    });

    const invites = await ctx.db
      .query("workspaceInvites")
      .withIndex("by_workspace", (query) => query.eq("workspaceId", args.workspaceId))
      .collect();

    return invites.map((invite) => ({
      inviteId: invite._id,
      email: invite.email,
      role: invite.role,
      status: invite.status,
      createdAt: invite.createdAt,
    }));
  },
});

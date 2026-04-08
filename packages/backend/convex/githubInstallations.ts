import { v } from "convex/values";

import { internalMutation, mutation, query } from "./_generated/server";
import { requireWorkspaceMembership } from "./lib/auth";

export const listForWorkspace = query({
  args: {
    workosUserId: v.string(),
    workspaceId: v.id("workspaces"),
  },
  returns: v.array(
    v.object({
      installationId: v.id("githubInstallations"),
      githubInstallationId: v.number(),
      githubAccountLogin: v.string(),
      githubAccountType: v.string(),
      status: v.string(),
    }),
  ),
  handler: async (ctx, args) => {
    await requireWorkspaceMembership({
      ctx,
      workspaceId: args.workspaceId,
      workosUserId: args.workosUserId,
    });

    const installations = await ctx.db
      .query("githubInstallations")
      .withIndex("by_workspace", (query) => query.eq("workspaceId", args.workspaceId))
      .collect();

    return installations.map((installation) => ({
      installationId: installation._id,
      githubInstallationId: installation.githubInstallationId,
      githubAccountLogin: installation.githubAccountLogin,
      githubAccountType: installation.githubAccountType,
      status: installation.status,
    }));
  },
});

export const getByGithubInstallationId = query({
  args: {
    githubInstallationId: v.number(),
  },
  returns: v.union(
    v.null(),
    v.object({
      installationId: v.id("githubInstallations"),
      workspaceId: v.id("workspaces"),
      githubInstallationId: v.number(),
      githubAccountLogin: v.string(),
      githubAccountType: v.string(),
      status: v.string(),
    }),
  ),
  handler: async (ctx, args) => {
    const installation = await ctx.db
      .query("githubInstallations")
      .withIndex("by_github_installation_id", (query) =>
        query.eq("githubInstallationId", args.githubInstallationId),
      )
      .unique();

    if (!installation) {
      return null;
    }

    return {
      installationId: installation._id,
      workspaceId: installation.workspaceId,
      githubInstallationId: installation.githubInstallationId,
      githubAccountLogin: installation.githubAccountLogin,
      githubAccountType: installation.githubAccountType,
      status: installation.status,
    };
  },
});

export const upsertInstallation = internalMutation({
  args: {
    workspaceId: v.id("workspaces"),
    githubInstallationId: v.number(),
    githubAccountLogin: v.string(),
    githubAccountType: v.string(),
    installedByUserId: v.id("users"),
    status: v.union(
      v.literal("pending"),
      v.literal("active"),
      v.literal("suspended"),
      v.literal("removed"),
    ),
  },
  returns: v.id("githubInstallations"),
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("githubInstallations")
      .withIndex("by_github_installation_id", (query) =>
        query.eq("githubInstallationId", args.githubInstallationId),
      )
      .unique();

    if (existing) {
      await ctx.db.patch(existing._id, args);
      return existing._id;
    }

    return await ctx.db.insert("githubInstallations", args);
  },
});

export const connectWorkspaceInstallation = mutation({
  args: {
    workosUserId: v.string(),
    workspaceId: v.id("workspaces"),
    githubInstallationId: v.number(),
    githubAccountLogin: v.string(),
    githubAccountType: v.string(),
    status: v.union(
      v.literal("pending"),
      v.literal("active"),
      v.literal("suspended"),
      v.literal("removed"),
    ),
  },
  returns: v.id("githubInstallations"),
  handler: async (ctx, args) => {
    const { user } = await requireWorkspaceMembership({
      ctx,
      workspaceId: args.workspaceId,
      workosUserId: args.workosUserId,
      minimumRole: "admin",
    });

    const existing = await ctx.db
      .query("githubInstallations")
      .withIndex("by_github_installation_id", (query) =>
        query.eq("githubInstallationId", args.githubInstallationId),
      )
      .unique();

    const payload = {
      workspaceId: args.workspaceId,
      githubInstallationId: args.githubInstallationId,
      githubAccountLogin: args.githubAccountLogin,
      githubAccountType: args.githubAccountType,
      installedByUserId: user._id,
      status: args.status,
    };

    if (existing) {
      await ctx.db.patch(existing._id, payload);
      return existing._id;
    }

    return await ctx.db.insert("githubInstallations", payload);
  },
});

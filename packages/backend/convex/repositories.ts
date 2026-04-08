import { v } from "convex/values";

import { mutation, query, internalMutation } from "./_generated/server";
import { requireWorkspaceMembership } from "./lib/auth";

export const listForWorkspace = query({
  args: {
    workosUserId: v.string(),
    workspaceId: v.id("workspaces"),
  },
  returns: v.array(
    v.object({
      repositoryId: v.id("repositories"),
      githubRepoId: v.number(),
      owner: v.string(),
      name: v.string(),
      fullName: v.string(),
      defaultBranch: v.string(),
      selected: v.boolean(),
      archived: v.boolean(),
      isPrivate: v.boolean(),
    }),
  ),
  handler: async (ctx, args) => {
    await requireWorkspaceMembership({
      ctx,
      workspaceId: args.workspaceId,
      workosUserId: args.workosUserId,
    });

    const repositories = await ctx.db
      .query("repositories")
      .withIndex("by_workspace", (query) => query.eq("workspaceId", args.workspaceId))
      .collect();

    return repositories.map((repository) => ({
      repositoryId: repository._id,
      githubRepoId: repository.githubRepoId,
      owner: repository.owner,
      name: repository.name,
      fullName: repository.fullName,
      defaultBranch: repository.defaultBranch,
      selected: repository.selected,
      archived: repository.archived,
      isPrivate: repository.isPrivate,
    }));
  },
});

export const setSelected = mutation({
  args: {
    workosUserId: v.string(),
    repositoryId: v.id("repositories"),
    selected: v.boolean(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const repository = await ctx.db.get(args.repositoryId);
    if (!repository) {
      return null;
    }

    await requireWorkspaceMembership({
      ctx,
      workspaceId: repository.workspaceId,
      workosUserId: args.workosUserId,
      minimumRole: "admin",
    });

    await ctx.db.patch(args.repositoryId, {
      selected: args.selected,
    });
    return null;
  },
});

export const setDefaultBranch = mutation({
  args: {
    workosUserId: v.string(),
    repositoryId: v.id("repositories"),
    defaultBranch: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const repository = await ctx.db.get(args.repositoryId);
    if (!repository) {
      return null;
    }

    await requireWorkspaceMembership({
      ctx,
      workspaceId: repository.workspaceId,
      workosUserId: args.workosUserId,
      minimumRole: "admin",
    });

    await ctx.db.patch(args.repositoryId, {
      defaultBranch: args.defaultBranch,
    });
    return null;
  },
});

export const syncRepositories = internalMutation({
  args: {
    workspaceId: v.id("workspaces"),
    githubInstallationId: v.number(),
    repositories: v.array(
      v.object({
        githubRepoId: v.number(),
        owner: v.string(),
        name: v.string(),
        fullName: v.string(),
        isPrivate: v.boolean(),
        defaultBranch: v.string(),
        archived: v.boolean(),
      }),
    ),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("repositories")
      .withIndex("by_workspace", (query) => query.eq("workspaceId", args.workspaceId))
      .collect();

    const existingByRepoId = new Map(
      existing.map((repository) => [repository.githubRepoId, repository]),
    );

    await Promise.all(
      args.repositories.map(async (repository) => {
        const current = existingByRepoId.get(repository.githubRepoId);
        if (current) {
          existingByRepoId.delete(repository.githubRepoId);
          await ctx.db.patch(current._id, {
            ...repository,
            githubInstallationId: args.githubInstallationId,
          });
          return;
        }

        await ctx.db.insert("repositories", {
          workspaceId: args.workspaceId,
          githubInstallationId: args.githubInstallationId,
          ...repository,
          selected: false,
        });
      }),
    );

    await Promise.all(
      Array.from(existingByRepoId.values()).map((repository) =>
        ctx.db.patch(repository._id, {
          archived: true,
          selected: false,
        }),
      ),
    );

    return null;
  },
});

export const refreshFromGitHub = mutation({
  args: {
    workosUserId: v.string(),
    workspaceId: v.id("workspaces"),
    githubInstallationId: v.number(),
    repositories: v.array(
      v.object({
        githubRepoId: v.number(),
        owner: v.string(),
        name: v.string(),
        fullName: v.string(),
        isPrivate: v.boolean(),
        defaultBranch: v.string(),
        archived: v.boolean(),
      }),
    ),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requireWorkspaceMembership({
      ctx,
      workspaceId: args.workspaceId,
      workosUserId: args.workosUserId,
      minimumRole: "admin",
    });

    const existing = await ctx.db
      .query("repositories")
      .withIndex("by_workspace", (query) => query.eq("workspaceId", args.workspaceId))
      .collect();

    const existingByRepoId = new Map(
      existing.map((repository) => [repository.githubRepoId, repository]),
    );

    await Promise.all(
      args.repositories.map(async (repository) => {
        const current = existingByRepoId.get(repository.githubRepoId);
        if (current) {
          existingByRepoId.delete(repository.githubRepoId);
          await ctx.db.patch(current._id, {
            ...repository,
            githubInstallationId: args.githubInstallationId,
          });
          return;
        }

        await ctx.db.insert("repositories", {
          workspaceId: args.workspaceId,
          githubInstallationId: args.githubInstallationId,
          ...repository,
          selected: false,
        });
      }),
    );

    await Promise.all(
      Array.from(existingByRepoId.values()).map((repository) =>
        ctx.db.patch(repository._id, {
          archived: true,
          selected: false,
        }),
      ),
    );

    return null;
  },
});

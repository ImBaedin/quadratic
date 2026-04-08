import { ConvexError, v } from "convex/values";

import { query, mutation, internalMutation } from "./_generated/server";
import { requireUser, requireWorkspaceMembership } from "./lib/auth";

function slugifyWorkspaceName(name: string) {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
}

export const listForCurrentUser = query({
  args: {
    workosUserId: v.string(),
  },
  returns: v.array(
    v.object({
      workspaceId: v.id("workspaces"),
      slug: v.string(),
      name: v.string(),
      role: v.union(v.literal("owner"), v.literal("admin"), v.literal("member")),
      status: v.string(),
    }),
  ),
  handler: async (ctx, args) => {
    const user = await requireUser(ctx, args.workosUserId);
    const memberships = await ctx.db
      .query("workspaceMemberships")
      .withIndex("by_user", (query) => query.eq("userId", user._id))
      .collect();

    const workspaces = await Promise.all(
      memberships.map((membership) => ctx.db.get(membership.workspaceId)),
    );

    return memberships.flatMap((membership, index) => {
      const workspace = workspaces[index];
      return workspace
        ? [
            {
              workspaceId: workspace._id,
              slug: workspace.slug,
              name: workspace.name,
              role: membership.role,
              status: workspace.status,
            },
          ]
        : [];
    });
  },
});

export const create = mutation({
  args: {
    workosUserId: v.string(),
    name: v.string(),
  },
  returns: v.object({
    workspaceId: v.id("workspaces"),
    slug: v.string(),
  }),
  handler: async (ctx, args) => {
    const user = await requireUser(ctx, args.workosUserId);
    const slugBase = slugifyWorkspaceName(args.name);

    if (!slugBase) {
      throw new ConvexError({
        code: "INVALID_ARGUMENT",
        message: "Workspace name must contain letters or numbers.",
      });
    }

    let slug = slugBase;
    let suffix = 1;

    while (
      await ctx.db
        .query("workspaces")
        .withIndex("by_slug", (query) => query.eq("slug", slug))
        .unique()
    ) {
      suffix += 1;
      slug = `${slugBase}-${suffix}`;
    }

    const workspaceId = await ctx.db.insert("workspaces", {
      slug,
      name: args.name.trim(),
      createdByUserId: user._id,
      status: "active",
    });

    await ctx.db.insert("workspaceMemberships", {
      workspaceId,
      userId: user._id,
      role: "owner",
      joinedAt: Date.now(),
    });

    await ctx.db.insert("workspaceAiPolicies", {
      workspaceId,
      enabled: true,
      hardLimitTokens: 250_000,
      reserveTokensPerRun: 20_000,
      defaultModel: "openai/gpt-5.4-nano",
    });

    return { workspaceId, slug };
  },
});

export const getBySlug = query({
  args: {
    workosUserId: v.string(),
    slug: v.string(),
  },
  returns: v.union(
    v.null(),
    v.object({
      workspaceId: v.id("workspaces"),
      slug: v.string(),
      name: v.string(),
      status: v.string(),
      role: v.union(v.literal("owner"), v.literal("admin"), v.literal("member")),
      workosOrganizationId: v.optional(v.string()),
    }),
  ),
  handler: async (ctx, args) => {
    const workspace = await ctx.db
      .query("workspaces")
      .withIndex("by_slug", (query) => query.eq("slug", args.slug))
      .unique();

    if (!workspace) {
      return null;
    }

    const { membership } = await requireWorkspaceMembership({
      ctx,
      workspaceId: workspace._id,
      workosUserId: args.workosUserId,
    });

    return {
      workspaceId: workspace._id,
      slug: workspace.slug,
      name: workspace.name,
      status: workspace.status,
      role: membership.role,
      workosOrganizationId: workspace.workosOrganizationId,
    };
  },
});

export const linkWorkOSOrganization = internalMutation({
  args: {
    workspaceId: v.id("workspaces"),
    workosOrganizationId: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await ctx.db.patch(args.workspaceId, {
      workosOrganizationId: args.workosOrganizationId,
    });
    return null;
  },
});

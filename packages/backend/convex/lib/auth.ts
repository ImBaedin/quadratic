import { ConvexError } from "convex/values";

import type { MutationCtx, QueryCtx } from "../_generated/server";
import { hasRequiredRole, type WorkspaceRole } from "./roles";

async function getUserByWorkosUserId(ctx: QueryCtx | MutationCtx, workosUserId: string) {
  return await ctx.db
    .query("users")
    .withIndex("by_workos_user_id", (query) => query.eq("workosUserId", workosUserId))
    .unique();
}

export async function requireUser(ctx: QueryCtx | MutationCtx, workosUserId: string) {
  const user = await getUserByWorkosUserId(ctx, workosUserId);

  if (!user) {
    throw new ConvexError({
      code: "UNAUTHENTICATED",
      message: "You need to sign in before accessing this resource.",
    });
  }

  return user;
}

export async function requireWorkspaceMembership(args: {
  ctx: QueryCtx | MutationCtx;
  workspaceId: string;
  workosUserId: string;
  minimumRole?: WorkspaceRole;
}) {
  const user = await requireUser(args.ctx, args.workosUserId);
  const membership = await args.ctx.db
    .query("workspaceMemberships")
    .withIndex("by_workspace_and_user", (query) =>
      query.eq("workspaceId", args.workspaceId as never).eq("userId", user._id),
    )
    .unique();

  if (!membership) {
    throw new ConvexError({
      code: "FORBIDDEN",
      message: "You do not belong to this workspace.",
    });
  }

  if (args.minimumRole && !hasRequiredRole(membership.role, args.minimumRole)) {
    throw new ConvexError({
      code: "FORBIDDEN",
      message: "You do not have permission to perform this action.",
    });
  }

  return { user, membership };
}

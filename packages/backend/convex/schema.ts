import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

const roleValidator = v.union(v.literal("owner"), v.literal("admin"), v.literal("member"));
const workspaceStatusValidator = v.union(v.literal("active"), v.literal("invited"), v.literal("disabled"));
const inviteStatusValidator = v.union(
  v.literal("pending"),
  v.literal("accepted"),
  v.literal("revoked"),
  v.literal("expired"),
);
const githubInstallationStatusValidator = v.union(
  v.literal("pending"),
  v.literal("active"),
  v.literal("suspended"),
  v.literal("removed"),
);
const runStatusValidator = v.union(
  v.literal("queued"),
  v.literal("requested"),
  v.literal("launching"),
  v.literal("running"),
  v.literal("succeeded"),
  v.literal("failed"),
  v.literal("cancelled"),
  v.literal("timed_out"),
);

export default defineSchema({
  users: defineTable({
    workosUserId: v.string(),
    email: v.string(),
    firstName: v.optional(v.string()),
    lastName: v.optional(v.string()),
    avatarUrl: v.optional(v.string()),
    lastLoginAt: v.number(),
  })
    .index("by_workos_user_id", ["workosUserId"])
    .index("by_email", ["email"]),
  workspaces: defineTable({
    slug: v.string(),
    name: v.string(),
    createdByUserId: v.id("users"),
    workosOrganizationId: v.optional(v.string()),
    status: workspaceStatusValidator,
  })
    .index("by_slug", ["slug"])
    .index("by_workos_organization_id", ["workosOrganizationId"]),
  workspaceMemberships: defineTable({
    workspaceId: v.id("workspaces"),
    userId: v.id("users"),
    role: roleValidator,
    workosMembershipId: v.optional(v.string()),
    joinedAt: v.number(),
  })
    .index("by_workspace", ["workspaceId"])
    .index("by_user", ["userId"])
    .index("by_workspace_and_user", ["workspaceId", "userId"])
    .index("by_workos_membership_id", ["workosMembershipId"]),
  workspaceInvites: defineTable({
    workspaceId: v.id("workspaces"),
    email: v.string(),
    role: roleValidator,
    status: inviteStatusValidator,
    invitedByUserId: v.id("users"),
    workosInvitationId: v.optional(v.string()),
    createdAt: v.number(),
  })
    .index("by_workspace", ["workspaceId"])
    .index("by_workspace_and_email", ["workspaceId", "email"])
    .index("by_workos_invitation_id", ["workosInvitationId"]),
  githubInstallations: defineTable({
    workspaceId: v.id("workspaces"),
    githubInstallationId: v.number(),
    githubAccountLogin: v.string(),
    githubAccountType: v.string(),
    installedByUserId: v.id("users"),
    status: githubInstallationStatusValidator,
  })
    .index("by_workspace", ["workspaceId"])
    .index("by_github_installation_id", ["githubInstallationId"]),
  repositories: defineTable({
    workspaceId: v.id("workspaces"),
    githubInstallationId: v.number(),
    githubRepoId: v.number(),
    owner: v.string(),
    name: v.string(),
    fullName: v.string(),
    isPrivate: v.boolean(),
    defaultBranch: v.string(),
    selected: v.boolean(),
    archived: v.boolean(),
  })
    .index("by_workspace", ["workspaceId"])
    .index("by_workspace_and_repo", ["workspaceId", "githubRepoId"])
    .index("by_workspace_and_selected", ["workspaceId", "selected"])
    .index("by_installation", ["githubInstallationId"]),
  agentRuns: defineTable({
    workspaceId: v.id("workspaces"),
    repositoryId: v.id("repositories"),
    branch: v.string(),
    kind: v.string(),
    status: runStatusValidator,
    requestedByUserId: v.id("users"),
    startedAt: v.optional(v.number()),
    completedAt: v.optional(v.number()),
    externalJobId: v.optional(v.string()),
    summary: v.optional(v.string()),
    error: v.optional(v.string()),
  })
    .index("by_workspace", ["workspaceId"])
    .index("by_workspace_and_status", ["workspaceId", "status"])
    .index("by_repository", ["repositoryId"]),
  agentRunEvents: defineTable({
    runId: v.id("agentRuns"),
    timestamp: v.number(),
    type: v.string(),
    payload: v.any(),
  }).index("by_run", ["runId"]),
});

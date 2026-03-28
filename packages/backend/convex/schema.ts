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
const taskStatusValidator = v.union(
  v.literal("drafting"),
  v.literal("awaiting_clarification"),
  v.literal("ready"),
  v.literal("executing"),
  v.literal("completed"),
  v.literal("failed"),
  v.literal("cancelled"),
);
const taskPhaseValidator = v.union(
  v.literal("intake"),
  v.literal("planning"),
  v.literal("clarification"),
  v.literal("execution"),
  v.literal("delivery"),
);
const taskQuestionStatusValidator = v.union(
  v.literal("pending"),
  v.literal("answered"),
  v.literal("dismissed"),
);
const taskRunKindValidator = v.union(
  v.literal("planning"),
  v.literal("clarification"),
  v.literal("execution"),
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
  tasks: defineTable({
    workspaceId: v.id("workspaces"),
    repositoryId: v.id("repositories"),
    branch: v.string(),
    title: v.string(),
    rawPrompt: v.string(),
    normalizedPrompt: v.optional(v.string()),
    status: taskStatusValidator,
    phase: taskPhaseValidator,
    createdByUserId: v.id("users"),
    plan: v.optional(v.string()),
    acceptanceCriteria: v.optional(v.array(v.string())),
    suggestedFiles: v.optional(
      v.array(
        v.object({
          path: v.string(),
          reason: v.optional(v.string()),
        }),
      ),
    ),
    latestSummary: v.optional(v.string()),
    latestError: v.optional(v.string()),
    activeRunId: v.optional(v.id("taskRuns")),
    planningRunId: v.optional(v.id("taskRuns")),
    executionRunId: v.optional(v.id("taskRuns")),
    readyForExecutionAt: v.optional(v.number()),
    completedAt: v.optional(v.number()),
    cancelledAt: v.optional(v.number()),
  })
    .index("by_workspace", ["workspaceId"])
    .index("by_workspace_and_status", ["workspaceId", "status"])
    .index("by_repository", ["repositoryId"]),
  taskQuestions: defineTable({
    taskId: v.id("tasks"),
    key: v.string(),
    question: v.string(),
    status: taskQuestionStatusValidator,
    answer: v.optional(v.string()),
    answeredAt: v.optional(v.number()),
  })
    .index("by_task", ["taskId"])
    .index("by_task_and_status", ["taskId", "status"]),
  taskRuns: defineTable({
    taskId: v.id("tasks"),
    workspaceId: v.id("workspaces"),
    repositoryId: v.id("repositories"),
    branch: v.string(),
    kind: taskRunKindValidator,
    status: runStatusValidator,
    requestedByUserId: v.id("users"),
    startedAt: v.optional(v.number()),
    completedAt: v.optional(v.number()),
    externalJobId: v.optional(v.string()),
    provider: v.optional(v.string()),
    model: v.optional(v.string()),
    summary: v.optional(v.string()),
    error: v.optional(v.string()),
  })
    .index("by_task", ["taskId"])
    .index("by_workspace", ["workspaceId"])
    .index("by_workspace_and_status", ["workspaceId", "status"]),
  taskRunEvents: defineTable({
    runId: v.id("taskRuns"),
    timestamp: v.number(),
    type: v.string(),
    payload: v.any(),
  }).index("by_run", ["runId"]),
});

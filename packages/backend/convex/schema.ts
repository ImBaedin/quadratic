import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

const roleValidator = v.union(v.literal("owner"), v.literal("admin"), v.literal("member"));
const workspaceStatusValidator = v.union(
  v.literal("active"),
  v.literal("invited"),
  v.literal("disabled"),
);
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

const taskKindValidator = v.union(
  v.literal("general"),
  v.literal("bug"),
  v.literal("feature"),
  v.literal("research"),
  v.literal("chore"),
  v.literal("breakdown"),
);

const taskStatusValidator = v.union(
  v.literal("draft"),
  v.literal("in_review"),
  v.literal("awaiting_clarification"),
  v.literal("ready"),
  v.literal("in_progress"),
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

const questionStatusValidator = v.union(
  v.literal("pending"),
  v.literal("answered"),
  v.literal("dismissed"),
);

const questionSourceValidator = v.union(
  v.literal("human"),
  v.literal("context_enrichment"),
  v.literal("task_breakdown"),
  v.literal("discussion_rereview"),
  v.literal("repo_analysis"),
  v.literal("repo_execution"),
);

const fieldValueKindValidator = v.union(
  v.literal("text"),
  v.literal("markdown"),
  v.literal("string_list"),
  v.literal("json"),
  v.literal("boolean"),
  v.literal("number"),
  v.literal("suggested_files"),
);

const fieldVisibilityValidator = v.union(
  v.literal("primary"),
  v.literal("secondary"),
  v.literal("telemetry"),
  v.literal("hidden"),
);

const fieldAiBehaviorValidator = v.union(
  v.literal("manual_only"),
  v.literal("suggestable"),
  v.literal("ai_default"),
);

const relationTypeValidator = v.union(
  v.literal("parent_child"),
  v.literal("blocked_by"),
  v.literal("blocks"),
  v.literal("references"),
  v.literal("duplicate_of"),
  v.literal("spawned_from"),
);

const runTargetTypeValidator = v.union(v.literal("task"), v.literal("repository"));

const workflowKindValidator = v.union(
  v.literal("context_enrichment"),
  v.literal("task_breakdown"),
  v.literal("discussion_rereview"),
  v.literal("repo_analysis"),
  v.literal("repo_execution"),
  v.literal("repository_sync"),
  v.literal("repository_explore"),
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

const proposalStatusValidator = v.union(
  v.literal("pending"),
  v.literal("applied"),
  v.literal("partially_applied"),
  v.literal("rejected"),
  v.literal("superseded"),
);

const proposalItemTypeValidator = v.union(
  v.literal("core_patch"),
  v.literal("field_value"),
  v.literal("context_entry"),
  v.literal("question"),
  v.literal("child_task"),
  v.literal("relation"),
);

const proposalItemActionValidator = v.union(
  v.literal("set"),
  v.literal("add"),
  v.literal("remove"),
  v.literal("create"),
);

const authorTypeValidator = v.union(v.literal("user"), v.literal("ai_run"), v.literal("system"));

const versionSourceTypeValidator = v.union(
  v.literal("create"),
  v.literal("manual_edit"),
  v.literal("proposal_apply"),
  v.literal("run_completion"),
  v.literal("question_answered"),
);

const reservationStatusValidator = v.union(
  v.literal("active"),
  v.literal("released"),
  v.literal("consumed"),
);

const usagePeriodStatusValidator = v.union(v.literal("open"), v.literal("closed"));

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
  workspaceAiPolicies: defineTable({
    workspaceId: v.id("workspaces"),
    enabled: v.boolean(),
    hardLimitTokens: v.number(),
    reserveTokensPerRun: v.number(),
    defaultModel: v.optional(v.string()),
  }).index("by_workspace", ["workspaceId"]),
  workspaceAiUsagePeriods: defineTable({
    workspaceId: v.id("workspaces"),
    periodKey: v.string(),
    startsAt: v.number(),
    endsAt: v.number(),
    inputTokens: v.number(),
    outputTokens: v.number(),
    totalTokens: v.number(),
    reservedTokens: v.number(),
    status: usagePeriodStatusValidator,
  })
    .index("by_workspace", ["workspaceId"])
    .index("by_workspace_and_period_key", ["workspaceId", "periodKey"]),
  workspaceAiReservations: defineTable({
    workspaceId: v.id("workspaces"),
    runId: v.optional(v.id("runs")),
    usagePeriodId: v.id("workspaceAiUsagePeriods"),
    reservedTokens: v.number(),
    status: reservationStatusValidator,
    createdByUserId: v.optional(v.id("users")),
    reason: v.optional(v.string()),
  })
    .index("by_workspace", ["workspaceId"])
    .index("by_run", ["runId"])
    .index("by_usage_period_id_and_status", ["usagePeriodId", "status"]),
  tasks: defineTable({
    workspaceId: v.id("workspaces"),
    primaryRepositoryId: v.optional(v.id("repositories")),
    branch: v.optional(v.string()),
    taskKind: taskKindValidator,
    title: v.string(),
    status: taskStatusValidator,
    phase: taskPhaseValidator,
    parentTaskId: v.optional(v.id("tasks")),
    activeRunId: v.optional(v.id("runs")),
    latestVersionId: v.optional(v.id("taskVersions")),
    createdByUserId: v.id("users"),
    latestSummary: v.optional(v.string()),
    latestError: v.optional(v.string()),
    completedAt: v.optional(v.number()),
  })
    .index("by_workspace", ["workspaceId"])
    .index("by_workspace_and_status", ["workspaceId", "status"])
    .index("by_parent_task_id", ["parentTaskId"])
    .index("by_primary_repository_id", ["primaryRepositoryId"]),
  taskFieldDefinitions: defineTable({
    workspaceId: v.id("workspaces"),
    key: v.string(),
    label: v.string(),
    description: v.optional(v.string()),
    valueKind: fieldValueKindValidator,
    visibility: fieldVisibilityValidator,
    aiBehavior: fieldAiBehaviorValidator,
    promptHint: v.optional(v.string()),
    taskKinds: v.array(taskKindValidator),
    archived: v.boolean(),
  })
    .index("by_workspace", ["workspaceId"])
    .index("by_workspace_and_key", ["workspaceId", "key"]),
  taskFieldValues: defineTable({
    taskId: v.id("tasks"),
    fieldDefinitionId: v.id("taskFieldDefinitions"),
    value: v.any(),
    updatedByUserId: v.optional(v.id("users")),
    updatedByRunId: v.optional(v.id("runs")),
    appliedFromProposalItemId: v.optional(v.id("taskProposalItems")),
  })
    .index("by_task", ["taskId"])
    .index("by_task_and_field_definition_id", ["taskId", "fieldDefinitionId"]),
  taskContextEntries: defineTable({
    taskId: v.id("tasks"),
    kind: v.string(),
    title: v.optional(v.string()),
    body: v.string(),
    metadata: v.optional(v.any()),
    createdByUserId: v.optional(v.id("users")),
    createdByRunId: v.optional(v.id("runs")),
    archived: v.boolean(),
  }).index("by_task", ["taskId"]),
  taskRelations: defineTable({
    taskId: v.id("tasks"),
    relatedTaskId: v.id("tasks"),
    relationType: relationTypeValidator,
    createdByUserId: v.optional(v.id("users")),
    createdByRunId: v.optional(v.id("runs")),
  })
    .index("by_task", ["taskId"])
    .index("by_related_task_id", ["relatedTaskId"])
    .index("by_task_and_relation_type", ["taskId", "relationType"]),
  taskQuestions: defineTable({
    taskId: v.id("tasks"),
    key: v.string(),
    question: v.string(),
    status: questionStatusValidator,
    source: questionSourceValidator,
    createdByRunId: v.optional(v.id("runs")),
    answer: v.optional(v.string()),
    answeredAt: v.optional(v.number()),
    answeredByUserId: v.optional(v.id("users")),
    answerSource: v.optional(v.string()),
  })
    .index("by_task", ["taskId"])
    .index("by_task_and_status", ["taskId", "status"]),
  taskDiscussions: defineTable({
    taskId: v.id("tasks"),
    authorType: authorTypeValidator,
    authorUserId: v.optional(v.id("users")),
    runId: v.optional(v.id("runs")),
    body: v.string(),
    triggerRereview: v.boolean(),
  }).index("by_task", ["taskId"]),
  taskVersions: defineTable({
    taskId: v.id("tasks"),
    createdByUserId: v.optional(v.id("users")),
    createdByRunId: v.optional(v.id("runs")),
    sourceType: versionSourceTypeValidator,
    sourceId: v.optional(v.string()),
    summary: v.optional(v.string()),
    snapshot: v.any(),
  }).index("by_task", ["taskId"]),
  taskProposals: defineTable({
    taskId: v.id("tasks"),
    runId: v.optional(v.id("runs")),
    workflowKind: workflowKindValidator,
    status: proposalStatusValidator,
    summary: v.optional(v.string()),
    rationale: v.optional(v.string()),
  })
    .index("by_task", ["taskId"])
    .index("by_run", ["runId"])
    .index("by_task_and_status", ["taskId", "status"]),
  taskProposalItems: defineTable({
    proposalId: v.id("taskProposals"),
    taskId: v.id("tasks"),
    itemType: proposalItemTypeValidator,
    action: proposalItemActionValidator,
    label: v.optional(v.string()),
    fieldKey: v.optional(v.string()),
    status: proposalStatusValidator,
    payload: v.any(),
    appliedEntityId: v.optional(v.string()),
  })
    .index("by_proposal", ["proposalId"])
    .index("by_task", ["taskId"])
    .index("by_proposal_and_status", ["proposalId", "status"]),
  runs: defineTable({
    workspaceId: v.id("workspaces"),
    targetType: runTargetTypeValidator,
    targetTaskId: v.optional(v.id("tasks")),
    targetRepositoryId: v.optional(v.id("repositories")),
    branch: v.optional(v.string()),
    runKind: workflowKindValidator,
    status: runStatusValidator,
    requestedByUserId: v.optional(v.id("users")),
    reservationId: v.optional(v.id("workspaceAiReservations")),
    provider: v.optional(v.string()),
    model: v.optional(v.string()),
    promptTemplateVersion: v.optional(v.string()),
    toolsetVersion: v.optional(v.string()),
    effectWorkflowKey: v.optional(v.string()),
    externalJobId: v.optional(v.string()),
    metadata: v.optional(v.any()),
    startedAt: v.optional(v.number()),
    completedAt: v.optional(v.number()),
    summary: v.optional(v.string()),
    error: v.optional(v.string()),
  })
    .index("by_workspace", ["workspaceId"])
    .index("by_workspace_and_status", ["workspaceId", "status"])
    .index("by_target_task_id", ["targetTaskId"])
    .index("by_target_repository_id", ["targetRepositoryId"]),
  runEvents: defineTable({
    runId: v.id("runs"),
    sequence: v.number(),
    timestamp: v.number(),
    type: v.string(),
    payload: v.any(),
  })
    .index("by_run", ["runId"])
    .index("by_run_and_sequence", ["runId", "sequence"]),
  runArtifacts: defineTable({
    runId: v.id("runs"),
    kind: v.string(),
    key: v.string(),
    label: v.optional(v.string()),
    contentType: v.optional(v.string()),
    url: v.optional(v.string()),
    metadata: v.optional(v.any()),
  }).index("by_run", ["runId"]),
  runUsage: defineTable({
    runId: v.id("runs"),
    workspaceId: v.id("workspaces"),
    provider: v.string(),
    model: v.string(),
    inputTokens: v.number(),
    outputTokens: v.number(),
    totalTokens: v.number(),
    estimatedCostUsd: v.optional(v.number()),
    periodKey: v.string(),
  })
    .index("by_run", ["runId"])
    .index("by_workspace_and_period_key", ["workspaceId", "periodKey"]),
});

import { ConvexError, v } from "convex/values";

import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import { internalMutation, mutation, query, type MutationCtx } from "./_generated/server";
import { requireWorkspaceMembership } from "./lib/auth";

const workflowKindValidator = v.union(
  v.literal("context_enrichment"),
  v.literal("task_breakdown"),
  v.literal("discussion_rereview"),
  v.literal("repo_analysis"),
  v.literal("repo_execution"),
  v.literal("repository_sync"),
  v.literal("repository_explore"),
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

const taskKindValues = ["general", "bug", "feature", "research", "chore", "breakdown"] as const;
const questionSourceValues = [
  "human",
  "context_enrichment",
  "task_breakdown",
  "discussion_rereview",
  "repo_analysis",
  "repo_execution",
] as const;
const relationTypeValues = [
  "parent_child",
  "blocked_by",
  "blocks",
  "references",
  "duplicate_of",
  "spawned_from",
] as const;
const taskStatusValues = [
  "draft",
  "in_review",
  "awaiting_clarification",
  "ready",
  "in_progress",
  "completed",
  "failed",
  "cancelled",
] as const;
const taskPhaseValues = ["intake", "planning", "clarification", "execution", "delivery"] as const;
const valueKindValues = [
  "text",
  "markdown",
  "string_list",
  "json",
  "boolean",
  "number",
  "suggested_files",
] as const;
const visibilityValues = ["primary", "secondary", "telemetry", "hidden"] as const;
const aiBehaviorValues = ["manual_only", "suggestable", "ai_default"] as const;

function isTaskKind(value: unknown): value is Doc<"tasks">["taskKind"] {
  return (
    typeof value === "string" && taskKindValues.includes(value as (typeof taskKindValues)[number])
  );
}

function isTaskStatus(value: unknown): value is Doc<"tasks">["status"] {
  return (
    typeof value === "string" &&
    taskStatusValues.includes(value as (typeof taskStatusValues)[number])
  );
}

function isQuestionSource(value: unknown): value is Doc<"taskQuestions">["source"] {
  return (
    typeof value === "string" &&
    questionSourceValues.includes(value as (typeof questionSourceValues)[number])
  );
}

function isTaskPhase(value: unknown): value is Doc<"tasks">["phase"] {
  return (
    typeof value === "string" && taskPhaseValues.includes(value as (typeof taskPhaseValues)[number])
  );
}

function isValueKind(value: unknown): value is Doc<"taskFieldDefinitions">["valueKind"] {
  return (
    typeof value === "string" && valueKindValues.includes(value as (typeof valueKindValues)[number])
  );
}

function isVisibility(value: unknown): value is Doc<"taskFieldDefinitions">["visibility"] {
  return (
    typeof value === "string" &&
    visibilityValues.includes(value as (typeof visibilityValues)[number])
  );
}

function isAiBehavior(value: unknown): value is Doc<"taskFieldDefinitions">["aiBehavior"] {
  return (
    typeof value === "string" &&
    aiBehaviorValues.includes(value as (typeof aiBehaviorValues)[number])
  );
}

function isRelationType(value: unknown): value is Doc<"taskRelations">["relationType"] {
  return (
    typeof value === "string" &&
    relationTypeValues.includes(value as (typeof relationTypeValues)[number])
  );
}

function assertRecord(value: unknown, message: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new ConvexError({
      code: "INVALID_ARGUMENT",
      message,
    });
  }

  return value as Record<string, unknown>;
}

async function requireProposalAccess(args: {
  ctx: MutationCtx;
  proposalId: Id<"taskProposals">;
  workosUserId: string;
}) {
  const proposal = await args.ctx.db.get(args.proposalId);
  if (!proposal) {
    throw new ConvexError({
      code: "NOT_FOUND",
      message: "Proposal not found.",
    });
  }

  const task = await args.ctx.db.get(proposal.taskId);
  if (!task) {
    throw new ConvexError({
      code: "NOT_FOUND",
      message: "Task not found.",
    });
  }

  const membership = await requireWorkspaceMembership({
    ctx: args.ctx,
    workspaceId: task.workspaceId,
    workosUserId: args.workosUserId,
  });

  return { proposal, task, membership };
}

async function recalculateProposalStatus(ctx: MutationCtx, proposalId: Id<"taskProposals">) {
  const items = await ctx.db
    .query("taskProposalItems")
    .withIndex("by_proposal", (query) => query.eq("proposalId", proposalId))
    .collect();
  const statuses = new Set(items.map((item: { status: string }) => item.status));

  let status: "pending" | "applied" | "partially_applied" | "rejected";
  if (statuses.size === 1 && statuses.has("pending")) {
    status = "pending";
  } else if (statuses.size === 1 && statuses.has("applied")) {
    status = "applied";
  } else if (statuses.size === 1 && statuses.has("rejected")) {
    status = "rejected";
  } else {
    status = "partially_applied";
  }

  await ctx.db.patch(proposalId, {
    status,
  });

  return status;
}

export const listForTask = query({
  args: {
    workosUserId: v.string(),
    taskId: v.id("tasks"),
  },
  returns: v.any(),
  handler: async (ctx, args) => {
    const task = await ctx.db.get(args.taskId);
    if (!task) {
      return [];
    }

    await requireWorkspaceMembership({
      ctx,
      workspaceId: task.workspaceId,
      workosUserId: args.workosUserId,
    });

    const proposals = await ctx.db
      .query("taskProposals")
      .withIndex("by_task", (query) => query.eq("taskId", args.taskId))
      .order("desc")
      .collect();

    return await Promise.all(
      proposals.map(async (proposal) => {
        const items = await ctx.db
          .query("taskProposalItems")
          .withIndex("by_proposal", (query) => query.eq("proposalId", proposal._id))
          .collect();

        return {
          proposalId: proposal._id,
          runId: proposal.runId,
          workflowKind: proposal.workflowKind,
          status: proposal.status,
          summary: proposal.summary,
          rationale: proposal.rationale,
          createdAt: proposal._creationTime,
          items: items.map((item) => ({
            itemId: item._id,
            itemType: item.itemType,
            action: item.action,
            label: item.label,
            fieldKey: item.fieldKey,
            status: item.status,
            payload: item.payload,
            appliedEntityId: item.appliedEntityId,
          })),
        };
      }),
    );
  },
});

export const apply = mutation({
  args: {
    workosUserId: v.string(),
    proposalId: v.id("taskProposals"),
    itemIds: v.optional(v.array(v.id("taskProposalItems"))),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { proposal, task, membership } = await requireProposalAccess({
      ctx,
      proposalId: args.proposalId,
      workosUserId: args.workosUserId,
    });
    const items = await ctx.db
      .query("taskProposalItems")
      .withIndex("by_proposal", (query) => query.eq("proposalId", proposal._id))
      .collect();

    const selectedIds = new Set((args.itemIds ?? items.map((item) => item._id)).map(String));

    for (const item of items) {
      if (!selectedIds.has(String(item._id)) || item.status !== "pending") {
        continue;
      }

      switch (item.itemType) {
        case "core_patch": {
          const payload = assertRecord(item.payload, "Proposal core patch payload is invalid.");
          await ctx.db.patch(task._id, {
            title: typeof payload.title === "string" ? payload.title : task.title,
            taskKind: isTaskKind(payload.taskKind) ? payload.taskKind : task.taskKind,
            status: isTaskStatus(payload.status) ? payload.status : task.status,
            phase: isTaskPhase(payload.phase) ? payload.phase : task.phase,
            branch: typeof payload.branch === "string" ? payload.branch : task.branch,
          });
          await ctx.db.patch(item._id, {
            status: "applied",
            appliedEntityId: String(task._id),
          });
          break;
        }
        case "field_value": {
          const payload = assertRecord(item.payload, "Proposal field payload is invalid.");
          const definition =
            typeof payload.definition === "object" && payload.definition !== null
              ? assertRecord(payload.definition, "Proposal field definition is invalid.")
              : null;

          if (
            item.fieldKey &&
            !(await ctx.db
              .query("taskFieldDefinitions")
              .withIndex("by_workspace_and_key", (query) =>
                query.eq("workspaceId", task.workspaceId).eq("key", item.fieldKey!),
              )
              .unique())
          ) {
            if (!definition) {
              throw new ConvexError({
                code: "NOT_FOUND",
                message: `Missing field definition for '${item.fieldKey}'.`,
              });
            }

            await ctx.db.insert("taskFieldDefinitions", {
              workspaceId: task.workspaceId,
              key: item.fieldKey!,
              label: typeof definition.label === "string" ? definition.label : item.fieldKey!,
              description:
                typeof definition.description === "string" ? definition.description : undefined,
              valueKind: isValueKind(definition.valueKind) ? definition.valueKind : "json",
              visibility: isVisibility(definition.visibility) ? definition.visibility : "secondary",
              aiBehavior: isAiBehavior(definition.aiBehavior)
                ? definition.aiBehavior
                : "suggestable",
              promptHint:
                typeof definition.promptHint === "string" ? definition.promptHint : undefined,
              taskKinds: Array.isArray(definition.taskKinds)
                ? definition.taskKinds.filter((value): value is Doc<"tasks">["taskKind"] =>
                    isTaskKind(value),
                  )
                : ["general", "bug", "feature", "research", "chore", "breakdown"],
              archived: false,
            });
          }

          if (!item.fieldKey) {
            throw new ConvexError({
              code: "INVALID_ARGUMENT",
              message: "Field proposal items must provide a fieldKey.",
            });
          }

          const entityId = await ctx.runMutation(internal.tasks.applyFieldValueFromProposal, {
            taskId: task._id,
            proposalItemId: item._id,
            fieldKey: item.fieldKey,
            value: payload.value,
            runId: proposal.runId,
            userId: membership.user._id,
          });

          await ctx.db.patch(item._id, {
            status: "applied",
            appliedEntityId: String(entityId),
          });
          break;
        }
        case "context_entry": {
          const payload = assertRecord(item.payload, "Proposal context payload is invalid.");
          const entityId = await ctx.runMutation(internal.tasks.addContextFromProposal, {
            taskId: task._id,
            kind: typeof payload.kind === "string" ? payload.kind : "note",
            title: typeof payload.title === "string" ? payload.title : undefined,
            body: typeof payload.body === "string" ? payload.body : JSON.stringify(payload),
            metadata: payload.metadata,
            runId: proposal.runId,
            userId: membership.user._id,
          });

          await ctx.db.patch(item._id, {
            status: "applied",
            appliedEntityId: String(entityId),
          });
          break;
        }
        case "question": {
          const payload = assertRecord(item.payload, "Proposal question payload is invalid.");
          const entityId = await ctx.runMutation(internal.tasks.createQuestionFromRun, {
            taskId: task._id,
            runId: proposal.runId,
            key:
              typeof payload.key === "string"
                ? payload.key
                : (item.fieldKey ?? `question-${item._id}`),
            question:
              typeof payload.question === "string"
                ? payload.question
                : typeof payload.body === "string"
                  ? payload.body
                  : "Clarify this task.",
            source: isQuestionSource(payload.source)
              ? payload.source
              : proposal.workflowKind === "task_breakdown"
                ? "task_breakdown"
                : proposal.workflowKind === "discussion_rereview"
                  ? "discussion_rereview"
                  : proposal.workflowKind === "repo_analysis"
                    ? "repo_analysis"
                    : "context_enrichment",
          });

          await ctx.db.patch(item._id, {
            status: "applied",
            appliedEntityId: String(entityId),
          });
          break;
        }
        case "child_task": {
          const payload = assertRecord(item.payload, "Proposal child task payload is invalid.");
          const entityId = await ctx.runMutation(internal.tasks.createChildTaskFromProposal, {
            parentTaskId: task._id,
            title: typeof payload.title === "string" ? payload.title : "Child task",
            prompt:
              typeof payload.prompt === "string"
                ? payload.prompt
                : typeof payload.body === "string"
                  ? payload.body
                  : "Follow the parent task breakdown.",
            taskKind: isTaskKind(payload.taskKind) ? payload.taskKind : "breakdown",
            branch: typeof payload.branch === "string" ? payload.branch : task.branch,
            runId: proposal.runId,
            userId: membership.user._id,
          });

          await ctx.db.patch(item._id, {
            status: "applied",
            appliedEntityId: String(entityId),
          });
          break;
        }
        case "relation": {
          const payload = assertRecord(item.payload, "Proposal relation payload is invalid.");
          const relatedTaskId =
            typeof payload.relatedTaskId === "string"
              ? (payload.relatedTaskId as Id<"tasks">)
              : null;
          if (!relatedTaskId) {
            throw new ConvexError({
              code: "INVALID_ARGUMENT",
              message: "Relation proposal items require a relatedTaskId.",
            });
          }

          const entityId = await ctx.runMutation(internal.tasks.addRelationFromProposal, {
            taskId: task._id,
            relatedTaskId,
            relationType: isRelationType(payload.relationType)
              ? payload.relationType
              : "references",
            runId: proposal.runId,
            userId: membership.user._id,
          });

          await ctx.db.patch(item._id, {
            status: "applied",
            appliedEntityId: String(entityId),
          });
          break;
        }
      }
    }

    const status = await recalculateProposalStatus(ctx, proposal._id);
    await ctx.runMutation(internal.tasks.recordVersionAfterProposal, {
      taskId: task._id,
      proposalId: proposal._id,
      runId: proposal.runId,
      userId: membership.user._id,
      summary: status === "applied" ? "Accepted AI proposal." : "Accepted part of an AI proposal.",
    });

    return null;
  },
});

export const reject = mutation({
  args: {
    workosUserId: v.string(),
    proposalId: v.id("taskProposals"),
    itemIds: v.optional(v.array(v.id("taskProposalItems"))),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { proposal } = await requireProposalAccess({
      ctx,
      proposalId: args.proposalId,
      workosUserId: args.workosUserId,
    });
    const items = await ctx.db
      .query("taskProposalItems")
      .withIndex("by_proposal", (query) => query.eq("proposalId", proposal._id))
      .collect();

    const selectedIds = new Set((args.itemIds ?? items.map((item) => item._id)).map(String));
    await Promise.all(
      items
        .filter((item) => selectedIds.has(String(item._id)) && item.status === "pending")
        .map((item) =>
          ctx.db.patch(item._id, {
            status: "rejected",
          }),
        ),
    );

    await recalculateProposalStatus(ctx, proposal._id);
    return null;
  },
});

export const createFromRun = internalMutation({
  args: {
    taskId: v.id("tasks"),
    runId: v.optional(v.id("runs")),
    workflowKind: workflowKindValidator,
    summary: v.optional(v.string()),
    rationale: v.optional(v.string()),
    items: v.array(
      v.object({
        itemType: proposalItemTypeValidator,
        action: proposalItemActionValidator,
        label: v.optional(v.string()),
        fieldKey: v.optional(v.string()),
        payload: v.any(),
      }),
    ),
  },
  returns: v.id("taskProposals"),
  handler: async (ctx, args) => {
    const proposalId = await ctx.db.insert("taskProposals", {
      taskId: args.taskId,
      runId: args.runId,
      workflowKind: args.workflowKind,
      status: "pending",
      summary: args.summary,
      rationale: args.rationale,
    });

    await Promise.all(
      args.items.map((item) =>
        ctx.db.insert("taskProposalItems", {
          proposalId,
          taskId: args.taskId,
          itemType: item.itemType,
          action: item.action,
          label: item.label,
          fieldKey: item.fieldKey,
          status: "pending",
          payload: item.payload,
        }),
      ),
    );

    return proposalId;
  },
});

export const markSuperseded = internalMutation({
  args: {
    proposalId: v.id("taskProposals"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await ctx.db.patch(args.proposalId, {
      status: "superseded",
    });
    return null;
  },
});

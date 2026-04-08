import { ConvexError, v } from "convex/values";

import type { Doc, Id } from "./_generated/dataModel";
import { internalMutation, query, type MutationCtx } from "./_generated/server";
import { requireWorkspaceMembership } from "./lib/auth";

function getCurrentPeriod() {
  const now = new Date();
  const startsAt = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).getTime();
  const endsAt = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1)).getTime();
  const periodKey = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;

  return {
    startsAt,
    endsAt,
    periodKey,
  };
}

type BudgetPolicy = Pick<
  Doc<"workspaceAiPolicies">,
  "enabled" | "hardLimitTokens" | "reserveTokensPerRun" | "defaultModel"
>;

const defaultBudgetPolicy: BudgetPolicy = {
  enabled: true,
  hardLimitTokens: 250_000,
  reserveTokensPerRun: 20_000,
  defaultModel: "openai/gpt-5.4-nano",
};

async function ensurePolicy(ctx: MutationCtx, workspaceId: Id<"workspaces">) {
  const existing = await ctx.db
    .query("workspaceAiPolicies")
    .withIndex("by_workspace", (query: any) => query.eq("workspaceId", workspaceId))
    .unique();

  if (existing) {
    return existing;
  }

  const policyId = await ctx.db.insert("workspaceAiPolicies", {
    workspaceId,
    ...defaultBudgetPolicy,
  });

  const policy = await ctx.db.get(policyId);
  if (!policy) {
    throw new ConvexError({
      code: "NOT_FOUND",
      message: "Workspace AI policy could not be loaded after creation.",
    });
  }

  return policy;
}

async function ensureUsagePeriod(ctx: MutationCtx, workspaceId: Id<"workspaces">) {
  const currentPeriod = getCurrentPeriod();
  const existing = await ctx.db
    .query("workspaceAiUsagePeriods")
    .withIndex("by_workspace_and_period_key", (query: any) =>
      query.eq("workspaceId", workspaceId).eq("periodKey", currentPeriod.periodKey),
    )
    .unique();

  if (existing) {
    return existing;
  }

  const periodId = await ctx.db.insert("workspaceAiUsagePeriods", {
    workspaceId,
    periodKey: currentPeriod.periodKey,
    startsAt: currentPeriod.startsAt,
    endsAt: currentPeriod.endsAt,
    inputTokens: 0,
    outputTokens: 0,
    totalTokens: 0,
    reservedTokens: 0,
    status: "open",
  });

  const period = await ctx.db.get(periodId);
  if (!period) {
    throw new ConvexError({
      code: "NOT_FOUND",
      message: "Workspace AI usage period could not be loaded after creation.",
    });
  }

  return period;
}

export const getWorkspaceAiStatus = query({
  args: {
    workosUserId: v.string(),
    workspaceId: v.id("workspaces"),
  },
  returns: v.any(),
  handler: async (ctx, args) => {
    await requireWorkspaceMembership({
      ctx,
      workspaceId: args.workspaceId,
      workosUserId: args.workosUserId,
    });

    const currentPeriod = getCurrentPeriod();
    const [existingPolicy, period, reservations] = await Promise.all([
      ctx.db
        .query("workspaceAiPolicies")
        .withIndex("by_workspace", (query) => query.eq("workspaceId", args.workspaceId))
        .unique(),
      ctx.db
        .query("workspaceAiUsagePeriods")
        .withIndex("by_workspace_and_period_key", (query) =>
          query.eq("workspaceId", args.workspaceId).eq("periodKey", currentPeriod.periodKey),
        )
        .unique(),
      ctx.db
        .query("workspaceAiReservations")
        .withIndex("by_workspace", (query) => query.eq("workspaceId", args.workspaceId))
        .collect(),
    ]);

    const policy = existingPolicy ?? {
      _id: undefined,
      workspaceId: args.workspaceId,
      ...defaultBudgetPolicy,
    };
    const usagePeriod = period ?? {
      _id: undefined,
      workspaceId: args.workspaceId,
      periodKey: currentPeriod.periodKey,
      startsAt: currentPeriod.startsAt,
      endsAt: currentPeriod.endsAt,
      inputTokens: 0,
      outputTokens: 0,
      totalTokens: 0,
      reservedTokens: 0,
      status: "open" as const,
    };

    const activeReservations = reservations.filter(
      (reservation: Doc<"workspaceAiReservations">) => reservation.status === "active",
    );

    return {
      workspaceId: args.workspaceId,
      enabled: policy.enabled,
      hardLimitTokens: policy.hardLimitTokens,
      reserveTokensPerRun: policy.reserveTokensPerRun,
      defaultModel: policy.defaultModel,
      currentPeriod: {
        periodKey: usagePeriod.periodKey,
        startsAt: usagePeriod.startsAt,
        endsAt: usagePeriod.endsAt,
        inputTokens: usagePeriod.inputTokens,
        outputTokens: usagePeriod.outputTokens,
        totalTokens: usagePeriod.totalTokens,
        reservedTokens: usagePeriod.reservedTokens,
        remainingTokens: Math.max(
          policy.hardLimitTokens - usagePeriod.totalTokens - usagePeriod.reservedTokens,
          0,
        ),
      },
      activeReservations: activeReservations.map((reservation: Doc<"workspaceAiReservations">) => ({
        reservationId: reservation._id,
        runId: reservation.runId,
        reservedTokens: reservation.reservedTokens,
        reason: reservation.reason,
        createdAt: reservation._creationTime,
      })),
    };
  },
});

export const reserveBudget = internalMutation({
  args: {
    workspaceId: v.id("workspaces"),
    requestedByUserId: v.optional(v.id("users")),
    runId: v.optional(v.id("runs")),
    reason: v.string(),
  },
  returns: v.object({
    reservationId: v.id("workspaceAiReservations"),
    policyId: v.id("workspaceAiPolicies"),
    usagePeriodId: v.id("workspaceAiUsagePeriods"),
    periodKey: v.string(),
    reservedTokens: v.number(),
  }),
  handler: async (ctx, args) => {
    const policy = await ensurePolicy(ctx, args.workspaceId);
    const usagePeriod = await ensureUsagePeriod(ctx, args.workspaceId);

    if (!policy.enabled) {
      throw new ConvexError({
        code: "AI_DISABLED",
        message: "AI is disabled for this workspace.",
      });
    }

    const projectedTotal =
      usagePeriod.totalTokens + usagePeriod.reservedTokens + policy.reserveTokensPerRun;
    if (projectedTotal > policy.hardLimitTokens) {
      throw new ConvexError({
        code: "AI_BUDGET_EXCEEDED",
        message: "Workspace AI budget exceeded.",
      });
    }

    const reservationId = await ctx.db.insert("workspaceAiReservations", {
      workspaceId: args.workspaceId,
      runId: args.runId,
      usagePeriodId: usagePeriod._id,
      reservedTokens: policy.reserveTokensPerRun,
      status: "active",
      createdByUserId: args.requestedByUserId,
      reason: args.reason,
    });

    await ctx.db.patch(usagePeriod._id, {
      reservedTokens: usagePeriod.reservedTokens + policy.reserveTokensPerRun,
    });

    return {
      reservationId,
      policyId: policy._id,
      usagePeriodId: usagePeriod._id,
      periodKey: usagePeriod.periodKey,
      reservedTokens: policy.reserveTokensPerRun,
    };
  },
});

export const attachReservationToRun = internalMutation({
  args: {
    reservationId: v.id("workspaceAiReservations"),
    runId: v.id("runs"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await ctx.db.patch(args.reservationId, {
      runId: args.runId,
    });
    return null;
  },
});

export const releaseReservation = internalMutation({
  args: {
    reservationId: v.id("workspaceAiReservations"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const reservation = await ctx.db.get(args.reservationId);
    if (!reservation || reservation.status !== "active") {
      return null;
    }

    const usagePeriod = await ctx.db.get(reservation.usagePeriodId);
    if (usagePeriod) {
      await ctx.db.patch(usagePeriod._id, {
        reservedTokens: Math.max(usagePeriod.reservedTokens - reservation.reservedTokens, 0),
      });
    }

    await ctx.db.patch(reservation._id, {
      status: "released",
    });

    return null;
  },
});

export const consumeReservation = internalMutation({
  args: {
    reservationId: v.id("workspaceAiReservations"),
    runId: v.id("runs"),
    workspaceId: v.id("workspaces"),
    provider: v.string(),
    model: v.string(),
    inputTokens: v.number(),
    outputTokens: v.number(),
    totalTokens: v.number(),
    estimatedCostUsd: v.optional(v.number()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const reservation = await ctx.db.get(args.reservationId);
    if (!reservation) {
      throw new ConvexError({
        code: "NOT_FOUND",
        message: "Budget reservation not found.",
      });
    }

    const usagePeriod = await ctx.db.get(reservation.usagePeriodId);
    if (!usagePeriod) {
      throw new ConvexError({
        code: "NOT_FOUND",
        message: "Usage period not found.",
      });
    }

    const existingUsage = await ctx.db
      .query("runUsage")
      .withIndex("by_run", (query) => query.eq("runId", args.runId))
      .unique();

    if (existingUsage) {
      await ctx.db.patch(existingUsage._id, {
        provider: args.provider,
        model: args.model,
        inputTokens: args.inputTokens,
        outputTokens: args.outputTokens,
        totalTokens: args.totalTokens,
        estimatedCostUsd: args.estimatedCostUsd,
        periodKey: usagePeriod.periodKey,
      });
    } else {
      await ctx.db.insert("runUsage", {
        runId: args.runId,
        workspaceId: args.workspaceId,
        provider: args.provider,
        model: args.model,
        inputTokens: args.inputTokens,
        outputTokens: args.outputTokens,
        totalTokens: args.totalTokens,
        estimatedCostUsd: args.estimatedCostUsd,
        periodKey: usagePeriod.periodKey,
      });
    }

    await ctx.db.patch(usagePeriod._id, {
      inputTokens: usagePeriod.inputTokens + args.inputTokens,
      outputTokens: usagePeriod.outputTokens + args.outputTokens,
      totalTokens: usagePeriod.totalTokens + args.totalTokens,
      reservedTokens: Math.max(usagePeriod.reservedTokens - reservation.reservedTokens, 0),
    });

    await ctx.db.patch(reservation._id, {
      status: "consumed",
    });

    return null;
  },
});

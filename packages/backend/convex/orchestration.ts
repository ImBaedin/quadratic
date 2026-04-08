"use node";

import { v } from "convex/values";

import { runEnvelopeSchema, runResultSchema } from "@quadratic/agent-runtime";
import { createInstallationAccessToken } from "@quadratic/github";

import { internal } from "./_generated/api";
import { internalAction } from "./_generated/server";

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is not configured`);
  }
  return value;
}

function readOrchestrationEnv() {
  return {
    githubApiBaseUrl: process.env.GITHUB_API_BASE_URL ?? "https://api.github.com",
    githubAppId: requireEnv("GITHUB_APP_ID"),
    githubAppPrivateKey: requireEnv("GITHUB_APP_PRIVATE_KEY"),
    repoActionsBaseUrl: requireEnv("REPO_ACTIONS_BASE_URL"),
    repoActionsToken: requireEnv("REPO_ACTIONS_TOKEN"),
  };
}

async function createGitHubToken(installationId: number) {
  const env = readOrchestrationEnv();

  const token = await createInstallationAccessToken({
    env: {
      GITHUB_API_BASE_URL: env.githubApiBaseUrl,
      GITHUB_APP_ID: env.githubAppId,
      GITHUB_APP_PRIVATE_KEY: env.githubAppPrivateKey,
    },
    installationId,
  });

  return token.token;
}

async function postToRepoActions(path: string, payload: unknown) {
  const env = readOrchestrationEnv();
  const response = await fetch(new URL(path, env.repoActionsBaseUrl), {
    method: "POST",
    headers: {
      authorization: `Bearer ${env.repoActionsToken}`,
      "content-type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const responseText = await response.text();
    const trimmed = responseText.trim();
    throw new Error(
      trimmed.length > 0
        ? `Repository actions service failed with status ${response.status}: ${trimmed}`
        : `Repository actions service failed with status ${response.status}`,
    );
  }

  return JSON.parse(await response.text());
}

export const dispatchRun = internalAction({
  args: {
    runId: v.id("runs"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    try {
      const context = await ctx.runQuery(internal.runs.getDispatchContext, {
        runId: args.runId,
      });

      await ctx.runMutation(internal.runs.transitionStatus, {
        runId: args.runId,
        status: "launching",
        summary: "Dispatching run to repository worker.",
      });

      let taskSnapshot: unknown;
      let repository = context.repository ?? undefined;

      if (context.targetType === "task" && context.targetTaskId) {
        taskSnapshot = await ctx.runQuery(internal.tasks.getAutomationContext, {
          taskId: context.targetTaskId,
        });

        if (
          !repository &&
          taskSnapshot &&
          typeof taskSnapshot === "object" &&
          taskSnapshot !== null
        ) {
          repository =
            "repository" in taskSnapshot
              ? (taskSnapshot.repository as typeof repository)
              : repository;
        }
      }

      const installationToken =
        repository?.githubInstallationId !== undefined
          ? await createGitHubToken(repository.githubInstallationId)
          : undefined;

      const request = runEnvelopeSchema.parse({
        runId: String(context._id ?? args.runId),
        workspaceId: String(context.workspaceId),
        targetType: context.targetType,
        targetTaskId: context.targetTaskId ? String(context.targetTaskId) : undefined,
        targetRepositoryId: context.targetRepositoryId
          ? String(context.targetRepositoryId)
          : undefined,
        branch: context.branch,
        runKind: context.runKind,
        requestedAt: new Date().toISOString(),
        provider: context.provider ?? "openrouter",
        model: context.model ?? "openai/gpt-5.4-nano",
        promptTemplateVersion: context.promptTemplateVersion ?? "planner-first-v1",
        toolsetVersion: context.toolsetVersion ?? "planner-first-v1",
        effectWorkflowKey: context.effectWorkflowKey ?? context.runKind,
        metadata: {
          installationToken,
        },
        task: taskSnapshot ?? undefined,
        repository: repository
          ? {
              repositoryId: String(repository.repositoryId),
              fullName: repository.fullName,
              owner: repository.owner,
              name: repository.name,
              defaultBranch: repository.defaultBranch,
              selected: repository.selected,
              archived: repository.archived,
              githubInstallationId: repository.githubInstallationId,
            }
          : undefined,
      });

      await ctx.runMutation(internal.runs.transitionStatus, {
        runId: args.runId,
        status: "running",
        summary: "Worker run is active.",
      });

      const json = await postToRepoActions("/runs/execute", request);
      const result = runResultSchema.parse(json);

      if (result.runId !== request.runId) {
        throw new Error("Repository actions service returned a mismatched run identifier.");
      }

      await ctx.runMutation(internal.runs.persistWorkerResult, {
        runId: args.runId,
        status: result.status,
        summary: result.summary,
        error: result.error,
        events: result.events.map((event) => ({
          type: event.type,
          sequence: event.sequence,
          payload: event.payload,
          timestamp: event.timestamp,
        })),
        artifacts: result.artifacts.map((artifact) => ({
          kind: artifact.kind,
          key: artifact.key,
          label: artifact.label,
          contentType: artifact.contentType,
          url: artifact.url,
          metadata: artifact.metadata,
        })),
        usage: result.usage
          ? {
              provider: result.usage.provider,
              model: result.usage.model,
              inputTokens: result.usage.inputTokens,
              outputTokens: result.usage.outputTokens,
              totalTokens: result.usage.totalTokens,
              estimatedCostUsd: result.usage.estimatedCostUsd,
            }
          : undefined,
        proposal: result.proposal
          ? {
              workflowKind: result.proposal.workflowKind,
              summary: result.proposal.summary,
              rationale: result.proposal.rationale,
              items: result.proposal.items.map((item) => ({
                itemType: item.itemType,
                action: item.action,
                label: item.label,
                fieldKey: item.fieldKey,
                payload: item.payload,
              })),
            }
          : undefined,
        execution: result.execution
          ? {
              status: result.execution.status,
              summary: result.execution.summary,
              error: result.execution.error,
            }
          : undefined,
      });
    } catch (error) {
      await ctx.runMutation(internal.runs.persistWorkerResult, {
        runId: args.runId,
        status: "failed",
        error: error instanceof Error ? error.message : "Run dispatch failed.",
        summary: "Worker dispatch failed.",
      });
    }

    return null;
  },
});

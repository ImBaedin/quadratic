"use node";

import { api, internal } from "./_generated/api";
import { internalAction } from "./_generated/server";
import { v } from "convex/values";
import {
  repositoryExecutionRequestSchema,
  repositoryExecutionResultSchema,
  taskPlanningRequestSchema,
  taskPlanningResultSchema,
} from "@quadratic/agent-runtime";
import { createInstallationAccessToken } from "@quadratic/github";

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
    throw new Error(`Repository actions service failed with status ${response.status}`);
  }

  return await response.json();
}

export const dispatchTaskPlanning = internalAction({
  args: {
    taskId: v.id("tasks"),
    runId: v.id("taskRuns"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    try {
      const context = await ctx.runQuery(internal.tasks.getPlanningContext, {
        taskId: args.taskId,
      });

      await ctx.runMutation(internal.tasks.transitionRunStatus, {
        runId: args.runId,
        status: "launching",
        summary: "Dispatching planning request.",
      });

      const githubToken = await createGitHubToken(context.repository.githubInstallationId);
      const request = taskPlanningRequestSchema.parse({
        taskId: String(context.taskId),
        runId: String(args.runId),
        workspaceId: String(context.workspaceId),
        repositoryId: String(context.repositoryId),
        githubInstallationId: String(context.repository.githubInstallationId),
        repositoryFullName: context.repository.fullName,
        branch: context.branch,
        requestedAt: new Date().toISOString(),
        metadata: {
          installationToken: githubToken,
          prompt: context.normalizedPrompt ?? context.rawPrompt,
          title: context.draft.title,
          existingQuestions: context.questions,
          existingDraft: context.draft,
          repository: context.repository,
        },
      });

      await ctx.runMutation(internal.tasks.transitionRunStatus, {
        runId: args.runId,
        status: "running",
        summary: "Planning request is running.",
      });

      const json = await postToRepoActions("/tasks/planning", request);
      const result = taskPlanningResultSchema.parse(json);

      if (result.taskId !== request.taskId || result.runId !== request.runId) {
        throw new Error("Repository actions service returned mismatched task planning identifiers.");
      }

      await ctx.runMutation(api.tasks.reportPlanningResult, {
        taskId: args.taskId,
        runId: args.runId,
        status: result.status,
        draft: result.draft,
        questions: result.questions,
        summary: result.summary,
        error: result.error,
        events: result.events,
      });
    } catch (error) {
      await ctx.runMutation(api.tasks.reportPlanningResult, {
        taskId: args.taskId,
        runId: args.runId,
        status: "failed",
        error: error instanceof Error ? error.message : "Task planning failed.",
        summary: "Planning dispatch failed.",
      });
    }

    return null;
  },
});

export const dispatchAgentRun = internalAction({
  args: {
    runId: v.id("agentRuns"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    try {
      const context = await ctx.runQuery(internal.agentRuns.getDispatchContext, {
        runId: args.runId,
      });
      if (!context) {
        throw new Error("Agent run not found.");
      }

      await ctx.runMutation(internal.agentRuns.transitionStatus, {
        runId: args.runId,
        status: "launching",
        summary: "Dispatching repository action.",
      });

      const githubToken = await createGitHubToken(context.repository.githubInstallationId);
      const request = repositoryExecutionRequestSchema.parse({
        runId: String(context.runId),
        workspaceId: String(context.workspaceId),
        repositoryId: String(context.repositoryId),
        githubInstallationId: String(context.repository.githubInstallationId),
        repositoryFullName: context.repository.fullName,
        branch: context.branch,
        kind: context.kind as "repository_sync" | "repository_explore" | "agent_tool",
        requestedAt: new Date().toISOString(),
        metadata: {
          installationToken: githubToken,
          repository: context.repository,
        },
      });

      await ctx.runMutation(internal.agentRuns.transitionStatus, {
        runId: args.runId,
        status: "running",
        summary: "Repository action is running.",
      });

      const json = await postToRepoActions("/runs", request);
      const result = repositoryExecutionResultSchema.parse(json);

      if (result.runId !== request.runId) {
        throw new Error("Repository actions service returned a mismatched run identifier.");
      }

      await ctx.runMutation(api.agentRuns.reportResult, {
        runId: args.runId,
        status: result.status,
        summary: result.summary,
        error: result.error,
      });
    } catch (error) {
      await ctx.runMutation(api.agentRuns.reportResult, {
        runId: args.runId,
        status: "failed",
        error: error instanceof Error ? error.message : "Repository action failed.",
        summary: "Repository action dispatch failed.",
      });
    }

    return null;
  },
});

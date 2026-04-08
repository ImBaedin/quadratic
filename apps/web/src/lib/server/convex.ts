import { api } from "@quadratic/backend/convex/_generated/api";
import { ConvexHttpClient } from "convex/browser";

import { serverEnv } from "@quadratic/env/server";

let client: ConvexHttpClient | null = null;

function getConvexClient() {
  if (!serverEnv.CONVEX_URL) {
    throw new Error("CONVEX_URL is not configured");
  }

  client ??= new ConvexHttpClient(serverEnv.CONVEX_URL);
  return client;
}

export async function syncCurrentUser(input: {
  workosUserId: string;
  email: string;
  firstName?: string;
  lastName?: string;
  avatarUrl?: string;
}) {
  return await getConvexClient().mutation(api.users.syncCurrentUser, input);
}

export async function listWorkspaces(workosUserId: string) {
  return await getConvexClient().query(api.workspaces.listForCurrentUser, { workosUserId });
}

export async function createWorkspace(args: { workosUserId: string; name: string }) {
  return await getConvexClient().mutation(api.workspaces.create, args);
}

export async function getWorkspace(args: { workosUserId: string; slug: string }) {
  return await getConvexClient().query(api.workspaces.getBySlug, args);
}

export async function listWorkspaceMembers(args: { workosUserId: string; workspaceId: string }) {
  return await getConvexClient().query(api.memberships.listForWorkspace, args as never);
}

export async function listInvites(args: { workosUserId: string; workspaceId: string }) {
  return await getConvexClient().query(api.invites.listForWorkspace, args as never);
}

export async function createInvite(args: {
  workosUserId: string;
  workspaceId: string;
  email: string;
  role: "owner" | "admin" | "member";
  workosInvitationId?: string;
}) {
  return await getConvexClient().mutation(api.invites.create, args as never);
}

export async function listInstallations(args: { workosUserId: string; workspaceId: string }) {
  return await getConvexClient().query(api.githubInstallations.listForWorkspace, args as never);
}

export async function getInstallationByGithubId(githubInstallationId: number) {
  return await getConvexClient().query(api.githubInstallations.getByGithubInstallationId, {
    githubInstallationId,
  });
}

export async function connectInstallation(args: {
  workosUserId: string;
  workspaceId: string;
  githubInstallationId: number;
  githubAccountLogin: string;
  githubAccountType: string;
  status: "pending" | "active" | "suspended" | "removed";
}) {
  return await getConvexClient().mutation(
    api.githubInstallations.connectWorkspaceInstallation,
    args as never,
  );
}

export async function listRepositories(args: { workosUserId: string; workspaceId: string }) {
  return await getConvexClient().query(api.repositories.listForWorkspace, args as never);
}

export async function refreshRepositories(args: {
  workosUserId: string;
  workspaceId: string;
  githubInstallationId: number;
  repositories: {
    githubRepoId: number;
    owner: string;
    name: string;
    fullName: string;
    isPrivate: boolean;
    defaultBranch: string;
    archived: boolean;
  }[];
}) {
  return await getConvexClient().mutation(api.repositories.refreshFromGitHub, args as never);
}

export async function setRepositorySelected(args: {
  workosUserId: string;
  repositoryId: string;
  selected: boolean;
}) {
  return await getConvexClient().mutation(api.repositories.setSelected, args as never);
}

export async function setRepositoryDefaultBranch(args: {
  workosUserId: string;
  repositoryId: string;
  defaultBranch: string;
}) {
  return await getConvexClient().mutation(api.repositories.setDefaultBranch, args as never);
}

export async function listAgentRuns(args: { workosUserId: string; workspaceId: string }) {
  return await getConvexClient().query(api.runs.listForWorkspace, args as never);
}

export async function requestAgentRun(args: {
  workosUserId: string;
  workspaceId: string;
  repositoryId: string;
  branch: string;
  kind: string;
}) {
  return await getConvexClient().mutation(api.runs.requestRepositoryRun, {
    workosUserId: args.workosUserId,
    workspaceId: args.workspaceId,
    repositoryId: args.repositoryId,
    branch: args.branch,
    runKind: args.kind,
  } as never);
}

export async function createTask(args: {
  workosUserId: string;
  workspaceId: string;
  repositoryId?: string;
  branch?: string;
  prompt: string;
  title?: string;
}) {
  return await getConvexClient().mutation(api.tasks.create, args as never);
}

export async function requestTaskPlanning(args: { workosUserId: string; taskId: string }) {
  return await getConvexClient().mutation(api.tasks.requestPlanning, args as never);
}

export async function getTask(args: { workosUserId: string; taskId: string }) {
  return await getConvexClient().query(api.tasks.get, args as never);
}

export async function listTasks(args: { workosUserId: string; workspaceId: string }) {
  return await getConvexClient().query(api.tasks.list, args as never);
}

export async function answerTaskQuestion(args: {
  workosUserId: string;
  questionId: string;
  answer: string;
}) {
  return await getConvexClient().mutation(api.tasks.answerQuestion, args as never);
}

export async function dismissTaskQuestion(args: { workosUserId: string; questionId: string }) {
  return await getConvexClient().mutation(api.tasks.dismissQuestion, args as never);
}

import {
  connectInstallation,
  createWorkspace,
  getWorkspace,
  listAgentRuns,
  listInstallations,
  listInvites,
  listRepositories,
  listWorkspaceMembers,
  listWorkspaces,
  syncCurrentUser,
} from "./convex";
import { getSession } from "./auth";

export async function ensureUserSynced(request: Request) {
  const session = await getSession(request);
  if (!session) {
    return null;
  }

  await syncCurrentUser({
    workosUserId: session.userId,
    email: session.email,
    firstName: session.firstName,
    lastName: session.lastName,
    avatarUrl: session.avatarUrl,
  });

  return session;
}

export async function getPlatformSession(request: Request) {
  const session = await ensureUserSynced(request);
  if (!session) {
    return null;
  }

  const workspaces = await listWorkspaces(session.userId);
  return {
    session,
    workspaces,
  };
}

export async function createWorkspaceForSession(request: Request, name: string) {
  const session = await ensureUserSynced(request);
  if (!session) {
    throw new Response("Unauthorized", { status: 401 });
  }

  return await createWorkspace({
    workosUserId: session.userId,
    name,
  });
}

export async function getWorkspaceBundle(request: Request, slug: string) {
  const session = await ensureUserSynced(request);
  if (!session) {
    throw new Response("Unauthorized", { status: 401 });
  }

  const workspace = await getWorkspace({
    workosUserId: session.userId,
    slug,
  });

  if (!workspace) {
    return null;
  }

  const [members, invites, installations, repositories, runs] = await Promise.all([
    listWorkspaceMembers({ workosUserId: session.userId, workspaceId: workspace.workspaceId }),
    listInvites({ workosUserId: session.userId, workspaceId: workspace.workspaceId }),
    listInstallations({ workosUserId: session.userId, workspaceId: workspace.workspaceId }),
    listRepositories({ workosUserId: session.userId, workspaceId: workspace.workspaceId }),
    listAgentRuns({ workosUserId: session.userId, workspaceId: workspace.workspaceId }),
  ]);

  return {
    session,
    workspace,
    members,
    invites,
    installations,
    repositories,
    runs,
  };
}

export async function connectGitHubInstallation(args: {
  request: Request;
  workspaceId: string;
  githubInstallationId: number;
  githubAccountLogin: string;
  githubAccountType: string;
}) {
  const session = await ensureUserSynced(args.request);
  if (!session) {
    throw new Response("Unauthorized", { status: 401 });
  }

  return await connectInstallation({
    workosUserId: session.userId,
    workspaceId: args.workspaceId,
    githubInstallationId: args.githubInstallationId,
    githubAccountLogin: args.githubAccountLogin,
    githubAccountType: args.githubAccountType,
    status: "active",
  });
}

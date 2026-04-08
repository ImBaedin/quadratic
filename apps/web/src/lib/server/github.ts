import {
  createInstallationAccessToken,
  listInstallationRepositories,
  normalizeGitHubWebhookEvent,
  readGitHubEnv,
  verifyGitHubWebhookSignature,
} from "@quadratic/github";

import { serverEnv } from "@quadratic/env/server";

function getGitHubEnv() {
  return readGitHubEnv(serverEnv);
}

export function getGitHubInstallUrl(args: { workspaceSlug: string; workspaceId: string }) {
  const env = getGitHubEnv();
  if (env.GITHUB_APP_INSTALL_URL) {
    const url = new URL(env.GITHUB_APP_INSTALL_URL);
    url.searchParams.set("state", Buffer.from(JSON.stringify(args)).toString("base64url"));
    return url.toString();
  }

  const url = new URL(`/apps/${env.GITHUB_APP_NAME}/installations/new`, env.GITHUB_WEB_BASE_URL);
  url.searchParams.set("state", Buffer.from(JSON.stringify(args)).toString("base64url"));
  return url.toString();
}

export function decodeGitHubInstallState(state: string | null) {
  if (!state) {
    return null;
  }

  return JSON.parse(Buffer.from(state, "base64url").toString("utf8")) as {
    workspaceSlug: string;
    workspaceId: string;
  };
}

export async function fetchInstallationRepositories(installationId: number) {
  const env = getGitHubEnv();
  const token = await createInstallationAccessToken({
    env,
    installationId,
  });

  return await listInstallationRepositories({
    env,
    token: token.token,
  });
}

export function verifyWebhookSignature(payload: string, signatureHeader: string | null) {
  const env = getGitHubEnv();
  return verifyGitHubWebhookSignature({
    secret: env.GITHUB_APP_WEBHOOK_SECRET,
    payload,
    signatureHeader,
  });
}

export function normalizeWebhookEvent(args: {
  event: string;
  action: string | null;
  payload: unknown;
}) {
  return normalizeGitHubWebhookEvent(args);
}

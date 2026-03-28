import { createPrivateKey, createSign } from "node:crypto";

import type { GitHubEnv } from "./env";

function toBase64Url(input: Buffer | string): string {
  return Buffer.from(input)
    .toString("base64")
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replaceAll("=", "");
}

export function createGitHubAppJwt(
  env: Pick<GitHubEnv, "GITHUB_APP_ID" | "GITHUB_APP_PRIVATE_KEY">,
  now = Math.floor(Date.now() / 1000),
): string {
  const header = toBase64Url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const payload = toBase64Url(
    JSON.stringify({
      iat: now - 60,
      exp: now + 9 * 60,
      iss: env.GITHUB_APP_ID,
    }),
  );
  const body = `${header}.${payload}`;
  const signer = createSign("RSA-SHA256");
  signer.update(body);
  signer.end();

  const privateKey = createPrivateKey(env.GITHUB_APP_PRIVATE_KEY);
  const signature = signer.sign(privateKey);
  return `${body}.${toBase64Url(signature)}`;
}

export async function createInstallationAccessToken(args: {
  env: Pick<
    GitHubEnv,
    "GITHUB_API_BASE_URL" | "GITHUB_APP_ID" | "GITHUB_APP_PRIVATE_KEY"
  >;
  installationId: string | number;
  repositories?: string[];
  permissions?: Record<string, "read" | "write">;
  fetchImpl?: typeof fetch;
}): Promise<{
  token: string;
  expiresAt: string;
  repositorySelection: "all" | "selected";
  permissions: Record<string, string>;
}> {
  const fetchImpl = args.fetchImpl ?? fetch;
  const jwt = createGitHubAppJwt(args.env);
  const response = await fetchImpl(
    `${args.env.GITHUB_API_BASE_URL}/app/installations/${args.installationId}/access_tokens`,
    {
      method: "POST",
      headers: {
        accept: "application/vnd.github+json",
        authorization: `Bearer ${jwt}`,
        "content-type": "application/json",
        "user-agent": "quadratic-github-app",
        "x-github-api-version": "2022-11-28",
      },
      body: JSON.stringify({
        repositories: args.repositories,
        permissions: args.permissions,
      }),
    },
  );

  if (!response.ok) {
    throw new Error(
      `GitHub installation token request failed with status ${response.status}`,
    );
  }

  const payload = (await response.json()) as {
    token: string;
    expires_at: string;
    repository_selection: "all" | "selected";
    permissions: Record<string, string>;
  };

  return {
    token: payload.token,
    expiresAt: payload.expires_at,
    repositorySelection: payload.repository_selection,
    permissions: payload.permissions,
  };
}

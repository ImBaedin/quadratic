import type { GitHubEnv } from "./env";
import { normalizeGitHubRepository } from "./normalization";

export async function githubApiRequest<TResponse>(args: {
  env: Pick<GitHubEnv, "GITHUB_API_BASE_URL">;
  path: string;
  token: string;
  method?: "GET" | "POST" | "PATCH" | "DELETE";
  body?: unknown;
  fetchImpl?: typeof fetch;
}): Promise<TResponse> {
  const fetchImpl = args.fetchImpl ?? fetch;
  const response = await fetchImpl(`${args.env.GITHUB_API_BASE_URL}${args.path}`, {
    method: args.method ?? "GET",
    headers: {
      accept: "application/vnd.github+json",
      authorization: `Bearer ${args.token}`,
      "content-type": "application/json",
      "user-agent": "quadratic-github-app",
      "x-github-api-version": "2022-11-28",
    },
    body: args.body ? JSON.stringify(args.body) : undefined,
  });

  if (!response.ok) {
    throw new Error(`GitHub API request failed with status ${response.status}`);
  }

  return (await response.json()) as TResponse;
}

export async function listInstallationRepositories(args: {
  env: Pick<GitHubEnv, "GITHUB_API_BASE_URL">;
  token: string;
  fetchImpl?: typeof fetch;
}) {
  const response = await githubApiRequest<{
    repositories: unknown[];
  }>({
    env: args.env,
    path: "/installation/repositories",
    token: args.token,
    fetchImpl: args.fetchImpl,
  });

  return response.repositories.map((repository) =>
    normalizeGitHubRepository(repository),
  );
}

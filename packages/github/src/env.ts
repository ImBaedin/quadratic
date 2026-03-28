import { z } from "zod";

const githubEnvSchema = z.object({
  GITHUB_APP_ID: z.string().min(1),
  GITHUB_APP_CLIENT_ID: z.string().min(1),
  GITHUB_APP_CLIENT_SECRET: z.string().min(1),
  GITHUB_APP_PRIVATE_KEY: z.string().min(1),
  GITHUB_APP_WEBHOOK_SECRET: z.string().min(1),
  GITHUB_APP_NAME: z.string().min(1).default("quadratic"),
  GITHUB_APP_INSTALL_URL: z.string().url().optional(),
  GITHUB_API_BASE_URL: z.string().url().default("https://api.github.com"),
  GITHUB_WEB_BASE_URL: z.string().url().default("https://github.com"),
});

export type GitHubEnv = z.infer<typeof githubEnvSchema>;

export function readGitHubEnv(env: Record<string, string | undefined>): GitHubEnv {
  return githubEnvSchema.parse(env);
}

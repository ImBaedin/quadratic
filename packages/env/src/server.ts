import { createEnv } from "@t3-oss/env-core";
import { z } from "zod";

const runtimeEnv = {
  ...(((globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env ??
    {}) as Record<string, string | undefined>),
  ...(((import.meta as ImportMeta & { env?: Record<string, string | undefined> }).env ?? {}) as Record<
    string,
    string | undefined
  >),
};

export const serverEnv = createEnv({
  server: {
    APP_URL: z.url().default("http://localhost:3001"),
    CONVEX_URL: z.url().optional(),
    GITHUB_APP_ID: z.string().optional(),
    GITHUB_APP_CLIENT_ID: z.string().optional(),
    GITHUB_APP_CLIENT_SECRET: z.string().optional(),
    GITHUB_APP_PRIVATE_KEY: z.string().optional(),
    GITHUB_APP_WEBHOOK_SECRET: z.string().optional(),
    GITHUB_APP_NAME: z.string().optional(),
    GITHUB_APP_INSTALL_URL: z.url().optional(),
    GITHUB_API_BASE_URL: z.url().default("https://api.github.com"),
    GITHUB_WEB_BASE_URL: z.url().default("https://github.com"),
    INNGEST_APP_ID: z.string().default("quadratic-web"),
    INNGEST_BASE_URL: z.url().optional(),
    INNGEST_EVENT_KEY: z.string().optional(),
    WORKOS_API_KEY: z.string().optional(),
    WORKOS_CLIENT_ID: z.string().optional(),
    WORKOS_COOKIE_PASSWORD: z.string().optional(),
    WORKOS_REDIRECT_URI: z.url().optional(),
    WORKOS_LOGOUT_REDIRECT_URI: z.url().optional(),
  },
  runtimeEnv,
  emptyStringAsUndefined: true,
});

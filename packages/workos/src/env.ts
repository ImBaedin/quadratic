import { z } from "zod";

const workosEnvSchema = z.object({
  WORKOS_CLIENT_ID: z.string().min(1),
  WORKOS_API_KEY: z.string().min(1),
  WORKOS_COOKIE_PASSWORD: z.string().min(32),
  WORKOS_REDIRECT_URI: z.string().url(),
  WORKOS_LOGOUT_REDIRECT_URI: z.string().url().optional(),
  WORKOS_BASE_URL: z.string().url().default("https://api.workos.com"),
});

export type WorkosEnv = z.infer<typeof workosEnvSchema>;

export function readWorkosEnv(env: Record<string, string | undefined>): WorkosEnv {
  return workosEnvSchema.parse(env);
}

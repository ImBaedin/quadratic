import { z } from "zod";

import type { WorkosEnv } from "./env";

export const authStateSchema = z.object({
  workspaceId: z.string().optional(),
  returnTo: z.string().optional(),
  invitationToken: z.string().optional(),
});

export type AuthState = z.infer<typeof authStateSchema>;

export function encodeAuthState(state: AuthState): string {
  return Buffer.from(JSON.stringify(authStateSchema.parse(state))).toString("base64url");
}

export function decodeAuthState(state: string | null | undefined): AuthState | null {
  if (!state) {
    return null;
  }

  const decoded = Buffer.from(state, "base64url").toString("utf8");
  return authStateSchema.parse(JSON.parse(decoded));
}

export function createWorkosAuthorizationUrl(args: {
  env: Pick<WorkosEnv, "WORKOS_BASE_URL" | "WORKOS_CLIENT_ID" | "WORKOS_REDIRECT_URI">;
  state?: AuthState;
  screenHint?: "sign-in" | "sign-up";
  prompt?: string;
}) {
  const url = new URL("/user_management/authorize", args.env.WORKOS_BASE_URL);
  url.searchParams.set("client_id", args.env.WORKOS_CLIENT_ID);
  url.searchParams.set("redirect_uri", args.env.WORKOS_REDIRECT_URI);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("provider", "authkit");
  if (args.state) {
    url.searchParams.set("state", encodeAuthState(args.state));
  }
  if (args.screenHint) {
    url.searchParams.set("screen_hint", args.screenHint);
  }
  if (args.prompt) {
    url.searchParams.set("prompt", args.prompt);
  }
  return url.toString();
}

export async function exchangeAuthorizationCode(args: {
  env: Pick<
    WorkosEnv,
    "WORKOS_API_KEY" | "WORKOS_BASE_URL" | "WORKOS_CLIENT_ID"
  >;
  code: string;
  invitationToken?: string;
  ipAddress?: string;
  userAgent?: string;
  fetchImpl?: typeof fetch;
}) {
  const fetchImpl = args.fetchImpl ?? fetch;
  const response = await fetchImpl(`${args.env.WORKOS_BASE_URL}/user_management/authenticate`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${args.env.WORKOS_API_KEY}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      client_id: args.env.WORKOS_CLIENT_ID,
      code: args.code,
      grant_type: "authorization_code",
      invitation_token: args.invitationToken,
      ip_address: args.ipAddress,
      user_agent: args.userAgent,
    }),
  });

  if (!response.ok) {
    const responseBody = await response.text();
    throw new Error(
      `WorkOS authorization exchange failed with status ${response.status}: ${responseBody || "empty response body"}`,
    );
  }

  return (await response.json()) as Record<string, unknown>;
}

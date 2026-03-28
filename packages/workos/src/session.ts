import { createHmac, timingSafeEqual } from "node:crypto";

import { z } from "zod";

const workosSessionSchema = z.object({
  userId: z.string(),
  email: z.string().email(),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  avatarUrl: z.string().url().optional(),
  accessToken: z.string().optional(),
  refreshToken: z.string().optional(),
  organizationIds: z.array(z.string()).default([]),
  activeWorkspaceId: z.string().optional(),
  expiresAt: z.string().datetime().optional(),
});

export type WorkosSession = z.infer<typeof workosSessionSchema>;

function sign(value: string, secret: string): string {
  return createHmac("sha256", secret).update(value).digest("base64url");
}

export function encodeWorkosSession(session: WorkosSession, secret: string): string {
  const payload = Buffer.from(
    JSON.stringify(workosSessionSchema.parse(session)),
  ).toString("base64url");
  return `${payload}.${sign(payload, secret)}`;
}

export function decodeWorkosSession(
  cookieValue: string | null | undefined,
  secret: string,
): WorkosSession | null {
  if (!cookieValue) {
    return null;
  }

  const [payload, signature] = cookieValue.split(".");
  if (!payload || !signature) {
    return null;
  }

  const expectedSignature = Buffer.from(sign(payload, secret));
  const providedSignature = Buffer.from(signature);
  if (
    expectedSignature.length !== providedSignature.length ||
    !timingSafeEqual(expectedSignature, providedSignature)
  ) {
    return null;
  }

  const decoded = Buffer.from(payload, "base64url").toString("utf8");
  return workosSessionSchema.parse(JSON.parse(decoded));
}

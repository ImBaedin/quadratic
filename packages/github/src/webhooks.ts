import { timingSafeEqual, createHmac } from "node:crypto";

import { z } from "zod";

import { normalizeGitHubInstallation, normalizeGitHubRepository } from "./normalization";

export function computeGitHubWebhookSignature(secret: string, payload: string): string {
  const digest = createHmac("sha256", secret).update(payload).digest("hex");
  return `sha256=${digest}`;
}

export function verifyGitHubWebhookSignature(args: {
  secret: string;
  payload: string;
  signatureHeader: string | null;
}): boolean {
  if (!args.signatureHeader) {
    return false;
  }

  const expected = Buffer.from(computeGitHubWebhookSignature(args.secret, args.payload));
  const provided = Buffer.from(args.signatureHeader);
  return expected.length === provided.length && timingSafeEqual(expected, provided);
}

const webhookEnvelopeSchema = z.object({
  installation: z.unknown().optional(),
  repository: z.unknown().optional(),
  repositories_added: z.array(z.unknown()).optional(),
  repositories_removed: z.array(z.unknown()).optional(),
});

export function normalizeGitHubWebhookEvent(args: {
  event: string;
  action: string | null;
  payload: unknown;
}) {
  const envelope = webhookEnvelopeSchema.parse(args.payload);
  return {
    event: args.event,
    action: args.action,
    installation: envelope.installation
      ? normalizeGitHubInstallation(envelope.installation)
      : undefined,
    repository: envelope.repository
      ? normalizeGitHubRepository(envelope.repository)
      : undefined,
    repositoriesAdded: (envelope.repositories_added ?? []).map((repository) =>
      normalizeGitHubRepository(repository),
    ),
    repositoriesRemoved: (envelope.repositories_removed ?? []).map((repository) =>
      normalizeGitHubRepository(repository),
    ),
  };
}

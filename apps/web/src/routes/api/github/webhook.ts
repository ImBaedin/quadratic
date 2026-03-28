import { createFileRoute } from "@tanstack/react-router";

import { getInstallationByGithubId } from "../../../lib/server/convex";
import { normalizeWebhookEvent, verifyWebhookSignature } from "../../../lib/server/github";
import { sendInngestEvent } from "../../../lib/server/inngest";

export const Route = createFileRoute("/api/github/webhook" as never)({
  server: {
    handlers: {
      POST: async ({ request }: { request: Request }) => {
    const payload = await request.text();
    const signature = request.headers.get("x-hub-signature-256");
    const event = request.headers.get("x-github-event");
    const parsedPayload = JSON.parse(payload) as { action?: unknown };

    if (!verifyWebhookSignature(payload, signature)) {
      return new Response("Invalid signature", { status: 401 });
    }

    if (!event) {
      return new Response("Missing event type", { status: 400 });
    }

    const normalized = normalizeWebhookEvent({
      event,
      action: typeof parsedPayload.action === "string" ? parsedPayload.action : null,
      payload: parsedPayload,
    });

    const installationId = normalized.installation?.id;
    const repositoryId = normalized.repository?.id;
    const installation = installationId ? await getInstallationByGithubId(installationId) : null;
    const workspaceId = installation?.workspaceId ?? `github-installation-${installationId ?? "unknown"}`;

    const eventName =
      event === "push"
        ? "repository.push_detected"
        : event === "installation_repositories"
          ? "github.installation.repositories_changed"
          : "github.installation.connected";

    await sendInngestEvent({
      name: eventName,
      data: {
        workspaceId,
        repositoryId: repositoryId ? String(repositoryId) : undefined,
        githubInstallationId: installationId ? String(installationId) : undefined,
        source: `github:${event}`,
        payload: {
          action: normalized.action,
          normalized,
        },
      },
    });

        return new Response("ok");
      },
    },
  },
});

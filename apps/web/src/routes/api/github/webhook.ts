import { createFileRoute } from "@tanstack/react-router";

import { normalizeWebhookEvent, verifyWebhookSignature } from "../../../lib/server/github";

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

    normalizeWebhookEvent({
      event,
      action: typeof parsedPayload.action === "string" ? parsedPayload.action : null,
      payload: parsedPayload,
    });

        return new Response("ok");
      },
    },
  },
});

import { inngestEventSchema, type InngestEventName } from "@quadratic/agent-runtime";
import { serverEnv } from "@quadratic/env/server";

export async function sendInngestEvent<TName extends InngestEventName>(args: {
  name: TName;
  data: {
    workspaceId: string;
    userId?: string;
    repositoryId?: string;
    runId?: string;
    githubInstallationId?: string;
    source?: string;
    payload?: Record<string, unknown>;
  };
}) {
  const event = inngestEventSchema.parse(args);

  if (!serverEnv.INNGEST_BASE_URL || !serverEnv.INNGEST_EVENT_KEY) {
    return {
      mode: "noop",
      event,
    };
  }

  const response = await fetch(`${serverEnv.INNGEST_BASE_URL}/e/${serverEnv.INNGEST_APP_ID}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${serverEnv.INNGEST_EVENT_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(event),
  });

  if (!response.ok) {
    throw new Error(`Failed to send Inngest event (${response.status})`);
  }

  return {
    mode: "live",
    event,
  };
}

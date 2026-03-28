import { createFileRoute } from "@tanstack/react-router";
import { repositoryExecutionResultSchema } from "@quadratic/agent-runtime";

import { reportAgentRun } from "../../lib/server/convex";

export const Route = createFileRoute("/api/inngest" as never)({
  server: {
    handlers: {
      POST: async ({ request }: { request: Request }) => {
        const json = await request.json();
        const result = repositoryExecutionResultSchema.parse(json);

        await reportAgentRun({
          runId: result.runId,
          status: result.status,
          summary: result.summary,
          error: result.error,
        });

        return new Response("ok");
      },
    },
  },
});

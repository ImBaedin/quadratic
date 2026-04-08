import { createFileRoute } from "@tanstack/react-router";

import { responseFromError } from "../../../lib/server/http";
import { getPlatformSession } from "../../../lib/server/platform";

export const Route = createFileRoute("/api/platform/session" as never)({
  server: {
    handlers: {
      GET: async ({ request }: { request: Request }) => {
        try {
          return Response.json((await getPlatformSession(request)) ?? { session: null, workspaces: [] });
        } catch (error) {
          return responseFromError(error, {
            context: "Failed to load platform session",
            fallbackMessage: "Failed to load platform session",
          });
        }
      },
    },
  },
});

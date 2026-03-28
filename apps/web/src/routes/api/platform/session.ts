import { createFileRoute } from "@tanstack/react-router";

import { getPlatformSession } from "../../../lib/server/platform";

export const Route = createFileRoute("/api/platform/session" as never)({
  server: {
    handlers: {
      GET: async ({ request }: { request: Request }) =>
        Response.json((await getPlatformSession(request)) ?? { session: null, workspaces: [] }),
    },
  },
});

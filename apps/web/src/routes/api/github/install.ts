import { createFileRoute } from "@tanstack/react-router";

import { getWorkspace } from "../../../lib/server/convex";
import { getGitHubInstallUrl } from "../../../lib/server/github";
import { ensureUserSynced } from "../../../lib/server/platform";

export const Route = createFileRoute("/api/github/install" as never)({
  server: {
    handlers: {
      GET: async ({ request }: { request: Request }) => {
        const url = new URL(request.url);
        const workspaceSlug = url.searchParams.get("workspaceSlug");
        if (!workspaceSlug) {
          return new Response("Workspace slug is required", { status: 400 });
        }

        const session = await ensureUserSynced(request);
        if (!session) {
          return new Response("Unauthorized", { status: 401 });
        }

        const workspace = await getWorkspace({ workosUserId: session.userId, slug: workspaceSlug });
        if (!workspace) {
          return new Response("Workspace not found", { status: 404 });
        }

        return new Response(null, {
          status: 302,
          headers: {
            Location: getGitHubInstallUrl({
              workspaceSlug,
              workspaceId: workspace.workspaceId,
            }),
          },
        });
      },
    },
  },
});

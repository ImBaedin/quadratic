import { createFileRoute } from "@tanstack/react-router";

import { responseFromError } from "../../../lib/server/http";
import { getWorkspace, requestAgentRun } from "../../../lib/server/convex";
import { ensureUserSynced } from "../../../lib/server/platform";

export const Route = createFileRoute("/api/platform/runs" as never)({
  server: {
    handlers: {
      POST: async ({ request }: { request: Request }) => {
        try {
          const formData = await request.formData();
          const workspaceSlug = formData.get("workspaceSlug");
          const repositoryId = formData.get("repositoryId");
          const branch = formData.get("branch");
          const kind = formData.get("kind");

          if (
            typeof workspaceSlug !== "string" ||
            typeof repositoryId !== "string" ||
            typeof branch !== "string" ||
            typeof kind !== "string"
          ) {
            return new Response("Missing required fields", { status: 400 });
          }

          const session = await ensureUserSynced(request);
          if (!session) {
            return new Response("Unauthorized", { status: 401 });
          }

          const workspace = await getWorkspace({ workosUserId: session.userId, slug: workspaceSlug });
          if (!workspace) {
            return new Response("Workspace not found", { status: 404 });
          }

          await requestAgentRun({
            workosUserId: session.userId,
            workspaceId: workspace.workspaceId,
            repositoryId,
            branch,
            kind,
          });

          return new Response(null, {
            status: 302,
            headers: {
              Location: `/${workspaceSlug}`,
            },
          });
        } catch (error) {
          return responseFromError(error, {
            context: "Failed to request repository run",
            fallbackMessage: "Failed to request repository run",
          });
        }
      },
    },
  },
});

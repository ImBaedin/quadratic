import { createFileRoute } from "@tanstack/react-router";

import { responseFromError } from "../../../lib/server/http";
import { createWorkspaceForSession } from "../../../lib/server/platform";

export const Route = createFileRoute("/api/platform/workspaces" as never)({
  server: {
    handlers: {
      POST: async ({ request }: { request: Request }) => {
        try {
          const formData = await request.formData();
          const name = formData.get("name");

          if (typeof name !== "string" || !name.trim()) {
            return new Response("Workspace name is required", { status: 400 });
          }

          const workspace = await createWorkspaceForSession(request, name);
          return new Response(null, {
            status: 302,
            headers: {
              Location: `/${workspace.slug}`,
            },
          });
        } catch (error) {
          return responseFromError(error, {
            context: "Failed to create workspace",
            fallbackMessage: "Failed to create workspace",
          });
        }
      },
    },
  },
});

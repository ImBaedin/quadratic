import { createFileRoute } from "@tanstack/react-router";

import { responseFromError } from "../../../lib/server/http";
import { createInvite, getWorkspace } from "../../../lib/server/convex";
import { ensureUserSynced } from "../../../lib/server/platform";

export const Route = createFileRoute("/api/platform/invites" as never)({
  server: {
    handlers: {
      POST: async ({ request }: { request: Request }) => {
        try {
          const formData = await request.formData();
          const workspaceSlug = formData.get("workspaceSlug");
          const email = formData.get("email");
          const role = formData.get("role");

          if (
            typeof workspaceSlug !== "string" ||
            typeof email !== "string" ||
            typeof role !== "string"
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

          await createInvite({
            workosUserId: session.userId,
            workspaceId: workspace.workspaceId,
            email,
            role: role === "admin" ? "admin" : "member",
          });

          return new Response(null, {
            status: 302,
            headers: {
              Location: `/${workspaceSlug}/settings/members`,
            },
          });
        } catch (error) {
          return responseFromError(error, {
            context: "Failed to create workspace invite",
            fallbackMessage: "Failed to create workspace invite",
          });
        }
      },
    },
  },
});

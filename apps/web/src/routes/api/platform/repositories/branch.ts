import { createFileRoute } from "@tanstack/react-router";

import { responseFromError } from "../../../../lib/server/http";
import { setRepositoryDefaultBranch } from "../../../../lib/server/convex";
import { ensureUserSynced } from "../../../../lib/server/platform";

export const Route = createFileRoute("/api/platform/repositories/branch" as never)({
  server: {
    handlers: {
      POST: async ({ request }: { request: Request }) => {
        try {
          const formData = await request.formData();
          const workspaceSlug = formData.get("workspaceSlug");
          const repositoryId = formData.get("repositoryId");
          const defaultBranch = formData.get("defaultBranch");

          if (
            typeof workspaceSlug !== "string" ||
            typeof repositoryId !== "string" ||
            typeof defaultBranch !== "string"
          ) {
            return new Response("Missing required fields", { status: 400 });
          }

          const session = await ensureUserSynced(request);
          if (!session) {
            return new Response("Unauthorized", { status: 401 });
          }

          await setRepositoryDefaultBranch({
            workosUserId: session.userId,
            repositoryId,
            defaultBranch,
          });

          return new Response(null, {
            status: 302,
            headers: {
              Location: `/${workspaceSlug}/settings/repositories`,
            },
          });
        } catch (error) {
          return responseFromError(error, {
            context: "Failed to update repository default branch",
            fallbackMessage: "Failed to update repository default branch",
          });
        }
      },
    },
  },
});

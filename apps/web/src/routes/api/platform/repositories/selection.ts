import { createFileRoute } from "@tanstack/react-router";

import { getWorkspace, setRepositorySelected } from "../../../../lib/server/convex";
import { ensureUserSynced } from "../../../../lib/server/platform";
import { sendInngestEvent } from "../../../../lib/server/inngest";

export const Route = createFileRoute("/api/platform/repositories/selection" as never)({
  server: {
    handlers: {
      POST: async ({ request }: { request: Request }) => {
    const formData = await request.formData();
    const workspaceSlug = formData.get("workspaceSlug");
    const repositoryId = formData.get("repositoryId");
    const selected = formData.get("selected");

    if (
      typeof workspaceSlug !== "string" ||
      typeof repositoryId !== "string" ||
      typeof selected !== "string"
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

    await setRepositorySelected({
      workosUserId: session.userId,
      repositoryId,
      selected: selected === "true",
    });

    await sendInngestEvent({
      name: "repository.selected",
      data: {
        workspaceId: workspace.workspaceId,
        repositoryId,
        userId: session.userId,
        source: "web",
      },
    });

        return new Response(null, {
          status: 302,
          headers: {
            Location: `/${workspaceSlug}/settings/repositories`,
          },
        });
      },
    },
  },
});

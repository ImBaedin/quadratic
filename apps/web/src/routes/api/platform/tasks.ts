import { createFileRoute } from "@tanstack/react-router";

import { responseFromError } from "../../../lib/server/http";
import { createTask, getWorkspace, requestTaskPlanning } from "../../../lib/server/convex";
import { ensureUserSynced } from "../../../lib/server/platform";

export const Route = createFileRoute("/api/platform/tasks" as never)({
  server: {
    handlers: {
      POST: async ({ request }: { request: Request }) => {
        try {
          const contentType = request.headers.get("content-type") ?? "";
          const payload = contentType.includes("application/json")
            ? await request.json()
            : Object.fromEntries(await request.formData());

          const workspaceSlug = payload.workspaceSlug;
          const repositoryId = payload.repositoryId;
          const branch = payload.branch;
          const prompt = payload.prompt;
          const title = payload.title;

          if (
            typeof workspaceSlug !== "string" ||
            typeof repositoryId !== "string" ||
            typeof branch !== "string" ||
            typeof prompt !== "string"
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

          const taskId = await createTask({
            workosUserId: session.userId,
            workspaceId: workspace.workspaceId,
            repositoryId,
            branch,
            prompt,
            title: typeof title === "string" ? title : undefined,
          });

          const planningRunId = await requestTaskPlanning({
            workosUserId: session.userId,
            taskId,
          });

          const result = {
            taskId,
            planningRunId,
          };

          if (contentType.includes("application/json")) {
            return Response.json(result, { status: 201 });
          }

          return new Response(null, {
            status: 302,
            headers: {
              Location: `/${workspaceSlug}`,
            },
          });
        } catch (error) {
          return responseFromError(error, {
            context: "Failed to create task",
            fallbackMessage: "Failed to create task",
          });
        }
      },
    },
  },
});

import { createFileRoute } from "@tanstack/react-router";

import { getWorkspaceBundle } from "../../../lib/server/platform";

export const Route = createFileRoute("/api/platform/workspace" as never)({
  server: {
    handlers: {
      GET: async ({ request }: { request: Request }) => {
        const url = new URL(request.url);
        const slug = url.searchParams.get("slug");
        if (!slug) {
          return new Response("Workspace slug is required", { status: 400 });
        }

        const bundle = await getWorkspaceBundle(request, slug);
        if (!bundle) {
          return new Response("Workspace not found", { status: 404 });
        }

        return Response.json(bundle);
      },
    },
  },
});

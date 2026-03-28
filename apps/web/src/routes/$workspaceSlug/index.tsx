import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/$workspaceSlug/" as never)({
  loader: ({ params }) => {
    throw redirect({ to: `/${params.workspaceSlug}/tasks` });
  },
});

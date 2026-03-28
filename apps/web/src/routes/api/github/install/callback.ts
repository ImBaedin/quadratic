import { createFileRoute } from "@tanstack/react-router";

import { connectGitHubInstallation, ensureUserSynced } from "../../../../lib/server/platform";
import { decodeGitHubInstallState, fetchInstallationRepositories } from "../../../../lib/server/github";
import { refreshRepositories } from "../../../../lib/server/convex";
import { sendInngestEvent } from "../../../../lib/server/inngest";

export const Route = createFileRoute("/api/github/install/callback" as never)({
  server: {
    handlers: {
      GET: async ({ request }: { request: Request }) => {
    const url = new URL(request.url);
    const installationIdRaw = url.searchParams.get("installation_id");
    const setupAction = url.searchParams.get("setup_action");
    const state = decodeGitHubInstallState(url.searchParams.get("state"));

    if (!installationIdRaw || !state) {
      return new Response("Missing installation context", { status: 400 });
    }

    const installationId = Number(installationIdRaw);

    await connectGitHubInstallation({
      request,
      workspaceId: state.workspaceId,
      githubInstallationId: installationId,
      githubAccountLogin: `installation-${installationId}`,
      githubAccountType: "Organization",
    });

    const repositories = await fetchInstallationRepositories(installationId);
    const session = await ensureUserSynced(request);
    if (session) {
      await refreshRepositories({
        workosUserId: session.userId,
        workspaceId: state.workspaceId,
        githubInstallationId: installationId,
        repositories: repositories.map((repository) => ({
          githubRepoId: repository.id,
          owner: repository.owner,
          name: repository.name,
          fullName: repository.fullName,
          isPrivate: repository.private,
          defaultBranch: repository.defaultBranch,
          archived: repository.archived,
        })),
      });

      await sendInngestEvent({
        name: "github.installation.connected",
        data: {
          workspaceId: state.workspaceId,
          userId: session.userId,
          githubInstallationId: String(installationId),
          payload: { setupAction },
          source: "github_install_callback",
        },
      });
    }

        return new Response(null, {
          status: 302,
          headers: {
            Location: `/${state.workspaceSlug}/settings/github`,
          },
        });
      },
    },
  },
});

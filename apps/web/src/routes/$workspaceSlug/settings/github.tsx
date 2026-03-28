import { createFileRoute } from "@tanstack/react-router";

import { WorkspaceShell } from "../../../components/workspace/shell";
import { useJson } from "../../../components/workspace/use-json";

export const Route = createFileRoute("/$workspaceSlug/settings/github" as never)({
  component: WorkspaceGitHubPage,
});

function WorkspaceGitHubPage() {
  const { workspaceSlug } = Route.useParams();
  const workspace = useJson<{
    workspace: { name: string; workspaceId: string };
    installations: { installationId: string; githubInstallationId: number; githubAccountLogin: string; status: string }[];
  }>(`/api/platform/workspace?slug=${workspaceSlug}`);

  return (
    <WorkspaceShell workspaceSlug={workspaceSlug} title={workspace.data?.workspace.name ?? workspaceSlug} eyebrow="GitHub App">
      <section className="grid gap-6 lg:grid-cols-[1fr_1.2fr]">
        <div className="rounded-[1.5rem] border border-zinc-800 bg-zinc-950 p-6">
          <h2 className="text-xl font-medium text-white">Install the GitHub App</h2>
          <p className="mt-3 text-sm text-zinc-400">
            The installation callback links the GitHub installation to this workspace, and the webhook route
            updates metadata or enqueues runs without doing heavy work inline.
          </p>
          <a
            href={`/api/github/install?workspaceSlug=${workspaceSlug}`}
            className="mt-6 inline-flex rounded-full bg-sky-400 px-5 py-3 text-sm font-medium text-zinc-950"
          >
            Open GitHub installation flow
          </a>
        </div>
        <div className="rounded-[1.5rem] border border-zinc-800 bg-zinc-950 p-6">
          <h2 className="text-xl font-medium text-white">Linked installations</h2>
          <div className="mt-4 grid gap-3">
            {(workspace.data?.installations ?? []).map((installation) => (
              <div key={installation.installationId} className="rounded-2xl border border-zinc-800 px-4 py-3 text-sm text-zinc-200">
                {installation.githubAccountLogin}
                <span className="ml-2 text-zinc-500">#{installation.githubInstallationId}</span>
                <span className="ml-2 text-zinc-500">{installation.status}</span>
              </div>
            ))}
          </div>
        </div>
      </section>
    </WorkspaceShell>
  );
}

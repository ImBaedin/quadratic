import { createFileRoute } from "@tanstack/react-router";

import { WorkspaceShell } from "../../components/workspace/shell";
import { useJson } from "../../components/workspace/use-json";

export const Route = createFileRoute("/$workspaceSlug/" as never)({
  component: WorkspaceOverviewPage,
});

function WorkspaceOverviewPage() {
  const { workspaceSlug } = Route.useParams();
  const workspace = useJson<{
    workspace: { name: string; slug: string; role: string };
    repositories: { repositoryId: string; fullName: string; defaultBranch: string; selected: boolean }[];
    runs: { runId: string; kind: string; branch: string; status: string; summary?: string }[];
    invites: { inviteId: string; email: string; role: string; status: string }[];
  }>(`/api/platform/workspace?slug=${workspaceSlug}`);

  return (
    <WorkspaceShell workspaceSlug={workspaceSlug} title={workspace.data?.workspace.name ?? workspaceSlug} eyebrow="Workspace overview">
      <section className="grid gap-6 lg:grid-cols-3">
        <div className="rounded-[1.5rem] border border-zinc-800 bg-zinc-950 p-6 lg:col-span-2">
          <h2 className="text-xl font-medium text-white">Connected repositories</h2>
          <div className="mt-4 grid gap-3">
            {(workspace.data?.repositories ?? []).map((repository) => (
              <div key={repository.repositoryId} className="rounded-2xl border border-zinc-800 px-4 py-3 text-sm text-zinc-200">
                {repository.fullName}
                <span className="ml-2 text-zinc-500">{repository.defaultBranch}</span>
                <span className="ml-2 text-zinc-500">{repository.selected ? "selected" : "available"}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="rounded-[1.5rem] border border-zinc-800 bg-zinc-950 p-6">
          <h2 className="text-xl font-medium text-white">Pending invites</h2>
          <div className="mt-4 grid gap-3">
            {(workspace.data?.invites ?? []).map((invite) => (
              <div key={invite.inviteId} className="rounded-2xl border border-zinc-800 px-4 py-3 text-sm text-zinc-200">
                {invite.email}
                <span className="ml-2 text-zinc-500">{invite.role}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="rounded-[1.5rem] border border-zinc-800 bg-zinc-950 p-6">
        <h2 className="text-xl font-medium text-white">Recent runs</h2>
        <div className="mt-4 grid gap-3">
          {(workspace.data?.runs ?? []).map((run) => (
            <div key={run.runId} className="rounded-2xl border border-zinc-800 px-4 py-3 text-sm text-zinc-200">
              {run.kind} on {run.branch}
              <span className="ml-2 text-zinc-500">{run.status}</span>
              {run.summary ? <p className="mt-1 text-zinc-400">{run.summary}</p> : null}
            </div>
          ))}
        </div>
      </section>
    </WorkspaceShell>
  );
}

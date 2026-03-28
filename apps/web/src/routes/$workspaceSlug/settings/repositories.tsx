import { createFileRoute } from "@tanstack/react-router";

import { WorkspaceShell } from "../../../components/workspace/shell";
import { useJson } from "../../../components/workspace/use-json";

export const Route = createFileRoute("/$workspaceSlug/settings/repositories" as never)({
  component: WorkspaceRepositoriesPage,
});

function WorkspaceRepositoriesPage() {
  const { workspaceSlug } = Route.useParams();
  const workspace = useJson<{
    workspace: { name: string };
    repositories: { repositoryId: string; fullName: string; selected: boolean; defaultBranch: string }[];
  }>(`/api/platform/workspace?slug=${workspaceSlug}`);

  return (
    <WorkspaceShell workspaceSlug={workspaceSlug} title={workspace.data?.workspace.name ?? workspaceSlug} eyebrow="Repositories">
      <section className="rounded-[1.5rem] border border-zinc-800 bg-zinc-950 p-6">
        <h2 className="text-xl font-medium text-white">Connected repositories</h2>
        <div className="mt-4 grid gap-4">
          {(workspace.data?.repositories ?? []).map((repository) => (
            <div key={repository.repositoryId} className="rounded-2xl border border-zinc-800 p-4">
              <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                <div>
                  <div className="text-sm text-white">{repository.fullName}</div>
                  <div className="text-xs text-zinc-500">Default branch: {repository.defaultBranch}</div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <form action="/api/platform/repositories/selection" method="post">
                    <input type="hidden" name="workspaceSlug" value={workspaceSlug} />
                    <input type="hidden" name="repositoryId" value={repository.repositoryId} />
                    <input type="hidden" name="selected" value={repository.selected ? "false" : "true"} />
                    <button className="rounded-full border border-zinc-700 px-4 py-2 text-xs text-zinc-200">
                      {repository.selected ? "Disconnect" : "Select"}
                    </button>
                  </form>
                  <form action="/api/platform/repositories/branch" method="post" className="flex gap-2">
                    <input type="hidden" name="workspaceSlug" value={workspaceSlug} />
                    <input type="hidden" name="repositoryId" value={repository.repositoryId} />
                    <input
                      name="defaultBranch"
                      defaultValue={repository.defaultBranch}
                      className="rounded-full border border-zinc-700 bg-zinc-900 px-4 py-2 text-xs text-white"
                    />
                    <button className="rounded-full bg-sky-400 px-4 py-2 text-xs font-medium text-zinc-950">
                      Save branch
                    </button>
                  </form>
                  <form action="/api/platform/runs" method="post">
                    <input type="hidden" name="workspaceSlug" value={workspaceSlug} />
                    <input type="hidden" name="repositoryId" value={repository.repositoryId} />
                    <input type="hidden" name="branch" value={repository.defaultBranch} />
                    <input type="hidden" name="kind" value="repository_sync" />
                    <button className="rounded-full border border-emerald-700 px-4 py-2 text-xs text-emerald-300">
                      Trigger run
                    </button>
                  </form>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>
    </WorkspaceShell>
  );
}

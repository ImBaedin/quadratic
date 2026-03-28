import { createFileRoute } from "@tanstack/react-router";

import { WorkspaceLayout } from "../../../components/workspace-layout";
import { useJson } from "../../../components/workspace/use-json";
import { Button } from "@quadratic/ui/components/button";
import { Card, CardContent, CardHeader, CardTitle } from "@quadratic/ui/components/card";

export const Route = createFileRoute("/$workspaceSlug/settings/repositories" as never)({
  component: WorkspaceRepositoriesPage,
});

function WorkspaceRepositoriesPage() {
  const { workspaceSlug } = Route.useParams();
  const workspace = useJson<{
    workspace: { name: string };
    repositories: {
      repositoryId: string;
      fullName: string;
      selected: boolean;
      defaultBranch: string;
    }[];
  }>(`/api/platform/workspace?slug=${workspaceSlug}`);

  return (
    <WorkspaceLayout
      workspaceSlug={workspaceSlug}
      workspaceName={workspace.data?.workspace.name}
      breadcrumbs={[
        { label: workspaceSlug },
        { label: "Settings", href: `/${workspaceSlug}/settings` },
        { label: "Repositories" },
      ]}
    >
      <div>
        <h1 className="font-heading text-lg font-semibold">Repositories</h1>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Select which repositories the agent can access.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Connected repositories</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {(workspace.data?.repositories ?? []).length === 0 ? (
            <p className="text-xs text-muted-foreground">No repositories connected yet.</p>
          ) : (
            (workspace.data?.repositories ?? []).map((repository) => (
              <div
                key={repository.repositoryId}
                className="flex flex-col gap-3 rounded-lg border border-border/60 p-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <div className="text-xs font-medium text-foreground">{repository.fullName}</div>
                  <div className="mt-0.5 text-[0.65rem] text-muted-foreground">
                    Default branch: {repository.defaultBranch}
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <form action="/api/platform/repositories/selection" method="post">
                    <input type="hidden" name="workspaceSlug" value={workspaceSlug} />
                    <input type="hidden" name="repositoryId" value={repository.repositoryId} />
                    <input type="hidden" name="selected" value={repository.selected ? "false" : "true"} />
                    <Button type="submit" variant="outline" size="sm">
                      {repository.selected ? "Disconnect" : "Select"}
                    </Button>
                  </form>
                  <form action="/api/platform/repositories/branch" method="post" className="flex gap-2">
                    <input type="hidden" name="workspaceSlug" value={workspaceSlug} />
                    <input type="hidden" name="repositoryId" value={repository.repositoryId} />
                    <input
                      name="defaultBranch"
                      defaultValue={repository.defaultBranch}
                      className="h-7 rounded-md border border-input bg-input/20 px-2 text-xs text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    />
                    <Button type="submit" size="sm">Save branch</Button>
                  </form>
                  <form action="/api/platform/runs" method="post">
                    <input type="hidden" name="workspaceSlug" value={workspaceSlug} />
                    <input type="hidden" name="repositoryId" value={repository.repositoryId} />
                    <input type="hidden" name="branch" value={repository.defaultBranch} />
                    <input type="hidden" name="kind" value="repository_sync" />
                    <Button type="submit" variant="outline" size="sm" className="border-emerald-700 text-emerald-400 hover:bg-emerald-500/10">
                      Trigger run
                    </Button>
                  </form>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </WorkspaceLayout>
  );
}

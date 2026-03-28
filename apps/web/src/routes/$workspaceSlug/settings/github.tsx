import { createFileRoute } from "@tanstack/react-router";

import { WorkspaceLayout } from "../../../components/workspace-layout";
import { useJson } from "../../../components/workspace/use-json";
import { Button } from "@quadratic/ui/components/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@quadratic/ui/components/card";

export const Route = createFileRoute("/$workspaceSlug/settings/github" as never)({
  component: WorkspaceGitHubPage,
});

function WorkspaceGitHubPage() {
  const { workspaceSlug } = Route.useParams();
  const workspace = useJson<{
    workspace: { name: string; workspaceId: string };
    installations: {
      installationId: string;
      githubInstallationId: number;
      githubAccountLogin: string;
      status: string;
    }[];
  }>(`/api/platform/workspace?slug=${workspaceSlug}`);

  return (
    <WorkspaceLayout
      workspaceSlug={workspaceSlug}
      workspaceName={workspace.data?.workspace.name}
      breadcrumbs={[
        { label: workspaceSlug },
        { label: "Settings", href: `/${workspaceSlug}/settings` },
        { label: "GitHub" },
      ]}
    >
      <div>
        <h1 className="font-heading text-lg font-semibold">GitHub App</h1>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Connect your GitHub account to enable repository access.
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_1.2fr]">
        <Card>
          <CardHeader>
            <CardTitle>Install the GitHub App</CardTitle>
            <CardDescription>
              The installation callback links the GitHub installation to this workspace, and the
              webhook route updates metadata or enqueues runs without doing heavy work inline.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button size="sm" render={<a href={`/api/github/install?workspaceSlug=${workspaceSlug}`} />}>
              Open GitHub installation flow
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Linked installations</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            {(workspace.data?.installations ?? []).length === 0 ? (
              <p className="text-xs text-muted-foreground">No installations linked yet.</p>
            ) : (
              (workspace.data?.installations ?? []).map((installation) => (
                <div
                  key={installation.installationId}
                  className="flex items-center justify-between rounded-lg border border-border/60 px-3 py-2 text-xs"
                >
                  <span className="font-medium text-foreground">{installation.githubAccountLogin}</span>
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <span>#{installation.githubInstallationId}</span>
                    <span className="rounded-full bg-muted px-2 py-0.5">{installation.status}</span>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </WorkspaceLayout>
  );
}

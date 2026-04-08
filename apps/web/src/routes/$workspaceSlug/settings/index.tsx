import { createFileRoute, Link } from "@tanstack/react-router";

import { WorkspaceLayout } from "../../../components/workspace-layout";
import { useJson } from "../../../components/workspace/use-json";

export const Route = createFileRoute("/$workspaceSlug/settings/" as never)({
  component: WorkspaceSettingsPage,
});

function WorkspaceSettingsPage() {
  const { workspaceSlug } = Route.useParams();
  const workspace = useJson<{ workspace: { name: string; role: string; slug: string } }>(
    `/api/platform/workspace?slug=${workspaceSlug}`,
  );

  const cards = [
    {
      title: "GitHub access",
      body: "Install or reconnect the GitHub App, reconcile installation repository access, and keep webhook ingestion fast.",
      href: `/${workspaceSlug}/settings/github`,
    },
    {
      title: "Repository policy",
      body: "Select connected repositories, set default branches, and trigger one-shot repo jobs.",
      href: `/${workspaceSlug}/settings/repositories`,
    },
    {
      title: "Members and invites",
      body: "Owners and admins manage invitations while members retain read access to the workspace.",
      href: `/${workspaceSlug}/settings/members`,
    },
  ];

  return (
    <WorkspaceLayout
      workspaceSlug={workspaceSlug}
      workspaceName={workspace.data?.workspace.name}
      error={workspace.error}
      breadcrumbs={[{ label: workspaceSlug }, { label: "Settings" }]}
    >
      <div>
        <h1 className="font-heading text-lg font-semibold">Settings</h1>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Manage workspace configuration and integrations.
        </p>
      </div>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map((card) => (
          <Link
            key={card.title}
            to={card.href}
            className="group flex flex-col gap-2 rounded-xl border border-border/60 bg-card p-5 text-xs transition-colors hover:border-border hover:bg-card/80"
          >
            <h2 className="font-medium text-foreground">{card.title}</h2>
            <p className="text-muted-foreground text-pretty">{card.body}</p>
          </Link>
        ))}
      </section>
    </WorkspaceLayout>
  );
}

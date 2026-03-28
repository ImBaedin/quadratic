import { createFileRoute } from "@tanstack/react-router";

import { WorkspaceShell } from "../../../components/workspace/shell";
import { useJson } from "../../../components/workspace/use-json";

export const Route = createFileRoute("/$workspaceSlug/settings/" as never)({
  component: WorkspaceSettingsPage,
});

function WorkspaceSettingsPage() {
  const { workspaceSlug } = Route.useParams();
  const workspace = useJson<{ workspace: { name: string; role: string; slug: string } }>(
    `/api/platform/workspace?slug=${workspaceSlug}`,
  );

  return (
    <WorkspaceShell workspaceSlug={workspaceSlug} title={workspace.data?.workspace.name ?? workspaceSlug} eyebrow="Workspace settings">
      <section className="grid gap-6 md:grid-cols-3">
        {[
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
            body: "Owners and admins manage invitations while members retain read access to the workspace shell.",
            href: `/${workspaceSlug}/settings/members`,
          },
        ].map((item) => (
          <a key={item.title} href={item.href} className="rounded-[1.5rem] border border-zinc-800 bg-zinc-950 p-6">
            <h2 className="text-xl font-medium text-white">{item.title}</h2>
            <p className="mt-3 text-sm text-zinc-400">{item.body}</p>
          </a>
        ))}
      </section>
    </WorkspaceShell>
  );
}

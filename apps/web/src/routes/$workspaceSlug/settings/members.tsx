import { createFileRoute } from "@tanstack/react-router";

import { WorkspaceShell } from "../../../components/workspace/shell";
import { useJson } from "../../../components/workspace/use-json";

export const Route = createFileRoute("/$workspaceSlug/settings/members" as never)({
  component: WorkspaceMembersPage,
});

function WorkspaceMembersPage() {
  const { workspaceSlug } = Route.useParams();
  const workspace = useJson<{
    workspace: { name: string; workspaceId: string };
    members: { membershipId: string; email: string; role: string }[];
    invites: { inviteId: string; email: string; role: string; status: string }[];
  }>(`/api/platform/workspace?slug=${workspaceSlug}`);

  return (
    <WorkspaceShell workspaceSlug={workspaceSlug} title={workspace.data?.workspace.name ?? workspaceSlug} eyebrow="Members">
      <section className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="rounded-[1.5rem] border border-zinc-800 bg-zinc-950 p-6">
          <h2 className="text-xl font-medium text-white">Invite a teammate</h2>
          <form action="/api/platform/invites" method="post" className="mt-4 grid gap-3">
            <input type="hidden" name="workspaceSlug" value={workspaceSlug} />
            <input
              name="email"
              type="email"
              required
              placeholder="teammate@example.com"
              className="rounded-2xl border border-zinc-700 bg-zinc-900 px-4 py-3 text-white"
            />
            <select name="role" className="rounded-2xl border border-zinc-700 bg-zinc-900 px-4 py-3 text-white">
              <option value="member">Member</option>
              <option value="admin">Admin</option>
            </select>
            <button className="rounded-full bg-sky-400 px-5 py-3 text-sm font-medium text-zinc-950">
              Send invitation
            </button>
          </form>
        </div>
        <div className="grid gap-6">
          <div className="rounded-[1.5rem] border border-zinc-800 bg-zinc-950 p-6">
            <h2 className="text-xl font-medium text-white">Members</h2>
            <div className="mt-4 grid gap-3">
              {(workspace.data?.members ?? []).map((member) => (
                <div key={member.membershipId} className="rounded-2xl border border-zinc-800 px-4 py-3 text-sm text-zinc-200">
                  {member.email}
                  <span className="ml-2 text-zinc-500">{member.role}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="rounded-[1.5rem] border border-zinc-800 bg-zinc-950 p-6">
            <h2 className="text-xl font-medium text-white">Invitations</h2>
            <div className="mt-4 grid gap-3">
              {(workspace.data?.invites ?? []).map((invite) => (
                <div key={invite.inviteId} className="rounded-2xl border border-zinc-800 px-4 py-3 text-sm text-zinc-200">
                  {invite.email}
                  <span className="ml-2 text-zinc-500">{invite.role}</span>
                  <span className="ml-2 text-zinc-500">{invite.status}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>
    </WorkspaceShell>
  );
}

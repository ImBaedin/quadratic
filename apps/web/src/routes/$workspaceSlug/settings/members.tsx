import { createFileRoute } from "@tanstack/react-router";

import { WorkspaceLayout } from "../../../components/workspace-layout";
import { useJson } from "../../../components/workspace/use-json";
import { Button } from "@quadratic/ui/components/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@quadratic/ui/components/card";

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
    <WorkspaceLayout
      workspaceSlug={workspaceSlug}
      workspaceName={workspace.data?.workspace.name}
      breadcrumbs={[
        { label: workspaceSlug },
        { label: "Settings", href: `/${workspaceSlug}/settings` },
        { label: "Members" },
      ]}
    >
      <div>
        <h1 className="font-heading text-lg font-semibold">Members</h1>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Manage team access and pending invitations.
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
        {/* Invite form */}
        <Card>
          <CardHeader>
            <CardTitle>Invite a teammate</CardTitle>
            <CardDescription>
              Owners and admins can send invitations. Members retain read-only access.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form action="/api/platform/invites" method="post" className="flex flex-col gap-3">
              <input type="hidden" name="workspaceSlug" value={workspaceSlug} />
              <input
                name="email"
                type="email"
                required
                placeholder="teammate@example.com"
                className="h-8 rounded-md border border-input bg-input/20 px-3 text-xs text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring dark:bg-input/30"
              />
              <select
                name="role"
                className="h-8 rounded-md border border-input bg-input/20 px-3 text-xs text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring dark:bg-input/30"
              >
                <option value="member">Member</option>
                <option value="admin">Admin</option>
              </select>
              <Button type="submit" size="sm">Send invitation</Button>
            </form>
          </CardContent>
        </Card>

        {/* Members + Invites */}
        <div className="flex flex-col gap-4">
          <Card>
            <CardHeader>
              <CardTitle>Members</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-2">
              {(workspace.data?.members ?? []).length === 0 ? (
                <p className="text-xs text-muted-foreground">No members yet.</p>
              ) : (
                (workspace.data?.members ?? []).map((member) => (
                  <div
                    key={member.membershipId}
                    className="flex items-center justify-between rounded-lg border border-border/60 px-3 py-2 text-xs"
                  >
                    <span className="truncate text-foreground">{member.email}</span>
                    <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-muted-foreground">
                      {member.role}
                    </span>
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Invitations</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-2">
              {(workspace.data?.invites ?? []).length === 0 ? (
                <p className="text-xs text-muted-foreground">No pending invitations.</p>
              ) : (
                (workspace.data?.invites ?? []).map((invite) => (
                  <div
                    key={invite.inviteId}
                    className="flex items-center justify-between gap-2 rounded-lg border border-border/60 px-3 py-2 text-xs"
                  >
                    <span className="truncate text-foreground">{invite.email}</span>
                    <div className="flex shrink-0 items-center gap-1.5 text-muted-foreground">
                      <span>{invite.role}</span>
                      <span className="rounded-full bg-muted px-2 py-0.5">{invite.status}</span>
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </WorkspaceLayout>
  );
}

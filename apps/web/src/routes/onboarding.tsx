import { createFileRoute } from "@tanstack/react-router";
import { Button } from "@quadratic/ui/components/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@quadratic/ui/components/card";
import { useJson } from "../components/workspace/use-json";

export const Route = createFileRoute("/onboarding" as never)({
  component: OnboardingPage,
});

function OnboardingPage() {
  const session = useJson<{
    session: { email: string } | null;
    workspaces: { slug: string; name: string; role: string }[];
  }>("/api/platform/session");

  return (
    <main className="flex min-h-dvh items-start justify-center p-4 pt-16">
      <div className="w-full max-w-2xl">
        <div className="mb-8 text-center">
          <span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            Quadratic
          </span>
          <h1 className="mt-3 font-heading text-2xl font-semibold text-balance">
            Set up your workspace
          </h1>
          <p className="mt-2 text-xs text-muted-foreground text-pretty">
            Create a new workspace or continue with one you've been invited to.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          {session.error ? (
            <div className="sm:col-span-2 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-100">
              {session.error}
            </div>
          ) : null}

          {/* Create workspace */}
          <Card>
            <CardHeader>
              <CardTitle>Create a workspace</CardTitle>
              <CardDescription>
                Signed in as{" "}
                <span className="font-medium text-foreground">
                  {session.data?.session?.email ?? "…"}
                </span>
                . This creates your workspace in Convex.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form action="/api/platform/workspaces" method="post" className="flex flex-col gap-3">
                <input
                  required
                  name="name"
                  placeholder="Acme Engineering"
                  className="h-8 rounded-md border border-input bg-input/20 px-3 text-xs text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring dark:bg-input/30"
                />
                <Button type="submit" size="sm">
                  Create workspace
                </Button>
              </form>
            </CardContent>
          </Card>

          {/* Continue with existing */}
          <Card>
            <CardHeader>
              <CardTitle>Continue an invited workspace</CardTitle>
              <CardDescription>
                Existing memberships are resolved from Convex after sign-in.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-2">
              {(session.data?.workspaces ?? []).length === 0 ? (
                <p className="text-xs text-muted-foreground">No workspaces found.</p>
              ) : (
                (session.data?.workspaces ?? []).map((workspace) => (
                  <a
                    key={workspace.slug}
                    href={`/${workspace.slug}`}
                    className="flex items-center justify-between rounded-lg border border-border/60 px-3 py-2 text-xs transition-colors hover:border-border hover:bg-muted/40"
                  >
                    <span className="font-medium text-foreground">{workspace.name}</span>
                    <span className="text-muted-foreground">{workspace.role}</span>
                  </a>
                ))
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </main>
  );
}

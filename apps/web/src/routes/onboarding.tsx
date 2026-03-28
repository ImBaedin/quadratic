import { createFileRoute } from "@tanstack/react-router";

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
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-10">
      <section className="rounded-[2rem] border border-zinc-800 bg-zinc-950 p-8">
        <div className="text-xs uppercase tracking-[0.35em] text-zinc-500">Onboarding</div>
        <h1 className="mt-3 text-4xl font-semibold text-white">Create a workspace and connect GitHub.</h1>
        <p className="mt-3 max-w-2xl text-zinc-400">
          The scaffold supports invited-workspace selection, GitHub App installation, repository
          registration, default branch management, teammate invites, and durable background runs.
        </p>
      </section>

      <section className="grid gap-6 md:grid-cols-2">
        <form action="/api/platform/workspaces" method="post" className="rounded-[1.5rem] border border-zinc-800 bg-zinc-950 p-6">
          <h2 className="text-xl font-medium text-white">1. Create a workspace</h2>
          <p className="mt-2 text-sm text-zinc-400">
            Signed in as {session.data?.session?.email ?? "anonymous"}. This creates the workspace and owner
            membership in Convex.
          </p>
          <label className="mt-5 flex flex-col gap-2 text-sm text-zinc-300">
            Workspace name
            <input
              required
              name="name"
              placeholder="Acme Engineering"
              className="rounded-2xl border border-zinc-700 bg-zinc-900 px-4 py-3 text-white"
            />
          </label>
          <button className="mt-5 rounded-full bg-sky-400 px-5 py-3 text-sm font-medium text-zinc-950">
            Create workspace
          </button>
        </form>

        <div className="rounded-[1.5rem] border border-zinc-800 bg-zinc-950 p-6">
          <h2 className="text-xl font-medium text-white">2. Continue an invited workspace</h2>
          <p className="mt-2 text-sm text-zinc-400">
            Existing memberships are resolved from Convex after sign-in. Pick a workspace to continue settings.
          </p>
          <div className="mt-5 grid gap-3">
            {(session.data?.workspaces ?? []).map((workspace) => (
              <a
                key={workspace.slug}
                href={`/${workspace.slug}`}
                className="rounded-2xl border border-zinc-800 px-4 py-3 text-sm text-zinc-200 transition hover:border-zinc-600"
              >
                {workspace.name}
                <span className="ml-2 text-zinc-500">{workspace.role}</span>
              </a>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}

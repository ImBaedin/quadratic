import { Link } from "@tanstack/react-router";
import { useEffect } from "react";
import { createFileRoute } from "@tanstack/react-router";

import { useJson } from "../components/workspace/use-json";

export const Route = createFileRoute("/" as never)({
  component: HomePage,
});

function HomePage() {
  const session = useJson<{
    session: { userId: string; email: string; activeWorkspaceId?: string } | null;
    workspaces: { slug: string; name: string; role: string }[];
  }>("/api/platform/session");

  useEffect(() => {
    if (session.data?.workspaces?.length) {
      window.location.assign(`/${session.data.workspaces[0]!.slug}`);
    }
  }, [session.data]);

  return (
    <main className="mx-auto flex min-h-[calc(100svh-5rem)] w-full max-w-6xl flex-col justify-center gap-8 px-4 py-16">
      <section className="grid gap-8 rounded-[2rem] border border-zinc-800 bg-[radial-gradient(circle_at_top,_rgba(96,165,250,0.18),_transparent_40%),linear-gradient(180deg,_rgba(24,24,27,0.98),_rgba(9,9,11,1))] p-10 md:grid-cols-[1.1fr_0.9fr]">
        <div className="space-y-5">
          <div className="text-xs uppercase tracking-[0.35em] text-sky-300">Quadratic Scaffold</div>
          <h1 className="max-w-xl text-5xl font-semibold tracking-tight text-white">
            Team onboarding around workspaces, GitHub installs, and ephemeral repo jobs.
          </h1>
          <p className="max-w-xl text-base text-zinc-400">
            This scaffold keeps TanStack Start on Cloudflare, Convex as system of record, Inngest for
            orchestration, and Fly for one-shot repository execution.
          </p>
          <div className="flex flex-wrap gap-3">
            <Link
              to="/login"
              className="rounded-full bg-sky-400 px-5 py-3 text-sm font-medium text-zinc-950 transition hover:bg-sky-300"
            >
              Sign in with WorkOS
            </Link>
            <Link
              to="/onboarding"
              className="rounded-full border border-zinc-700 px-5 py-3 text-sm text-zinc-200 transition hover:border-zinc-500"
            >
              Open onboarding
            </Link>
          </div>
        </div>
        <div className="grid gap-4 rounded-[1.5rem] border border-zinc-800 bg-black/30 p-6">
          {[
            "Auth and session flow with WorkOS",
            "Workspace creation and membership shell",
            "GitHub App installation callback and webhook entrypoints",
            "Repository selection, default branch, and invite management",
            "Agent run lifecycle and Inngest/Fly worker contracts",
          ].map((item) => (
            <div key={item} className="rounded-2xl border border-zinc-800 bg-zinc-950/80 p-4 text-sm text-zinc-300">
              {item}
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}

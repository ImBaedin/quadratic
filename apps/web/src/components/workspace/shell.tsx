import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";

export function WorkspaceShell(props: {
  workspaceSlug: string;
  title: string;
  eyebrow: string;
  children: ReactNode;
}) {
  const links = [
    { to: `/${props.workspaceSlug}`, label: "Overview" },
    { to: `/${props.workspaceSlug}/settings`, label: "Settings" },
    { to: `/${props.workspaceSlug}/settings/github`, label: "GitHub" },
    { to: `/${props.workspaceSlug}/settings/repositories`, label: "Repositories" },
    { to: `/${props.workspaceSlug}/settings/members`, label: "Members" },
  ];

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-4 py-10">
      <section className="flex flex-col gap-4 rounded-3xl border border-zinc-800 bg-zinc-950/80 p-8">
        <div className="text-xs uppercase tracking-[0.3em] text-zinc-500">{props.eyebrow}</div>
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <h1 className="text-3xl font-semibold text-white">{props.title}</h1>
            <p className="mt-2 max-w-2xl text-sm text-zinc-400">
              Workspace onboarding focuses on membership, GitHub access, repository registration, and
              asynchronous run plumbing.
            </p>
          </div>
          <nav className="flex flex-wrap gap-2">
            {links.map((link) => (
              <Link
                key={link.to}
                to={link.to}
                className="rounded-full border border-zinc-700 px-4 py-2 text-sm text-zinc-300 transition hover:border-zinc-500 hover:text-white"
              >
                {link.label}
              </Link>
            ))}
          </nav>
        </div>
      </section>
      {props.children}
    </main>
  );
}

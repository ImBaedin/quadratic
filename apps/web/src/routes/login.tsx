import { createFileRoute, redirect } from "@tanstack/react-router";
import { getAuth, getSignInUrl, getSignUpUrl } from "@workos/authkit-tanstack-react-start";

export const Route = createFileRoute("/login" as never)({
  loader: async () => {
    const { user } = await getAuth();
    if (user) {
      throw redirect({ href: "/onboarding" });
    }

    return {
      signInUrl: await getSignInUrl({ data: { returnPathname: "/onboarding" } }),
      signUpUrl: await getSignUpUrl({ data: { returnPathname: "/onboarding" } }),
    };
  },
  component: LoginPage,
});

function LoginPage() {
  const { signInUrl, signUpUrl } = Route.useLoaderData();

  return (
    <main className="mx-auto flex min-h-[calc(100svh-5rem)] max-w-3xl flex-col justify-center gap-6 px-4 py-16">
      <div className="rounded-[2rem] border border-zinc-800 bg-zinc-950 p-10">
        <div className="text-xs uppercase tracking-[0.35em] text-zinc-500">Authentication</div>
        <h1 className="mt-4 text-4xl font-semibold text-white">Sign in to continue onboarding</h1>
        <p className="mt-4 text-zinc-400">
          WorkOS AuthKit owns the session lifecycle. Quadratic syncs the authenticated identity into
          Convex after callback handling and then routes you into onboarding and workspace setup.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <a
            href={signInUrl}
            className="inline-flex rounded-full bg-sky-400 px-5 py-3 text-sm font-medium text-zinc-950"
          >
            Sign In
          </a>
          <a
            href={signUpUrl}
            className="inline-flex rounded-full border border-zinc-700 px-5 py-3 text-sm font-medium text-zinc-100"
          >
            Create Account
          </a>
        </div>
      </div>
    </main>
  );
}

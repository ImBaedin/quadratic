import { createFileRoute, redirect } from "@tanstack/react-router";
import { getAuth, getSignInUrl, getSignUpUrl } from "@workos/authkit-tanstack-react-start";
import { Button } from "@quadratic/ui/components/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@quadratic/ui/components/card";

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
    <main className="flex min-h-dvh items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            Quadratic
          </span>
        </div>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Welcome back</CardTitle>
            <CardDescription>
              Sign in to your account or create a new one to get started.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-2.5">
            <Button render={<a href={signInUrl} />} className="w-full" size="sm">
              Sign in
            </Button>
            <Button render={<a href={signUpUrl} />} variant="outline" className="w-full" size="sm">
              Create account
            </Button>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}

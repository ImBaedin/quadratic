import { createFileRoute } from "@tanstack/react-router";
import { signOut } from "@workos/authkit-tanstack-react-start";

export const Route = createFileRoute("/logout" as never)({
  loader: async () => {
    await signOut({ data: { returnTo: "/" } });
  },
  component: () => null,
});

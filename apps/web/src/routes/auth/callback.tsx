import { createFileRoute } from "@tanstack/react-router";
import { handleCallbackRoute } from "@workos/authkit-tanstack-react-start";

import { syncCurrentUser } from "../../lib/server/convex";

export const Route = createFileRoute("/auth/callback" as never)({
  server: {
    handlers: {
      GET: handleCallbackRoute({
        onSuccess: async ({ user }) => {
          await syncCurrentUser({
            workosUserId: user.id,
            email: user.email,
            firstName: user.firstName ?? undefined,
            lastName: user.lastName ?? undefined,
            avatarUrl: user.profilePictureUrl ?? undefined,
          });
        },
      }),
    },
  },
});

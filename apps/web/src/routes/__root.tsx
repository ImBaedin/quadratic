import type { ConvexQueryClient } from "@convex-dev/react-query";
import { Toaster } from "@quadratic/ui/components/sonner";
import type { QueryClient } from "@tanstack/react-query";
import { HeadContent, Outlet, Scripts, createRootRouteWithContext } from "@tanstack/react-router";
import { TanStackRouterDevtools } from "@tanstack/react-router-devtools";
import { AuthKitProvider } from "@workos/authkit-tanstack-react-start/client";
import { ConvexProvider } from "convex/react";

import Header from "../components/header";

import appCss from "../index.css?url";

export interface RouterAppContext {
  queryClient: QueryClient;
  convexQueryClient: ConvexQueryClient;
}

export const Route = createRootRouteWithContext<RouterAppContext>()({
  head: () => ({
    meta: [
      {
        charSet: "utf-8",
      },
      {
        name: "viewport",
        content: "width=device-width, initial-scale=1",
      },
      {
        title: "Quadratic",
      },
    ],
    links: [
      {
        rel: "stylesheet",
        href: appCss,
      },
    ],
  }),

  component: RootDocument,
});

function RootDocument() {
  const { convexQueryClient } = Route.useRouteContext();
  return (
    <AuthKitProvider>
      <ConvexProvider client={convexQueryClient.convexClient}>
        <html lang="en" className="dark">
          <head>
            <HeadContent />
          </head>
          <body>
            <div className="grid min-h-svh grid-rows-[auto_1fr] bg-black text-white">
              <Header />
              <Outlet />
            </div>
            <Toaster richColors />
            <TanStackRouterDevtools position="bottom-left" />
            <Scripts />
          </body>
        </html>
      </ConvexProvider>
    </AuthKitProvider>
  );
}

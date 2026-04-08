import type { ReactNode } from "react";

import { SidebarInset, SidebarProvider } from "@quadratic/ui/components/sidebar";
import { AppSidebar } from "./app-sidebar";
import { AppTopbar, type BreadcrumbSegment } from "./app-topbar";

interface WorkspaceLayoutProps {
  workspaceSlug: string;
  workspaceName?: string;
  breadcrumbs?: BreadcrumbSegment[];
  error?: string | null;
  children: ReactNode;
}

export function WorkspaceLayout({
  workspaceSlug,
  workspaceName,
  breadcrumbs,
  error,
  children,
}: WorkspaceLayoutProps) {
  const displayName = workspaceName ?? workspaceSlug;

  return (
    <SidebarProvider>
      <AppSidebar workspaceSlug={workspaceSlug} workspaceName={displayName} />
      <SidebarInset>
        <AppTopbar breadcrumbs={breadcrumbs} />
        <main className="flex flex-1 flex-col gap-6 p-6">
          {error ? (
            <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-100">
              {error}
            </div>
          ) : null}
          {children}
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}

import type { ReactNode } from "react";

import { SidebarInset, SidebarProvider } from "@quadratic/ui/components/sidebar";
import { AppSidebar } from "./app-sidebar";
import { AppTopbar, type BreadcrumbSegment } from "./app-topbar";

interface WorkspaceLayoutProps {
  workspaceSlug: string;
  workspaceName?: string;
  breadcrumbs?: BreadcrumbSegment[];
  children: ReactNode;
}

export function WorkspaceLayout({
  workspaceSlug,
  workspaceName,
  breadcrumbs,
  children,
}: WorkspaceLayoutProps) {
  const displayName = workspaceName ?? workspaceSlug;

  return (
    <SidebarProvider>
      <AppSidebar workspaceSlug={workspaceSlug} workspaceName={displayName} />
      <SidebarInset>
        <AppTopbar breadcrumbs={breadcrumbs} />
        <main className="flex flex-1 flex-col gap-6 p-6">{children}</main>
      </SidebarInset>
    </SidebarProvider>
  );
}

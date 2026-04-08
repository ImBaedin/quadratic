import { Link, useLocation } from "@tanstack/react-router";
import { CheckSquare, GitBranch, Gear, CaretUpDown } from "@phosphor-icons/react";

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@quadratic/ui/components/sidebar";
import { cn } from "@/lib/utils";

interface AppSidebarProps {
  workspaceSlug: string;
  workspaceName: string;
}

const navItems = (workspaceSlug: string) => [
  {
    label: "Tasks",
    to: `/${workspaceSlug}/tasks`,
    icon: CheckSquare,
  },
  {
    label: "Repositories",
    to: `/${workspaceSlug}/settings/repositories`,
    icon: GitBranch,
  },
  {
    label: "Settings",
    to: `/${workspaceSlug}/settings`,
    icon: Gear,
  },
];

export function AppSidebar({ workspaceSlug, workspaceName }: AppSidebarProps) {
  const location = useLocation();

  return (
    <Sidebar collapsible="offcanvas">
      {/* Workspace header */}
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              size="lg"
              className="h-auto gap-2.5 px-2 py-2"
              tooltip="Switch workspace"
            >
              <div className="flex size-7 shrink-0 items-center justify-center rounded-md bg-primary text-[0.65rem] font-bold text-primary-foreground uppercase">
                {workspaceName.slice(0, 2)}
              </div>
              <div className="flex min-w-0 flex-1 flex-col">
                <span className="truncate text-xs font-medium text-sidebar-foreground">
                  {workspaceName}
                </span>
                <span className="text-[0.6rem] text-sidebar-foreground/50">Workspace</span>
              </div>
              <CaretUpDown className="ml-auto size-3.5 shrink-0 text-sidebar-foreground/40" />
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      {/* Nav */}
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {navItems(workspaceSlug).map((item) => {
                const isActive =
                  item.label === "Tasks"
                    ? location.pathname.startsWith(`/${workspaceSlug}/tasks`)
                    : item.label === "Settings"
                      ? location.pathname === `/${workspaceSlug}/settings` ||
                        location.pathname === `/${workspaceSlug}/settings/github` ||
                        location.pathname === `/${workspaceSlug}/settings/members`
                      : location.pathname.startsWith(item.to);

                return (
                  <SidebarMenuItem key={item.label}>
                    <SidebarMenuButton
                      isActive={isActive}
                      tooltip={item.label}
                      render={
                        <Link to={item.to} className={cn("flex w-full items-center gap-2")} />
                      }
                    >
                      <item.icon
                        weight={isActive ? "fill" : "regular"}
                        className="size-4 shrink-0"
                      />
                      <span>{item.label}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter />
    </Sidebar>
  );
}

import { Link } from "@tanstack/react-router";
import { SignOut } from "@phosphor-icons/react";
import { useAuth } from "@workos/authkit-tanstack-react-start/client";

import { SidebarTrigger } from "@quadratic/ui/components/sidebar";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@quadratic/ui/components/breadcrumb";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@quadratic/ui/components/dropdown-menu";
import { Avatar, AvatarFallback } from "@quadratic/ui/components/avatar";
import { Separator } from "@quadratic/ui/components/separator";

export interface BreadcrumbSegment {
  label: string;
  href?: string;
}

interface AppTopbarProps {
  breadcrumbs?: BreadcrumbSegment[];
}

export function AppTopbar({ breadcrumbs = [] }: AppTopbarProps) {
  const { user } = useAuth();

  const initials = user?.email ? user.email.slice(0, 2).toUpperCase() : "??";

  return (
    <header className="flex h-14 shrink-0 items-center gap-2 border-b border-border/60 px-4">
      <SidebarTrigger aria-label="Toggle sidebar" className="-ml-1" />

      {breadcrumbs.length > 0 && (
        <>
          <Separator orientation="vertical" className="mx-1 h-4" />
          <Breadcrumb>
            <BreadcrumbList>
              {breadcrumbs.map((seg, i) => {
                const isLast = i === breadcrumbs.length - 1;
                return (
                  <BreadcrumbItem key={seg.label}>
                    {isLast ? (
                      <BreadcrumbPage>{seg.label}</BreadcrumbPage>
                    ) : (
                      <>
                        {seg.href ? (
                          <Link
                            to={seg.href}
                            className="text-xs text-muted-foreground transition-colors hover:text-foreground"
                          >
                            {seg.label}
                          </Link>
                        ) : (
                          <span className="hidden text-xs text-muted-foreground md:inline">
                            {seg.label}
                          </span>
                        )}
                        <BreadcrumbSeparator />
                      </>
                    )}
                  </BreadcrumbItem>
                );
              })}
            </BreadcrumbList>
          </Breadcrumb>
        </>
      )}

      {/* Spacer */}
      <div className="flex-1" />

      {/* User menu */}
      <DropdownMenu>
        <DropdownMenuTrigger
          aria-label="Open user menu"
          className="rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <Avatar size="sm">
            <AvatarFallback className="text-[0.6rem]">{initials}</AvatarFallback>
          </Avatar>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-52">
          {user?.email && (
            <DropdownMenuGroup>
              <DropdownMenuLabel className="truncate font-normal text-muted-foreground">
                {user.email}
              </DropdownMenuLabel>
            </DropdownMenuGroup>
          )}
          {user?.email && <DropdownMenuSeparator />}
          <DropdownMenuGroup>
            <DropdownMenuItem render={<a href="/logout" />}>
              <SignOut className="size-3.5" />
              Sign out
            </DropdownMenuItem>
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  );
}

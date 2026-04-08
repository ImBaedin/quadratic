# Quadratic MVP UI Rebuild

## Context

The current web app has basic, unstyled pages for workspace management, settings, and GitHub integration. There is **no task-centric UI** — the core product flow (create task → agent enriches it → task becomes a trackable item) has no frontend yet. The goal is to rebuild the UI into a Linear-inspired, dark-themed task tracking app with a proper app shell (top nav + sidebar), task list, task creation, and task detail views. This is a **UI shell with stubbed data** — no real API wiring.

## Layout Architecture

**Two layout modes:**

- **Bare layout** — `/`, `/login`, `/onboarding`, `/auth/callback` (no sidebar)
- **Workspace layout** — all `/$workspaceSlug/*` routes get sidebar + topbar

**App shell structure:**

```
┌─────────────────────────────────────────┐
│ Top Bar (breadcrumbs, user menu)        │
├────────┬────────────────────────────────┤
│Sidebar │ Main Content                   │
│        │                                │
│ Tasks  │                                │
│ Repos  │                                │
│Settings│                                │
│        │                                │
└────────┴────────────────────────────────┘
```

## Files to Create

### Mock Data & Utilities

1. **`apps/web/src/lib/mock-data.ts`** — All mock types and stub data (tasks, repos, workspace, questions)
2. **`apps/web/src/lib/task-status.ts`** — Status→color/label mapping config

### Layout Components

3. **`apps/web/src/components/app-sidebar.tsx`** — Left sidebar using shadcn `Sidebar` primitives (`SidebarProvider`, `SidebarMenu`, `SidebarMenuButton`, etc.). Nav items: Tasks, Repositories, Settings. Workspace name in header. Uses Phosphor icons. Links use TanStack `<Link>` via `render` prop on `SidebarMenuButton`.
4. **`apps/web/src/components/app-topbar.tsx`** — Top bar with `SidebarTrigger`, `Breadcrumb`, user avatar `DropdownMenu` (logout). Height: `h-14`, border-bottom.
5. **`apps/web/src/components/workspace-layout.tsx`** — Composes `SidebarProvider` + `AppSidebar` + `SidebarInset` > `AppTopbar` + `<main>{children}</main>`. Replaces current `WorkspaceShell`.

### Task Components

6. **`apps/web/src/components/tasks/task-status-badge.tsx`** — Wraps shadcn `Badge` with status-specific colors:
   - `drafting` → gray
   - `awaiting_clarification` → amber
   - `ready` → green
   - `executing` → blue + `animate-pulse`
   - `completed` → emerald
   - `failed` → red
   - `cancelled` → muted gray

7. **`apps/web/src/components/tasks/task-list.tsx`** — Renders task rows. Each row: status badge, title, repo name (muted), relative timestamp. Rows are `<Link>` to task detail. Empty state uses shadcn `EmptyState`.

8. **`apps/web/src/components/tasks/task-creation-dialog.tsx`** — `Dialog` with repo `Select` dropdown + `Textarea` for description. On mobile, render as `Drawer` (bottom sheet) using `useIsMobile()`. On submit, adds task to local state.

9. **`apps/web/src/components/tasks/task-detail-panel.tsx`** — Shows task title, status badge, original prompt, and conditionally: plan, acceptance criteria, suggested files, questions, or "Agent working..." spinner.

### Route Pages

10. **`apps/web/src/routes/$workspaceSlug/tasks/index.tsx`** — Task list page. Has `useState` with mock tasks. "New Task" button opens creation dialog. Wraps content in `WorkspaceLayout`.

11. **`apps/web/src/routes/$workspaceSlug/tasks/$taskId.tsx`** — Task detail page. Looks up task by ID from mock data. Wraps in `WorkspaceLayout`.

## Files to Modify

12. **`apps/web/src/routes/__root.tsx`** — Remove `<Header />` import and usage. Change body container from `grid grid-rows-[auto_1fr]` to simple `min-h-svh` flex container. The workspace layout handles its own shell.

13. **`apps/web/src/routes/$workspaceSlug/index.tsx`** — Replace current overview page with a redirect to `/$workspaceSlug/tasks` (tasks page is now the main view).

14. **`apps/web/src/routes/$workspaceSlug/settings/index.tsx`** — Replace `WorkspaceShell` with `WorkspaceLayout`.
15. **`apps/web/src/routes/$workspaceSlug/settings/github.tsx`** — Replace `WorkspaceShell` with `WorkspaceLayout`.
16. **`apps/web/src/routes/$workspaceSlug/settings/repositories.tsx`** — Replace `WorkspaceShell` with `WorkspaceLayout`.
17. **`apps/web/src/routes/$workspaceSlug/settings/members.tsx`** — Replace `WorkspaceShell` with `WorkspaceLayout`.

18. **`apps/web/src/routes/login.tsx`** — Light styling cleanup with shadcn Card/Button.
19. **`apps/web/src/routes/onboarding.tsx`** — Light styling cleanup with shadcn Card/Button/Input.

## Key Reusable Components (from `@quadratic/ui`)

| Component          | Import Path                              | Usage                          |
| ------------------ | ---------------------------------------- | ------------------------------ |
| Sidebar primitives | `@quadratic/ui/components/sidebar`       | App shell sidebar              |
| Badge              | `@quadratic/ui/components/badge`         | Task status badges             |
| Button             | `@quadratic/ui/components/button`        | Actions everywhere             |
| Dialog             | `@quadratic/ui/components/dialog`        | Task creation (desktop)        |
| Drawer             | `@quadratic/ui/components/drawer`        | Task creation (mobile)         |
| Select             | `@quadratic/ui/components/select`        | Repo picker in task creation   |
| Textarea           | `@quadratic/ui/components/textarea`      | Task description input         |
| Card               | `@quadratic/ui/components/card`          | Task detail sections, settings |
| Breadcrumb         | `@quadratic/ui/components/breadcrumb`    | Top bar navigation             |
| Avatar             | `@quadratic/ui/components/avatar`        | User menu in topbar            |
| DropdownMenu       | `@quadratic/ui/components/dropdown-menu` | User menu, workspace switcher  |
| Separator          | `@quadratic/ui/components/separator`     | Topbar dividers                |
| Skeleton           | `@quadratic/ui/components/skeleton`      | Loading states                 |
| Empty State        | `@quadratic/ui/components/empty-state`   | No tasks yet                   |
| Sonner/Toaster     | `@quadratic/ui/components/sonner`        | Already in root                |

**Existing hooks:** `useIsMobile()` from `@quadratic/ui/hooks/use-mobile`
**Existing utils:** `cn()` from `@/lib/utils` (clsx + tailwind-merge)
**Icons:** `@phosphor-icons/react` — use `CheckSquare`, `GitBranch`, `Gear`, `Plus`, `CircleNotch`, `CaretUpDown`, `SignOut`, `User`

## Mobile Responsiveness

- shadcn `Sidebar` with `collapsible="offcanvas"` auto-renders as a `Sheet` on mobile — no extra work
- `SidebarTrigger` (hamburger) opens/closes the sheet on mobile
- Task creation uses `Drawer` (bottom sheet) on mobile via `useIsMobile()` check
- Topbar breadcrumbs truncate on small screens (`hidden md:flex` for middle segments)
- Task list rows: hide timestamp on `<sm` screens
- Task detail sections stack vertically by default

## Implementation Order

### Phase 1 — Foundation

1. `mock-data.ts` + `task-status.ts`
2. `task-status-badge.tsx`

### Phase 2 — App Shell

3. `app-sidebar.tsx`
4. `app-topbar.tsx`
5. `workspace-layout.tsx`
6. Modify `__root.tsx` — remove old Header

### Phase 3 — Task Pages

7. `task-list.tsx` + `task-creation-dialog.tsx`
8. `routes/$workspaceSlug/tasks/index.tsx` (task list route)
9. `task-detail-panel.tsx`
10. `routes/$workspaceSlug/tasks/$taskId.tsx` (task detail route)

### Phase 4 — Migration

11. `$workspaceSlug/index.tsx` → redirect to tasks
12. All settings pages → swap `WorkspaceShell` for `WorkspaceLayout`

### Phase 5 — Polish

13. Clean up `login.tsx` and `onboarding.tsx` styling
14. Delete old `header.tsx` and `workspace/shell.tsx`

## Verification

1. Run `bun run dev` (or `bun run dev:web`) to start the dev server
2. Visit `/login` — should show clean login page that redirects to WorkOS
3. Visit `/$workspaceSlug` — should redirect to `/$workspaceSlug/tasks`
4. Task list page shows mock tasks with status badges, repo names, timestamps
5. Click "New Task" — dialog/drawer opens with repo select + textarea
6. Submit a task — appears in the list with "drafting" status
7. Click a task — detail page shows prompt, status, and enriched data (for ready/completed tasks)
8. Sidebar navigation works — Tasks, Repositories, Settings all route correctly
9. Resize to mobile width — sidebar becomes a sheet, task creation becomes a drawer
10. `Cmd+B` toggles sidebar on desktop

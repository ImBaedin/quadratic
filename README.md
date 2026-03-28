# Quadratic

Quadratic is scaffolded as a workspace-first product shell:

- `apps/web`: TanStack Start app deployed to Cloudflare via Alchemy
- `packages/backend/convex`: system of record, reactive queries, role checks, repo/run state
- `packages/agent-runtime`: shared external worker request/result contracts
- `packages/github`: GitHub App auth, webhook verification, metadata normalization
- `packages/workos`: WorkOS normalization helpers and legacy auth utilities
- Fly.io: external repository action service
- Convex: durable orchestration and system of record
- WorkOS: sign-in, organization identity, memberships, invitations

## Getting Started

First, install the dependencies:

```bash
bun install
```

## Environment

The scaffold expects separate dev and prod values for:

- `APP_URL`
- `VITE_CONVEX_URL`
- `CONVEX_URL`
- `WORKOS_CLIENT_ID`
- `WORKOS_API_KEY`
- `WORKOS_COOKIE_PASSWORD`
- `WORKOS_REDIRECT_URI`
- `WORKOS_LOGOUT_REDIRECT_URI`
- `GITHUB_APP_ID`
- `GITHUB_APP_CLIENT_ID`
- `GITHUB_APP_CLIENT_SECRET`
- `GITHUB_APP_PRIVATE_KEY`
- `GITHUB_APP_WEBHOOK_SECRET`
- `GITHUB_APP_NAME`
- `GITHUB_APP_INSTALL_URL`
- `REPO_ACTIONS_BASE_URL`
- `REPO_ACTIONS_TOKEN`
- `SERVICE_TOKEN` for `apps/repo-actions`

The web app now uses WorkOS AuthKit for TanStack Start directly. Configure `WORKOS_REDIRECT_URI` to
match `/api/auth/callback` in the web app and set the same callback in the WorkOS dashboard.

## Convex Setup

This project uses Convex as a backend. You'll need to set up Convex before running the app:

```bash
bun run dev:setup
```

Follow the prompts to create a new Convex project and connect it to your application.

Copy environment variables from your Convex deployment and platform providers into the web app and Cloudflare bindings.

Then, run the development server:

```bash
bun run dev
```

Open [http://localhost:3001](http://localhost:3001) in your browser to see the web application.
Your app will connect to the Convex cloud backend automatically.

## UI Customization

React web apps in this stack share shadcn/ui primitives through `packages/ui`.

- Change design tokens and global styles in `packages/ui/src/styles/globals.css`
- Update shared primitives in `packages/ui/src/components/*`
- Adjust shadcn aliases or style config in `packages/ui/components.json` and `apps/web/components.json`

### Add more shared components

Run this from the project root to add more primitives to the shared UI package:

```bash
npx shadcn@latest add accordion dialog popover sheet table -c packages/ui
```

Import shared components like this:

```tsx
import { Button } from "@quadratic/ui/components/button";
```

### Add app-specific blocks

If you want to add app-specific blocks instead of shared primitives, run the shadcn CLI from `apps/web`.

## Deployment

### Web

Deploy `apps/web` to Cloudflare through the existing Alchemy path.

### Convex

Use separate Convex cloud deployments for dev and prod.

### Fly

Deploy `apps/repo-actions` to Fly as the external repository action service. Convex scheduled actions
call this service directly and apply the returned result back into Convex state. Set `SERVICE_TOKEN`
on the Fly app and the same value as `REPO_ACTIONS_TOKEN` in Convex.

## Git Hooks and Formatting

- Format and lint fix: `bun run check`

## Project Structure

```
quadratic/
├── apps/
│   ├── repo-actions/         # Fly-deployed repository action service
│   ├── web/                  # Cloudflare-hosted TanStack Start app
├── packages/
│   ├── agent-runtime/        # Shared request/result and runtime contracts
│   ├── backend/              # Convex backend functions and schema
│   ├── github/               # GitHub App helpers
│   ├── ui/                   # Shared shadcn/ui components and styles
│   ├── workos/               # WorkOS helpers and session utilities
```

## Available Scripts

- `bun run dev`: Start all applications in development mode
- `bun run build`: Build all applications
- `bun run dev:web`: Start only the web application
- `bun run dev:setup`: Setup and configure your Convex project
- `bun run check-types`: Check TypeScript types across all apps
- `bun run check`: Run Oxlint and Oxfmt

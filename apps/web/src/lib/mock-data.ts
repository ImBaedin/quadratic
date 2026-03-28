// ─── Types ───────────────────────────────────────────────────────────────────

export type TaskStatus =
  | "drafting"
  | "awaiting_clarification"
  | "ready"
  | "executing"
  | "completed"
  | "failed"
  | "cancelled";

export interface MockTask {
  taskId: string;
  title: string;
  description: string;
  status: TaskStatus;
  repoId: string;
  repoName: string;
  createdAt: Date;
  updatedAt: Date;
  plan?: string;
  acceptanceCriteria?: string[];
  suggestedFiles?: string[];
  questions?: MockQuestion[];
}

export interface MockQuestion {
  questionId: string;
  body: string;
  answer?: string;
}

export interface MockRepo {
  repoId: string;
  fullName: string;
  defaultBranch: string;
}

export interface MockWorkspace {
  workspaceId: string;
  name: string;
  slug: string;
}

// ─── Mock Repositories ───────────────────────────────────────────────────────

export const MOCK_REPOS: MockRepo[] = [
  { repoId: "repo-1", fullName: "acme/api-service", defaultBranch: "main" },
  { repoId: "repo-2", fullName: "acme/frontend-app", defaultBranch: "main" },
  { repoId: "repo-3", fullName: "acme/data-pipeline", defaultBranch: "develop" },
];

// ─── Mock Tasks ──────────────────────────────────────────────────────────────

export const MOCK_TASKS: MockTask[] = [
  {
    taskId: "task-1",
    title: "Refactor authentication middleware to support OAuth2 flows",
    description:
      "The current auth middleware only supports API key auth. We need to add OAuth2 support for third-party integrations.",
    status: "completed",
    repoId: "repo-1",
    repoName: "acme/api-service",
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 3),
    updatedAt: new Date(Date.now() - 1000 * 60 * 60 * 2),
    plan: "1. Audit current middleware\n2. Add OAuth2 token validation\n3. Update route guards\n4. Write integration tests",
    acceptanceCriteria: [
      "OAuth2 bearer tokens are validated against the issuer",
      "API key auth continues to work unchanged",
      "All existing tests pass",
      "New tests cover OAuth2 flows",
    ],
    suggestedFiles: [
      "src/middleware/auth.ts",
      "src/middleware/oauth2.ts",
      "src/routes/api.ts",
      "tests/auth.test.ts",
    ],
  },
  {
    taskId: "task-2",
    title: "Add pagination to the /users endpoint",
    description:
      "The /users endpoint currently returns all users without any pagination. This causes performance issues with large datasets.",
    status: "ready",
    repoId: "repo-1",
    repoName: "acme/api-service",
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 12),
    updatedAt: new Date(Date.now() - 1000 * 60 * 30),
    plan: "1. Add cursor-based pagination params\n2. Update DB query to use LIMIT/OFFSET\n3. Return pagination metadata in response",
    acceptanceCriteria: [
      "Endpoint accepts `page` and `limit` query params",
      "Response includes `total`, `page`, and `hasNextPage` fields",
      "Default limit is 20, max is 100",
    ],
    suggestedFiles: ["src/routes/users.ts", "src/db/queries/users.ts"],
  },
  {
    taskId: "task-3",
    title: "Migrate dashboard charts to use the new data pipeline",
    description:
      "Charts in the dashboard are still using the old REST API. We need to migrate them to subscribe to the new streaming data pipeline.",
    status: "executing",
    repoId: "repo-2",
    repoName: "acme/frontend-app",
    createdAt: new Date(Date.now() - 1000 * 60 * 45),
    updatedAt: new Date(Date.now() - 1000 * 60 * 5),
  },
  {
    taskId: "task-4",
    title: "Fix race condition in job queue processor",
    description:
      "Under high load, multiple workers can pick up the same job before it's marked as in-progress. Need to add distributed locking.",
    status: "awaiting_clarification",
    repoId: "repo-3",
    repoName: "acme/data-pipeline",
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 6),
    updatedAt: new Date(Date.now() - 1000 * 60 * 60),
    questions: [
      {
        questionId: "q-1",
        body: "Should we use Redis-based distributed locking (Redlock) or a database-level advisory lock?",
      },
      {
        questionId: "q-2",
        body: "What is the acceptable job duplication rate before the fix? This helps us prioritize urgency.",
      },
    ],
  },
  {
    taskId: "task-5",
    title: "Set up E2E test suite for the checkout flow",
    description:
      "We have unit tests but no end-to-end tests for the checkout flow. Add Playwright tests covering happy path and edge cases.",
    status: "drafting",
    repoId: "repo-2",
    repoName: "acme/frontend-app",
    createdAt: new Date(Date.now() - 1000 * 60 * 10),
    updatedAt: new Date(Date.now() - 1000 * 60 * 10),
  },
  {
    taskId: "task-6",
    title: "Backfill missing timestamps in events table",
    description:
      "A deploy two weeks ago failed to write `created_at` for ~12k rows. Need a migration to backfill from the audit log.",
    status: "failed",
    repoId: "repo-3",
    repoName: "acme/data-pipeline",
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 48),
    updatedAt: new Date(Date.now() - 1000 * 60 * 60 * 24),
  },
];

export type TaskStatus =
  | "drafting"
  | "awaiting_clarification"
  | "ready"
  | "executing"
  | "completed"
  | "failed"
  | "cancelled";

export interface TaskListItem {
  taskId: string;
  repositoryId: string;
  repositoryFullName: string;
  branch: string;
  title: string;
  status: TaskStatus;
  phase: "intake" | "planning" | "clarification" | "execution" | "delivery";
  createdAt: number;
  latestSummary?: string;
  latestError?: string;
  readyForExecutionAt?: number;
  completedAt?: number;
}

export interface TaskQuestion {
  questionId: string;
  key: string;
  question: string;
  status: "pending" | "answered" | "dismissed";
  answer?: string;
  answeredAt?: number;
}

export interface TaskRun {
  runId: string;
  kind: "planning" | "clarification" | "execution";
  status:
    | "queued"
    | "requested"
    | "launching"
    | "running"
    | "succeeded"
    | "failed"
    | "cancelled"
    | "timed_out";
  startedAt?: number;
  completedAt?: number;
  externalJobId?: string;
  provider?: string;
  model?: string;
  summary?: string;
  error?: string;
  events: TaskRunEvent[];
}

export interface TaskRunEvent {
  eventId: string;
  timestamp: number;
  type: string;
  payload: Record<string, unknown>;
}

export interface TaskDetail {
  taskId: string;
  workspaceId: string;
  repositoryId: string;
  repositoryFullName: string;
  branch: string;
  title: string;
  rawPrompt: string;
  normalizedPrompt?: string;
  status: TaskStatus;
  phase: "intake" | "planning" | "clarification" | "execution" | "delivery";
  createdAt: number;
  plan?: string;
  acceptanceCriteria?: string[];
  suggestedFiles?: Array<{
    path: string;
    reason?: string;
  }>;
  latestSummary?: string;
  latestError?: string;
  activeRunId?: string;
  planningRunId?: string;
  executionRunId?: string;
  questions: TaskQuestion[];
  runs: TaskRun[];
}

export interface TaskRepositoryOption {
  repositoryId: string;
  fullName: string;
  defaultBranch: string;
}

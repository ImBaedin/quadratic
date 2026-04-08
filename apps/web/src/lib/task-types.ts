export type TaskStatus =
  | "draft"
  | "in_review"
  | "awaiting_clarification"
  | "ready"
  | "in_progress"
  | "completed"
  | "failed"
  | "cancelled";

export type TaskKind = "general" | "bug" | "feature" | "research" | "chore" | "breakdown";

export type TaskPhase = "intake" | "planning" | "clarification" | "execution" | "delivery";

export interface TaskListItem {
  taskId: string;
  repositoryId?: string;
  repositoryFullName: string;
  branch?: string;
  title: string;
  taskKind: TaskKind;
  status: TaskStatus;
  phase: TaskPhase;
  createdAt: number;
  latestSummary?: string;
  latestError?: string;
  completedAt?: number;
  pendingProposalCount?: number;
  rawPrompt?: string;
  parentTaskId?: string;
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
  runKind:
    | "context_enrichment"
    | "task_breakdown"
    | "discussion_rereview"
    | "repo_analysis"
    | "repo_execution"
    | "repository_sync"
    | "repository_explore";
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
  artifacts?: Array<{
    artifactId?: string;
    kind: string;
    key: string;
    label?: string;
    contentType?: string;
    url?: string;
    metadata?: Record<string, unknown>;
  }>;
  usage?: {
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
    estimatedCostUsd?: number;
  } | null;
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
  phase: TaskPhase;
  createdAt: number;
  completedAt?: number;
  plan?: string;
  acceptanceCriteria?: string[];
  suggestedFiles?: Array<{
    path: string;
    reason?: string;
  }>;
  latestSummary?: string;
  latestError?: string;
  activeRunId?: string;
  latestVersionId?: string;
  taskKind: TaskKind;
  questions: TaskQuestion[];
  runs: TaskRun[];
  fieldValues?: Array<{
    definitionId: string;
    key: string;
    label: string;
    description?: string;
    valueKind: string;
    visibility: string;
    aiBehavior: string;
    promptHint?: string;
    value?: unknown;
  }>;
  contextEntries?: Array<{
    contextEntryId: string;
    kind: string;
    title?: string;
    body: string;
    metadata?: Record<string, unknown>;
    createdAt?: number;
  }>;
  discussions?: Array<{
    discussionId: string;
    authorType: string;
    body: string;
    triggerRereview: boolean;
    createdAt: number;
  }>;
  proposals?: Array<{
    proposalId: string;
    workflowKind: string;
    status: string;
    summary?: string;
    rationale?: string;
    items: Array<{
      itemId: string;
      itemType: string;
      action: string;
      label?: string;
      fieldKey?: string;
      status: string;
      payload: Record<string, unknown>;
      appliedEntityId?: string;
    }>;
  }>;
  versions?: Array<{
    versionId: string;
    sourceType: string;
    sourceId?: string;
    summary?: string;
    createdAt: number;
    snapshot: Record<string, unknown>;
  }>;
}

export interface TaskRepositoryOption {
  repositoryId: string;
  fullName: string;
  defaultBranch: string;
}

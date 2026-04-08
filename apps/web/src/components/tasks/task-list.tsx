import { Link } from "@tanstack/react-router";
import { GitBranch, Plus, CheckSquare } from "@phosphor-icons/react";

import {
  Empty,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
  EmptyDescription,
  EmptyContent,
} from "@quadratic/ui/components/empty";
import { cn } from "@/lib/utils";
import type { TaskListItem, TaskStatus } from "@/lib/task-types";
import { ACTIVE_STATUSES, DONE_STATUSES } from "@/lib/task-status";
import { TaskStatusIcon } from "./task-status-badge";
import { TaskKindIcon } from "./task-kind-icon";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function relativeTime(timestamp: number): string {
  const seconds = Math.floor((Date.now() - timestamp) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d`;
  return new Date(timestamp).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

// ─── Public component ─────────────────────────────────────────────────────────

interface TaskListProps {
  tasks: TaskListItem[];
  workspaceSlug: string;
  onNewTask?: () => void;
}

export function TaskList({ tasks, workspaceSlug, onNewTask }: TaskListProps) {
  if (tasks.length === 0) {
    return (
      <Empty className="min-h-[320px] border border-dashed border-border/60">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <CheckSquare className="size-4" />
          </EmptyMedia>
          <EmptyTitle>No tasks yet</EmptyTitle>
          <EmptyDescription>Create your first task to get started.</EmptyDescription>
        </EmptyHeader>
        {onNewTask && (
          <EmptyContent>
            <button
              onClick={onNewTask}
              className="inline-flex h-7 items-center gap-1.5 rounded-md bg-primary px-3 text-xs font-medium text-primary-foreground transition-colors hover:bg-primary/90"
            >
              <Plus className="size-3" />
              New task
            </button>
          </EmptyContent>
        )}
      </Empty>
    );
  }

  const active = tasks.filter((t) => (ACTIVE_STATUSES as TaskStatus[]).includes(t.status));
  const done = tasks.filter((t) => (DONE_STATUSES as TaskStatus[]).includes(t.status));

  return (
    <div className="flex flex-col gap-1">
      {active.length > 0 && (
        <TaskGroup label="Active" tasks={active} workspaceSlug={workspaceSlug} />
      )}
      {done.length > 0 && <TaskGroup label="Done" tasks={done} workspaceSlug={workspaceSlug} />}
    </div>
  );
}

// ─── Group ────────────────────────────────────────────────────────────────────

function TaskGroup({
  label,
  tasks,
  workspaceSlug,
}: {
  label: string;
  tasks: TaskListItem[];
  workspaceSlug: string;
}) {
  return (
    <div className="overflow-hidden rounded-xl border border-border/60 bg-card">
      {/* Group header */}
      <div className="flex items-center gap-2 border-b border-border/60 px-4 py-2">
        <span className="text-[0.65rem] font-semibold uppercase tracking-wider text-muted-foreground/60">
          {label}
        </span>
        <span className="tabular-nums text-[0.65rem] text-muted-foreground/40">{tasks.length}</span>
      </div>

      {/* Rows */}
      <ul>
        {tasks.map((task, i) => (
          <TaskRow
            key={task.taskId}
            task={task}
            workspaceSlug={workspaceSlug}
            isLast={i === tasks.length - 1}
          />
        ))}
      </ul>
    </div>
  );
}

// ─── Row ──────────────────────────────────────────────────────────────────────

function TaskRow({
  task,
  workspaceSlug,
  isLast,
}: {
  task: TaskListItem;
  workspaceSlug: string;
  isLast: boolean;
}) {
  const updatedAt = task.completedAt ?? task.createdAt;

  return (
    <li className={cn(!isLast && "border-b border-border/40")}>
      <Link
        to={`/${workspaceSlug}/tasks/${task.taskId}` as never}
        className={cn(
          "group flex items-center gap-3 px-4 py-2.5 transition-colors hover:bg-muted/30",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring",
        )}
      >
        {/* Status icon */}
        <TaskStatusIcon status={task.status} className="shrink-0" />

        {/* Kind icon */}
        <TaskKindIcon kind={task.taskKind} className="shrink-0" />

        {/* Title */}
        <span className="min-w-0 flex-1 truncate text-xs font-medium text-foreground">
          {task.title}
        </span>

        {/* Pending proposals indicator */}
        {task.pendingProposalCount != null && task.pendingProposalCount > 0 && (
          <span className="shrink-0 rounded-full bg-primary/15 px-1.5 py-0.5 text-[0.6rem] font-medium tabular-nums text-primary">
            {task.pendingProposalCount}
          </span>
        )}

        {/* Repo + branch */}
        <span className="hidden shrink-0 items-center gap-1 text-[0.7rem] text-muted-foreground/60 sm:flex">
          <GitBranch className="size-3 shrink-0" />
          <span className="max-w-[10rem] truncate">{task.repositoryFullName}</span>
        </span>

        {/* Timestamp */}
        <time
          dateTime={new Date(updatedAt).toISOString()}
          className="hidden shrink-0 tabular-nums text-[0.7rem] text-muted-foreground/50 sm:inline"
        >
          {relativeTime(updatedAt)}
        </time>
      </Link>
    </li>
  );
}

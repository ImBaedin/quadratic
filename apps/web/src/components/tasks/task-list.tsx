import { Link } from "@tanstack/react-router";
import { CheckSquare } from "@phosphor-icons/react";

import {
  Empty,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
  EmptyDescription,
  EmptyContent,
} from "@quadratic/ui/components/empty";
import { cn } from "@/lib/utils";
import type { TaskListItem } from "@/lib/task-types";
import { TaskStatusBadge } from "./task-status-badge";

function relativeTime(timestamp: number): string {
  const seconds = Math.floor((Date.now() - timestamp) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(timestamp).toLocaleDateString();
}

interface TaskListProps {
  tasks: TaskListItem[];
  workspaceSlug: string;
  onNewTask?: () => void;
}

export function TaskList({ tasks, workspaceSlug, onNewTask }: TaskListProps) {
  if (tasks.length === 0) {
    return (
      <Empty className="min-h-[320px] border border-dashed border-border">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <CheckSquare className="size-4" />
          </EmptyMedia>
          <EmptyTitle>No tasks yet</EmptyTitle>
          <EmptyDescription>
            Create your first task and the agent will pick it up.
          </EmptyDescription>
        </EmptyHeader>
        {onNewTask && (
          <EmptyContent>
            <button
              onClick={onNewTask}
              className="inline-flex h-7 items-center rounded-md bg-primary px-3 text-xs font-medium text-primary-foreground transition-colors hover:bg-primary/90"
            >
              New task
            </button>
          </EmptyContent>
        )}
      </Empty>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border border-border/60 bg-card">
      <ul className="divide-y divide-border/60">
        {tasks.map((task) => (
          <TaskRow key={task.taskId} task={task} workspaceSlug={workspaceSlug} />
        ))}
      </ul>
    </div>
  );
}

function TaskRow({
  task,
  workspaceSlug,
}: {
  task: TaskListItem;
  workspaceSlug: string;
}) {
  const updatedAt = task.completedAt ?? task.readyForExecutionAt ?? task.createdAt;

  return (
    <li>
      <Link
        to={`/${workspaceSlug}/tasks/${task.taskId}` as never}
        className={cn(
          "flex items-center gap-3 px-4 py-3 text-xs transition-colors hover:bg-muted/40",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring",
        )}
      >
        {/* Status badge — fixed width */}
        <TaskStatusBadge status={task.status} className="shrink-0" />

        {/* Title */}
        <span className="min-w-0 flex-1 truncate font-medium text-foreground">
          {task.title}
        </span>

        {/* Repo name */}
        <span className="hidden shrink-0 text-muted-foreground sm:inline">
          {task.repositoryFullName}
        </span>

        {/* Timestamp */}
        <time
          dateTime={new Date(updatedAt).toISOString()}
          className="hidden shrink-0 tabular-nums text-muted-foreground sm:inline"
        >
          {relativeTime(updatedAt)}
        </time>
      </Link>
    </li>
  );
}

import { cn } from "@/lib/utils";
import type { TaskStatus } from "@/lib/task-types";
import { TASK_STATUS_CONFIG } from "@/lib/task-status";

interface TaskStatusBadgeProps {
  status: TaskStatus;
  className?: string;
}

export function TaskStatusBadge({ status, className }: TaskStatusBadgeProps) {
  const config = TASK_STATUS_CONFIG[status];

  return (
    <span
      className={cn(
        "inline-flex h-5 shrink-0 items-center rounded-full border px-2 text-[0.625rem] font-medium tabular-nums whitespace-nowrap",
        config.badgeClass,
        config.pulse && "animate-pulse",
        className,
      )}
    >
      {config.label}
    </span>
  );
}

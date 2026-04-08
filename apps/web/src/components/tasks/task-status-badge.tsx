import { cn } from "@/lib/utils";
import type { TaskStatus } from "@/lib/task-types";
import { TASK_STATUS_CONFIG } from "@/lib/task-status";

interface TaskStatusIconProps {
  status: TaskStatus;
  className?: string;
  /** Show label next to icon (default: false) */
  showLabel?: boolean;
}

/**
 * Linear-style status indicator — a small SVG icon whose shape encodes the
 * task state. Pass `showLabel` to render the text label alongside it.
 */
export function TaskStatusIcon({ status, className, showLabel = false }: TaskStatusIconProps) {
  const config = TASK_STATUS_CONFIG[status];

  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1.5",
        config.iconClass,
        config.pulse && "animate-pulse",
        className,
      )}
    >
      <StatusShapeIcon shape={config.shape} className="size-3.5 shrink-0" />
      {showLabel && <span className="text-[0.7rem] font-medium leading-none">{config.label}</span>}
    </span>
  );
}

/** Full badge — icon + label in a subtle pill, matches the old TaskStatusBadge API */
export function TaskStatusBadge({ status, className }: { status: TaskStatus; className?: string }) {
  const config = TASK_STATUS_CONFIG[status];

  return (
    <span
      className={cn(
        "inline-flex h-5 shrink-0 items-center gap-1 rounded-full border px-1.5 text-[0.625rem] font-medium whitespace-nowrap tabular-nums",
        config.badgeClass,
        config.pulse && "animate-pulse",
        className,
      )}
    >
      <StatusShapeIcon shape={config.shape} className="size-2.5 shrink-0" />
      {config.label}
    </span>
  );
}

// ─── Shape SVGs ──────────────────────────────────────────────────────────────

function StatusShapeIcon({
  shape,
  className,
}: {
  shape: (typeof TASK_STATUS_CONFIG)[TaskStatus]["shape"];
  className?: string;
}) {
  switch (shape) {
    // Draft: plain circle outline
    case "empty":
      return (
        <svg viewBox="0 0 14 14" fill="none" className={className}>
          <circle cx="7" cy="7" r="5.5" stroke="currentColor" strokeWidth="1.5" />
        </svg>
      );

    // In review: half-filled circle
    case "half":
      return (
        <svg viewBox="0 0 14 14" fill="none" className={className}>
          <circle cx="7" cy="7" r="5.5" stroke="currentColor" strokeWidth="1.5" />
          <path d="M7 1.5a5.5 5.5 0 0 1 0 11V1.5z" fill="currentColor" />
        </svg>
      );

    // Needs input: circle with exclamation dot
    case "alert":
      return (
        <svg viewBox="0 0 14 14" fill="none" className={className}>
          <circle cx="7" cy="7" r="5.5" stroke="currentColor" strokeWidth="1.5" />
          <rect x="6.25" y="4" width="1.5" height="4" rx="0.75" fill="currentColor" />
          <circle cx="7" cy="9.5" r="0.75" fill="currentColor" />
        </svg>
      );

    // Ready: circle with outlined check
    case "check-outline":
      return (
        <svg viewBox="0 0 14 14" fill="none" className={className}>
          <circle cx="7" cy="7" r="5.5" stroke="currentColor" strokeWidth="1.5" />
          <path
            d="M4.5 7l1.8 1.8 3.2-3.6"
            stroke="currentColor"
            strokeWidth="1.4"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      );

    // In progress: 3/4 arc
    case "progress":
      return (
        <svg viewBox="0 0 14 14" fill="none" className={className}>
          <circle
            cx="7"
            cy="7"
            r="5.5"
            stroke="currentColor"
            strokeOpacity="0.25"
            strokeWidth="1.5"
          />
          <path
            d="M7 1.5A5.5 5.5 0 1 1 1.5 7"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
        </svg>
      );

    // Completed: solid filled circle with check
    case "filled":
      return (
        <svg viewBox="0 0 14 14" fill="none" className={className}>
          <circle cx="7" cy="7" r="6" fill="currentColor" />
          <path
            d="M4.5 7l1.8 1.8 3.2-3.6"
            stroke="white"
            strokeWidth="1.4"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      );

    // Failed: circle with ×
    case "x":
      return (
        <svg viewBox="0 0 14 14" fill="none" className={className}>
          <circle cx="7" cy="7" r="5.5" stroke="currentColor" strokeWidth="1.5" />
          <path
            d="M5 5l4 4M9 5l-4 4"
            stroke="currentColor"
            strokeWidth="1.4"
            strokeLinecap="round"
          />
        </svg>
      );

    // Cancelled: circle with dash
    case "dash":
      return (
        <svg viewBox="0 0 14 14" fill="none" className={className}>
          <circle cx="7" cy="7" r="5.5" stroke="currentColor" strokeWidth="1.5" />
          <path d="M4.5 7h5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      );
  }
}

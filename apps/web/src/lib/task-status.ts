import type { TaskStatus } from "./task-types";

export interface TaskStatusConfig {
  label: string;
  /** Short label for compact contexts */
  shortLabel: string;
  /** Tailwind classes for the status icon / dot color */
  iconClass: string;
  /** Tailwind classes for a subtle pill badge */
  badgeClass: string;
  /** Whether this status should animate */
  pulse: boolean;
  /** Visual shape variant driving the SVG icon */
  shape: "empty" | "half" | "alert" | "check-outline" | "progress" | "filled" | "x" | "dash";
}

export const TASK_STATUS_CONFIG: Record<TaskStatus, TaskStatusConfig> = {
  draft: {
    label: "Draft",
    shortLabel: "Draft",
    iconClass: "text-zinc-500",
    badgeClass: "bg-zinc-700/40 text-zinc-400 border-zinc-600/50",
    pulse: false,
    shape: "empty",
  },
  in_review: {
    label: "In review",
    shortLabel: "Review",
    iconClass: "text-violet-400",
    badgeClass: "bg-violet-500/10 text-violet-300 border-violet-500/25",
    pulse: false,
    shape: "half",
  },
  awaiting_clarification: {
    label: "Needs input",
    shortLabel: "Input",
    iconClass: "text-amber-400",
    badgeClass: "bg-amber-500/10 text-amber-400 border-amber-500/25",
    pulse: false,
    shape: "alert",
  },
  ready: {
    label: "Ready",
    shortLabel: "Ready",
    iconClass: "text-sky-400",
    badgeClass: "bg-sky-500/10 text-sky-400 border-sky-500/25",
    pulse: false,
    shape: "check-outline",
  },
  in_progress: {
    label: "Running",
    shortLabel: "Running",
    iconClass: "text-blue-400",
    badgeClass: "bg-blue-500/10 text-blue-400 border-blue-500/25",
    pulse: true,
    shape: "progress",
  },
  completed: {
    label: "Completed",
    shortLabel: "Done",
    iconClass: "text-emerald-400",
    badgeClass: "bg-emerald-500/10 text-emerald-400 border-emerald-500/25",
    pulse: false,
    shape: "filled",
  },
  failed: {
    label: "Failed",
    shortLabel: "Failed",
    iconClass: "text-red-400",
    badgeClass: "bg-red-500/10 text-red-400 border-red-500/25",
    pulse: false,
    shape: "x",
  },
  cancelled: {
    label: "Cancelled",
    shortLabel: "Cancelled",
    iconClass: "text-zinc-600",
    badgeClass: "bg-zinc-800/50 text-zinc-500 border-zinc-700/50",
    pulse: false,
    shape: "dash",
  },
};

export const ACTIVE_STATUSES: TaskStatus[] = [
  "draft",
  "in_review",
  "awaiting_clarification",
  "ready",
  "in_progress",
];
export const DONE_STATUSES: TaskStatus[] = ["completed", "failed", "cancelled"];

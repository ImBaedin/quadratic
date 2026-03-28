import type { TaskStatus } from "./mock-data";

export interface TaskStatusConfig {
  label: string;
  /** Tailwind background + text classes for the badge */
  badgeClass: string;
  /** Whether this status should pulse */
  pulse: boolean;
}

export const TASK_STATUS_CONFIG: Record<TaskStatus, TaskStatusConfig> = {
  drafting: {
    label: "Drafting",
    badgeClass: "bg-zinc-700/60 text-zinc-300 border-zinc-600",
    pulse: false,
  },
  awaiting_clarification: {
    label: "Needs input",
    badgeClass: "bg-amber-500/15 text-amber-400 border-amber-500/30",
    pulse: false,
  },
  ready: {
    label: "Ready",
    badgeClass: "bg-green-500/15 text-green-400 border-green-500/30",
    pulse: false,
  },
  executing: {
    label: "Executing",
    badgeClass: "bg-blue-500/15 text-blue-400 border-blue-500/30",
    pulse: true,
  },
  completed: {
    label: "Completed",
    badgeClass: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
    pulse: false,
  },
  failed: {
    label: "Failed",
    badgeClass: "bg-red-500/15 text-red-400 border-red-500/30",
    pulse: false,
  },
  cancelled: {
    label: "Cancelled",
    badgeClass: "bg-zinc-800/60 text-zinc-500 border-zinc-700",
    pulse: false,
  },
};

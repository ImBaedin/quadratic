import type { RunStatus } from "./events";

const allowedTransitions = {
  queued: ["requested", "launching", "running", "cancelled", "failed", "timed_out"],
  requested: ["launching", "running", "cancelled", "failed", "timed_out"],
  launching: ["running", "cancelled", "failed", "timed_out"],
  running: ["succeeded", "failed", "cancelled", "timed_out"],
  succeeded: [],
  failed: [],
  cancelled: [],
  timed_out: [],
} satisfies Record<RunStatus, RunStatus[]>;

export function canTransitionRunStatus(from: RunStatus, to: RunStatus): boolean {
  return (allowedTransitions[from] as RunStatus[]).includes(to);
}

export function assertRunStatusTransition(from: RunStatus, to: RunStatus): void {
  if (!canTransitionRunStatus(from, to)) {
    throw new Error(`Invalid run status transition from ${from} to ${to}`);
  }
}

export function isTerminalRunStatus(status: RunStatus): boolean {
  return allowedTransitions[status].length === 0;
}

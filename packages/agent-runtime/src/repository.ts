import type { RunEnvelope } from "./events";

export function buildRepositorySummary(envelope: RunEnvelope) {
  const repository = envelope.repository ?? envelope.task?.repository;
  if (!repository) {
    return null;
  }

  return {
    fullName: repository.fullName,
    owner: repository.owner,
    name: repository.name,
    defaultBranch: repository.defaultBranch,
    selected: repository.selected,
    archived: repository.archived,
  };
}

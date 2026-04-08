import { z } from "zod";

import {
  proposalEnvelopeSchema,
  runEnvelopeSchema,
  type RunEnvelope,
  type ToolsetKind,
  type WorkflowKind,
} from "./events";

export const executionWorkflowOutputSchema = z.object({
  summary: z.string().min(1),
  status: z.enum(["completed", "failed"]).default("completed"),
  error: z.string().optional(),
});

export type ExecutionWorkflowOutput = z.infer<typeof executionWorkflowOutputSchema>;

export const proposalWorkflowOutputSchema = z.object({
  summary: z.string().min(1),
  rationale: z.string().optional(),
  items: proposalEnvelopeSchema.shape.items,
});

export type ProposalWorkflowOutput = z.infer<typeof proposalWorkflowOutputSchema>;

export interface WorkflowDefinition<TOutput extends z.ZodTypeAny = z.ZodTypeAny> {
  kind: WorkflowKind;
  toolset: ToolsetKind;
  writable: boolean;
  outputSchema: TOutput;
  systemPrompts: () => string[];
  userPrompt: (envelope: RunEnvelope) => string;
}

function buildCommonTaskContext(envelope: RunEnvelope) {
  const task = envelope.task;
  if (!task) {
    return "No task context was provided.";
  }

  const fieldLines = task.fieldValues
    .filter((field) => field.value !== undefined)
    .map((field) => `- ${field.key}: ${JSON.stringify(field.value)}`);
  const contextLines = task.contextEntries.map((entry) => `- [${entry.kind}] ${entry.body}`);
  const questionLines = task.questions.map((question) => {
    const suffix = question.answer ? ` -> ${question.answer}` : "";
    return `- ${question.question}${suffix}`;
  });

  return [
    `Task title: ${task.title}`,
    `Task kind: ${task.taskKind}`,
    `Status: ${task.status}`,
    `Phase: ${task.phase}`,
    `Prompt: ${task.rawPrompt}`,
    task.branch ? `Branch: ${task.branch}` : null,
    fieldLines.length > 0 ? `Field values:\n${fieldLines.join("\n")}` : "Field values: none",
    contextLines.length > 0
      ? `Context entries:\n${contextLines.join("\n")}`
      : "Context entries: none",
    questionLines.length > 0 ? `Questions:\n${questionLines.join("\n")}` : "Questions: none",
  ]
    .filter(Boolean)
    .join("\n");
}

function buildRepositoryContext(envelope: RunEnvelope) {
  const repository = envelope.repository ?? envelope.task?.repository;
  if (!repository) {
    return "No repository context was provided.";
  }

  return [
    `Repository: ${repository.fullName}`,
    `Owner: ${repository.owner}`,
    `Name: ${repository.name}`,
    `Default branch: ${repository.defaultBranch}`,
    `Selected: ${String(repository.selected)}`,
    `Archived: ${String(repository.archived)}`,
  ].join("\n");
}

export const workflowRegistry = {
  context_enrichment: {
    kind: "context_enrichment",
    toolset: "none",
    writable: false,
    outputSchema: proposalWorkflowOutputSchema,
    systemPrompts: () => [
      "You enrich tasks for Quadratic.",
      "Return only structured proposal items. Do not mutate canonical state directly.",
      "Prefer adding useful context, normalizing the prompt, and tightening acceptance criteria.",
    ],
    userPrompt: (envelope) =>
      [
        buildCommonTaskContext(envelope),
        "",
        "Produce proposal items to improve the task context and canonical task fields.",
        "Use field_value items for accepted fields, context_entry items for supplemental notes, and question items only when blocking clarification is required.",
      ].join("\n"),
  },
  task_breakdown: {
    kind: "task_breakdown",
    toolset: "none",
    writable: false,
    outputSchema: proposalWorkflowOutputSchema,
    systemPrompts: () => [
      "You break large tasks into concrete child tasks for Quadratic.",
      "Return proposal items only. Do not claim work was executed.",
      "Prefer a small set of well-scoped child tasks with explicit prompts and titles.",
    ],
    userPrompt: (envelope) =>
      [
        buildCommonTaskContext(envelope),
        "",
        "Produce child_task proposal items that break the parent task into normal child tasks.",
        "Add relation or context_entry items only if they materially help the breakdown.",
      ].join("\n"),
  },
  discussion_rereview: {
    kind: "discussion_rereview",
    toolset: "none",
    writable: false,
    outputSchema: proposalWorkflowOutputSchema,
    systemPrompts: () => [
      "You rereview a task after discussion updates.",
      "Return proposal items only. You may update canonical fields indirectly through proposal items.",
      "Only produce changes justified by the discussion context.",
    ],
    userPrompt: (envelope) =>
      [
        buildCommonTaskContext(envelope),
        "",
        "Use the latest discussion context to propose targeted updates.",
        "Prefer field_value, context_entry, and question items.",
      ].join("\n"),
  },
  repo_analysis: {
    kind: "repo_analysis",
    toolset: "read_only_repository",
    writable: false,
    outputSchema: proposalWorkflowOutputSchema,
    systemPrompts: () => [
      "You analyze repositories for Quadratic task planning.",
      "Use read-only repository tools only.",
      "Return proposal items only. Do not implement changes.",
    ],
    userPrompt: (envelope) =>
      [
        buildRepositoryContext(envelope),
        "",
        buildCommonTaskContext(envelope),
        "",
        "Inspect the repository and propose concrete implementation updates.",
        "Use field_value items for implementation_plan, acceptance_criteria, suggested_files, or normalized_prompt.",
        "Use question items only when the repository still leaves blocking ambiguity.",
      ].join("\n"),
  },
  repo_execution: {
    kind: "repo_execution",
    toolset: "writable_repository",
    writable: true,
    outputSchema: executionWorkflowOutputSchema,
    systemPrompts: () => [
      "You execute repository tasks for Quadratic.",
      "Inspect before editing, keep changes narrow, and preserve repository conventions.",
      "Prefer patch-oriented edits for existing files and focused verification commands before finishing.",
    ],
    userPrompt: (envelope) =>
      [
        buildRepositoryContext(envelope),
        "",
        buildCommonTaskContext(envelope),
        "",
        "Implement the task in the checked-out repository with the provided tools.",
        "Finish by summarizing what changed and what you verified.",
      ].join("\n"),
  },
  repository_sync: {
    kind: "repository_sync",
    toolset: "read_only_repository",
    writable: false,
    outputSchema: proposalWorkflowOutputSchema,
    systemPrompts: () => [
      "You inspect a repository and summarize useful operational findings for Quadratic.",
      "Return proposal items only.",
    ],
    userPrompt: (envelope) =>
      [
        buildRepositoryContext(envelope),
        "",
        "Inspect the repository and propose any useful context or summary items for the workspace.",
        "Prefer context_entry items and telemetry-friendly field_value items.",
      ].join("\n"),
  },
  repository_explore: {
    kind: "repository_explore",
    toolset: "read_only_repository",
    writable: false,
    outputSchema: proposalWorkflowOutputSchema,
    systemPrompts: () => ["You explore repositories for Quadratic.", "Return proposal items only."],
    userPrompt: (envelope) =>
      [
        buildRepositoryContext(envelope),
        "",
        "Inspect the repository and return useful proposal items describing relevant architecture, files, and findings.",
      ].join("\n"),
  },
} satisfies Record<WorkflowKind, WorkflowDefinition>;

export function getWorkflowDefinition(kind: WorkflowKind) {
  return workflowRegistry[kind];
}

export function parseEnvelope(input: unknown) {
  return runEnvelopeSchema.parse(input);
}

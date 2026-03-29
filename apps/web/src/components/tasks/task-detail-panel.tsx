import { useState } from "react";
import {
  CircleNotch,
  CheckSquare,
  CaretDown,
  ClockCounterClockwise,
  File,
  Question,
  ListChecks,
  CheckCircle,
  PaperPlaneTilt,
  TerminalWindow,
} from "@phosphor-icons/react";
import { Badge } from "@quadratic/ui/components/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@quadratic/ui/components/card";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@quadratic/ui/components/collapsible";
import { Separator } from "@quadratic/ui/components/separator";
import { Button } from "@quadratic/ui/components/button";
import { Textarea } from "@quadratic/ui/components/textarea";
import { cn } from "@/lib/utils";
import type { TaskDetail, TaskQuestion, TaskRun, TaskRunEvent } from "@/lib/task-types";
import { TaskStatusBadge } from "./task-status-badge";

interface TaskDetailPanelProps {
  task: TaskDetail;
  onAnswerQuestion?: (questionId: string, answer: string) => Promise<void>;
  onStartExecution?: () => Promise<void>;
}

export function TaskDetailPanel({
  task,
  onAnswerQuestion,
  onStartExecution,
}: TaskDetailPanelProps) {
  const isExecuting = task.status === "executing";
  const hasEnrichedData =
    task.plan ||
    task.acceptanceCriteria?.length ||
    task.suggestedFiles?.length ||
    task.questions?.length;

  const pendingQuestions = task.questions.filter((q) => q.status === "pending");
  const answeredQuestions = task.questions.filter((q) => q.status === "answered");
  const allAnswered = pendingQuestions.length === 0 && answeredQuestions.length > 0;
  const canStartExecution = task.status === "ready" && pendingQuestions.length === 0;

  return (
    <div className="flex flex-col gap-6">
      {/* Header card */}
      <Card>
        <CardHeader className="gap-3">
          <div className="flex flex-wrap items-center gap-3">
            <TaskStatusBadge status={task.status} />
            <time className="text-xs text-muted-foreground tabular-nums">
              {new Date(task.createdAt).toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
                year: "numeric",
              })}
            </time>
          </div>
          <CardTitle className="text-base font-semibold leading-snug text-balance">
            {task.title}
          </CardTitle>
          <p className="text-xs text-muted-foreground text-pretty">{task.rawPrompt}</p>
        </CardHeader>
        <Separator />
        <CardContent className="pt-4">
          <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex gap-2">
              <span className="text-muted-foreground">Repository</span>
              <span className="font-medium text-foreground">{task.repositoryFullName}</span>
            </div>
            {canStartExecution && onStartExecution ? (
              <ExecuteTaskButton onStartExecution={onStartExecution} />
            ) : null}
          </div>
        </CardContent>
      </Card>

      {task.latestSummary ? (
        <div className="rounded-xl border border-border/60 bg-card px-4 py-3 text-xs text-muted-foreground">
          {task.latestSummary}
        </div>
      ) : null}

      {task.latestError ? (
        <div className="rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-xs text-destructive">
          {task.latestError}
        </div>
      ) : null}

      {/* Executing spinner */}
      {isExecuting && !hasEnrichedData && (
        <div className="flex items-center gap-3 rounded-xl border border-border/60 bg-card px-4 py-3">
          <CircleNotch className="size-4 animate-spin text-blue-400" />
          <span className="text-xs text-muted-foreground">Agent is working on this task…</span>
        </div>
      )}

      {/* Questions — pending (interactive) */}
      {pendingQuestions.length > 0 && (
        <Card className="border-amber-500/20">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm">
              <Question className="size-4 text-amber-400" weight="fill" />
              {pendingQuestions.length === 1
                ? "The agent has a question"
                : `The agent has ${pendingQuestions.length} questions`}
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            {pendingQuestions.map((q, i) => (
              <QuestionAnswerForm
                key={q.questionId}
                question={q}
                index={i + 1}
                total={pendingQuestions.length}
                onSubmit={onAnswerQuestion}
              />
            ))}
          </CardContent>
        </Card>
      )}

      {/* Questions — answered */}
      {answeredQuestions.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm">
              <CheckCircle
                className={cn("size-4", allAnswered ? "text-emerald-400" : "text-muted-foreground")}
                weight="fill"
              />
              {allAnswered ? "All questions answered" : "Answered questions"}
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {answeredQuestions.map((q) => (
              <div
                key={q.questionId}
                className="flex flex-col gap-2 rounded-lg border border-border/60 bg-muted/20 px-3 py-2.5"
              >
                <p className="text-xs text-muted-foreground">{q.question}</p>
                <div className="flex items-start gap-1.5">
                  <CheckCircle className="mt-0.5 size-3 shrink-0 text-emerald-400" weight="fill" />
                  <p className="text-xs text-foreground">{q.answer}</p>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Plan */}
      {task.plan && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm">
              <CheckSquare className="size-4 text-primary" weight="fill" />
              Plan
            </CardTitle>
          </CardHeader>
          <CardContent>
            <pre className="whitespace-pre-wrap text-xs text-muted-foreground leading-relaxed">
              {task.plan}
            </pre>
          </CardContent>
        </Card>
      )}

      {/* Acceptance criteria */}
      {task.acceptanceCriteria && task.acceptanceCriteria.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm">
              <ListChecks className="size-4 text-emerald-400" />
              Acceptance criteria
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="flex flex-col gap-2">
              {task.acceptanceCriteria.map((criterion, i) => (
                <li key={i} className="flex items-start gap-2 text-xs text-muted-foreground">
                  <span className="mt-0.5 size-1.5 shrink-0 rounded-full bg-emerald-500" />
                  {criterion}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {/* Suggested files */}
      {task.suggestedFiles && task.suggestedFiles.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm">
              <File className="size-4 text-muted-foreground" />
              Suggested files
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="flex flex-col gap-1.5">
              {task.suggestedFiles.map((file) => (
                <li key={file.path} className="font-mono text-[0.7rem] text-muted-foreground">
                  {file.path}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {task.runs.length > 0 && <TaskRunLogs task={task} />}

      {/* Drafting / planning state */}
      {(task.status === "drafting" || task.status === "ready") && !hasEnrichedData && (
        <div className="flex items-center gap-3 rounded-xl border border-border/60 bg-card px-4 py-3">
          <CircleNotch className="size-4 text-muted-foreground/40" />
          <span className="text-xs text-muted-foreground">
            Agent is analysing the task description…
          </span>
        </div>
      )}
    </div>
  );
}

function TaskRunLogs({ task }: { task: TaskDetail }) {
  const totalEvents = task.runs.reduce((count, run) => count + run.events.length, 0);

  return (
    <Card className="overflow-hidden">
      <Collapsible>
        <CardHeader className="pb-3">
          <CollapsibleTrigger className="group flex w-full items-center justify-between gap-3 rounded-lg text-left outline-none">
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex size-8 shrink-0 items-center justify-center rounded-lg border border-border/70 bg-muted/30">
                <TerminalWindow className="size-4 text-muted-foreground" />
              </div>
              <div className="min-w-0">
                <CardTitle className="text-sm">Agent logs</CardTitle>
                <p className="mt-1 text-xs text-muted-foreground">
                  {task.runs.length} {task.runs.length === 1 ? "run" : "runs"} and {totalEvents}{" "}
                  raw events
                </p>
              </div>
            </div>
            <CaretDown className="size-4 shrink-0 text-muted-foreground transition-transform duration-200 group-data-[panel-open]:rotate-180" />
          </CollapsibleTrigger>
        </CardHeader>
        <CollapsibleContent>
          <Separator />
          <CardContent className="flex flex-col gap-4 pt-4">
            {task.runs.map((run) => (
              <TaskRunLogCard key={run.runId} run={run} />
            ))}
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}

function TaskRunLogCard({ run }: { run: TaskRun }) {
  return (
    <div className="rounded-xl border border-border/60 bg-muted/15">
      <div className="flex flex-wrap items-center gap-2 border-b border-border/60 px-3 py-2.5">
        <Badge variant="outline" className="font-medium capitalize">
          {run.kind}
        </Badge>
        <Badge variant="secondary" className="font-medium capitalize">
          {formatRunStatus(run.status)}
        </Badge>
        <span className="font-mono text-[0.65rem] text-muted-foreground">{run.runId}</span>
        {run.model ? (
          <span className="rounded-md border border-border/60 bg-background/70 px-1.5 py-0.5 font-mono text-[0.65rem] text-muted-foreground">
            {run.model}
          </span>
        ) : null}
      </div>

      <div className="flex flex-col gap-3 px-3 py-3">
        <div className="flex flex-wrap items-center gap-3 text-[0.7rem] text-muted-foreground">
          {run.startedAt ? (
            <span className="inline-flex items-center gap-1">
              <ClockCounterClockwise className="size-3" />
              Started {formatTimestamp(run.startedAt)}
            </span>
          ) : null}
          {run.completedAt ? <span>Completed {formatTimestamp(run.completedAt)}</span> : null}
        </div>

        {run.summary ? (
          <div className="rounded-lg border border-border/60 bg-background/70 px-3 py-2 text-xs text-muted-foreground">
            {run.summary}
          </div>
        ) : null}

        {run.error ? (
          <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive">
            {run.error}
          </div>
        ) : null}

        {run.events.length > 0 ? (
          <div className="flex flex-col gap-2">
            {run.events.map((event) => (
              <TaskRunEventRow key={event.eventId} event={event} />
            ))}
          </div>
        ) : (
          <div className="rounded-lg border border-dashed border-border/60 px-3 py-2 text-xs text-muted-foreground">
            No recorded events for this run.
          </div>
        )}
      </div>
    </div>
  );
}

function TaskRunEventRow({ event }: { event: TaskRunEvent }) {
  const label = formatEventLabel(event);
  const details = formatEventDetails(event);
  const payload = sanitizePayload(event.payload, event.type);

  return (
    <div className="rounded-lg border border-border/60 bg-background/80 px-3 py-2.5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <span className="rounded-md border border-border/70 bg-muted/40 px-1.5 py-0.5 font-mono text-[0.65rem] text-muted-foreground">
            {event.type}
          </span>
          <span className="text-xs font-medium text-foreground">{label}</span>
        </div>
        <time className="text-[0.65rem] tabular-nums text-muted-foreground">
          {formatTimestamp(event.timestamp)}
        </time>
      </div>

      {details ? <p className="mt-2 text-xs text-muted-foreground">{details}</p> : null}

      {payload ? (
        <pre className="mt-2 overflow-x-auto rounded-md border border-border/60 bg-muted/30 p-2 text-[0.68rem] leading-relaxed text-muted-foreground">
          {JSON.stringify(payload, null, 2)}
        </pre>
      ) : null}
    </div>
  );
}

function formatRunStatus(status: TaskRun["status"]) {
  return status.replaceAll("_", " ");
}

function formatEventLabel(event: TaskRunEvent) {
  switch (event.type) {
    case "run.tool_called":
      return `Called ${readString(event.payload.toolName) ?? "tool"}`;
    case "run.tool_result":
      return `${readBoolean(event.payload.ok) === false ? "Failed" : "Finished"} ${readString(event.payload.toolName) ?? "tool"}`;
    case "run.stdout":
      return "Assistant output";
    case "run.stderr":
      return "Runtime error output";
    case "run.progress":
      return readString(event.payload.message) ?? "Progress update";
    case "run.artifact":
      return `Artifact ${readString(event.payload.kind) ?? "recorded"}`;
    default:
      return event.type.replace("run.", "").replaceAll("_", " ");
  }
}

function formatEventDetails(event: TaskRunEvent) {
  switch (event.type) {
    case "run.tool_called":
      return summarizeToolInput(event.payload.input);
    case "run.tool_result":
      return readString(event.payload.error) ?? summarizeToolOutput(event.payload.output);
    case "run.stdout":
    case "run.stderr":
      return readString(event.payload.chunk);
    case "run.progress":
      return undefined;
    default:
      return undefined;
  }
}

function summarizeToolInput(value: unknown) {
  const input = asRecord(value);
  if (!input) {
    return undefined;
  }

  if (typeof input.path === "string") {
    const range =
      typeof input.startLine === "number" || typeof input.endLine === "number"
        ? ` (${input.startLine ?? 1}-${input.endLine ?? "end"})`
        : "";
    return `Path: ${input.path}${range}`;
  }

  if (typeof input.command === "string") {
    return `Command: ${input.command}`;
  }

  if (typeof input.pattern === "string") {
    return `Pattern: ${input.pattern}`;
  }

  return undefined;
}

function summarizeToolOutput(value: unknown) {
  const output = asRecord(value);
  if (!output) {
    return undefined;
  }

  if (typeof output.path === "string" && typeof output.content === "string") {
    return `Read ${output.path}`;
  }

  if (typeof output.path === "string" && typeof output.bytesWritten === "number") {
    return `Wrote ${output.path}`;
  }

  if (Array.isArray(output.files)) {
    return `Listed ${output.files.length} files`;
  }

  if (typeof output.exitCode === "number") {
    return `Command exited with code ${output.exitCode}`;
  }

  return undefined;
}

function sanitizePayload(payload: Record<string, unknown>, eventType: string) {
  const entries = Object.entries(payload).filter(([key]) => key !== "runId");
  if (entries.length === 0) {
    return null;
  }

  if (eventType === "run.progress" && entries.length === 1 && entries[0]?.[0] === "message") {
    return null;
  }

  return Object.fromEntries(entries);
}

function readString(value: unknown) {
  return typeof value === "string" && value.trim().length > 0 ? value : undefined;
}

function readBoolean(value: unknown) {
  return typeof value === "boolean" ? value : undefined;
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

function formatTimestamp(timestamp: number) {
  return new Date(timestamp).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function ExecuteTaskButton({ onStartExecution }: { onStartExecution: () => Promise<void> }) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleClick() {
    setError(null);
    setSubmitting(true);

    try {
      await onStartExecution();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to start execution.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex flex-col items-end gap-1.5">
      <Button size="sm" onClick={handleClick} disabled={submitting}>
        <PaperPlaneTilt className="size-3.5" weight="fill" />
        {submitting ? "Starting..." : "Run task"}
      </Button>
      {error ? <p className="text-[0.65rem] text-destructive">{error}</p> : null}
    </div>
  );
}

// ─── Inline question answer form ─────────────────────────────────────────────

interface QuestionAnswerFormProps {
  question: TaskQuestion;
  index: number;
  total: number;
  onSubmit?: (questionId: string, answer: string) => Promise<void>;
}

function QuestionAnswerForm({ question, index, total, onSubmit }: QuestionAnswerFormProps) {
  const [answer, setAnswer] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!answer.trim() || !onSubmit) return;

    setError(null);
    setSubmitting(true);
    try {
      await onSubmit(question.questionId, answer.trim());
      setAnswer("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to submit answer.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-col gap-3 rounded-lg border border-amber-500/20 bg-amber-500/5 px-3 py-3"
    >
      {/* Question label */}
      {total > 1 && (
        <span className="text-[0.6rem] font-medium uppercase tracking-wider text-amber-500/70">
          Question {index} of {total}
        </span>
      )}
      <p className="text-xs font-medium text-foreground">{question.question}</p>

      {/* Answer textarea */}
      <Textarea
        required
        value={answer}
        onChange={(e) => setAnswer(e.target.value)}
        disabled={submitting}
        placeholder="Type your answer…"
        rows={3}
        className="resize-none border-amber-500/20 bg-background/60 text-xs focus-visible:border-amber-500/40 focus-visible:ring-amber-500/20"
      />

      {/* Error */}
      {error && (
        <p className="text-[0.65rem] text-destructive">{error}</p>
      )}

      {/* Submit */}
      <div className="flex justify-end">
        <Button
          type="submit"
          size="sm"
          disabled={!answer.trim() || submitting || !onSubmit}
          className="gap-1.5"
        >
          {submitting ? (
            <>
              <CircleNotch className="size-3 animate-spin" />
              Sending…
            </>
          ) : (
            <>
              <PaperPlaneTilt className="size-3" weight="fill" />
              Submit answer
            </>
          )}
        </Button>
      </div>
    </form>
  );
}

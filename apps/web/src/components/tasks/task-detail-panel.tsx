import { useState } from "react";
import {
  CircleNotch,
  CaretDown,
  File,
  ListChecks,
  CheckCircle,
  PaperPlaneTilt,
  TerminalWindow,
  ClockCounterClockwise,
  GitBranch,
  Calendar,
  ChatCircle,
  ArrowClockwise,
} from "@phosphor-icons/react";
import { Card, CardContent, CardHeader, CardTitle } from "@quadratic/ui/components/card";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@quadratic/ui/components/collapsible";
import { Separator } from "@quadratic/ui/components/separator";
import { Button } from "@quadratic/ui/components/button";
import { Textarea } from "@quadratic/ui/components/textarea";
import { Badge } from "@quadratic/ui/components/badge";
import { cn } from "@/lib/utils";
import type { TaskDetail, TaskQuestion, TaskRun, TaskRunEvent } from "@/lib/task-types";
import { TaskStatusBadge, TaskStatusIcon } from "./task-status-badge";
import { TaskKindIcon } from "./task-kind-icon";

interface TaskDetailPanelProps {
  task: TaskDetail;
  onAnswerQuestion?: (questionId: string, answer: string) => Promise<void>;
  onStartExecution?: () => Promise<void>;
  onAddDiscussion?: (body: string, triggerRereview: boolean) => Promise<void>;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatDate(timestamp: number) {
  return new Date(timestamp).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatDateTime(timestamp: number) {
  return new Date(timestamp).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

// ─── Main panel ───────────────────────────────────────────────────────────────

export function TaskDetailPanel({
  task,
  onAnswerQuestion,
  onStartExecution,
  onAddDiscussion,
}: TaskDetailPanelProps) {
  const pendingQuestions = task.questions.filter((q) => q.status === "pending");
  const answeredQuestions = task.questions.filter((q) => q.status === "answered");
  const isExecuting = task.status === "in_progress";
  const canStartExecution = task.status === "ready" && pendingQuestions.length === 0;
  const hasEnrichedData =
    task.plan || task.acceptanceCriteria?.length || task.suggestedFiles?.length;

  return (
    <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
      {/* ── Main content (left) ───────────────────────────────────────── */}
      <div className="min-w-0 flex-1 flex flex-col gap-4">
        {/* Title + meta header */}
        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <TaskStatusBadge status={task.status} />
            <TaskKindIcon
              kind={task.taskKind}
              showLabel
              className="text-[0.7rem] text-muted-foreground"
            />
          </div>
          <h1 className="text-lg font-semibold leading-snug text-balance text-foreground">
            {task.title}
          </h1>
          {task.rawPrompt && task.rawPrompt !== task.title && (
            <p className="text-xs text-muted-foreground text-pretty leading-relaxed">
              {task.rawPrompt}
            </p>
          )}
        </div>

        {/* Latest summary / error banner */}
        {task.latestError && (
          <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2.5 text-xs text-destructive">
            {task.latestError}
          </div>
        )}
        {task.latestSummary && !task.latestError && (
          <div className="rounded-lg border border-border/60 bg-muted/20 px-3 py-2.5 text-xs text-muted-foreground">
            {task.latestSummary}
          </div>
        )}

        {/* Executing / working spinner */}
        {isExecuting && !hasEnrichedData && (
          <div className="flex items-center gap-2.5 rounded-lg border border-border/60 bg-card px-3 py-2.5">
            <CircleNotch className="size-4 shrink-0 animate-spin text-blue-400" />
            <span className="text-xs text-muted-foreground">Agent is running…</span>
          </div>
        )}
        {(task.status === "draft" || task.status === "in_review") && !hasEnrichedData && (
          <div className="flex items-center gap-2.5 rounded-lg border border-border/60 bg-card px-3 py-2.5">
            <CircleNotch className="size-4 shrink-0 text-muted-foreground/30" />
            <span className="text-xs text-muted-foreground">Analysing task…</span>
          </div>
        )}

        {/* Pending questions — top priority */}
        {pendingQuestions.length > 0 && (
          <div className="rounded-xl border border-amber-500/20 bg-amber-500/5">
            <div className="flex items-center gap-2 border-b border-amber-500/15 px-4 py-2.5">
              <span className="size-1.5 rounded-full bg-amber-400" />
              <span className="text-xs font-medium text-amber-400">
                {pendingQuestions.length === 1
                  ? "Agent has a question"
                  : `Agent has ${pendingQuestions.length} questions`}
              </span>
            </div>
            <div className="flex flex-col gap-3 p-4">
              {pendingQuestions.map((q, i) => (
                <QuestionAnswerForm
                  key={q.questionId}
                  question={q}
                  index={i + 1}
                  total={pendingQuestions.length}
                  onSubmit={onAnswerQuestion}
                />
              ))}
            </div>
          </div>
        )}

        {/* Answered questions */}
        {answeredQuestions.length > 0 && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                <CheckCircle className="size-3.5 text-emerald-400" weight="fill" />
                Answered questions
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-2">
              {answeredQuestions.map((q) => (
                <div
                  key={q.questionId}
                  className="rounded-lg border border-border/60 bg-muted/10 px-3 py-2.5"
                >
                  <p className="text-xs text-muted-foreground">{q.question}</p>
                  <div className="mt-1.5 flex items-start gap-1.5">
                    <CheckCircle
                      className="mt-0.5 size-3 shrink-0 text-emerald-400"
                      weight="fill"
                    />
                    <p className="text-xs text-foreground">{q.answer}</p>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {/* Implementation plan */}
        {task.plan && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                <ListChecks className="size-3.5 text-primary" />
                Implementation plan
              </CardTitle>
            </CardHeader>
            <CardContent>
              <pre className="whitespace-pre-wrap text-xs text-foreground/80 leading-relaxed font-sans">
                {task.plan as string}
              </pre>
            </CardContent>
          </Card>
        )}

        {/* Acceptance criteria */}
        {task.acceptanceCriteria && (task.acceptanceCriteria as string[]).length > 0 && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                <CheckCircle className="size-3.5 text-emerald-400" />
                Acceptance criteria
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="flex flex-col gap-2">
                {(task.acceptanceCriteria as string[]).map((criterion, i) => (
                  <li key={i} className="flex items-start gap-2 text-xs text-muted-foreground">
                    <span className="mt-1.5 size-1 shrink-0 rounded-full bg-emerald-500" />
                    <span className="text-pretty">{criterion}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        )}

        {/* Suggested files */}
        {task.suggestedFiles &&
          (task.suggestedFiles as Array<{ path: string; reason?: string }>).length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                  <File className="size-3.5" />
                  Suggested files
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="flex flex-col gap-1">
                  {(task.suggestedFiles as Array<{ path: string; reason?: string }>).map((file) => (
                    <li key={file.path} className="flex flex-col gap-0.5">
                      <span className="font-mono text-[0.7rem] text-foreground/80">
                        {file.path}
                      </span>
                      {file.reason && (
                        <span className="text-[0.65rem] text-muted-foreground/60">
                          {file.reason}
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}

        {/* Discussion */}
        <DiscussionSection discussions={task.discussions} onAddDiscussion={onAddDiscussion} />

        {/* Agent runs (collapsible) */}
        {task.runs.length > 0 && <TaskRunLogs task={task} />}
      </div>

      {/* ── Sidebar (right) ───────────────────────────────────────────── */}
      <aside className="w-full shrink-0 lg:w-60 xl:w-72">
        <div className="rounded-xl border border-border/60 bg-card">
          <div className="px-4 py-3">
            <p className="text-[0.65rem] font-semibold uppercase tracking-wider text-muted-foreground/50">
              Details
            </p>
          </div>
          <Separator />
          <dl className="flex flex-col divide-y divide-border/40">
            <SidebarRow label="Status">
              <TaskStatusIcon status={task.status} showLabel />
            </SidebarRow>
            <SidebarRow label="Type">
              <TaskKindIcon kind={task.taskKind} showLabel />
            </SidebarRow>
            <SidebarRow label="Phase">
              <span className="text-[0.7rem] capitalize text-foreground/80">{task.phase}</span>
            </SidebarRow>
            {task.repositoryFullName && (
              <SidebarRow label="Repository">
                <span className="flex items-center gap-1 text-[0.7rem] text-foreground/80">
                  <GitBranch className="size-3 shrink-0 text-muted-foreground" />
                  <span className="truncate">{task.repositoryFullName}</span>
                </span>
              </SidebarRow>
            )}
            {task.branch && (
              <SidebarRow label="Branch">
                <span className="font-mono text-[0.7rem] text-foreground/80">{task.branch}</span>
              </SidebarRow>
            )}
            <SidebarRow label="Created">
              <span className="flex items-center gap-1 text-[0.7rem] text-muted-foreground">
                <Calendar className="size-3 shrink-0" />
                {formatDate(task.createdAt)}
              </span>
            </SidebarRow>
            {task.completedAt && (
              <SidebarRow label="Completed">
                <span className="flex items-center gap-1 text-[0.7rem] text-muted-foreground">
                  <Calendar className="size-3 shrink-0" />
                  {formatDate(task.completedAt)}
                </span>
              </SidebarRow>
            )}
          </dl>

          {/* Execute button — in sidebar when ready */}
          {canStartExecution && onStartExecution && (
            <>
              <Separator />
              <div className="p-4">
                <ExecuteTaskButton onStartExecution={onStartExecution} />
              </div>
            </>
          )}
        </div>
      </aside>
    </div>
  );
}

// ─── Sidebar row ──────────────────────────────────────────────────────────────

function SidebarRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3 px-4 py-2.5">
      <dt className="shrink-0 text-[0.65rem] text-muted-foreground/50 pt-px">{label}</dt>
      <dd className="min-w-0 text-right">{children}</dd>
    </div>
  );
}

// ─── Discussion section ───────────────────────────────────────────────────────

function DiscussionSection({
  discussions,
  onAddDiscussion,
}: {
  discussions?: TaskDetail["discussions"];
  onAddDiscussion?: (body: string, triggerRereview: boolean) => Promise<void>;
}) {
  const [body, setBody] = useState("");
  const [triggerRereview, setTriggerRereview] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const entries = discussions ?? [];

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!body.trim() || !onAddDiscussion) return;

    setError(null);
    setSubmitting(true);
    try {
      await onAddDiscussion(body.trim(), triggerRereview);
      setBody("");
      setTriggerRereview(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send message.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      {/* Existing discussion entries */}
      {entries.length > 0 && (
        <div className="flex flex-col gap-2">
          {entries.map((d) => (
            <div
              key={d.discussionId}
              className={cn(
                "rounded-lg border px-3 py-2.5",
                d.authorType === "user"
                  ? "border-border/60 bg-muted/20"
                  : "border-blue-500/20 bg-blue-500/5",
              )}
            >
              <div className="mb-1.5 flex items-center gap-2">
                <span className="text-[0.65rem] font-medium text-muted-foreground/60 capitalize">
                  {d.authorType === "user" ? "You" : "Agent"}
                </span>
                {d.triggerRereview && (
                  <span className="rounded-full border border-violet-500/20 bg-violet-500/10 px-1.5 py-px text-[0.6rem] text-violet-400">
                    re-review triggered
                  </span>
                )}
                <span className="ml-auto text-[0.65rem] tabular-nums text-muted-foreground/40">
                  {formatDateTime(d.createdAt)}
                </span>
              </div>
              <p className="text-xs text-foreground/80 text-pretty leading-relaxed">{d.body}</p>
            </div>
          ))}
        </div>
      )}

      {/* Compose box */}
      {onAddDiscussion && (
        <form onSubmit={handleSubmit} className="rounded-xl border border-border/60 bg-card p-3">
          <div className="flex items-center gap-2 mb-2">
            <ChatCircle className="size-3.5 text-muted-foreground/50" />
            <span className="text-[0.65rem] font-medium text-muted-foreground/50">
              {entries.length === 0 ? "Add a comment" : "Reply"}
            </span>
          </div>
          <Textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            disabled={submitting}
            placeholder="Add context, feedback, or a question…"
            rows={3}
            className="resize-none text-xs border-0 bg-transparent px-0 shadow-none focus-visible:ring-0 focus-visible:ring-offset-0"
          />
          {error && <p className="mt-1 text-[0.65rem] text-destructive">{error}</p>}
          <div className="mt-2 flex items-center justify-between gap-2">
            <label className="flex cursor-pointer items-center gap-1.5 select-none">
              <input
                type="checkbox"
                checked={triggerRereview}
                onChange={(e) => setTriggerRereview(e.target.checked)}
                disabled={submitting}
                className="size-3 rounded border-border accent-primary"
              />
              <span className="flex items-center gap-1 text-[0.65rem] text-muted-foreground/60">
                <ArrowClockwise className="size-3" />
                Request AI re-review
              </span>
            </label>
            <Button type="submit" size="sm" disabled={!body.trim() || submitting}>
              {submitting ? (
                <CircleNotch className="size-3.5 animate-spin" />
              ) : (
                <PaperPlaneTilt className="size-3.5" weight="fill" />
              )}
              {submitting ? "Sending…" : "Send"}
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}

// ─── Execute button ───────────────────────────────────────────────────────────

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
    <div className="flex flex-col gap-1.5">
      <Button size="sm" onClick={handleClick} disabled={submitting} className="w-full">
        <PaperPlaneTilt className="size-3.5" weight="fill" />
        {submitting ? "Starting…" : "Run task"}
      </Button>
      {error && <p className="text-[0.65rem] text-destructive">{error}</p>}
    </div>
  );
}

// ─── Question answer form ─────────────────────────────────────────────────────

function QuestionAnswerForm({
  question,
  index,
  total,
  onSubmit,
}: {
  question: TaskQuestion;
  index: number;
  total: number;
  onSubmit?: (questionId: string, answer: string) => Promise<void>;
}) {
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
    <form onSubmit={handleSubmit} className="flex flex-col gap-2.5">
      {total > 1 && (
        <span className="text-[0.6rem] font-semibold uppercase tracking-wider text-amber-500/60">
          {index} / {total}
        </span>
      )}
      <p className="text-xs font-medium text-foreground text-pretty">{question.question}</p>
      <Textarea
        required
        value={answer}
        onChange={(e) => setAnswer(e.target.value)}
        disabled={submitting}
        placeholder="Type your answer…"
        rows={2}
        className="resize-none border-amber-500/20 bg-background/60 text-xs focus-visible:border-amber-500/40 focus-visible:ring-amber-500/20"
      />
      {error && <p className="text-[0.65rem] text-destructive">{error}</p>}
      <div className="flex justify-end">
        <Button type="submit" size="sm" disabled={!answer.trim() || submitting || !onSubmit}>
          {submitting ? (
            <CircleNotch className="size-3 animate-spin" />
          ) : (
            <PaperPlaneTilt className="size-3" weight="fill" />
          )}
          {submitting ? "Sending…" : "Answer"}
        </Button>
      </div>
    </form>
  );
}

// ─── Run logs ─────────────────────────────────────────────────────────────────

function TaskRunLogs({ task }: { task: TaskDetail }) {
  const [open, setOpen] = useState(false);
  const totalEvents = task.runs.reduce((n, r) => n + r.events.length, 0);

  return (
    <Card className="overflow-hidden">
      <Collapsible open={open} onOpenChange={setOpen}>
        <CollapsibleTrigger className="flex w-full items-center gap-3 px-4 py-3 text-left outline-none focus-visible:ring-2 focus-visible:ring-ring">
          <div className="flex size-7 shrink-0 items-center justify-center rounded-lg border border-border/70 bg-muted/20">
            <TerminalWindow className="size-3.5 text-muted-foreground" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-medium text-foreground">Agent logs</p>
            <p className="text-[0.65rem] text-muted-foreground">
              {task.runs.length} {task.runs.length === 1 ? "run" : "runs"} · {totalEvents} events
            </p>
          </div>
          <CaretDown
            className={cn(
              "size-4 shrink-0 text-muted-foreground transition-transform duration-150",
              open && "rotate-180",
            )}
          />
        </CollapsibleTrigger>
        <CollapsibleContent>
          <Separator />
          <div className="flex flex-col gap-3 p-4">
            {task.runs.map((run) => (
              <RunCard key={run.runId} run={run} />
            ))}
          </div>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}

function RunCard({ run }: { run: TaskRun }) {
  return (
    <div className="rounded-xl border border-border/60 bg-muted/10">
      <div className="flex flex-wrap items-center gap-2 border-b border-border/60 px-3 py-2">
        <Badge variant="outline" className="text-[0.65rem] font-medium capitalize">
          {run.runKind.replaceAll("_", " ")}
        </Badge>
        <Badge
          variant={run.status === "succeeded" ? "outline" : "secondary"}
          className={cn(
            "text-[0.65rem] capitalize",
            run.status === "succeeded" &&
              "border-emerald-500/20 bg-emerald-500/10 text-emerald-400",
            run.status === "failed" && "border-red-500/20 bg-red-500/10 text-red-400",
            run.status === "running" && "border-blue-500/20 bg-blue-500/10 text-blue-400",
          )}
        >
          {run.status.replaceAll("_", " ")}
        </Badge>
        {run.model && (
          <span className="ml-auto font-mono text-[0.65rem] text-muted-foreground/50">
            {run.model}
          </span>
        )}
      </div>

      <div className="flex flex-col gap-2 p-3">
        <div className="flex flex-wrap gap-3 text-[0.7rem] text-muted-foreground/50">
          {run.startedAt && (
            <span className="inline-flex items-center gap-1">
              <ClockCounterClockwise className="size-3" />
              {formatDateTime(run.startedAt)}
            </span>
          )}
          {run.completedAt && <span>→ {formatDateTime(run.completedAt)}</span>}
        </div>

        {run.summary && (
          <p className="text-xs text-muted-foreground leading-relaxed text-pretty">{run.summary}</p>
        )}
        {run.error && <p className="text-xs text-destructive text-pretty">{run.error}</p>}

        {run.events.length > 0 && (
          <div className="flex flex-col gap-1.5">
            {run.events.map((event) => (
              <EventRow key={event.eventId} event={event} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function EventRow({ event }: { event: TaskRunEvent }) {
  const label = formatEventLabel(event);
  const details = formatEventDetails(event);
  const payload = sanitizePayload(event.payload, event.type);

  return (
    <div className="rounded-lg border border-border/40 bg-background/60 px-2.5 py-2">
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <span className="shrink-0 rounded border border-border/60 bg-muted/40 px-1 py-px font-mono text-[0.6rem] text-muted-foreground/60">
            {event.type.replace("run.", "")}
          </span>
          <span className="truncate text-[0.7rem] font-medium text-foreground">{label}</span>
        </div>
        <time className="shrink-0 tabular-nums text-[0.62rem] text-muted-foreground/40">
          {formatDateTime(event.timestamp)}
        </time>
      </div>
      {details && (
        <p className="mt-1.5 text-[0.7rem] text-muted-foreground/70 text-pretty">{details}</p>
      )}
      {payload && (
        <pre className="mt-1.5 overflow-x-auto rounded border border-border/40 bg-muted/20 p-1.5 text-[0.62rem] leading-relaxed text-muted-foreground/60">
          {JSON.stringify(payload, null, 2)}
        </pre>
      )}
    </div>
  );
}

// ─── Formatting helpers ───────────────────────────────────────────────────────

function formatEventLabel(event: TaskRunEvent) {
  switch (event.type) {
    case "run.tool_called":
      return `Called ${readString(event.payload.toolName) ?? "tool"}`;
    case "run.tool_result":
      return `${readBoolean(event.payload.ok) === false ? "Failed" : "Finished"} ${readString(event.payload.toolName) ?? "tool"}`;
    case "run.stdout":
      return "Assistant output";
    case "run.stderr":
      return "Runtime error";
    case "run.progress":
      return readString(event.payload.message) ?? "Progress";
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
    default:
      return undefined;
  }
}

function summarizeToolInput(value: unknown) {
  const input = asRecord(value);
  if (!input) return undefined;
  if (typeof input.path === "string") {
    const range =
      typeof input.startLine === "number" || typeof input.endLine === "number"
        ? ` (${input.startLine ?? 1}–${input.endLine ?? "end"})`
        : "";
    return `${input.path}${range}`;
  }
  if (typeof input.command === "string") return `$ ${input.command}`;
  if (typeof input.pattern === "string") return `Pattern: ${input.pattern}`;
  return undefined;
}

function summarizeToolOutput(value: unknown) {
  const output = asRecord(value);
  if (!output) return undefined;
  if (typeof output.path === "string" && typeof output.content === "string")
    return `Read ${output.path}`;
  if (typeof output.path === "string" && typeof output.bytesWritten === "number")
    return `Wrote ${output.path}`;
  if (Array.isArray(output.files)) return `Listed ${output.files.length} files`;
  if (typeof output.exitCode === "number") return `Exit ${output.exitCode}`;
  return undefined;
}

function sanitizePayload(payload: Record<string, unknown>, eventType: string) {
  const entries = Object.entries(payload).filter(([k]) => k !== "runId");
  if (entries.length === 0) return null;
  if (eventType === "run.progress" && entries.length === 1 && entries[0]?.[0] === "message")
    return null;
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

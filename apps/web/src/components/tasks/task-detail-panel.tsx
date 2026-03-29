import { useState } from "react";
import {
  CircleNotch,
  CheckSquare,
  File,
  Question,
  ListChecks,
  CheckCircle,
  PaperPlaneTilt,
} from "@phosphor-icons/react";
import { Card, CardContent, CardHeader, CardTitle } from "@quadratic/ui/components/card";
import { Separator } from "@quadratic/ui/components/separator";
import { Button } from "@quadratic/ui/components/button";
import { Textarea } from "@quadratic/ui/components/textarea";
import { cn } from "@/lib/utils";
import type { TaskDetail, TaskQuestion } from "@/lib/task-types";
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

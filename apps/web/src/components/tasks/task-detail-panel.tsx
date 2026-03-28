import { CircleNotch, CheckSquare, File, Question, ListChecks } from "@phosphor-icons/react";
import { Card, CardContent, CardHeader, CardTitle } from "@quadratic/ui/components/card";
import { Separator } from "@quadratic/ui/components/separator";
import type { MockTask } from "@/lib/mock-data";
import { TaskStatusBadge } from "./task-status-badge";

interface TaskDetailPanelProps {
  task: MockTask;
}

export function TaskDetailPanel({ task }: TaskDetailPanelProps) {
  const isExecuting = task.status === "executing";
  const hasEnrichedData =
    task.plan ||
    task.acceptanceCriteria?.length ||
    task.suggestedFiles?.length ||
    task.questions?.length;

  return (
    <div className="flex flex-col gap-6">
      {/* Header card */}
      <Card>
        <CardHeader className="gap-3">
          <div className="flex flex-wrap items-center gap-3">
            <TaskStatusBadge status={task.status} />
            <time className="text-xs text-muted-foreground tabular-nums">
              {task.updatedAt.toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
                year: "numeric",
              })}
            </time>
          </div>
          <CardTitle className="text-base font-semibold leading-snug text-balance">
            {task.title}
          </CardTitle>
          <p className="text-xs text-muted-foreground text-pretty">{task.description}</p>
        </CardHeader>
        <Separator />
        <CardContent className="pt-4">
          <div className="flex flex-wrap gap-x-6 gap-y-1 text-xs">
            <div className="flex gap-2">
              <span className="text-muted-foreground">Repository</span>
              <span className="font-medium text-foreground">{task.repoName}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Executing spinner */}
      {isExecuting && !hasEnrichedData && (
        <div className="flex items-center gap-3 rounded-xl border border-border/60 bg-card px-4 py-3">
          <CircleNotch className="size-4 animate-spin text-blue-400" />
          <span className="text-xs text-muted-foreground">Agent is working on this task…</span>
        </div>
      )}

      {/* Questions */}
      {task.questions && task.questions.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm">
              <Question className="size-4 text-amber-400" weight="fill" />
              Needs your input
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {task.questions.map((q) => (
              <div key={q.questionId} className="rounded-lg border border-amber-500/20 bg-amber-500/5 px-3 py-2.5">
                <p className="text-xs text-foreground">{q.body}</p>
                {q.answer && (
                  <p className="mt-1.5 text-xs text-muted-foreground">
                    <span className="font-medium text-emerald-400">Answer:</span> {q.answer}
                  </p>
                )}
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
                <li key={file} className="font-mono text-[0.7rem] text-muted-foreground">
                  {file}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {/* Drafting state */}
      {task.status === "drafting" && !hasEnrichedData && (
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

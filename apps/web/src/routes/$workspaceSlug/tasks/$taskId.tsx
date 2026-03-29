import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft } from "@phosphor-icons/react";
import { useAuth } from "@workos/authkit-tanstack-react-start/client";
import { useMutation, useQuery } from "convex/react";

import { api } from "@quadratic/backend/convex/_generated/api";
import type { Id } from "@quadratic/backend/convex/_generated/dataModel";

import { WorkspaceLayout } from "../../../components/workspace-layout";
import { TaskDetailPanel } from "../../../components/tasks/task-detail-panel";
import type { TaskDetail } from "../../../lib/task-types";
import { useJson } from "../../../components/workspace/use-json";
import { toast } from "sonner";

export const Route = createFileRoute("/$workspaceSlug/tasks/$taskId" as never)({
  component: TaskDetailPage,
  notFoundComponent: () => (
    <p className="p-6 text-sm text-muted-foreground">Task not found.</p>
  ),
});

function TaskDetailPage() {
  const { workspaceSlug, taskId } = Route.useParams();
  const { user } = useAuth();
  const workspace = useJson<{ workspace: { name: string } }>(
    `/api/platform/workspace?slug=${workspaceSlug}`,
  );
  const task = useQuery(
    api.tasks.get,
    user?.id
      ? {
          workosUserId: user.id,
          taskId: taskId as Id<"tasks">,
        }
      : "skip",
  ) as TaskDetail | null | undefined;
  const answerQuestion = useMutation(api.tasks.answerQuestion);
  const startExecution = useMutation(api.tasks.startExecution);

  async function handleAnswerQuestion(questionId: string, answer: string) {
    if (!user?.id) {
      toast.error("Your session is still loading.");
      return;
    }
    await answerQuestion({
      workosUserId: user.id,
      questionId: questionId as Id<"taskQuestions">,
      answer,
    });
    toast.success("Answer submitted.");
  }

  async function handleStartExecution() {
    if (!user?.id) {
      toast.error("Your session is still loading.");
      return;
    }

    await startExecution({
      workosUserId: user.id,
      taskId: taskId as Id<"tasks">,
    });
    toast.success("Task execution started.");
  }

  if (task === null) {
    return <p className="p-6 text-sm text-muted-foreground">Task not found.</p>;
  }

  return (
    <WorkspaceLayout
      workspaceSlug={workspaceSlug}
      workspaceName={workspace.data?.workspace.name}
      breadcrumbs={[
        { label: workspaceSlug },
        { label: "Tasks", href: `/${workspaceSlug}/tasks` },
        { label: task?.title ?? "Task" },
      ]}
    >
      {/* Back link */}
      <div>
        <Link
          to={`/${workspaceSlug}/tasks` as never}
          className="inline-flex items-center gap-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="size-3" />
          Back to tasks
        </Link>
      </div>

      {/* Detail panel */}
      <div className="mx-auto w-full max-w-2xl">
        {task ? (
          <TaskDetailPanel
            task={task}
            onAnswerQuestion={handleAnswerQuestion}
            onStartExecution={handleStartExecution}
          />
        ) : (
          <div className="flex items-center gap-3 rounded-xl border border-border/60 bg-card px-4 py-3">
            <span className="text-xs text-muted-foreground">Loading task…</span>
          </div>
        )}
      </div>
    </WorkspaceLayout>
  );
}

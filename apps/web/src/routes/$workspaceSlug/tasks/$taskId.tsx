import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft } from "@phosphor-icons/react";
import { useAuth } from "@workos/authkit-tanstack-react-start/client";
import { useMutation, useQuery } from "convex/react";
import { toast } from "sonner";

import { api } from "@quadratic/backend/convex/_generated/api";
import type { Id } from "@quadratic/backend/convex/_generated/dataModel";

import { WorkspaceLayout } from "../../../components/workspace-layout";
import { TaskDetailPanel } from "../../../components/tasks/task-detail-panel";
import { Skeleton } from "@quadratic/ui/components/skeleton";
import type { TaskDetail } from "../../../lib/task-types";
import { useJson } from "../../../components/workspace/use-json";

export const Route = createFileRoute("/$workspaceSlug/tasks/$taskId" as never)({
  component: TaskDetailPage,
  notFoundComponent: () => <p className="p-6 text-sm text-muted-foreground">Task not found.</p>,
});

function TaskDetailPage() {
  const { workspaceSlug, taskId } = Route.useParams();
  const { user } = useAuth();

  const workspace = useJson<{ workspace: { name: string } }>(
    `/api/platform/workspace?slug=${workspaceSlug}`,
  );

  const task = useQuery(
    api.tasks.get,
    user?.id ? { workosUserId: user.id, taskId: taskId as Id<"tasks"> } : "skip",
  ) as TaskDetail | null | undefined;

  const answerQuestion = useMutation(api.tasks.answerQuestion);
  const startExecution = useMutation(api.tasks.startExecution);
  const addDiscussion = useMutation(api.tasks.addDiscussionMessage);

  async function handleAnswerQuestion(questionId: string, answer: string) {
    if (!user?.id) {
      toast.error("Session loading.");
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
      toast.error("Session loading.");
      return;
    }
    await startExecution({ workosUserId: user.id, taskId: taskId as Id<"tasks"> });
    toast.success("Task execution started.");
  }

  async function handleAddDiscussion(body: string, triggerRereview: boolean) {
    if (!user?.id) {
      toast.error("Session loading.");
      return;
    }
    await addDiscussion({
      workosUserId: user.id,
      taskId: taskId as Id<"tasks">,
      body,
      triggerRereview,
    });
  }

  if (task === null) {
    return (
      <WorkspaceLayout workspaceSlug={workspaceSlug} error={workspace.error}>
        <p className="text-sm text-muted-foreground">Task not found.</p>
      </WorkspaceLayout>
    );
  }

  return (
    <WorkspaceLayout
      workspaceSlug={workspaceSlug}
      workspaceName={workspace.data?.workspace.name}
      error={workspace.error}
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

      {/* Detail panel or skeleton */}
      {task ? (
        <TaskDetailPanel
          task={task}
          onAnswerQuestion={handleAnswerQuestion}
          onStartExecution={handleStartExecution}
          onAddDiscussion={handleAddDiscussion}
        />
      ) : (
        <TaskDetailSkeleton />
      )}
    </WorkspaceLayout>
  );
}

function TaskDetailSkeleton() {
  return (
    <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
      <div className="min-w-0 flex-1 flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <div className="flex gap-2">
            <Skeleton className="h-5 w-16 rounded-full" />
            <Skeleton className="h-5 w-12 rounded-full" />
          </div>
          <Skeleton className="h-6 w-3/4 rounded-md" />
          <Skeleton className="h-4 w-full rounded-md" />
          <Skeleton className="h-4 w-2/3 rounded-md" />
        </div>
        <Skeleton className="h-24 w-full rounded-xl" />
        <Skeleton className="h-32 w-full rounded-xl" />
      </div>
      <aside className="w-full shrink-0 lg:w-60 xl:w-72">
        <Skeleton className="h-48 w-full rounded-xl" />
      </aside>
    </div>
  );
}

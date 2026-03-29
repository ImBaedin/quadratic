import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useAuth } from "@workos/authkit-tanstack-react-start/client";
import { useMutation, useQuery } from "convex/react";
import { toast } from "sonner";

import { api } from "@quadratic/backend/convex/_generated/api";
import type { Id } from "@quadratic/backend/convex/_generated/dataModel";

import { WorkspaceLayout } from "../../../components/workspace-layout";
import { TaskList } from "../../../components/tasks/task-list";
import {
  TaskCreationDialog,
  NewTaskButton,
} from "../../../components/tasks/task-creation-dialog";
import type { TaskListItem, TaskRepositoryOption } from "../../../lib/task-types";
import { useJson } from "../../../components/workspace/use-json";

export const Route = createFileRoute("/$workspaceSlug/tasks/" as never)({
  component: TasksPage,
});

function TasksPage() {
  const { workspaceSlug } = Route.useParams();
  const { user } = useAuth();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const workspace = useJson<{
    workspace: { workspaceId: string; name: string };
    repositories: TaskRepositoryOption[];
  }>(`/api/platform/workspace?slug=${workspaceSlug}`);
  const tasks = useQuery(
    api.tasks.listForWorkspace,
    user?.id && workspace.data?.workspace.workspaceId
      ? {
          workosUserId: user.id,
          workspaceId: workspace.data.workspace.workspaceId as Id<"workspaces">,
        }
      : "skip",
  ) as TaskListItem[] | undefined;
  const createTask = useMutation(api.tasks.create);
  const requestPlanning = useMutation(api.tasks.requestPlanning);

  async function handleNewTask(task: {
    repositoryId: string;
    branch: string;
    prompt: string;
  }) {
    if (!user?.id || !workspace.data?.workspace.workspaceId) {
      toast.error("Your session is still loading.");
      return;
    }

    try {
      setSubmitting(true);
      const taskId = await createTask({
        workosUserId: user.id,
        workspaceId: workspace.data.workspace.workspaceId as Id<"workspaces">,
        repositoryId: task.repositoryId as Id<"repositories">,
        branch: task.branch,
        prompt: task.prompt,
      });
      await requestPlanning({
        workosUserId: user.id,
        taskId,
      });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to create task.");
      throw error;
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <WorkspaceLayout
      workspaceSlug={workspaceSlug}
      workspaceName={workspace.data?.workspace.name}
      breadcrumbs={[
        { label: workspaceSlug },
        { label: "Tasks" },
      ]}
    >
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-heading text-lg font-semibold text-balance">Tasks</h1>
          <p className="mt-0.5 text-xs text-muted-foreground text-pretty">
            {(tasks ?? []).length} {(tasks ?? []).length === 1 ? "task" : "tasks"}
          </p>
        </div>
        <NewTaskButton onClick={() => setDialogOpen(true)} />
      </div>

      {/* Task list */}
      <TaskList
        tasks={tasks ?? []}
        workspaceSlug={workspaceSlug}
        onNewTask={() => setDialogOpen(true)}
      />

      {/* Creation dialog / drawer */}
      <TaskCreationDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        repos={workspace.data?.repositories ?? []}
        onSubmit={handleNewTask}
        submitting={submitting}
      />
    </WorkspaceLayout>
  );
}

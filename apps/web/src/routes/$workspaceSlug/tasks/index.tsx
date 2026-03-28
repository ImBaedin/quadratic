import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";

import { WorkspaceLayout } from "../../../components/workspace-layout";
import { TaskList } from "../../../components/tasks/task-list";
import {
  TaskCreationDialog,
  NewTaskButton,
} from "../../../components/tasks/task-creation-dialog";
import { MOCK_TASKS, MOCK_REPOS, type MockTask } from "../../../lib/mock-data";

export const Route = createFileRoute("/$workspaceSlug/tasks/" as never)({
  component: TasksPage,
});

function TasksPage() {
  const { workspaceSlug } = Route.useParams();
  const [tasks, setTasks] = useState<MockTask[]>(MOCK_TASKS);
  const [dialogOpen, setDialogOpen] = useState(false);

  function handleNewTask(task: MockTask) {
    setTasks((prev) => [task, ...prev]);
  }

  return (
    <WorkspaceLayout
      workspaceSlug={workspaceSlug}
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
            {tasks.length} {tasks.length === 1 ? "task" : "tasks"}
          </p>
        </div>
        <NewTaskButton onClick={() => setDialogOpen(true)} />
      </div>

      {/* Task list */}
      <TaskList
        tasks={tasks}
        workspaceSlug={workspaceSlug}
        onNewTask={() => setDialogOpen(true)}
      />

      {/* Creation dialog / drawer */}
      <TaskCreationDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        repos={MOCK_REPOS}
        onSubmit={handleNewTask}
      />
    </WorkspaceLayout>
  );
}

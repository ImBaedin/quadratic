import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { ArrowLeft } from "@phosphor-icons/react";

import { WorkspaceLayout } from "../../../components/workspace-layout";
import { TaskDetailPanel } from "../../../components/tasks/task-detail-panel";
import { MOCK_TASKS } from "../../../lib/mock-data";

export const Route = createFileRoute("/$workspaceSlug/tasks/$taskId" as never)({
  loader: ({ params }) => {
    const task = MOCK_TASKS.find((t) => t.taskId === params.taskId);
    if (!task) throw notFound();
    return { task };
  },
  component: TaskDetailPage,
  notFoundComponent: () => (
    <p className="p-6 text-sm text-muted-foreground">Task not found.</p>
  ),
});

function TaskDetailPage() {
  const { workspaceSlug } = Route.useParams();
  const { task } = Route.useLoaderData();

  return (
    <WorkspaceLayout
      workspaceSlug={workspaceSlug}
      breadcrumbs={[
        { label: workspaceSlug },
        { label: "Tasks", href: `/${workspaceSlug}/tasks` },
        { label: task.title },
      ]}
    >
      {/* Back link */}
      <div>
        <Link
          to={`/${workspaceSlug}/tasks`}
          className="inline-flex items-center gap-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="size-3" />
          Back to tasks
        </Link>
      </div>

      {/* Detail panel */}
      <div className="mx-auto w-full max-w-2xl">
        <TaskDetailPanel task={task} />
      </div>
    </WorkspaceLayout>
  );
}

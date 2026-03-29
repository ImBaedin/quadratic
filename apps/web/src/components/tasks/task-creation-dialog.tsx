import { useState } from "react";
import { Plus } from "@phosphor-icons/react";

import { useIsMobile } from "@quadratic/ui/hooks/use-mobile";
import { Button } from "@quadratic/ui/components/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@quadratic/ui/components/dialog";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerFooter,
} from "@quadratic/ui/components/drawer";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@quadratic/ui/components/select";
import { Textarea } from "@quadratic/ui/components/textarea";
import type { TaskRepositoryOption } from "@/lib/task-types";

interface TaskCreationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  repos: TaskRepositoryOption[];
  onSubmit: (task: {
    repositoryId: string;
    branch: string;
    prompt: string;
  }) => Promise<void> | void;
  submitting?: boolean;
}

interface FormProps {
  repos: TaskRepositoryOption[];
  onSubmit: (task: {
    repositoryId: string;
    branch: string;
    prompt: string;
  }) => Promise<void> | void;
  onCancel: () => void;
  submitting: boolean;
}

function TaskCreationForm({ repos, onSubmit, onCancel, submitting }: FormProps) {
  const [repoId, setRepoId] = useState(repos[0]?.repositoryId ?? "");
  const [description, setDescription] = useState("");
  const selectedRepoId = repoId || repos[0]?.repositoryId || "";
  const selectedRepo = repos.find((repo) => repo.repositoryId === selectedRepoId) ?? repos[0];

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!description.trim() || !selectedRepo) return;

    await onSubmit({
      repositoryId: selectedRepo.repositoryId,
      branch: selectedRepo.defaultBranch,
      prompt: description.trim(),
    });
    setDescription("");
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <label className="text-xs font-medium text-foreground">Repository</label>
        <Select value={selectedRepoId} onValueChange={(value) => setRepoId(value ?? "")}>
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Select a repository" />
          </SelectTrigger>
          <SelectContent>
            {repos.map((repo) => (
              <SelectItem key={repo.repositoryId} value={repo.repositoryId}>
                {repo.fullName}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-xs font-medium text-foreground">
          Task description
        </label>
        <Textarea
          required
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          disabled={submitting}
          placeholder="Describe what you want the agent to do..."
          rows={5}
          className="resize-none"
        />
      </div>

      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" size="sm" onClick={onCancel} disabled={submitting}>
          Cancel
        </Button>
        <Button type="submit" size="sm" disabled={!description.trim() || !selectedRepo || submitting}>
          {submitting ? "Creating..." : "Create task"}
        </Button>
      </div>
    </form>
  );
}

export function TaskCreationDialog({
  open,
  onOpenChange,
  repos,
  onSubmit,
  submitting = false,
}: TaskCreationDialogProps) {
  const isMobile = useIsMobile();

  async function handleSubmit(task: {
    repositoryId: string;
    branch: string;
    prompt: string;
  }) {
    await onSubmit(task);
    onOpenChange(false);
  }

  if (isMobile) {
    return (
      <Drawer open={open} onOpenChange={onOpenChange}>
        <DrawerContent>
          <DrawerHeader>
            <DrawerTitle>New task</DrawerTitle>
          </DrawerHeader>
          <div className="px-4 pb-2">
            <TaskCreationForm
              repos={repos}
              onSubmit={handleSubmit}
              onCancel={() => onOpenChange(false)}
              submitting={submitting}
            />
          </div>
          <DrawerFooter />
        </DrawerContent>
      </Drawer>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent showCloseButton={false}>
        <DialogHeader>
          <DialogTitle>New task</DialogTitle>
        </DialogHeader>
        <TaskCreationForm
          repos={repos}
          onSubmit={handleSubmit}
          onCancel={() => onOpenChange(false)}
          submitting={submitting}
        />
        <DialogFooter />
      </DialogContent>
    </Dialog>
  );
}

export function NewTaskButton({
  onClick,
}: {
  onClick: () => void;
}) {
  return (
    <Button size="sm" onClick={onClick}>
      <Plus className="size-3.5" />
      New task
    </Button>
  );
}

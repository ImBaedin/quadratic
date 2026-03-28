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
  DialogClose,
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
import type { MockRepo, MockTask, TaskStatus } from "@/lib/mock-data";

interface TaskCreationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  repos: MockRepo[];
  onSubmit: (task: MockTask) => void;
}

function generateId() {
  return `task-${Math.random().toString(36).slice(2, 9)}`;
}

function slugify(text: string) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, "")
    .trim()
    .replace(/\s+/g, " ")
    .split(" ")
    .slice(0, 8)
    .join(" ");
}

interface FormProps {
  repos: MockRepo[];
  onSubmit: (task: MockTask) => void;
  onCancel: () => void;
}

function TaskCreationForm({ repos, onSubmit, onCancel }: FormProps) {
  const [repoId, setRepoId] = useState(repos[0]?.repoId ?? "");
  const [description, setDescription] = useState("");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!description.trim()) return;

    const repo = repos.find((r) => r.repoId === repoId) ?? repos[0];
    const title = slugify(description) || "New task";
    const titleFormatted =
      title.charAt(0).toUpperCase() + title.slice(1);

    const newTask: MockTask = {
      taskId: generateId(),
      title: titleFormatted,
      description: description.trim(),
      status: "drafting" as TaskStatus,
      repoId: repo.repoId,
      repoName: repo.fullName,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    onSubmit(newTask);
    setDescription("");
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <label className="text-xs font-medium text-foreground">Repository</label>
        <Select value={repoId} onValueChange={setRepoId}>
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Select a repository" />
          </SelectTrigger>
          <SelectContent>
            {repos.map((repo) => (
              <SelectItem key={repo.repoId} value={repo.repoId}>
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
          placeholder="Describe what you want the agent to do..."
          rows={5}
          className="resize-none"
        />
      </div>

      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" size="sm" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" size="sm" disabled={!description.trim()}>
          Create task
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
}: TaskCreationDialogProps) {
  const isMobile = useIsMobile();

  function handleSubmit(task: MockTask) {
    onSubmit(task);
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

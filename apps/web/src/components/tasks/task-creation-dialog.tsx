import { useState } from "react";
import { Plus, X } from "@phosphor-icons/react";

import { useIsMobile } from "@quadratic/ui/hooks/use-mobile";
import { Button } from "@quadratic/ui/components/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@quadratic/ui/components/dialog";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from "@quadratic/ui/components/drawer";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@quadratic/ui/components/select";
import { Textarea } from "@quadratic/ui/components/textarea";
import { cn } from "@/lib/utils";
import type { TaskKind, TaskRepositoryOption } from "@/lib/task-types";
import { TASK_KIND_CONFIG } from "./task-kind-icon";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface NewTaskPayload {
  repositoryId: string;
  branch: string;
  prompt: string;
  title?: string;
  taskKind: TaskKind;
}

interface TaskCreationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  repos: TaskRepositoryOption[];
  onSubmit: (task: NewTaskPayload) => Promise<void> | void;
  submitting?: boolean;
}

interface FormProps {
  repos: TaskRepositoryOption[];
  onSubmit: (task: NewTaskPayload) => Promise<void> | void;
  onCancel: () => void;
  submitting: boolean;
}

// ─── Kind picker ──────────────────────────────────────────────────────────────

const ORDERED_KINDS: TaskKind[] = ["general", "feature", "bug", "research", "chore", "breakdown"];

function KindPicker({ value, onChange }: { value: TaskKind; onChange: (kind: TaskKind) => void }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {ORDERED_KINDS.map((kind) => {
        const config = TASK_KIND_CONFIG[kind];
        const { Icon } = config;
        const isSelected = value === kind;
        return (
          <button
            key={kind}
            type="button"
            onClick={() => onChange(kind)}
            className={cn(
              "inline-flex h-7 items-center gap-1.5 rounded-md border px-2.5 text-[0.7rem] font-medium transition-colors",
              isSelected
                ? "border-border bg-muted/60 text-foreground"
                : "border-transparent text-muted-foreground hover:border-border/60 hover:bg-muted/30 hover:text-foreground",
            )}
          >
            <Icon
              className={cn(
                "size-3.5 shrink-0",
                isSelected ? config.iconClass : "text-muted-foreground/60",
              )}
              weight="fill"
            />
            {config.label}
          </button>
        );
      })}
    </div>
  );
}

// ─── Form ─────────────────────────────────────────────────────────────────────

function TaskCreationForm({ repos, onSubmit, onCancel, submitting }: FormProps) {
  const [repoId, setRepoId] = useState(repos[0]?.repositoryId ?? "");
  const [taskKind, setTaskKind] = useState<TaskKind>("general");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");

  const selectedRepoId = repoId || repos[0]?.repositoryId || "";
  const selectedRepo = repos.find((r) => r.repositoryId === selectedRepoId) ?? repos[0];

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!description.trim() || !selectedRepo) return;

    await onSubmit({
      repositoryId: selectedRepo.repositoryId,
      branch: selectedRepo.defaultBranch,
      prompt: description.trim(),
      title: title.trim() || undefined,
      taskKind,
    });

    setTitle("");
    setDescription("");
    setTaskKind("general");
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      {/* Kind picker */}
      <div className="flex flex-col gap-2">
        <label className="text-xs font-medium text-muted-foreground">Type</label>
        <KindPicker value={taskKind} onChange={setTaskKind} />
      </div>

      {/* Title (optional) */}
      <div className="flex flex-col gap-1.5">
        <label className="text-xs font-medium text-muted-foreground">
          Title
          <span className="ml-1 text-muted-foreground/50">(optional)</span>
        </label>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          disabled={submitting}
          placeholder="Short title for this task…"
          className="h-8 w-full rounded-md border border-input bg-input/20 px-3 text-xs text-foreground placeholder:text-muted-foreground/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
        />
      </div>

      {/* Description / prompt */}
      <div className="flex flex-col gap-1.5">
        <label className="text-xs font-medium text-muted-foreground">Description</label>
        <Textarea
          required
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          disabled={submitting}
          placeholder="Describe what needs to be done in detail…"
          rows={5}
          className="resize-none text-xs"
        />
      </div>

      {/* Repository */}
      {repos.length > 1 && (
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-muted-foreground">Repository</label>
          <Select value={selectedRepoId} onValueChange={(v) => setRepoId(v ?? "")}>
            <SelectTrigger className="w-full text-xs">
              <SelectValue placeholder="Select a repository" />
            </SelectTrigger>
            <SelectContent>
              {repos.map((repo) => (
                <SelectItem key={repo.repositoryId} value={repo.repositoryId} className="text-xs">
                  {repo.fullName}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {/* Actions */}
      <div className="flex justify-end gap-2 pt-1">
        <Button type="button" variant="ghost" size="sm" onClick={onCancel} disabled={submitting}>
          Cancel
        </Button>
        <Button
          type="submit"
          size="sm"
          disabled={!description.trim() || !selectedRepo || submitting}
        >
          {submitting ? "Creating…" : "Create task"}
        </Button>
      </div>
    </form>
  );
}

// ─── Dialog / Drawer shell ────────────────────────────────────────────────────

export function TaskCreationDialog({
  open,
  onOpenChange,
  repos,
  onSubmit,
  submitting = false,
}: TaskCreationDialogProps) {
  const isMobile = useIsMobile();

  async function handleSubmit(task: NewTaskPayload) {
    await onSubmit(task);
    onOpenChange(false);
  }

  if (isMobile) {
    return (
      <Drawer open={open} onOpenChange={onOpenChange}>
        <DrawerContent>
          <DrawerHeader className="pb-2">
            <DrawerTitle>New task</DrawerTitle>
          </DrawerHeader>
          <div className="px-4 pb-6">
            <TaskCreationForm
              repos={repos}
              onSubmit={handleSubmit}
              onCancel={() => onOpenChange(false)}
              submitting={submitting}
            />
          </div>
        </DrawerContent>
      </Drawer>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg" showCloseButton={false}>
        <DialogHeader className="flex-row items-center justify-between space-y-0 pb-1">
          <DialogTitle>New task</DialogTitle>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            aria-label="Close dialog"
          >
            <X className="size-4" />
          </button>
        </DialogHeader>
        <TaskCreationForm
          repos={repos}
          onSubmit={handleSubmit}
          onCancel={() => onOpenChange(false)}
          submitting={submitting}
        />
      </DialogContent>
    </Dialog>
  );
}

export function NewTaskButton({ onClick }: { onClick: () => void }) {
  return (
    <Button size="sm" onClick={onClick}>
      <Plus className="size-3.5" />
      New task
    </Button>
  );
}

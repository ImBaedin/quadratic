import {
  Bug,
  Sparkle,
  MagnifyingGlass,
  Wrench,
  SquaresFour,
  TreeStructure,
} from "@phosphor-icons/react";

import { cn } from "@/lib/utils";
import type { TaskKind } from "@/lib/task-types";

export interface TaskKindConfig {
  label: string;
  Icon: React.ComponentType<{
    className?: string;
    weight?: "fill" | "regular" | "bold" | "light" | "thin" | "duotone";
  }>;
  iconClass: string;
}

export const TASK_KIND_CONFIG: Record<TaskKind, TaskKindConfig> = {
  general: {
    label: "General",
    Icon: SquaresFour,
    iconClass: "text-zinc-400",
  },
  bug: {
    label: "Bug",
    Icon: Bug,
    iconClass: "text-red-400",
  },
  feature: {
    label: "Feature",
    Icon: Sparkle,
    iconClass: "text-blue-400",
  },
  research: {
    label: "Research",
    Icon: MagnifyingGlass,
    iconClass: "text-violet-400",
  },
  chore: {
    label: "Chore",
    Icon: Wrench,
    iconClass: "text-amber-400",
  },
  breakdown: {
    label: "Breakdown",
    Icon: TreeStructure,
    iconClass: "text-teal-400",
  },
};

interface TaskKindIconProps {
  kind: TaskKind;
  className?: string;
  showLabel?: boolean;
}

export function TaskKindIcon({ kind, className, showLabel = false }: TaskKindIconProps) {
  const config = TASK_KIND_CONFIG[kind];
  const { Icon } = config;

  return (
    <span className={cn("inline-flex shrink-0 items-center gap-1", config.iconClass, className)}>
      <Icon className="size-3.5 shrink-0" weight="fill" />
      {showLabel && <span className="text-[0.7rem] font-medium leading-none">{config.label}</span>}
    </span>
  );
}

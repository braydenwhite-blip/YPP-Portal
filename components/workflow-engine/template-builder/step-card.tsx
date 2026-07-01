"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

import { StatusBadge } from "@/components/ui-v2/status-badge";
import { cn } from "@/components/ui-v2/cn";
import { STEP_KIND_LABELS } from "@/lib/workflow-engine/constants";
import type { StepDefinition } from "@/lib/workflow-engine/types";

export function StepCard({
  step,
  stageId,
  selected,
  readOnly,
  onClick,
}: {
  step: StepDefinition;
  stageId: string;
  selected?: boolean;
  readOnly?: boolean;
  onClick?: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: step.id,
    data: { type: "step", stageId },
    disabled: readOnly,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...(readOnly ? {} : attributes)}
      {...(readOnly ? {} : listeners)}
      onClick={onClick}
      className={cn(
        "flex flex-col gap-1 rounded-lg border border-line-soft bg-surface px-2.5 py-2 text-left",
        !readOnly && "cursor-pointer hover:border-brand-300 hover:bg-brand-50/40",
        selected && "ring-2 ring-brand-400",
        isDragging && "opacity-50"
      )}
    >
      <div className="flex items-center justify-between gap-1.5">
        <span className="text-[13px] font-medium text-ink">{step.name}</span>
        {step.isRequired ? (
          <StatusBadge tone="brand">required</StatusBadge>
        ) : (
          <span className="shrink-0 text-[10px] text-ink-muted">optional</span>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-ink-muted">
        <span className="rounded bg-surface-soft px-1.5 py-0.5">
          {STEP_KIND_LABELS[step.kind] ?? step.kind}
        </span>
        {step.assigneeMode ? <span>→ {step.assigneeMode.toLowerCase()}</span> : null}
        {step.dueOffsetHours ? <span>due +{step.dueOffsetHours}h</span> : null}
      </div>
    </div>
  );
}

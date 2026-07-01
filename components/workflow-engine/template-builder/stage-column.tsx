"use client";

import { useState } from "react";

import { SortableContext, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { useDroppable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";

import { Button } from "@/components/ui-v2/button";
import { CardV2 } from "@/components/ui-v2/card";
import { StatusBadge } from "@/components/ui-v2/status-badge";
import { cn } from "@/components/ui-v2/cn";
import type { AutomationRuleDefinition, StageDefinition } from "@/lib/workflow-engine/types";
import { addStep, deleteStage, updateStage } from "@/lib/workflow-engine/template-actions";
import { useAutosave } from "./use-autosave";
import { StepCard } from "./step-card";

export function StageColumn({
  stage,
  index,
  total,
  rules,
  pending,
  run,
  readOnly,
  selectedStepId,
  onSelectStep,
  onMove,
}: {
  stage: StageDefinition;
  index: number;
  total: number;
  rules: AutomationRuleDefinition[];
  pending: boolean;
  run: (fn: () => Promise<unknown>) => void;
  readOnly?: boolean;
  selectedStepId: string | null;
  onSelectStep: (stepId: string) => void;
  onMove: (dir: "up" | "down") => void;
}) {
  const steps = [...stage.steps].sort((a, b) => a.order - b.order);
  const stepIds = steps.map((s) => s.id);

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: stage.id,
    data: { type: "stage" },
    disabled: readOnly,
  });
  const { setNodeRef: setDropRef, isOver } = useDroppable({
    id: `droppable-stage-${stage.id}`,
    data: { type: "stage-drop", stageId: stage.id },
  });

  const nameField = useAutosave(
    stage.name,
    async (name) => {
      if (name.trim()) await updateStage({ id: stage.id, name: name.trim() });
    },
    600
  );

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn("flex w-[280px] shrink-0 flex-col gap-3", isDragging && "opacity-50")}
    >
      <CardV2 padding="md" className="flex flex-col gap-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2">
            <button
              type="button"
              {...(readOnly ? {} : attributes)}
              {...(readOnly ? {} : listeners)}
              className={cn(
                "inline-flex h-6 w-6 items-center justify-center rounded-full bg-brand-600 text-[11px] font-bold text-white",
                !readOnly && "cursor-grab active:cursor-grabbing"
              )}
              aria-label="Drag to reorder stage"
            >
              {index + 1}
            </button>
            {readOnly ? (
              <span className="text-[14px] font-semibold text-ink">{stage.name}</span>
            ) : (
              <input
                className="w-32 rounded border border-transparent bg-transparent text-[14px] font-semibold text-ink hover:border-line-soft focus:border-brand-400 focus:outline-none"
                value={nameField.value}
                onChange={(e) => nameField.setValue(e.target.value)}
                onBlur={nameField.flush}
              />
            )}
          </div>
          {!readOnly ? (
            <div className="flex items-center gap-0.5">
              <IconButton label="↑" disabled={index === 0 || pending} onClick={() => onMove("up")} />
              <IconButton
                label="↓"
                disabled={index === total - 1 || pending}
                onClick={() => onMove("down")}
              />
              <IconButton
                label="✕"
                disabled={pending}
                onClick={() => {
                  if (confirm(`Delete stage "${stage.name}" and its steps?`))
                    run(() => deleteStage({ id: stage.id }));
                }}
              />
            </div>
          ) : null}
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          {stage.isInitial ? <StatusBadge tone="info">start</StatusBadge> : null}
          {stage.isTerminal ? <StatusBadge tone="success">final</StatusBadge> : null}
          {stage.slaHours ? (
            <span className="text-[11px] text-ink-muted">SLA {stage.slaHours}h</span>
          ) : null}
          {rules.length > 0 ? (
            <span className="text-[11px] text-ink-muted">{rules.length} automation{rules.length === 1 ? "" : "s"}</span>
          ) : null}
        </div>

        <div
          ref={setDropRef}
          className={cn(
            "flex min-h-[60px] flex-col gap-2 rounded-lg p-1",
            isOver && "bg-brand-50 ring-1 ring-brand-300"
          )}
        >
          <SortableContext items={stepIds} strategy={verticalListSortingStrategy}>
            {steps.map((step) => (
              <StepCard
                key={step.id}
                step={step}
                stageId={stage.id}
                readOnly={readOnly}
                selected={selectedStepId === step.id}
                onClick={readOnly ? undefined : () => onSelectStep(step.id)}
              />
            ))}
          </SortableContext>
          {steps.length === 0 ? (
            <p className="px-1 py-2 text-center text-[12px] text-ink-muted">No steps yet.</p>
          ) : null}
        </div>

        {!readOnly ? (
          <Button
            size="sm"
            variant="ghost"
            loading={pending}
            onClick={() =>
              run(() => addStep({ stageId: stage.id, name: "New step", kind: "TASK" }))
            }
          >
            + Add step
          </Button>
        ) : null}
      </CardV2>
    </div>
  );
}

function IconButton({
  label,
  disabled,
  onClick,
}: {
  label: string;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className="inline-flex h-6 w-6 items-center justify-center rounded-lg border border-line-soft text-[12px] text-ink-muted disabled:opacity-40 hover:bg-brand-50"
    >
      {label}
    </button>
  );
}

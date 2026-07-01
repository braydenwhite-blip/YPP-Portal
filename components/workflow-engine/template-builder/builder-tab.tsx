"use client";

import { useState } from "react";

import {
  DndContext,
  DragOverlay,
  closestCorners,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { SortableContext, arrayMove, horizontalListSortingStrategy } from "@dnd-kit/sortable";

import { Button } from "@/components/ui-v2/button";
import { CardV2 } from "@/components/ui-v2/card";
import { ModalV2 } from "@/components/ui-v2/modal";
import { STEP_KINDS, STEP_KIND_LABELS, workflowDomainLabel } from "@/lib/workflow-engine/constants";
import type { WorkflowTemplateDefinition } from "@/lib/workflow-engine/types";
import { WORKFLOW_BLUEPRINTS } from "@/lib/workflow-engine/blueprints";
import {
  addStage,
  addStep,
  installBlueprint,
  moveStep,
  reorderStages,
  reorderSteps,
} from "@/lib/workflow-engine/template-actions";
import { StageColumn } from "./stage-column";
import { StepCard } from "./step-card";
import { StepDetailsPanel } from "./step-details-panel";

export function BuilderTab({
  template,
  pending,
  run,
  readOnly,
}: {
  template: WorkflowTemplateDefinition;
  pending: boolean;
  run: (fn: () => Promise<unknown>) => void;
  readOnly?: boolean;
}) {
  const [zoom, setZoom] = useState(1);
  const [selectedStepId, setSelectedStepId] = useState<string | null>(null);
  const [installPickerOpen, setInstallPickerOpen] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [activeType, setActiveType] = useState<"stage" | "step" | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  );

  const stages = [...template.stages].sort((a, b) => a.order - b.order);
  const stageIds = stages.map((s) => s.id);
  const allSteps = stages.flatMap((s) => s.steps.map((st) => ({ ...st, stageId: s.id })));
  const selectedStep = selectedStepId ? allSteps.find((s) => s.id === selectedStepId) : null;
  const selectedStage = selectedStep ? stages.find((s) => s.id === selectedStep.stageId) : null;

  function onDragStart(event: DragStartEvent) {
    const type = event.active.data.current?.type as "stage" | "step" | undefined;
    setActiveId(String(event.active.id));
    setActiveType(type ?? null);
  }

  function onDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    setActiveId(null);
    setActiveType(null);
    if (!over) return;

    const type = active.data.current?.type as "stage" | "step" | undefined;

    if (type === "stage") {
      if (active.id === over.id) return;
      const oldIndex = stageIds.indexOf(String(active.id));
      const newIndex = stageIds.indexOf(String(over.id));
      if (oldIndex === -1 || newIndex === -1) return;
      const newOrder = arrayMove(stageIds, oldIndex, newIndex);
      run(() => reorderStages({ templateId: template.id, orderedStageIds: newOrder }));
      return;
    }

    if (type === "step") {
      const sourceStageId = active.data.current?.stageId as string | undefined;
      const overData = over.data.current as { type?: string; stageId?: string } | undefined;
      const targetStageId =
        overData?.type === "step" ? overData.stageId : overData?.type === "stage-drop" ? overData.stageId : undefined;
      if (!sourceStageId || !targetStageId) return;

      if (sourceStageId === targetStageId) {
        const stage = stages.find((s) => s.id === sourceStageId);
        if (!stage) return;
        const ids = [...stage.steps].sort((a, b) => a.order - b.order).map((s) => s.id);
        const oldIndex = ids.indexOf(String(active.id));
        const newIndex = ids.indexOf(String(over.id));
        if (oldIndex === -1 || newIndex === -1 || oldIndex === newIndex) return;
        const newOrder = arrayMove(ids, oldIndex, newIndex);
        run(() => reorderSteps({ stageId: sourceStageId, orderedStepIds: newOrder }));
        return;
      }

      // Cross-stage move: append to target stage, then reorder if dropped on a
      // specific card rather than the stage container itself.
      run(async () => {
        await moveStep({ id: String(active.id), toStageId: targetStageId });
        if (overData?.type === "step") {
          const targetStage = stages.find((s) => s.id === targetStageId);
          if (targetStage) {
            const ids = [...targetStage.steps].sort((a, b) => a.order - b.order).map((s) => s.id);
            const withoutMoved = ids.filter((id) => id !== String(active.id));
            const overIndex = withoutMoved.indexOf(String(over.id));
            const insertAt = overIndex === -1 ? withoutMoved.length : overIndex;
            withoutMoved.splice(insertAt, 0, String(active.id));
            await reorderSteps({ stageId: targetStageId, orderedStepIds: withoutMoved });
          }
        }
      });
    }
  }

  const activeStep = activeType === "step" ? allSteps.find((s) => s.id === activeId) : null;
  const activeStage = activeType === "stage" ? stages.find((s) => s.id === activeId) : null;

  const canvas = (
    <div className="flex flex-1 flex-col gap-3 overflow-hidden">
      {!readOnly ? (
        <div className="flex items-center gap-2 self-end">
          <button
            type="button"
            className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-line-soft text-[13px]"
            onClick={() => setZoom((z) => Math.max(0.5, +(z - 0.1).toFixed(2)))}
          >
            −
          </button>
          <button
            type="button"
            className="text-[12px] text-ink-muted"
            onClick={() => setZoom(1)}
          >
            {Math.round(zoom * 100)}%
          </button>
          <button
            type="button"
            className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-line-soft text-[13px]"
            onClick={() => setZoom((z) => Math.min(1.5, +(z + 0.1).toFixed(2)))}
          >
            +
          </button>
        </div>
      ) : null}
      <div className="overflow-x-auto pb-4">
        <div
          className="flex w-fit items-start gap-4"
          style={{ transform: `scale(${zoom})`, transformOrigin: "top left" }}
        >
          {readOnly ? (
            stages.map((stage, idx) => (
              <StageColumn
                key={stage.id}
                stage={stage}
                index={idx}
                total={stages.length}
                rules={template.automationRules.filter((r) => r.stageKey === stage.key)}
                pending={pending}
                run={run}
                readOnly
                selectedStepId={null}
                onSelectStep={() => {}}
                onMove={() => {}}
              />
            ))
          ) : (
            <SortableContext items={stageIds} strategy={horizontalListSortingStrategy}>
              {stages.map((stage, idx) => (
                <StageColumn
                  key={stage.id}
                  stage={stage}
                  index={idx}
                  total={stages.length}
                  rules={template.automationRules.filter((r) => r.stageKey === stage.key)}
                  pending={pending}
                  run={run}
                  selectedStepId={selectedStepId}
                  onSelectStep={setSelectedStepId}
                  onMove={(dir) => {
                    const j = dir === "up" ? idx - 1 : idx + 1;
                    if (j < 0 || j >= stageIds.length) return;
                    const ids = [...stageIds];
                    [ids[idx], ids[j]] = [ids[j], ids[idx]];
                    run(() => reorderStages({ templateId: template.id, orderedStageIds: ids }));
                  }}
                />
              ))}
            </SortableContext>
          )}
          {!readOnly ? (
            <button
              type="button"
              onClick={() =>
                run(() => addStage({ templateId: template.id, name: "New stage" }))
              }
              className="flex h-32 w-[280px] shrink-0 items-center justify-center rounded-xl border border-dashed border-line-card text-[13px] font-semibold text-brand-700 hover:bg-brand-50"
            >
              + Add stage
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );

  return (
    <div className="flex gap-4">
      {!readOnly ? (
        <Palette
          stages={stages}
          pending={pending}
          run={run}
          onOpenInstallPicker={() => setInstallPickerOpen(true)}
        />
      ) : null}

      {readOnly ? (
        canvas
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCorners}
          onDragStart={onDragStart}
          onDragEnd={onDragEnd}
        >
          {canvas}
          <DragOverlay>
            {activeStep ? (
              <StepCard step={activeStep} stageId={activeStep.stageId} />
            ) : activeStage ? (
              <div className="w-[280px] rounded-xl border border-brand-400 bg-white px-3 py-2 text-[13px] font-semibold shadow-lg">
                {activeStage.name}
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>
      )}

      {!readOnly && selectedStep && selectedStage ? (
        <StepDetailsPanel
          key={selectedStep.id}
          step={selectedStep}
          stage={selectedStage}
          stages={stages}
          templateAutomationRules={template.automationRules}
          pending={pending}
          run={run}
          onClose={() => setSelectedStepId(null)}
        />
      ) : null}

      <ModalV2
        open={installPickerOpen}
        onClose={() => setInstallPickerOpen(false)}
        labelledBy="install-blueprint-title"
        size="sm"
      >
        <div className="flex flex-col gap-3 p-1">
          <h2 id="install-blueprint-title" className="text-[15px] font-semibold text-ink">
            Install as new template
          </h2>
          <p className="text-[12px] text-ink-muted">
            This installs a fresh template from the blueprint catalog — it does not import stages
            into the workflow you&apos;re currently editing.
          </p>
          <ul className="flex max-h-80 flex-col gap-1 overflow-y-auto">
            {WORKFLOW_BLUEPRINTS.map((bp) => (
              <li key={bp.key}>
                <button
                  type="button"
                  className="flex w-full flex-col items-start rounded-lg border border-line-soft px-3 py-2 text-left hover:bg-brand-50"
                  onClick={() => {
                    setInstallPickerOpen(false);
                    run(() => installBlueprint({ blueprintKey: bp.key }));
                  }}
                >
                  <span className="text-[13px] font-medium text-ink">{bp.name}</span>
                  <span className="text-[11px] text-ink-muted">
                    {workflowDomainLabel(bp.domain)}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      </ModalV2>
    </div>
  );
}

function Palette({
  stages,
  pending,
  run,
  onOpenInstallPicker,
}: {
  stages: WorkflowTemplateDefinition["stages"];
  pending: boolean;
  run: (fn: () => Promise<unknown>) => void;
  onOpenInstallPicker: () => void;
}) {
  const lastStageId = stages[stages.length - 1]?.id;

  function addStepToLastStage(kind: (typeof STEP_KINDS)[number]) {
    if (!lastStageId) return;
    run(() => addStep({ stageId: lastStageId, name: STEP_KIND_LABELS[kind] ?? kind, kind }));
  }

  return (
    <CardV2 padding="md" className="flex w-[200px] shrink-0 flex-col gap-4">
      <div>
        <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-ink-muted">
          Structure
        </p>
        <button
          type="button"
          disabled={pending}
          className="w-full rounded-lg border border-line-soft px-2.5 py-1.5 text-left text-[13px] hover:bg-brand-50"
          onClick={() => run(() => addStage({ templateId: stages[0]?.id ?? "", name: "New stage" }))}
        >
          + Stage
        </button>
      </div>
      <div>
        <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-ink-muted">
          Steps
        </p>
        <div className="flex flex-col gap-1">
          {STEP_KINDS.map((k) => (
            <button
              key={k}
              type="button"
              disabled={!lastStageId || pending}
              onClick={() => addStepToLastStage(k)}
              className="w-full rounded-lg border border-line-soft px-2.5 py-1.5 text-left text-[13px] hover:bg-brand-50 disabled:opacity-40"
            >
              {STEP_KIND_LABELS[k] ?? k}
            </button>
          ))}
          <button
            type="button"
            disabled={!lastStageId || pending}
            title="Maps to a Task step"
            onClick={() => addStepToLastStage("TASK")}
            className="w-full rounded-lg border border-line-soft px-2.5 py-1.5 text-left text-[13px] hover:bg-brand-50 disabled:opacity-40"
          >
            Wait / Delay <span className="text-[10px] text-ink-muted">(Task)</span>
          </button>
        </div>
      </div>
      <div>
        <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-ink-muted">
          Flow
        </p>
        <div className="flex flex-col gap-1">
          <button
            type="button"
            disabled
            title="Coming soon"
            className="w-full cursor-not-allowed rounded-lg border border-line-soft px-2.5 py-1.5 text-left text-[13px] text-ink-muted opacity-50"
          >
            Parallel Stage
          </button>
          <button
            type="button"
            disabled
            title="Coming soon"
            className="w-full cursor-not-allowed rounded-lg border border-line-soft px-2.5 py-1.5 text-left text-[13px] text-ink-muted opacity-50"
          >
            Loop
          </button>
        </div>
      </div>
      <div>
        <Button size="sm" variant="secondary" className="w-full" onClick={onOpenInstallPicker}>
          Import from Template
        </Button>
      </div>
    </CardV2>
  );
}

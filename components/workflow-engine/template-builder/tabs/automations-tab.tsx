"use client";

import { useState } from "react";

import { DndContext, closestCenter, PointerSensor, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { SortableContext, arrayMove, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

import { Button } from "@/components/ui-v2/button";
import { CardV2 } from "@/components/ui-v2/card";
import { cn } from "@/components/ui-v2/cn";
import {
  AUTOMATION_ACTIONS,
  AUTOMATION_ACTION_LABELS,
  AUTOMATION_TRIGGERS,
  AUTOMATION_TRIGGER_LABELS,
} from "@/lib/workflow-engine/constants";
import type { AutomationRuleDefinition, WorkflowTemplateDefinition } from "@/lib/workflow-engine/types";
import {
  addAutomationRule,
  deleteAutomationRule,
  reorderAutomationRules,
  updateAutomationRule,
} from "@/lib/workflow-engine/template-actions";

const field = "rounded-lg border border-line-soft px-2.5 py-1.5 text-[13px]";
const labelCls = "text-[11px] font-semibold uppercase tracking-wide text-ink-muted";

export function AutomationRuleRow({
  rule,
  scopeLabel,
  pending,
  run,
  sortable,
}: {
  rule: AutomationRuleDefinition;
  scopeLabel: string;
  pending: boolean;
  run: (fn: () => Promise<unknown>) => void;
  sortable?: boolean;
}) {
  const sort = useSortable({ id: rule.id, disabled: !sortable });
  const style = sortable
    ? { transform: CSS.Transform.toString(sort.transform), transition: sort.transition }
    : undefined;

  return (
    <li
      ref={sortable ? sort.setNodeRef : undefined}
      style={style}
      className={cn(
        "flex items-center justify-between gap-2 rounded-lg bg-surface-soft px-3 py-2",
        sortable && sort.isDragging && "opacity-50"
      )}
    >
      <div className="flex items-center gap-2">
        {sortable ? (
          <button
            type="button"
            {...sort.attributes}
            {...sort.listeners}
            className="cursor-grab text-ink-muted active:cursor-grabbing"
            aria-label="Drag to reorder"
          >
            ⠿
          </button>
        ) : null}
        <span className="text-[12px] text-ink">
          <strong>{AUTOMATION_TRIGGER_LABELS[rule.trigger] ?? rule.trigger}</strong> →{" "}
          {AUTOMATION_ACTION_LABELS[rule.action] ?? rule.action}
          {rule.config?.title ? ` · "${String(rule.config.title)}"` : ""}
          <span className="ml-2 text-ink-muted">({scopeLabel})</span>
        </span>
      </div>
      <div className="flex items-center gap-1">
        <Button
          size="sm"
          variant="ghost"
          loading={pending}
          onClick={() => run(() => updateAutomationRule({ id: rule.id, enabled: !rule.enabled }))}
        >
          {rule.enabled ? "On" : "Off"}
        </Button>
        <Button
          size="sm"
          variant="ghost"
          loading={pending}
          onClick={() => run(() => deleteAutomationRule({ id: rule.id }))}
        >
          ✕
        </Button>
      </div>
    </li>
  );
}

export function AutomationsTab({
  template,
  pending,
  run,
}: {
  template: WorkflowTemplateDefinition;
  pending: boolean;
  run: (fn: () => Promise<unknown>) => void;
}) {
  const [adding, setAdding] = useState(false);
  const [trigger, setTrigger] = useState<string>(AUTOMATION_TRIGGERS[1]);
  const [action, setAction] = useState<string>(AUTOMATION_ACTIONS[0]);
  const [stageId, setStageId] = useState("");
  const [title, setTitle] = useState("");

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));
  const rules = [...template.automationRules].sort((a, b) => a.order - b.order);
  const ruleIds = rules.map((r) => r.id);

  function scopeLabel(rule: AutomationRuleDefinition): string {
    if (!rule.stageKey) return "Whole workflow";
    const stage = template.stages.find((s) => s.key === rule.stageKey);
    return stage ? stage.name : rule.stageKey;
  }

  function onDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = ruleIds.indexOf(String(active.id));
    const newIndex = ruleIds.indexOf(String(over.id));
    if (oldIndex === -1 || newIndex === -1) return;
    const newOrder = arrayMove(ruleIds, oldIndex, newIndex);
    run(() => reorderAutomationRules({ templateId: template.id, orderedRuleIds: newOrder }));
  }

  return (
    <CardV2 padding="lg" className="flex flex-col gap-4">
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
        <SortableContext items={ruleIds} strategy={verticalListSortingStrategy}>
          <ul className="flex flex-col gap-1.5">
            {rules.map((r) => (
              <AutomationRuleRow
                key={r.id}
                rule={r}
                scopeLabel={scopeLabel(r)}
                pending={pending}
                run={run}
                sortable
              />
            ))}
            {rules.length === 0 ? (
              <li className="text-[12px] text-ink-muted">No automation yet.</li>
            ) : null}
          </ul>
        </SortableContext>
      </DndContext>

      {adding ? (
        <div className="flex flex-wrap items-end gap-2 rounded-lg border border-line-soft p-3">
          <div className="flex flex-col gap-1">
            <span className={labelCls}>When</span>
            <select className={field} value={trigger} onChange={(e) => setTrigger(e.target.value)}>
              {AUTOMATION_TRIGGERS.map((t) => (
                <option key={t} value={t}>
                  {AUTOMATION_TRIGGER_LABELS[t]}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <span className={labelCls}>Do</span>
            <select className={field} value={action} onChange={(e) => setAction(e.target.value)}>
              {AUTOMATION_ACTIONS.map((a) => (
                <option key={a} value={a}>
                  {AUTOMATION_ACTION_LABELS[a]}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <span className={labelCls}>Stage scope</span>
            <select className={field} value={stageId} onChange={(e) => setStageId(e.target.value)}>
              <option value="">Whole workflow</option>
              {template.stages.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <span className={labelCls}>Title (optional)</span>
            <input className={field} value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <Button
            size="sm"
            loading={pending}
            onClick={() => {
              run(() =>
                addAutomationRule({
                  templateId: template.id,
                  name: title || AUTOMATION_ACTION_LABELS[action],
                  trigger,
                  action,
                  stageId: stageId || undefined,
                  config: title ? { title } : undefined,
                })
              );
              setAdding(false);
              setTitle("");
            }}
          >
            Add
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setAdding(false)}>
            Cancel
          </Button>
        </div>
      ) : (
        <button
          type="button"
          className="self-start text-[12px] font-semibold text-brand-700 hover:underline"
          onClick={() => setAdding(true)}
        >
          + Add automation
        </button>
      )}
    </CardV2>
  );
}

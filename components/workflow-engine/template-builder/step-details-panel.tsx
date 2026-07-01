"use client";

import { CardV2 } from "@/components/ui-v2/card";
import { Button } from "@/components/ui-v2/button";
import { cn } from "@/components/ui-v2/cn";
import {
  ASSIGNEE_MODES,
  AUTOMATION_ACTION_LABELS,
  AUTOMATION_TRIGGER_LABELS,
  STEP_KIND_LABELS,
  STEP_KINDS,
} from "@/lib/workflow-engine/constants";
import type { AutomationRuleDefinition, StageDefinition, StepDefinition } from "@/lib/workflow-engine/types";
import { deleteStep, moveStep, updateStage, updateStep } from "@/lib/workflow-engine/template-actions";
import { useAutosave } from "./use-autosave";

const field = "w-full rounded-lg border border-line-soft px-2.5 py-1.5 text-[13px]";
const labelCls = "text-[11px] font-semibold uppercase tracking-wide text-ink-muted";

type StepPatch = {
  name: string;
  description: string;
  kind: string;
  assigneeMode: string;
  assigneeRole: string;
  assigneeSubtype: string;
  dueOffsetHours: string;
  isRequired: boolean;
};

export function StepDetailsPanel({
  step,
  stage,
  stages,
  templateAutomationRules,
  pending,
  run,
  onClose,
}: {
  step: StepDefinition;
  stage: StageDefinition;
  stages: StageDefinition[];
  templateAutomationRules: AutomationRuleDefinition[];
  pending: boolean;
  run: (fn: () => Promise<unknown>) => void;
  onClose: () => void;
}) {
  const initial: StepPatch = {
    name: step.name,
    description: step.description ?? "",
    kind: step.kind,
    assigneeMode: step.assigneeMode ?? "OWNER",
    assigneeRole: step.assigneeRole ?? "",
    assigneeSubtype: step.assigneeSubtype ?? "",
    dueOffsetHours: step.dueOffsetHours != null ? String(step.dueOffsetHours) : "",
    isRequired: step.isRequired,
  };

  const autosave = useAutosave<StepPatch>(initial, async (v) => {
    await updateStep({
      id: step.id,
      name: v.name.trim() || step.name,
      description: v.description,
      kind: v.kind,
      isRequired: v.isRequired,
      assigneeMode: v.assigneeMode,
      assigneeRole: v.assigneeRole || null,
      assigneeSubtype: v.assigneeSubtype || null,
      dueOffsetHours: v.dueOffsetHours ? Number(v.dueOffsetHours) : null,
    });
  });

  const stepAutomations = templateAutomationRules.filter((r) => r.stepKey === step.key);
  const requireAll = stage.exitCriteria?.requireAllRequiredSteps ?? true;

  return (
    <CardV2
      padding="lg"
      className="sticky top-6 flex max-h-[calc(100vh-3rem)] w-[380px] shrink-0 flex-col gap-4 overflow-y-auto"
    >
      <div className="flex items-center justify-between">
        <p className={labelCls}>Step details</p>
        <button
          type="button"
          onClick={onClose}
          className="text-[12px] text-ink-muted hover:text-ink"
        >
          ✕ Close
        </button>
      </div>

      <div className="flex flex-col gap-1.5">
        <span className={labelCls}>Step type</span>
        <div className="flex flex-wrap gap-1.5">
          {STEP_KINDS.map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => autosave.setValue((v) => ({ ...v, kind: k }))}
              className={cn(
                "rounded-lg border px-2.5 py-1 text-[12px]",
                autosave.value.kind === k
                  ? "border-brand-400 bg-brand-50 text-brand-700"
                  : "border-line-soft text-ink-muted hover:bg-surface-soft"
              )}
            >
              {STEP_KIND_LABELS[k] ?? k}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <label className={labelCls}>Title</label>
        <input
          className={field}
          value={autosave.value.name}
          onChange={(e) => autosave.setValue((v) => ({ ...v, name: e.target.value }))}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label className={labelCls}>Description (guidance shown in the runner)</label>
        <textarea
          className={cn(field, "resize-y")}
          rows={6}
          value={autosave.value.description}
          onChange={(e) => autosave.setValue((v) => ({ ...v, description: e.target.value }))}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label className={labelCls}>Stage</label>
        <select
          className={field}
          value={stage.id}
          onChange={(e) => run(() => moveStep({ id: step.id, toStageId: e.target.value }))}
        >
          {stages.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1.5">
          <label className={labelCls}>Owner</label>
          <select
            className={field}
            value={autosave.value.assigneeMode}
            onChange={(e) => autosave.setValue((v) => ({ ...v, assigneeMode: e.target.value }))}
          >
            {ASSIGNEE_MODES.map((m) => (
              <option key={m} value={m}>
                {m.toLowerCase()}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1.5">
          <label className={labelCls}>Due date rule</label>
          <input
            type="number"
            className={field}
            placeholder="hours after stage entry"
            value={autosave.value.dueOffsetHours}
            onChange={(e) => autosave.setValue((v) => ({ ...v, dueOffsetHours: e.target.value }))}
          />
        </div>
      </div>

      {autosave.value.assigneeMode === "ROLE" ? (
        <div className="flex flex-col gap-1.5">
          <label className={labelCls}>Role</label>
          <input
            className={field}
            value={autosave.value.assigneeRole}
            onChange={(e) => autosave.setValue((v) => ({ ...v, assigneeRole: e.target.value }))}
          />
        </div>
      ) : null}
      {autosave.value.assigneeMode === "SUBTYPE" ? (
        <div className="flex flex-col gap-1.5">
          <label className={labelCls}>Admin subtype</label>
          <input
            className={field}
            value={autosave.value.assigneeSubtype}
            onChange={(e) => autosave.setValue((v) => ({ ...v, assigneeSubtype: e.target.value }))}
          />
        </div>
      ) : null}

      <label className="flex items-center gap-2 text-[13px] text-ink">
        <input
          type="checkbox"
          checked={autosave.value.isRequired}
          onChange={(e) => autosave.setValue((v) => ({ ...v, isRequired: e.target.checked }))}
        />
        Required step
      </label>

      <div className="flex flex-col gap-1.5">
        <p className={labelCls}>Automations ({stepAutomations.length})</p>
        {stepAutomations.length === 0 ? (
          <p className="text-[12px] text-ink-muted">No automations target this step directly.</p>
        ) : (
          <ul className="flex flex-col gap-1">
            {stepAutomations.map((r) => (
              <li key={r.id} className="rounded-lg bg-surface-soft px-2.5 py-1.5 text-[12px] text-ink">
                {AUTOMATION_TRIGGER_LABELS[r.trigger] ?? r.trigger} →{" "}
                {AUTOMATION_ACTION_LABELS[r.action] ?? r.action}
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="flex flex-col gap-1.5 border-t border-line-soft pt-3">
        <p className={labelCls}>Exit criteria for this stage</p>
        <label className="flex items-center gap-2 text-[13px] text-ink">
          <input
            type="checkbox"
            checked={requireAll}
            onChange={(e) =>
              run(() =>
                updateStage({
                  id: stage.id,
                  exitCriteria: { ...stage.exitCriteria, requireAllRequiredSteps: e.target.checked },
                })
              )
            }
          />
          All steps in this stage are completed
        </label>
      </div>

      <div className="flex items-center justify-between gap-2 border-t border-line-soft pt-3">
        <span className="text-[11px] text-ink-muted">
          {autosave.status === "saving" ? "Saving…" : autosave.status === "saved" ? "Saved" : ""}
        </span>
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="ghost"
            loading={pending}
            onClick={() => {
              if (confirm(`Delete step "${step.name}"?`)) {
                run(() => deleteStep({ id: step.id }));
                onClose();
              }
            }}
          >
            Delete step
          </Button>
          <Button size="sm" loading={pending} onClick={autosave.flush}>
            Save step
          </Button>
        </div>
      </div>
    </CardV2>
  );
}

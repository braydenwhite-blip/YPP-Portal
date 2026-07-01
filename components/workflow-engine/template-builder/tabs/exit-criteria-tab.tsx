"use client";

import { useState } from "react";

import { Button } from "@/components/ui-v2/button";
import { CardV2 } from "@/components/ui-v2/card";
import type { WorkflowTemplateDefinition } from "@/lib/workflow-engine/types";
import { updateStage } from "@/lib/workflow-engine/template-actions";

const labelCls = "text-[11px] font-semibold uppercase tracking-wide text-ink-muted";

export function ExitCriteriaTab({
  template,
  pending,
  run,
}: {
  template: WorkflowTemplateDefinition;
  pending: boolean;
  run: (fn: () => Promise<unknown>) => void;
}) {
  const stages = [...template.stages].sort((a, b) => a.order - b.order);
  return (
    <div className="flex flex-col gap-4">
      {stages.map((stage) => (
        <StageExitCriteria key={stage.id} stage={stage} pending={pending} run={run} />
      ))}
    </div>
  );
}

function StageExitCriteria({
  stage,
  pending,
  run,
}: {
  stage: WorkflowTemplateDefinition["stages"][number];
  pending: boolean;
  run: (fn: () => Promise<unknown>) => void;
}) {
  const [newCustom, setNewCustom] = useState("");
  const criteria = stage.exitCriteria ?? {};
  const custom = criteria.custom ?? [];

  function save(patch: Partial<NonNullable<WorkflowTemplateDefinition["stages"][number]["exitCriteria"]>>) {
    run(() => updateStage({ id: stage.id, exitCriteria: { ...criteria, ...patch } }));
  }

  return (
    <CardV2 padding="lg" className="flex flex-col gap-3">
      <p className="text-[14px] font-semibold text-ink">{stage.name}</p>
      <label className="flex items-center gap-2 text-[13px] text-ink">
        <input
          type="checkbox"
          checked={criteria.requireAllRequiredSteps ?? true}
          onChange={(e) => save({ requireAllRequiredSteps: e.target.checked })}
        />
        All steps in this stage are completed
      </label>
      <div className="flex items-center gap-2">
        <label className={labelCls}>Min progress %</label>
        <input
          type="number"
          min={0}
          max={100}
          className="w-24 rounded-lg border border-line-soft px-2.5 py-1 text-[13px]"
          value={criteria.minProgress ?? ""}
          onChange={(e) => save({ minProgress: e.target.value ? Number(e.target.value) : undefined })}
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <span className={labelCls}>Custom conditions</span>
        <ul className="flex flex-wrap gap-1.5">
          {custom.map((c, i) => (
            <li key={i} className="flex items-center gap-1 rounded-full bg-surface-soft px-2.5 py-1 text-[12px]">
              {c}
              <button
                type="button"
                onClick={() => save({ custom: custom.filter((_, j) => j !== i) })}
                className="text-ink-muted hover:text-ink"
              >
                ✕
              </button>
            </li>
          ))}
        </ul>
        <div className="flex gap-2">
          <input
            className="flex-1 rounded-lg border border-line-soft px-2.5 py-1 text-[13px]"
            value={newCustom}
            onChange={(e) => setNewCustom(e.target.value)}
            placeholder="Add a custom condition…"
          />
          <Button
            size="sm"
            variant="secondary"
            loading={pending}
            disabled={!newCustom.trim()}
            onClick={() => {
              save({ custom: [...custom, newCustom.trim()] });
              setNewCustom("");
            }}
          >
            Add
          </Button>
        </div>
      </div>
    </CardV2>
  );
}

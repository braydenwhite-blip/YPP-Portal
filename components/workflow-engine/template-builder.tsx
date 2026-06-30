"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui-v2/button";
import { CardV2 } from "@/components/ui-v2/card";
import { StatusBadge } from "@/components/ui-v2/status-badge";
import { cn } from "@/components/ui-v2/cn";
import {
  ASSIGNEE_MODES,
  AUTOMATION_ACTION_LABELS,
  AUTOMATION_ACTIONS,
  AUTOMATION_TRIGGER_LABELS,
  AUTOMATION_TRIGGERS,
  STEP_KIND_LABELS,
  STEP_KINDS,
  WORKFLOW_DOMAINS,
  workflowDomainLabel,
} from "@/lib/workflow-engine/constants";
import type {
  AutomationRuleDefinition,
  StageDefinition,
  WorkflowTemplateDefinition,
} from "@/lib/workflow-engine/types";
import {
  addAutomationRule,
  addStage,
  addStep,
  deleteAutomationRule,
  deleteStage,
  deleteStep,
  reorderStages,
  setTemplateStatus,
  updateAutomationRule,
  updateStage,
  updateStep,
  updateTemplate,
} from "@/lib/workflow-engine/template-actions";

const field = "rounded-lg border border-line-soft px-2.5 py-1.5 text-[13px]";
const labelCls = "text-[11px] font-semibold uppercase tracking-wide text-ink-muted";

export function TemplateBuilder({ template }: { template: WorkflowTemplateDefinition }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function run(fn: () => Promise<unknown>) {
    setError(null);
    startTransition(async () => {
      try {
        await fn();
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Something went wrong.");
      }
    });
  }

  const stages = [...template.stages].sort((a, b) => a.order - b.order);
  const templateRules = template.automationRules.filter((r) => !r.stageKey);

  return (
    <div className="flex flex-col gap-6">
      {error ? (
        <div className="rounded-lg border border-danger-100 bg-danger-100 px-4 py-2 text-[13px] text-danger-700">
          {error}
        </div>
      ) : null}

      {/* Template settings */}
      <CardV2 padding="lg" className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <StatusBadge tone={template.status === "PUBLISHED" ? "success" : "neutral"}>
              {template.status.toLowerCase()}
            </StatusBadge>
            <span className="text-[12px] text-ink-muted">v{template.version}</span>
          </div>
          <div className="flex gap-2">
            {template.status !== "PUBLISHED" ? (
              <Button
                size="sm"
                loading={pending}
                onClick={() => run(() => setTemplateStatus({ id: template.id, status: "PUBLISHED" }))}
              >
                Publish
              </Button>
            ) : (
              <Button
                size="sm"
                variant="secondary"
                loading={pending}
                onClick={() => run(() => setTemplateStatus({ id: template.id, status: "DRAFT" }))}
              >
                Unpublish
              </Button>
            )}
            <Button
              size="sm"
              variant="ghost"
              loading={pending}
              onClick={() => run(() => setTemplateStatus({ id: template.id, status: "ARCHIVED" }))}
            >
              Archive
            </Button>
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <LabeledInput
            label="Name"
            defaultValue={template.name}
            onBlurSave={(v) => v && v !== template.name && run(() => updateTemplate({ id: template.id, name: v }))}
          />
          <div className="flex flex-col gap-1.5">
            <label className={labelCls}>Domain</label>
            <select
              className={field}
              defaultValue={template.domain ?? "GENERAL"}
              onChange={(e) => run(() => updateTemplate({ id: template.id, domain: e.target.value }))}
            >
              {WORKFLOW_DOMAINS.map((d) => (
                <option key={d} value={d}>
                  {workflowDomainLabel(d)}
                </option>
              ))}
            </select>
          </div>
        </div>
        <p className="text-[12px] text-ink-muted">
          Structure: <strong>Stage</strong> → Steps → Automation → Exit criteria → Assignments →
          Notifications. Build the process once; run it any number of times.
        </p>
      </CardV2>

      {/* Stages */}
      <div className="flex flex-col gap-4">
        {stages.map((stage, idx) => (
          <StageCard
            key={stage.id}
            stage={stage}
            templateId={template.id}
            index={idx}
            total={stages.length}
            rules={template.automationRules.filter((r) => r.stageKey === stage.key)}
            pending={pending}
            run={run}
            onMove={(dir) => {
              const ids = stages.map((s) => s.id);
              const j = dir === "up" ? idx - 1 : idx + 1;
              if (j < 0 || j >= ids.length) return;
              [ids[idx], ids[j]] = [ids[j], ids[idx]];
              run(() => reorderStages({ templateId: template.id, orderedStageIds: ids }));
            }}
          />
        ))}
        <AddStageForm templateId={template.id} pending={pending} run={run} />
      </div>

      {/* Template-wide automation */}
      <CardV2 padding="lg">
        <p className={labelCls}>Workflow-wide automation</p>
        <p className="mb-3 text-[12px] text-ink-muted">
          Runs regardless of stage (e.g. escalate when overdue, auto-advance when ready).
        </p>
        <AutomationList
          templateId={template.id}
          stages={stages}
          rules={templateRules}
          pending={pending}
          run={run}
        />
      </CardV2>
    </div>
  );
}

function StageCard({
  stage,
  templateId,
  index,
  total,
  rules,
  pending,
  run,
  onMove,
}: {
  stage: StageDefinition;
  templateId: string;
  index: number;
  total: number;
  rules: AutomationRuleDefinition[];
  pending: boolean;
  run: (fn: () => Promise<unknown>) => void;
  onMove: (dir: "up" | "down") => void;
}) {
  const steps = [...stage.steps].sort((a, b) => a.order - b.order);
  return (
    <CardV2 padding="lg" className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-brand-600 text-[11px] font-bold text-white">
            {index + 1}
          </span>
          <span className="text-[16px] font-semibold text-ink">{stage.name}</span>
          {stage.isInitial ? <StatusBadge tone="info">start</StatusBadge> : null}
          {stage.isTerminal ? <StatusBadge tone="success">final</StatusBadge> : null}
          {stage.slaHours ? (
            <span className="text-[11px] text-ink-muted">SLA {stage.slaHours}h</span>
          ) : null}
        </div>
        <div className="flex items-center gap-1">
          <IconButton label="↑" disabled={index === 0 || pending} onClick={() => onMove("up")} />
          <IconButton
            label="↓"
            disabled={index === total - 1 || pending}
            onClick={() => onMove("down")}
          />
          <Button
            size="sm"
            variant="ghost"
            loading={pending}
            onClick={() =>
              run(() => updateStage({ id: stage.id, isInitial: !stage.isInitial }))
            }
          >
            {stage.isInitial ? "Unset start" : "Set start"}
          </Button>
          <Button
            size="sm"
            variant="ghost"
            loading={pending}
            onClick={() =>
              run(() => updateStage({ id: stage.id, isTerminal: !stage.isTerminal }))
            }
          >
            {stage.isTerminal ? "Unset final" : "Set final"}
          </Button>
          <Button
            size="sm"
            variant="ghost"
            loading={pending}
            onClick={() => {
              if (confirm(`Delete stage “${stage.name}” and its steps?`))
                run(() => deleteStage({ id: stage.id }));
            }}
          >
            Delete
          </Button>
        </div>
      </div>

      {/* Steps */}
      <div>
        <p className={labelCls}>Steps</p>
        <ul className="mt-2 flex flex-col divide-y divide-line-soft">
          {steps.map((step) => (
            <li key={step.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
              <div className="flex items-center gap-2">
                <span className="text-[13px] text-ink">{step.name}</span>
                <span className="text-[11px] text-ink-muted">
                  {STEP_KIND_LABELS[step.kind] ?? step.kind}
                </span>
                {step.isRequired ? (
                  <StatusBadge tone="brand">required</StatusBadge>
                ) : (
                  <span className="text-[11px] text-ink-muted">optional</span>
                )}
                {step.assigneeMode ? (
                  <span className="text-[11px] text-ink-muted">→ {step.assigneeMode.toLowerCase()}</span>
                ) : null}
                {step.dueOffsetHours ? (
                  <span className="text-[11px] text-ink-muted">due +{step.dueOffsetHours}h</span>
                ) : null}
              </div>
              <div className="flex gap-1">
                <Button
                  size="sm"
                  variant="ghost"
                  loading={pending}
                  onClick={() =>
                    run(() => updateStep({ id: step.id, isRequired: !step.isRequired }))
                  }
                >
                  {step.isRequired ? "Make optional" : "Make required"}
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  loading={pending}
                  onClick={() => run(() => deleteStep({ id: step.id }))}
                >
                  Remove
                </Button>
              </div>
            </li>
          ))}
          {steps.length === 0 ? (
            <li className="py-2 text-[12px] text-ink-muted">No steps yet.</li>
          ) : null}
        </ul>
        <AddStepForm stageId={stage.id} pending={pending} run={run} />
      </div>

      {/* Stage automation (Automation + Notifications) */}
      <div>
        <p className={labelCls}>Automation on this stage</p>
        <AutomationList
          templateId={templateId}
          stages={[]}
          rules={rules}
          fixedStageKey={stage.key}
          pending={pending}
          run={run}
        />
      </div>
    </CardV2>
  );
}

function AutomationList({
  templateId,
  stages,
  rules,
  fixedStageKey,
  pending,
  run,
}: {
  templateId: string;
  stages: StageDefinition[];
  rules: AutomationRuleDefinition[];
  fixedStageKey?: string;
  pending: boolean;
  run: (fn: () => Promise<unknown>) => void;
}) {
  const [adding, setAdding] = useState(false);
  const [trigger, setTrigger] = useState<string>(AUTOMATION_TRIGGERS[1]);
  const [action, setAction] = useState<string>(AUTOMATION_ACTIONS[0]);
  const [stageId, setStageId] = useState("");
  const [title, setTitle] = useState("");

  return (
    <div className="mt-2 flex flex-col gap-2">
      <ul className="flex flex-col gap-1">
        {rules.map((r) => (
          <li
            key={r.id}
            className="flex items-center justify-between rounded-lg bg-surface-soft px-3 py-1.5"
          >
            <span className="text-[12px] text-ink">
              <strong>{AUTOMATION_TRIGGER_LABELS[r.trigger] ?? r.trigger}</strong> →{" "}
              {AUTOMATION_ACTION_LABELS[r.action] ?? r.action}
              {r.config?.title ? ` · “${String(r.config.title)}”` : ""}
            </span>
            <div className="flex items-center gap-1">
              <Button
                size="sm"
                variant="ghost"
                loading={pending}
                onClick={() => run(() => updateAutomationRule({ id: r.id, enabled: !r.enabled }))}
              >
                {r.enabled ? "On" : "Off"}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                loading={pending}
                onClick={() => run(() => deleteAutomationRule({ id: r.id }))}
              >
                ✕
              </Button>
            </div>
          </li>
        ))}
        {rules.length === 0 ? (
          <li className="text-[12px] text-ink-muted">No automation yet.</li>
        ) : null}
      </ul>

      {adding ? (
        <div className="flex flex-wrap items-end gap-2 rounded-lg border border-line-soft p-3">
          <Labeled label="When">
            <select className={field} value={trigger} onChange={(e) => setTrigger(e.target.value)}>
              {AUTOMATION_TRIGGERS.map((t) => (
                <option key={t} value={t}>
                  {AUTOMATION_TRIGGER_LABELS[t]}
                </option>
              ))}
            </select>
          </Labeled>
          <Labeled label="Do">
            <select className={field} value={action} onChange={(e) => setAction(e.target.value)}>
              {AUTOMATION_ACTIONS.map((a) => (
                <option key={a} value={a}>
                  {AUTOMATION_ACTION_LABELS[a]}
                </option>
              ))}
            </select>
          </Labeled>
          {stages.length > 0 ? (
            <Labeled label="Stage scope">
              <select className={field} value={stageId} onChange={(e) => setStageId(e.target.value)}>
                <option value="">Whole workflow</option>
                {stages.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </Labeled>
          ) : null}
          <Labeled label="Title (optional)">
            <input className={field} value={title} onChange={(e) => setTitle(e.target.value)} />
          </Labeled>
          <Button
            size="sm"
            loading={pending}
            onClick={() => {
              run(() =>
                addAutomationRule({
                  templateId,
                  name: title || AUTOMATION_ACTION_LABELS[action],
                  trigger,
                  action,
                  stageId: fixedStageKey ? undefined : stageId || undefined,
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
    </div>
  );
}

function AddStageForm({
  templateId,
  pending,
  run,
}: {
  templateId: string;
  pending: boolean;
  run: (fn: () => Promise<unknown>) => void;
}) {
  const [name, setName] = useState("");
  const [sla, setSla] = useState("");
  return (
    <div className="flex flex-wrap items-end gap-2 rounded-xl border border-dashed border-line-card p-3">
      <Labeled label="New stage name">
        <input className={field} value={name} onChange={(e) => setName(e.target.value)} />
      </Labeled>
      <Labeled label="SLA hours (optional)">
        <input
          className={cn(field, "w-28")}
          type="number"
          value={sla}
          onChange={(e) => setSla(e.target.value)}
        />
      </Labeled>
      <Button
        size="sm"
        loading={pending}
        disabled={!name.trim()}
        onClick={() => {
          run(() =>
            addStage({
              templateId,
              name,
              slaHours: sla ? Number(sla) : null,
            })
          );
          setName("");
          setSla("");
        }}
      >
        Add stage
      </Button>
    </div>
  );
}

function AddStepForm({
  stageId,
  pending,
  run,
}: {
  stageId: string;
  pending: boolean;
  run: (fn: () => Promise<unknown>) => void;
}) {
  const [name, setName] = useState("");
  const [kind, setKind] = useState<string>(STEP_KINDS[0]);
  const [required, setRequired] = useState(true);
  const [assignee, setAssignee] = useState("OWNER");
  const [due, setDue] = useState("");
  return (
    <div className="mt-2 flex flex-wrap items-end gap-2 rounded-lg border border-dashed border-line-card p-2">
      <Labeled label="Step name">
        <input className={field} value={name} onChange={(e) => setName(e.target.value)} />
      </Labeled>
      <Labeled label="Kind">
        <select className={field} value={kind} onChange={(e) => setKind(e.target.value)}>
          {STEP_KINDS.map((k) => (
            <option key={k} value={k}>
              {STEP_KIND_LABELS[k]}
            </option>
          ))}
        </select>
      </Labeled>
      <Labeled label="Assign to">
        <select className={field} value={assignee} onChange={(e) => setAssignee(e.target.value)}>
          {ASSIGNEE_MODES.map((m) => (
            <option key={m} value={m}>
              {m.toLowerCase()}
            </option>
          ))}
        </select>
      </Labeled>
      <Labeled label="Due +h">
        <input
          className={cn(field, "w-20")}
          type="number"
          value={due}
          onChange={(e) => setDue(e.target.value)}
        />
      </Labeled>
      <label className="flex items-center gap-1.5 text-[12px] text-ink-muted">
        <input type="checkbox" checked={required} onChange={(e) => setRequired(e.target.checked)} />
        required
      </label>
      <Button
        size="sm"
        loading={pending}
        disabled={!name.trim()}
        onClick={() => {
          run(() =>
            addStep({
              stageId,
              name,
              kind,
              isRequired: required,
              assigneeMode: assignee,
              dueOffsetHours: due ? Number(due) : null,
            })
          );
          setName("");
          setDue("");
        }}
      >
        Add step
      </Button>
    </div>
  );
}

function Labeled({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <span className={labelCls}>{label}</span>
      {children}
    </div>
  );
}

function LabeledInput({
  label,
  defaultValue,
  onBlurSave,
}: {
  label: string;
  defaultValue: string;
  onBlurSave: (v: string) => void;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className={labelCls}>{label}</label>
      <input
        className={field}
        defaultValue={defaultValue}
        onBlur={(e) => onBlurSave(e.target.value.trim())}
      />
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
      className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-line-soft text-[13px] text-ink-muted disabled:opacity-40 hover:bg-brand-50"
    >
      {label}
    </button>
  );
}

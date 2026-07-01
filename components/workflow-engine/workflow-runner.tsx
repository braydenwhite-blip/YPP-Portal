"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui-v2/button";
import { CardV2 } from "@/components/ui-v2/card";
import { SectionHeaderV2 } from "@/components/ui-v2/section-header";
import { StatusBadge } from "@/components/ui-v2/status-badge";
import { EntityChip } from "@/components/ui-v2/entity-chip";
import { ModalV2, ModalFooterV2 } from "@/components/ui-v2/modal";
import { cn } from "@/components/ui-v2/cn";
import {
  INSTANCE_STATUS_LABELS,
  INSTANCE_STATUS_TONE,
  STEP_STATE_TONE,
} from "@/lib/workflow-engine/constants";
import { workflowEntityTypeLabel } from "@/lib/workflow-engine/entity-types";
import type { Entity360Type } from "@/lib/operations/entity-360";
import type { InstanceDetail } from "@/lib/workflow-engine/queries";
import type { StepExecutionView } from "@/lib/workflow-engine/types";
import {
  advanceWorkflow,
  blockStep,
  cancelWorkflow,
  completeStep,
  createManualActionForStep,
  escalateWorkflow,
  reassignStep,
  scheduleMeetingForStep,
  setWorkflowOwner,
  skipStep,
  unblockStep,
} from "@/lib/workflow-engine/instance-actions";

export type AssignableUser = { id: string; name: string };

export type RelatedWorkflowAttachment = {
  id: string;
  entityType: string;
  entityId: string;
  relationship: string;
};

/** WORKFLOW_ENTITY_TYPE_VALUES → EntityChip's supported "type" union. Types
 *  with no EntityChip equivalent (CURRICULUM_DRAFT, SPECIAL_PROGRAM) fall back
 *  to plain text in the Related objects panel. */
const ENTITY_TYPE_TO_CHIP_TYPE: Partial<Record<string, Entity360Type>> = {
  CHAPTER: "chapter",
  PARTNER: "partner",
  INSTRUCTOR_APPLICATION: "applicant",
  CHAPTER_PRESIDENT_APPLICATION: "applicant",
  USER: "person",
  MENTORSHIP: "mentorship",
  CLASS_OFFERING: "class",
  MEETING: "meeting",
  ACTION_ITEM: "action",
  INITIATIVE: "initiative",
};

function formatDueDate(iso: string | null): string | null {
  if (!iso) return null;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(date);
}

/** Local input value ("YYYY-MM-DDTHH:mm") for a datetime-local default 3 days out. */
function defaultMeetingInputValue(): string {
  const d = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);
  d.setSeconds(0, 0);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function WorkflowRunner({
  detail,
  assignableUsers = [],
  relatedAttachments = [],
}: {
  detail: InstanceDetail;
  /** For the per-step / instance-owner "Reassign" picker. Loaded by the page
   *  the same way /workflows/new loads its assignable-users list
   *  (lib/weekly-meetings/teams.ts's listAssignableUsers). */
  assignableUsers?: AssignableUser[];
  /** WorkflowAttachment rows for THIS instance (secondary entity links) —
   *  rendered in the "Related objects" panel alongside the instance's own
   *  primary subject. */
  relatedAttachments?: RelatedWorkflowAttachment[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [blockingId, setBlockingId] = useState<string | null>(null);
  const [blockReason, setBlockReason] = useState("");
  const [reassigningId, setReassigningId] = useState<string | null>(null);
  const [escalateOpen, setEscalateOpen] = useState(false);
  const [schedulingId, setSchedulingId] = useState<string | null>(null);
  const [meetingWhen, setMeetingWhen] = useState("");

  const { instance, runtime, executions, definition, events, ownerName, executionOwnerNames } = detail;

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

  const currentExecs = executions.filter((e) => e.stageKey === runtime.currentStageKey);
  const isClosed = instance.status === "COMPLETED" || instance.status === "CANCELLED";

  const stageByKey = new Map(definition.stages.map((s) => [s.key, s]));
  const currentStageDef = runtime.currentStageKey ? stageByKey.get(runtime.currentStageKey) : undefined;
  const stepDescByKey = new Map(
    (currentStageDef?.steps ?? []).map((st) => [st.key, st.description])
  );

  return (
    <div className="flex flex-col gap-6">
      {error ? (
        <div className="rounded-lg border border-danger-100 bg-danger-100 px-4 py-2 text-[13px] text-danger-700">
          {error}
        </div>
      ) : null}

      {/* Completion + next action */}
      <CardV2 padding="lg" className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-3">
            <StatusBadge tone={INSTANCE_STATUS_TONE[instance.status] ?? "neutral"} withDot>
              {INSTANCE_STATUS_LABELS[instance.status] ?? instance.status}
            </StatusBadge>
            {runtime.isOverdue ? <StatusBadge tone="danger">Overdue</StatusBadge> : null}
            {instance.escalatedAt ? (
              <StatusBadge tone="danger" title="Escalated to leadership">
                Escalated
              </StatusBadge>
            ) : null}
            <span className="text-[13px] text-ink-muted">
              {runtime.completionPercent}% complete
            </span>
          </div>
          <div className="flex items-center gap-2">
            {!isClosed ? (
              <Button variant="ghost" size="sm" onClick={() => setEscalateOpen(true)}>
                Escalate
              </Button>
            ) : null}
            {!isClosed && runtime.canAdvance ? (
              <Button
                variant="secondary"
                size="sm"
                loading={pending}
                onClick={() => run(() => advanceWorkflow({ instanceId: instance.id }))}
              >
                Advance stage →
              </Button>
            ) : null}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 text-[13px] text-ink-muted">
          <span>Owner:</span>
          {instance.ownerId ? (
            <EntityChip type="person" id={instance.ownerId} label={ownerName ?? "Owner"} />
          ) : (
            <span>Unassigned</span>
          )}
          {!isClosed ? (
            <OwnerReassignControl
              currentOwnerId={instance.ownerId}
              assignableUsers={assignableUsers}
              open={reassigningId === "__instance__"}
              onOpen={() => setReassigningId("__instance__")}
              onClose={() => setReassigningId(null)}
              onPick={(ownerId) =>
                run(() => setWorkflowOwner({ instanceId: instance.id, ownerId }))
              }
              pending={pending}
            />
          ) : null}
        </div>

        <div className="h-2 w-full overflow-hidden rounded-full bg-brand-50">
          <div
            className="h-full rounded-full bg-brand-600 transition-all"
            style={{ width: `${runtime.completionPercent}%` }}
          />
        </div>

        {!isClosed ? (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-brand-50/60 px-4 py-3">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-brand-700">
                Next recommended action
              </p>
              <p className="text-[14px] font-medium text-ink">{runtime.nextAction.label}</p>
            </div>
            {runtime.nextAction.kind === "ADVANCE_STAGE" ? (
              <Button
                size="sm"
                loading={pending}
                onClick={() => run(() => advanceWorkflow({ instanceId: instance.id }))}
              >
                Advance
              </Button>
            ) : runtime.nextAction.kind === "DONE" && !runtime.currentStageKey ? null : runtime
                .nextAction.kind === "DONE" ? (
              <Button
                size="sm"
                loading={pending}
                onClick={() => run(() => advanceWorkflow({ instanceId: instance.id }))}
              >
                Complete workflow
              </Button>
            ) : null}
          </div>
        ) : null}
      </CardV2>

      {/* Stage timeline */}
      <CardV2 padding="lg">
        <SectionHeaderV2 title="Stages" description="The path this workflow takes." />
        <ol className="mt-3 flex flex-col gap-1">
          {runtime.stages.map((s) => {
            const stageDescription = stageByKey.get(s.stageKey)?.description;
            return (
              <li
                key={s.stageKey}
                className={cn(
                  "flex flex-col gap-1 rounded-lg px-3 py-2",
                  s.status === "CURRENT" || s.status === "BLOCKED" ? "bg-brand-50" : ""
                )}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-3">
                    <span
                      className={cn(
                        "inline-flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-bold",
                        s.status === "COMPLETED"
                          ? "bg-complete-50 text-complete-700"
                          : s.status === "CURRENT"
                            ? "bg-brand-600 text-white"
                            : s.status === "BLOCKED"
                              ? "bg-blocked-50 text-blocked-700"
                              : "bg-idle-50 text-idle-700"
                      )}
                    >
                      {s.status === "COMPLETED" ? "✓" : s.order + 1}
                    </span>
                    <span className="text-[14px] font-medium text-ink">{s.name}</span>
                    {s.isTerminal ? (
                      <span className="text-[11px] text-ink-muted">final</span>
                    ) : null}
                    {s.isOverdue ? <StatusBadge tone="danger">Overdue</StatusBadge> : null}
                  </div>
                  <span className="text-[12px] text-ink-muted">
                    {s.completedSteps}/{s.totalSteps} steps
                  </span>
                </div>
                {stageDescription ? (
                  <p className="ml-9 text-[12px] text-ink-muted">{stageDescription}</p>
                ) : null}
              </li>
            );
          })}
        </ol>
      </CardV2>

      {/* Current stage steps */}
      {!isClosed && currentExecs.length > 0 ? (
        <CardV2 padding="lg">
          <SectionHeaderV2
            title="Current stage"
            description="Complete the required steps to advance."
          />
          <ul className="mt-3 flex flex-col divide-y divide-line-soft">
            {currentExecs.map((exec) => (
              <StepRow
                key={exec.id}
                exec={exec}
                description={stepDescByKey.get(exec.stepKey) ?? null}
                ownerName={exec.ownerId ? executionOwnerNames[exec.ownerId] ?? null : null}
                pending={pending}
                blockingId={blockingId}
                blockReason={blockReason}
                setBlockReason={setBlockReason}
                onComplete={() => run(() => completeStep({ executionId: exec.id }))}
                onSkip={() => run(() => skipStep({ executionId: exec.id }))}
                onUnblock={() => run(() => unblockStep({ executionId: exec.id }))}
                onStartBlock={() => {
                  setBlockingId(exec.id);
                  setBlockReason("");
                }}
                onSubmitBlock={() => {
                  run(() => blockStep({ executionId: exec.id, reason: blockReason || "Blocked" }));
                  setBlockingId(null);
                }}
                onCancelBlock={() => setBlockingId(null)}
                assignableUsers={assignableUsers}
                reassigning={reassigningId === exec.id}
                onOpenReassign={() => setReassigningId(exec.id)}
                onCloseReassign={() => setReassigningId(null)}
                onPickOwner={(ownerId) =>
                  run(() => reassignStep({ executionId: exec.id, ownerId }))
                }
                onCreateAction={() => run(() => createManualActionForStep({ executionId: exec.id }))}
                scheduling={schedulingId === exec.id}
                meetingWhen={meetingWhen}
                setMeetingWhen={setMeetingWhen}
                onOpenSchedule={() => {
                  setSchedulingId(exec.id);
                  setMeetingWhen(defaultMeetingInputValue());
                }}
                onCloseSchedule={() => setSchedulingId(null)}
                onSubmitSchedule={() => {
                  const iso = meetingWhen ? new Date(meetingWhen).toISOString() : undefined;
                  run(() => scheduleMeetingForStep({ executionId: exec.id, scheduledAt: iso }));
                  setSchedulingId(null);
                }}
              />
            ))}
          </ul>
        </CardV2>
      ) : null}

      {/* Related objects */}
      <RelatedObjectsPanel instance={instance} attachments={relatedAttachments} />

      {/* Footer actions */}
      {!isClosed ? (
        <div className="flex justify-end">
          <Button
            variant="ghost"
            size="sm"
            loading={pending}
            onClick={() => {
              if (confirm("Cancel this workflow?")) {
                run(() => cancelWorkflow({ instanceId: instance.id }));
              }
            }}
          >
            Cancel workflow
          </Button>
        </div>
      ) : null}

      {/* History */}
      <CardV2 padding="lg">
        <SectionHeaderV2 title="History" description="Everything that has happened." />
        <ul className="mt-3 flex flex-col gap-2">
          {events.length === 0 ? (
            <li className="text-[13px] text-ink-muted">No activity yet.</li>
          ) : (
            events.map((e) => (
              <li key={e.id} className="flex items-start gap-3 text-[13px]">
                <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-brand-300" />
                <div>
                  <span className="text-ink">{e.summary}</span>
                  <span className="ml-2 text-[11px] text-ink-muted">
                    {new Date(e.createdAt).toLocaleString()}
                    {e.actorName ? ` · ${e.actorName}` : ""}
                  </span>
                </div>
              </li>
            ))
          )}
        </ul>
      </CardV2>

      {definition.description ? (
        <CardV2 padding="lg">
          <SectionHeaderV2 title="About this workflow" description={definition.name} />
          <p className="mt-3 whitespace-pre-line text-[13px] text-ink-muted">
            {definition.description}
          </p>
        </CardV2>
      ) : (
        <p className="text-center text-[11px] text-ink-muted">Template: {definition.name}</p>
      )}

      <EscalateModal
        open={escalateOpen}
        pending={pending}
        onClose={() => setEscalateOpen(false)}
        onConfirm={() => {
          run(() => escalateWorkflow({ instanceId: instance.id }));
          setEscalateOpen(false);
        }}
      />
    </div>
  );
}

function EscalateModal({
  open,
  pending,
  onClose,
  onConfirm,
}: {
  open: boolean;
  pending: boolean;
  onClose: () => void;
  onConfirm: () => void;
}) {
  return (
    <ModalV2
      open={open}
      onClose={onClose}
      locked={pending}
      labelledBy="escalate-workflow-heading"
      size="sm"
      accent="warning"
    >
      <h2 id="escalate-workflow-heading" className="text-[16px] font-bold text-ink">
        Escalate this workflow
      </h2>
      <p className="text-[13px] text-ink-muted">
        Leadership will be notified that this workflow needs attention.
      </p>
      <ModalFooterV2>
        <Button variant="ghost" onClick={onClose} disabled={pending}>
          Cancel
        </Button>
        <Button variant="danger" loading={pending} onClick={onConfirm}>
          Escalate
        </Button>
      </ModalFooterV2>
    </ModalV2>
  );
}

function OwnerReassignControl({
  currentOwnerId,
  assignableUsers,
  open,
  onOpen,
  onClose,
  onPick,
  pending,
}: {
  currentOwnerId: string | null;
  assignableUsers: AssignableUser[];
  open: boolean;
  onOpen: () => void;
  onClose: () => void;
  onPick: (ownerId: string) => void;
  pending: boolean;
}) {
  if (assignableUsers.length === 0) return null;

  if (!open) {
    return (
      <Button variant="ghost" size="sm" onClick={onOpen}>
        Reassign
      </Button>
    );
  }

  return (
    <span className="flex items-center gap-1.5">
      <select
        className="rounded-lg border border-line-soft px-2 py-1 text-[12.5px]"
        defaultValue={currentOwnerId ?? ""}
        autoFocus
        disabled={pending}
        onChange={(e) => {
          if (e.target.value) onPick(e.target.value);
        }}
      >
        <option value="" disabled>
          Choose owner…
        </option>
        {assignableUsers.map((u) => (
          <option key={u.id} value={u.id}>
            {u.name}
          </option>
        ))}
      </select>
      <Button variant="ghost" size="sm" onClick={onClose} disabled={pending}>
        Cancel
      </Button>
    </span>
  );
}

function StepRow({
  exec,
  description,
  ownerName,
  pending,
  blockingId,
  blockReason,
  setBlockReason,
  onComplete,
  onSkip,
  onUnblock,
  onStartBlock,
  onSubmitBlock,
  onCancelBlock,
  assignableUsers,
  reassigning,
  onOpenReassign,
  onCloseReassign,
  onPickOwner,
  onCreateAction,
  scheduling,
  meetingWhen,
  setMeetingWhen,
  onOpenSchedule,
  onCloseSchedule,
  onSubmitSchedule,
}: {
  exec: StepExecutionView;
  description: string | null;
  ownerName: string | null;
  pending: boolean;
  blockingId: string | null;
  blockReason: string;
  setBlockReason: (v: string) => void;
  onComplete: () => void;
  onSkip: () => void;
  onUnblock: () => void;
  onStartBlock: () => void;
  onSubmitBlock: () => void;
  onCancelBlock: () => void;
  assignableUsers: AssignableUser[];
  reassigning: boolean;
  onOpenReassign: () => void;
  onCloseReassign: () => void;
  onPickOwner: (ownerId: string) => void;
  onCreateAction: () => void;
  scheduling: boolean;
  meetingWhen: string;
  setMeetingWhen: (v: string) => void;
  onOpenSchedule: () => void;
  onCloseSchedule: () => void;
  onSubmitSchedule: () => void;
}) {
  const done = exec.state === "COMPLETE" || exec.state === "SKIPPED";
  const dueLabel = formatDueDate(exec.dueAt);
  const canCreateAction = !done && !exec.linkedActionItemId;
  const canScheduleMeeting = !done && exec.kind === "MEETING" && !exec.linkedMeetingId;

  return (
    <li className="flex flex-col gap-2 py-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <StatusBadge tone={STEP_STATE_TONE[exec.state] ?? "neutral"}>
            {exec.state.replace(/_/g, " ").toLowerCase()}
          </StatusBadge>
          <span className={cn("text-[14px]", done ? "text-ink-muted line-through" : "text-ink")}>
            {exec.title}
          </span>
          {!exec.isRequired ? (
            <span className="text-[11px] text-ink-muted">optional</span>
          ) : null}
        </div>
        {!done ? (
          <div className="flex items-center gap-2">
            {exec.state === "BLOCKED" ? (
              <Button variant="secondary" size="sm" loading={pending} onClick={onUnblock}>
                Unblock
              </Button>
            ) : (
              <Button variant="ghost" size="sm" loading={pending} onClick={onStartBlock}>
                Block
              </Button>
            )}
            {!exec.isRequired ? (
              <Button variant="ghost" size="sm" loading={pending} onClick={onSkip}>
                Skip
              </Button>
            ) : null}
            <Button size="sm" loading={pending} onClick={onComplete}>
              Complete
            </Button>
          </div>
        ) : null}
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[12px] text-ink-muted">
        <span className="flex items-center gap-1.5">
          Owner:{" "}
          {exec.ownerId ? (
            <EntityChip type="person" id={exec.ownerId} label={ownerName ?? "Owner"} />
          ) : (
            <span>(unassigned)</span>
          )}
        </span>
        {dueLabel ? <span>Due {dueLabel}</span> : null}
        {!done ? (
          <OwnerReassignControl
            currentOwnerId={exec.ownerId}
            assignableUsers={assignableUsers}
            open={reassigning}
            onOpen={onOpenReassign}
            onClose={onCloseReassign}
            onPick={onPickOwner}
            pending={pending}
          />
        ) : null}
      </div>

      {description ? (
        <details className="text-[12px] text-ink-muted">
          <summary className="cursor-pointer select-none font-medium text-brand-700">
            Guidance
          </summary>
          <p className="mt-1">{description}</p>
        </details>
      ) : null}

      {exec.blockedReason ? (
        <p className="text-[12px] text-blocked-700">Blocked: {exec.blockedReason}</p>
      ) : null}

      {exec.linkedActionItemId || exec.linkedMeetingId ? (
        <p className="flex flex-wrap items-center gap-x-3 text-[11px]">
          {exec.linkedActionItemId ? (
            <Link
              href={`/actions/${exec.linkedActionItemId}`}
              className="text-brand-700 underline-offset-2 hover:underline"
            >
              View action →
            </Link>
          ) : null}
          {exec.linkedMeetingId ? (
            <Link
              href={`/meetings/${exec.linkedMeetingId}`}
              className="text-brand-700 underline-offset-2 hover:underline"
            >
              View meeting →
            </Link>
          ) : null}
        </p>
      ) : null}

      {!done && (canCreateAction || canScheduleMeeting) ? (
        <div className="flex flex-wrap items-center gap-2">
          {canCreateAction ? (
            <Button variant="ghost" size="sm" loading={pending} onClick={onCreateAction}>
              Create action
            </Button>
          ) : null}
          {canScheduleMeeting && !scheduling ? (
            <Button variant="ghost" size="sm" loading={pending} onClick={onOpenSchedule}>
              Schedule meeting
            </Button>
          ) : null}
        </div>
      ) : null}

      {scheduling ? (
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="datetime-local"
            value={meetingWhen}
            onChange={(e) => setMeetingWhen(e.target.value)}
            className="rounded-lg border border-line px-3 py-1.5 text-[13px]"
          />
          <Button size="sm" loading={pending} onClick={onSubmitSchedule}>
            Schedule
          </Button>
          <Button variant="ghost" size="sm" onClick={onCloseSchedule}>
            Cancel
          </Button>
        </div>
      ) : null}

      {blockingId === exec.id ? (
        <div className="flex items-center gap-2">
          <input
            value={blockReason}
            onChange={(e) => setBlockReason(e.target.value)}
            placeholder="Why is this blocked?"
            className="flex-1 rounded-lg border border-line px-3 py-1.5 text-[13px]"
          />
          <Button size="sm" loading={pending} onClick={onSubmitBlock}>
            Save
          </Button>
          <Button variant="ghost" size="sm" onClick={onCancelBlock}>
            Cancel
          </Button>
        </div>
      ) : null}
    </li>
  );
}

function RelatedObjectsPanel({
  instance,
  attachments,
}: {
  instance: InstanceDetail["instance"];
  attachments: RelatedWorkflowAttachment[];
}) {
  const hasPrimary = Boolean(instance.subjectType && instance.subjectId);
  if (!hasPrimary && attachments.length === 0) return null;

  return (
    <CardV2 padding="lg">
      <SectionHeaderV2
        title="Related objects"
        description="What this workflow is about, and what else it touches."
      />
      <ul className="mt-3 flex flex-wrap gap-2">
        {hasPrimary ? (
          <li>
            <RelatedObjectChip
              entityType={instance.subjectType as string}
              entityId={instance.subjectId as string}
              sublabel="Primary subject"
            />
          </li>
        ) : null}
        {attachments.map((a) => (
          <li key={a.id}>
            <RelatedObjectChip entityType={a.entityType} entityId={a.entityId} sublabel={a.relationship} />
          </li>
        ))}
      </ul>
    </CardV2>
  );
}

function RelatedObjectChip({
  entityType,
  entityId,
  sublabel,
}: {
  entityType: string;
  entityId: string;
  sublabel?: string;
}) {
  const chipType = ENTITY_TYPE_TO_CHIP_TYPE[entityType];
  const label = workflowEntityTypeLabel(entityType);
  if (!chipType) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-line bg-surface px-2.5 py-1 text-[12.5px] font-medium text-ink-muted">
        {label}
        {sublabel ? <span className="text-ink-muted">· {sublabel}</span> : null}
      </span>
    );
  }
  return <EntityChip type={chipType} id={entityId} label={label} sublabel={sublabel} />;
}

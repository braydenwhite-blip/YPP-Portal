"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui-v2/button";
import { CardV2 } from "@/components/ui-v2/card";
import { SectionHeaderV2 } from "@/components/ui-v2/section-header";
import { StatusBadge } from "@/components/ui-v2/status-badge";
import { cn } from "@/components/ui-v2/cn";
import {
  INSTANCE_STATUS_LABELS,
  INSTANCE_STATUS_TONE,
  STEP_STATE_TONE,
} from "@/lib/workflow-engine/constants";
import type { InstanceDetail } from "@/lib/workflow-engine/queries";
import type { StepExecutionView } from "@/lib/workflow-engine/types";
import {
  advanceWorkflow,
  blockStep,
  cancelWorkflow,
  completeStep,
  skipStep,
  unblockStep,
} from "@/lib/workflow-engine/instance-actions";

export function WorkflowRunner({ detail }: { detail: InstanceDetail }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [blockingId, setBlockingId] = useState<string | null>(null);
  const [blockReason, setBlockReason] = useState("");

  const { instance, runtime, executions, definition, events } = detail;

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
          <div className="flex items-center gap-3">
            <StatusBadge tone={INSTANCE_STATUS_TONE[instance.status] ?? "neutral"} withDot>
              {INSTANCE_STATUS_LABELS[instance.status] ?? instance.status}
            </StatusBadge>
            {runtime.isOverdue ? <StatusBadge tone="danger">Overdue</StatusBadge> : null}
            <span className="text-[13px] text-ink-muted">
              {runtime.completionPercent}% complete
            </span>
          </div>
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
          {runtime.stages.map((s) => (
            <li
              key={s.stageKey}
              className={cn(
                "flex items-center justify-between rounded-lg px-3 py-2",
                s.status === "CURRENT" || s.status === "BLOCKED" ? "bg-brand-50" : ""
              )}
            >
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
            </li>
          ))}
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
              />
            ))}
          </ul>
        </CardV2>
      ) : null}

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

      <p className="text-center text-[11px] text-ink-muted">
        Template: {definition.name}
      </p>
    </div>
  );
}

function StepRow({
  exec,
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
}: {
  exec: StepExecutionView;
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
}) {
  const done = exec.state === "COMPLETE" || exec.state === "SKIPPED";
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

      {exec.blockedReason ? (
        <p className="text-[12px] text-blocked-700">Blocked: {exec.blockedReason}</p>
      ) : null}

      {(exec.linkedActionItemId || exec.linkedMeetingId) && (
        <p className="text-[11px] text-ink-muted">
          {exec.linkedActionItemId ? "Linked action created · " : ""}
          {exec.linkedMeetingId ? "Linked meeting scheduled" : ""}
        </p>
      )}

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

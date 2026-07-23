"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { ChairDecisionAction } from "@prisma/client";

import { finalizeStaffApplicationDecision } from "@/lib/application-actions";
import DecisionButtons from "@/components/instructor-applicants/final-review/DecisionButtons";
import DecisionReadinessMeter from "@/components/instructor-applicants/final-review/DecisionReadinessMeter";
import type { DecisionReadinessCheck } from "@/lib/applications/decision-readiness";
import { StatusBadge } from "@/components/ui-v2";

const STAFF_ACTIONS = new Set<ChairDecisionAction>([
  "APPROVE",
  "APPROVE_WITH_CONDITIONS",
  "REJECT",
  "REQUEST_SECOND_INTERVIEW",
]);

function actionLabel(action: ChairDecisionAction): string {
  switch (action) {
    case "APPROVE":
      return "Approve";
    case "APPROVE_WITH_CONDITIONS":
      return "Approve w/ conditions";
    case "REJECT":
      return "Reject";
    case "REQUEST_SECOND_INTERVIEW":
      return "Second interview";
    default:
      return action;
  }
}

export function StaffDecisionPanel({
  applicationId,
  canDecide,
  checks,
  summaryLine,
  decided,
  decidedLabel,
}: {
  applicationId: string;
  canDecide: boolean;
  checks: DecisionReadinessCheck[];
  summaryLine: string;
  decided: boolean;
  decidedLabel?: string | null;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [pendingAction, setPendingAction] = useState<ChairDecisionAction | null>(null);
  const [notes, setNotes] = useState("");
  const [conditions, setConditions] = useState("");
  const [error, setError] = useState<string | null>(null);

  if (decided) {
    return (
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <DecisionReadinessMeter checks={checks} summaryLine={summaryLine} compact />
          {decidedLabel ? <StatusBadge tone="brand">{decidedLabel}</StatusBadge> : null}
        </div>
        <p className="m-0 text-[13px] text-ink-muted">
          This application already has a final decision.
        </p>
      </div>
    );
  }

  function choose(action: ChairDecisionAction) {
    if (!canDecide || !STAFF_ACTIONS.has(action)) return;
    setError(null);
    setPendingAction(action);
  }

  function confirm() {
    if (!pendingAction) return;
    const formData = new FormData();
    formData.set("applicationId", applicationId);
    formData.set("action", pendingAction);
    if (notes.trim()) formData.set("notes", notes.trim());
    if (conditions.trim()) formData.set("conditions", conditions.trim());

    startTransition(async () => {
      try {
        await finalizeStaffApplicationDecision(formData);
        setPendingAction(null);
        setNotes("");
        setConditions("");
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not save decision.");
      }
    });
  }

  return (
    <div className="min-w-0 flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <DecisionReadinessMeter checks={checks} summaryLine={summaryLine} compact />
      </div>

      {!canDecide ? (
        <p className="m-0 rounded-[10px] border border-line-soft bg-surface-soft px-3 py-2 text-[13px] text-ink-muted">
          Only admins, hiring chairs, or chapter reviewers can finalize staff decisions.
        </p>
      ) : (
        <p className="m-0 text-[13px] leading-relaxed text-ink-muted">
          Decisions finalize immediately — no Chair review step.
        </p>
      )}

      <label className="flex flex-col gap-1 text-[11px] font-bold uppercase tracking-[0.05em] text-ink-muted">
        Note
        <textarea
          rows={3}
          value={notes}
          disabled={!canDecide || pending}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Internal rationale (required for reject)…"
          className="w-full resize-y rounded-[9px] border border-line bg-surface px-2.5 py-2 text-[13px] font-normal normal-case tracking-normal text-ink"
        />
      </label>

      {pendingAction === "APPROVE_WITH_CONDITIONS" ? (
        <label className="flex flex-col gap-1 text-[11px] font-bold uppercase tracking-[0.05em] text-ink-muted">
          Conditions
          <textarea
            rows={2}
            value={conditions}
            disabled={pending}
            onChange={(e) => setConditions(e.target.value)}
            placeholder="What conditions apply?"
            className="w-full resize-y rounded-[9px] border border-line bg-surface px-2.5 py-2 text-[13px] font-normal normal-case tracking-normal text-ink"
          />
        </label>
      ) : null}

      <DecisionButtons
        hasRedFlags={false}
        hasMajorityReject={false}
        hasMixedConsensus={false}
        draftMeetsRequirements={true}
        pending={pending}
        pendingAction={pendingAction}
        onChoose={choose}
        allowedActions={[
          "APPROVE",
          "APPROVE_WITH_CONDITIONS",
          "REQUEST_SECOND_INTERVIEW",
          "REJECT",
        ]}
      />

      {pendingAction && STAFF_ACTIONS.has(pendingAction) ? (
        <div className="rounded-[10px] border border-brand-200 bg-brand-50/70 px-3.5 py-3">
          <p className="m-0 text-[13px] font-semibold text-ink">
            Confirm {actionLabel(pendingAction)}?
          </p>
          <p className="m-0 mt-1 text-[12.5px] text-ink-muted">
            This saves immediately — no Chair approval after.
          </p>
          {error ? (
            <p className="m-0 mt-2 text-[13px] font-medium text-danger-700">{error}</p>
          ) : null}
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              disabled={pending}
              onClick={confirm}
              className="h-9 rounded-[9px] bg-brand-600 px-3.5 text-[13px] font-bold text-white disabled:opacity-60"
            >
              {pending ? "Saving…" : `Confirm ${actionLabel(pendingAction)}`}
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={() => {
                setPendingAction(null);
                setError(null);
              }}
              className="h-9 rounded-[9px] border border-line bg-surface px-3.5 text-[13px] font-semibold text-ink disabled:opacity-60"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

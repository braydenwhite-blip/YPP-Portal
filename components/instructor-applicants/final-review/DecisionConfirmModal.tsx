"use client";

/**
 * Focus-trapped confirmation modal that mounts at the cockpit root. Renders a
 * shared frame (header / body / footer) plus action-specific children. The
 * modal does NOT call the server itself — `onConfirm` is wired to
 * `useCommitDecision.commit()` upstream. (§8.2)
 */

import { useEffect, useState } from "react";
import type {
  ChairDecisionAction,
  InstructorApplicationStatus,
  InstructorInterviewRecommendation,
} from "@prisma/client";
import type { ReadinessSignals } from "@/lib/readiness-signals";
import type { FinalReviewWarning } from "@/lib/final-review-warnings";
import { Button, ModalFooterV2, ModalV2 } from "@/components/ui-v2";
import DecisionSummaryCard from "./DecisionSummaryCard";
import RejectReasonCodePicker, { type RejectReasonCode } from "./RejectReasonCodePicker";
import ApproveWithConditionsEditor, {
  type DecisionCondition,
} from "./ApproveWithConditionsEditor";
import ConfirmModalRisks from "./ConfirmModalRisks";
import DecisionEmailEditor, { type DecisionEmailOverride } from "./DecisionEmailEditor";

export interface DecisionConfirmPayload {
  action: ChairDecisionAction;
  rationale: string;
  comparisonNotes: string;
  rejectReasonCode?: RejectReasonCode;
  rejectFreeText?: string;
  conditions?: DecisionCondition[];
  /** One-off inline edit of the decision email, when the chair changed it. */
  emailOverride?: DecisionEmailOverride;
}

export interface DecisionConfirmModalProps {
  open: boolean;
  action: ChairDecisionAction;
  application: {
    id: string;
    displayName: string;
    chapterName: string | null;
    status: InstructorApplicationStatus;
  };
  rationale: string;
  comparisonNotes: string;
  readiness: ReadinessSignals;
  priorDecision: { action: ChairDecisionAction; decidedAt: string } | null;
  consensus: {
    totalReviews: number;
    recommendations: InstructorInterviewRecommendation[];
    redFlagCount: number;
  };
  submitting: boolean;
  error: string | null;
  warnings: FinalReviewWarning[];
  acknowledgements: Record<string, boolean>;
  onToggleAcknowledge: (key: string) => void;
  onCancel: () => void;
  onConfirm: (payload: DecisionConfirmPayload) => void;
}

export default function DecisionConfirmModal(props: DecisionConfirmModalProps) {
  const {
    open,
    action,
    application,
    rationale,
    comparisonNotes,
    readiness,
    priorDecision,
    consensus,
    submitting,
    error,
    onCancel,
    onConfirm,
  } = props;

  const [reasonCode, setReasonCode] = useState<RejectReasonCode | null>(null);
  const [reasonFreeText, setReasonFreeText] = useState<string>("");
  const [conditions, setConditions] = useState<DecisionCondition[]>([]);
  const [emailOverride, setEmailOverride] = useState<DecisionEmailOverride | null>(null);

  useEffect(() => {
    if (!open) {
      setReasonCode(null);
      setReasonFreeText("");
      setConditions([]);
      setEmailOverride(null);
    }
  }, [open]);

  // Mirror the rationale formatting `useCommitDecision` applies before sending,
  // so the email preview/resolve matches exactly what the applicant receives.
  const formattedRationale =
    action === "REJECT" && reasonCode
      ? `[${reasonCode}] ${reasonFreeText.trim() || rationale.trim()}`
      : rationale;

  const requiresReason = action === "REJECT";
  const requiresRationale = action === "REJECT" || action === "REQUEST_INFO";
  const requiresConditions = action === "APPROVE_WITH_CONDITIONS";

  const reasonOk =
    !requiresReason ||
    (reasonCode !== null && (reasonCode !== "OTHER" || reasonFreeText.trim().length > 0));
  const rationaleOk = !requiresRationale || rationale.trim().length > 0;
  const conditionsOk = !requiresConditions || conditions.length > 0;
  const allHighRiskAcknowledged = props.warnings
    .filter((w) => w.severity === "HIGH_RISK")
    .every((w) => props.acknowledgements[w.key] === true);
  const canConfirm =
    reasonOk && rationaleOk && conditionsOk && allHighRiskAcknowledged && !submitting;

  function handleConfirm() {
    if (!canConfirm) return;
    onConfirm({
      action,
      rationale,
      comparisonNotes,
      rejectReasonCode: reasonCode ?? undefined,
      rejectFreeText: reasonCode === "OTHER" ? reasonFreeText.trim() : undefined,
      conditions: requiresConditions ? conditions : undefined,
      emailOverride: emailOverride ?? undefined,
    });
  }

  return (
    <ModalV2
      open={open}
      onClose={onCancel}
      locked={submitting}
      size="lg"
      labelledBy="confirm-modal-title"
      motionKey="confirm"
    >
      <DecisionSummaryCard
        action={action}
        applicantDisplayName={application.displayName}
        chapterName={application.chapterName}
        rationale={rationale}
        readiness={readiness}
        priorDecision={priorDecision}
        consensus={consensus}
        rejectReasonCode={reasonCode}
        rejectFreeText={reasonCode === "OTHER" ? reasonFreeText : undefined}
      />
      <ConfirmModalRisks
        warnings={props.warnings}
        acknowledgements={props.acknowledgements}
        onToggleAcknowledge={props.onToggleAcknowledge}
      />
      {requiresReason ? (
        <RejectReasonCodePicker
          reasonCode={reasonCode}
          freeText={reasonFreeText}
          onChange={(code, free) => {
            setReasonCode(code);
            setReasonFreeText(free);
          }}
        />
      ) : null}
      {requiresConditions ? (
        <ApproveWithConditionsEditor
          conditions={conditions}
          onChange={setConditions}
        />
      ) : null}
      {requiresRationale && rationale.trim().length === 0 ? (
        <p className="m-0 text-[12px] text-danger-700">
          Add a rationale in the dock before continuing — it&apos;s required for this action.
        </p>
      ) : null}
      <DecisionEmailEditor
        applicationId={application.id}
        action={action}
        rationale={formattedRationale}
        onOverrideChange={setEmailOverride}
      />
      {error ? (
        <p
          role="alert"
          className="m-0 rounded-[10px] bg-danger-100 p-2.5 text-[13px] text-danger-700"
        >
          {error}
        </p>
      ) : null}
      <ModalFooterV2>
        <Button variant="secondary" size="sm" disabled={submitting} onClick={onCancel}>
          Cancel
        </Button>
        <Button variant="primary" size="sm" onClick={handleConfirm} disabled={!canConfirm}>
          {submitting ? "Recording…" : "Confirm decision"}
        </Button>
      </ModalFooterV2>
    </ModalV2>
  );
}

"use client";

/**
 * Focus-trapped confirmation modal that mounts at the cockpit root. Renders a
 * shared frame (header / body / footer) plus action-specific children. The
 * modal does NOT call the server itself — `onConfirm` is wired to
 * `useCommitDecision.commit()` upstream. (§8.2)
 */

import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type {
  ChairDecisionAction,
  InstructorApplicationStatus,
  InstructorInterviewRecommendation,
} from "@prisma/client";
import type { ReadinessSignals } from "@/lib/readiness-signals";
import type { FinalReviewWarning } from "@/lib/final-review-warnings";
import DecisionSummaryCard from "./DecisionSummaryCard";
import RejectReasonCodePicker, { type RejectReasonCode } from "./RejectReasonCodePicker";
import ApproveWithConditionsEditor, {
  type DecisionCondition,
} from "./ApproveWithConditionsEditor";
import ConfirmModalRisks from "./ConfirmModalRisks";

export interface DecisionConfirmPayload {
  action: ChairDecisionAction;
  rationale: string;
  comparisonNotes: string;
  rejectReasonCode?: RejectReasonCode;
  rejectFreeText?: string;
  conditions?: DecisionCondition[];
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
  const dialogRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) {
      setReasonCode(null);
      setReasonFreeText("");
      setConditions([]);
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape" && !submitting) onCancel();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, submitting, onCancel]);

  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement as HTMLElement | null;
    dialogRef.current?.focus();
    return () => previous?.focus?.();
  }, [open]);

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
    });
  }

  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          key="confirm-backdrop"
          className="cockpit-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(15, 7, 36, 0.5)",
            backdropFilter: "blur(10px)",
            zIndex: 60,
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "center",
            padding: "5vh 20px",
            overflowY: "auto",
          }}
          onClick={() => {
            if (!submitting) onCancel();
          }}
        >
          <motion.div
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="confirm-modal-title"
            tabIndex={-1}
            initial={{ scale: 0.96, y: 16, opacity: 0 }}
            animate={{ scale: 1, y: 0, opacity: 1 }}
            exit={{ scale: 0.96, y: 16, opacity: 0 }}
            transition={{ type: "spring", stiffness: 240, damping: 26 }}
            onClick={(event) => event.stopPropagation()}
            style={{
              maxWidth: 640,
              width: "100%",
              background: "var(--cockpit-surface, #fff)",
              borderRadius: 16,
              padding: 24,
              boxShadow: "0 24px 60px rgba(15, 7, 36, 0.32)",
              display: "flex",
              flexDirection: "column",
              gap: 16,
            }}
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
              <p style={{ margin: 0, fontSize: 12, color: "#b91c1c" }}>
                Add a rationale in the dock before continuing — it&apos;s required for this action.
              </p>
            ) : null}
            {error ? (
              <p
                role="alert"
                style={{
                  margin: 0,
                  padding: 10,
                  borderRadius: 10,
                  background: "rgba(239, 68, 68, 0.1)",
                  color: "#b91c1c",
                  fontSize: 13,
                }}
              >
                {error}
              </p>
            ) : null}
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
              <button
                type="button"
                disabled={submitting}
                onClick={onCancel}
                style={{
                  padding: "8px 14px",
                  borderRadius: 8,
                  border: "1px solid var(--cockpit-line, rgba(71,85,105,0.2))",
                  background: "var(--cockpit-surface, #fff)",
                  cursor: submitting ? "not-allowed" : "pointer",
                  fontSize: 13,
                  fontWeight: 600,
                  opacity: submitting ? 0.5 : 1,
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirm}
                disabled={!canConfirm}
                style={{
                  padding: "8px 14px",
                  borderRadius: 8,
                  border: "1px solid var(--ypp-purple-600, #6b21c8)",
                  background: canConfirm ? "var(--ypp-purple-600, #6b21c8)" : "rgba(107, 33, 200, 0.4)",
                  color: "#fff",
                  cursor: canConfirm ? "pointer" : "not-allowed",
                  fontSize: 13,
                  fontWeight: 600,
                }}
              >
                {submitting ? "Recording…" : "Confirm decision"}
              </button>
            </div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}

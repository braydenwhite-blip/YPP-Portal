"use client";

/**
 * Validation-error surface for the cockpit. Replaces the inline error chip
 * from Phase 2D for `chairDecide()` validation rejections, with a
 * jump-to-field affordance keyed to the offending field. (§10.4)
 */

import { useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { AlertTriangleIcon } from "./cockpit-icons";

export type CommitValidationField =
  | "rationale"
  | "rejectReasonCode"
  | "rejectFreeText"
  | "conditions";

export interface CommitErrorModalProps {
  open: boolean;
  code: string | null;
  message: string;
  field: CommitValidationField | null;
  fieldIndex?: number;
  onJumpToField: (field: CommitValidationField, fieldIndex?: number) => void;
  onDismiss: () => void;
}

const CODE_TITLE: Record<string, string> = {
  REJECT_REASON_REQUIRED: "Pick a reason code before rejecting.",
  RATIONALE_TOO_LONG: "Your rationale is over the 10 000 character limit.",
  CONDITIONS_REQUIRED: "Add at least one condition before approving with conditions.",
  CONDITION_LABEL_INVALID: "A condition is missing a label.",
  CONDITION_LABEL_TOO_LONG: "A condition label is too long.",
  CONDITION_OWNER_NOT_FOUND: "A condition owner couldn't be found.",
  TOO_MANY_CONDITIONS: "Conditions are capped at 10 — remove some before saving.",
  CONTRARIAN_OVERRIDE_MISSING: "Acknowledge the warning before continuing.",
  VALIDATION: "We couldn't save this decision.",
};

export default function CommitErrorModal(props: CommitErrorModalProps) {
  const dialogRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!props.open) return;
    const previous = document.activeElement as HTMLElement | null;
    dialogRef.current?.focus();
    return () => previous?.focus?.();
  }, [props.open]);

  const title =
    (props.code && CODE_TITLE[props.code]) || "We couldn't save this decision.";

  return (
    <AnimatePresence>
      {props.open ? (
        <motion.div
          key="commit-err-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
          onClick={props.onDismiss}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(15, 7, 36, 0.4)",
            backdropFilter: "blur(8px)",
            zIndex: 65,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 20,
          }}
        >
          <motion.div
            ref={dialogRef}
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="commit-err-title"
            tabIndex={-1}
            initial={{ scale: 0.96, y: 12, opacity: 0 }}
            animate={{ scale: 1, y: 0, opacity: 1 }}
            exit={{ scale: 0.96, y: 12, opacity: 0 }}
            transition={{ type: "spring", stiffness: 240, damping: 26 }}
            onClick={(event) => event.stopPropagation()}
            style={{
              maxWidth: 460,
              width: "100%",
              background: "var(--cockpit-surface, #fff)",
              borderRadius: 16,
              padding: 22,
              boxShadow: "0 24px 60px rgba(15, 7, 36, 0.32)",
              borderTop: "4px solid var(--score-mixed, #eab308)",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 8, color: "#a16207" }}>
              <AlertTriangleIcon size={20} />
              <h2 id="commit-err-title" style={{ margin: 0, fontSize: 17, color: "var(--ink-default, #1a0533)" }}>
                {title}
              </h2>
            </div>
            <p style={{ marginTop: 10, fontSize: 13, color: "var(--ink-muted, #6b5f7a)" }}>
              {props.message}
            </p>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 18 }}>
              <button
                type="button"
                onClick={props.onDismiss}
                style={{
                  padding: "8px 14px",
                  borderRadius: 8,
                  border: "1px solid var(--cockpit-line, rgba(71,85,105,0.2))",
                  background: "var(--cockpit-surface, #fff)",
                  cursor: "pointer",
                  fontSize: 13,
                  fontWeight: 600,
                }}
              >
                Cancel
              </button>
              {props.field ? (
                <button
                  type="button"
                  onClick={() => props.field && props.onJumpToField(props.field, props.fieldIndex)}
                  style={{
                    padding: "8px 14px",
                    borderRadius: 8,
                    border: "1px solid #b45309",
                    background: "#b45309",
                    color: "#fff",
                    cursor: "pointer",
                    fontSize: 13,
                    fontWeight: 600,
                  }}
                >
                  Fix {fieldLabel(props.field, props.fieldIndex)}
                </button>
              ) : null}
            </div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}

function fieldLabel(field: CommitValidationField, idx?: number): string {
  switch (field) {
    case "rationale":
      return "rationale";
    case "rejectReasonCode":
      return "reason code";
    case "rejectFreeText":
      return "rejection text";
    case "conditions":
      return idx !== undefined ? `condition #${idx + 1}` : "conditions";
  }
}

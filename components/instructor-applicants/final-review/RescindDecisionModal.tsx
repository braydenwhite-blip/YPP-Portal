"use client";

/**
 * SUPER_ADMIN-only confirmation flow for rescinding the most recent chair
 * decision. Captures a required reason that lands in the audit timeline.
 * Wired to `rescindChairDecision()` server action.
 */

import { useEffect, useRef, useState, useTransition } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { ChairDecisionAction } from "@prisma/client";
import { useRouter } from "next/navigation";
import { rescindChairDecision } from "@/lib/instructor-application-actions";
import { AlertTriangleIcon } from "./cockpit-icons";

const ACTION_LABEL: Record<ChairDecisionAction, string> = {
  APPROVE: "Approval",
  APPROVE_WITH_CONDITIONS: "Approval with conditions",
  REJECT: "Rejection",
  HOLD: "Hold",
  WAITLIST: "Waitlist",
  REQUEST_INFO: "Info request",
  REQUEST_SECOND_INTERVIEW: "Second interview",
};

export interface RescindDecisionModalProps {
  open: boolean;
  applicationId: string;
  applicantName: string;
  decision: { action: ChairDecisionAction; decidedAt: string; chairName: string | null } | null;
  onCancel: () => void;
  onSuccess?: () => void;
}

export default function RescindDecisionModal(props: RescindDecisionModalProps) {
  const router = useRouter();
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    if (!props.open) {
      setReason("");
      setError(null);
    }
  }, [props.open]);

  useEffect(() => {
    if (!props.open) return;
    const previous = document.activeElement as HTMLElement | null;
    dialogRef.current?.focus();
    return () => previous?.focus?.();
  }, [props.open]);

  function handleSubmit() {
    if (reason.trim().length === 0) {
      setError("Add a rescind reason — it goes in the audit trail.");
      return;
    }
    setError(null);
    const formData = new FormData();
    formData.set("applicationId", props.applicationId);
    formData.set("reason", reason);
    startTransition(async () => {
      const result = await rescindChairDecision(formData);
      if (!result.success) {
        setError(result.error ?? "Could not rescind the decision.");
        return;
      }
      props.onSuccess?.();
      props.onCancel();
      router.refresh();
    });
  }

  return (
    <AnimatePresence>
      {props.open ? (
        <motion.div
          key="rescind-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
          onClick={() => {
            if (!pending) props.onCancel();
          }}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(15, 7, 36, 0.46)",
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
            role="dialog"
            aria-modal="true"
            aria-labelledby="rescind-title"
            tabIndex={-1}
            initial={{ scale: 0.96, y: 16, opacity: 0 }}
            animate={{ scale: 1, y: 0, opacity: 1 }}
            exit={{ scale: 0.96, y: 16, opacity: 0 }}
            transition={{ type: "spring", stiffness: 240, damping: 26 }}
            onClick={(event) => event.stopPropagation()}
            style={{
              maxWidth: 520,
              width: "100%",
              background: "var(--cockpit-surface, #fff)",
              borderRadius: 16,
              padding: 22,
              boxShadow: "0 24px 60px rgba(15, 7, 36, 0.32)",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 8, color: "#b91c1c" }}>
              <AlertTriangleIcon size={22} />
              <h2 id="rescind-title" style={{ margin: 0, fontSize: 18, color: "var(--ink-default, #1a0533)" }}>
                Rescind decision for {props.applicantName}
              </h2>
            </div>
            <p style={{ marginTop: 10, fontSize: 13, color: "var(--ink-muted, #6b5f7a)", lineHeight: 1.5 }}>
              {props.decision ? (
                <>
                  This supersedes the prior <strong>{ACTION_LABEL[props.decision.action]}</strong>
                  {props.decision.chairName ? <> by {props.decision.chairName}</> : null} from{" "}
                  {new Date(props.decision.decidedAt).toLocaleDateString()}. The application returns
                  to <strong>chair review</strong>; if the decision was an approval, the
                  applicant&apos;s INSTRUCTOR role is revoked.
                </>
              ) : (
                "No active decision to rescind."
              )}
            </p>
            <label
              style={{
                display: "block",
                marginTop: 14,
                fontSize: 12,
                fontWeight: 600,
                color: "var(--ink-default, #1a0533)",
              }}
            >
              Rescind reason (required, in audit trail)
              <textarea
                value={reason}
                onChange={(event) => setReason(event.target.value.slice(0, 2000))}
                rows={4}
                placeholder="Why is this decision being rescinded? Be specific — this goes on the record."
                style={{
                  width: "100%",
                  marginTop: 6,
                  padding: 10,
                  fontSize: 13,
                  borderRadius: 10,
                  border: "1px solid var(--cockpit-line, rgba(71,85,105,0.22))",
                  fontFamily: "inherit",
                  resize: "vertical",
                }}
              />
              <span style={{ fontSize: 11, color: "var(--ink-muted, #6b5f7a)" }}>
                {reason.length} / 2 000
              </span>
            </label>
            {error ? (
              <p
                role="alert"
                style={{
                  margin: "10px 0 0",
                  padding: 8,
                  borderRadius: 8,
                  background: "rgba(239, 68, 68, 0.1)",
                  color: "#b91c1c",
                  fontSize: 12,
                }}
              >
                {error}
              </p>
            ) : null}
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 16 }}>
              <button
                type="button"
                onClick={props.onCancel}
                disabled={pending}
                style={{
                  padding: "8px 14px",
                  borderRadius: 8,
                  border: "1px solid var(--cockpit-line, rgba(71,85,105,0.2))",
                  background: "var(--cockpit-surface, #fff)",
                  cursor: pending ? "not-allowed" : "pointer",
                  fontSize: 13,
                  fontWeight: 600,
                  opacity: pending ? 0.6 : 1,
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSubmit}
                disabled={pending || !props.decision || reason.trim().length === 0}
                style={{
                  padding: "8px 14px",
                  borderRadius: 8,
                  border: "1px solid #b91c1c",
                  background: pending || reason.trim().length === 0 ? "rgba(185, 28, 28, 0.5)" : "#b91c1c",
                  color: "#fff",
                  cursor: pending || reason.trim().length === 0 ? "not-allowed" : "pointer",
                  fontSize: 13,
                  fontWeight: 600,
                }}
              >
                {pending ? "Rescinding…" : "Rescind decision"}
              </button>
            </div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}

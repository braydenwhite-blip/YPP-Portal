"use client";

/**
 * Highest-severity surface for the chair cockpit. Tells the chair, without
 * ambiguity, that their decision was committed and then automatically
 * reversed because the workflow-sync step failed. (§10.2)
 */

import { useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { ChairDecisionAction } from "@prisma/client";
import { AlertOctagonIcon } from "./cockpit-icons";

const ACTION_LABEL: Record<ChairDecisionAction, string> = {
  APPROVE: "Approve",
  REJECT: "Reject",
  HOLD: "Hold",
  REQUEST_INFO: "Request info",
  REQUEST_SECOND_INTERVIEW: "Second interview",
};

export interface SyncRollbackBannerProps {
  open: boolean;
  applicationId: string;
  applicantName: string;
  rolledBackAction: ChairDecisionAction;
  reversedAt: string;
  reason: string;
  idempotencyKey: string;
  chairId: string;
  onRetry: () => void;
}

function buildDiagnostic(props: SyncRollbackBannerProps): string {
  return [
    `Application: ${props.applicationId}`,
    `Applicant:   ${props.applicantName}`,
    `Action:      ${props.rolledBackAction}`,
    `Reversed at: ${props.reversedAt}`,
    `Reason:      ${props.reason}`,
    `Chair:       ${props.chairId}`,
    `Idempotency: ${props.idempotencyKey}`,
  ].join("\n");
}

export default function SyncRollbackBanner(props: SyncRollbackBannerProps) {
  const retryButtonRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (props.open) retryButtonRef.current?.focus();
  }, [props.open]);

  function handleContactSupport() {
    const diagnostic = buildDiagnostic(props);
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(diagnostic).catch(() => {
        /* clipboard denied — chair can fall back to manual paste */
      });
    }
    if (typeof window !== "undefined") {
      const subject = encodeURIComponent(
        `Chair decision rollback — ${props.applicationId}`
      );
      const body = encodeURIComponent(
        `Decision was reversed.\n\n${diagnostic}\n\n[paste anything else here]`
      );
      window.open(`mailto:support@youthpassionproject.org?subject=${subject}&body=${body}`);
    }
  }

  return (
    <AnimatePresence>
      {props.open ? (
        <motion.div
          key="sync-rollback-banner"
          role="alert"
          aria-live="assertive"
          initial={{ y: -16, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -16, opacity: 0 }}
          transition={{ type: "spring", stiffness: 220, damping: 26 }}
          style={{
            position: "sticky",
            top: 0,
            zIndex: 70,
            display: "flex",
            alignItems: "flex-start",
            gap: 12,
            padding: "14px 24px",
            background: "rgba(239, 68, 68, 0.06)",
            borderBottom: "1px solid rgba(239, 68, 68, 0.4)",
            borderLeft: "8px solid var(--score-weak, #ef4444)",
            color: "#7f1d1d",
          }}
        >
          <AlertOctagonIcon size={22} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ margin: 0, fontSize: 14, fontWeight: 700 }}>
              Decision was reversed.
            </p>
            <p style={{ margin: "4px 0 0", fontSize: 13, lineHeight: 1.45 }}>
              We couldn&apos;t finalise &ldquo;{ACTION_LABEL[props.rolledBackAction]}&rdquo;
              for <strong>{props.applicantName}</strong> because the onboarding pipeline
              didn&apos;t update. The decision record was removed and the applicant is
              back in your queue.
            </p>
            <p
              style={{
                margin: "4px 0 0",
                fontSize: 12,
                color: "#991b1b",
                fontFamily: "var(--font-mono, ui-monospace, monospace)",
              }}
            >
              {props.reason}
            </p>
            <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
              <button
                ref={retryButtonRef}
                type="button"
                onClick={props.onRetry}
                style={{
                  padding: "6px 12px",
                  borderRadius: 8,
                  border: "1px solid #b91c1c",
                  background: "#b91c1c",
                  color: "#fff",
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                Retry decision
              </button>
              <button
                type="button"
                onClick={handleContactSupport}
                style={{
                  padding: "6px 12px",
                  borderRadius: 8,
                  border: "1px solid rgba(239, 68, 68, 0.4)",
                  background: "transparent",
                  color: "#7f1d1d",
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                Contact support
              </button>
            </div>
          </div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}

"use client";

/**
 * Modal shown to the chair who lost a race against another chair on the same
 * applicant. Surfaces who won, what they decided, a rationale preview, and
 * routes the chair forward without ambiguity. (§10.3)
 */

import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useRouter } from "next/navigation";
import type { ChairDecisionAction } from "@prisma/client";
import { AlertTriangleIcon } from "./cockpit-icons";

const ACTION_LABEL: Record<ChairDecisionAction, string> = {
  APPROVE: "Approved",
  REJECT: "Rejected",
  HOLD: "Placed on hold",
  REQUEST_INFO: "Requested info",
  REQUEST_SECOND_INTERVIEW: "Sent to second interview",
};

export interface StaleClickRecoveryModalProps {
  open: boolean;
  applicantName: string;
  attemptedAction: ChairDecisionAction;
  winnerChairName: string | null;
  winnerAction: ChairDecisionAction | null;
  winnerDecidedAt: string | null;
  winnerRationalePreview: string | null;
  onAcknowledge: () => void;
  backToQueueHref: string;
}

function relativeTime(iso: string | null): string {
  if (!iso) return "moments ago";
  const ts = new Date(iso).getTime();
  if (Number.isNaN(ts)) return "moments ago";
  const seconds = Math.max(0, Math.floor((Date.now() - ts) / 1000));
  if (seconds < 60) return `${seconds || "a few"} seconds ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? "" : "s"} ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  const days = Math.floor(hours / 24);
  return `${days} day${days === 1 ? "" : "s"} ago`;
}

export default function StaleClickRecoveryModal(props: StaleClickRecoveryModalProps) {
  const router = useRouter();
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const [showFull, setShowFull] = useState(false);

  useEffect(() => {
    if (!props.open) return;
    const previous = document.activeElement as HTMLElement | null;
    dialogRef.current?.focus();
    return () => previous?.focus?.();
  }, [props.open]);

  const { open, onAcknowledge } = props;
  useEffect(() => {
    if (!open) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") onAcknowledge();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onAcknowledge]);

  function handleContinueAudit() {
    props.onAcknowledge();
    router.refresh();
  }

  function handleBackToQueue() {
    props.onAcknowledge();
    router.push(props.backToQueueHref);
  }

  return (
    <AnimatePresence>
      {props.open ? (
        <motion.div
          key="stale-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
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
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="stale-click-title"
            tabIndex={-1}
            initial={{ scale: 0.96, y: 16, opacity: 0 }}
            animate={{ scale: 1, y: 0, opacity: 1 }}
            exit={{ scale: 0.96, y: 16, opacity: 0 }}
            transition={{ type: "spring", stiffness: 240, damping: 26 }}
            style={{
              maxWidth: 520,
              width: "100%",
              background: "var(--cockpit-surface, #fff)",
              borderRadius: 16,
              padding: 22,
              boxShadow: "0 24px 60px rgba(15, 7, 36, 0.32)",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 8, color: "#b45309" }}>
              <AlertTriangleIcon size={22} />
              <h2 id="stale-click-title" style={{ margin: 0, fontSize: 18, color: "var(--ink-default, #1a0533)" }}>
                This applicant was just decided by another chair.
              </h2>
            </div>
            <p style={{ marginTop: 12, fontSize: 13, color: "var(--ink-default, #1a0533)" }}>
              {props.winnerChairName ? <strong>{props.winnerChairName}</strong> : "Another chair"}{" "}
              marked <strong>{props.applicantName}</strong> as{" "}
              <strong>
                {props.winnerAction ? ACTION_LABEL[props.winnerAction] : "decided"}
              </strong>{" "}
              {relativeTime(props.winnerDecidedAt)}.
            </p>
            {props.winnerRationalePreview ? (
              <blockquote
                style={{
                  margin: "10px 0",
                  padding: "10px 12px",
                  borderLeft: "4px solid var(--ypp-purple-400, #b47fff)",
                  background: "var(--ypp-purple-50, #f3ecff)",
                  fontSize: 12,
                  color: "var(--ink-default, #1a0533)",
                  whiteSpace: "pre-wrap",
                }}
              >
                {showFull
                  ? props.winnerRationalePreview
                  : props.winnerRationalePreview.slice(0, 160)}
                {!showFull && props.winnerRationalePreview.length > 160 ? "…" : ""}
                {props.winnerRationalePreview.length > 160 ? (
                  <button
                    type="button"
                    onClick={() => setShowFull((s) => !s)}
                    style={{
                      marginLeft: 6,
                      background: "none",
                      border: "none",
                      color: "var(--ypp-purple-700, #5a1da8)",
                      fontWeight: 600,
                      cursor: "pointer",
                      fontSize: 12,
                    }}
                  >
                    {showFull ? "Show less" : "Show more"}
                  </button>
                ) : null}
              </blockquote>
            ) : null}
            <p style={{ margin: 0, fontSize: 12, color: "var(--ink-muted, #6b5f7a)" }}>
              Your draft rationale stays in the dock. If the decision is later rescinded, you can pick
              up where you left off.
            </p>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 18 }}>
              <button
                type="button"
                onClick={handleBackToQueue}
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
                Back to queue
              </button>
              <button
                type="button"
                onClick={handleContinueAudit}
                style={{
                  padding: "8px 14px",
                  borderRadius: 8,
                  border: "1px solid var(--ypp-purple-600, #6b21c8)",
                  background: "var(--ypp-purple-600, #6b21c8)",
                  color: "#fff",
                  cursor: "pointer",
                  fontSize: 13,
                  fontWeight: 600,
                }}
              >
                Continue reviewing audit
              </button>
            </div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}

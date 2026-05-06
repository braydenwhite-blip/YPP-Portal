"use client";

/**
 * Sticky banner shown when the client lost the response mid-flight (timeout
 * or `AbortError`). Lets the chair retry safely — the idempotency key in
 * `useCommitDecision` ensures the server replays a prior success or processes
 * fresh if the first attempt never landed. (§10.6)
 */

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { ChairDecisionAction, InstructorApplicationStatus } from "@prisma/client";
import { AlertTriangleIcon } from "./cockpit-icons";

export interface NetworkRecoveryBannerProps {
  open: boolean;
  applicationId: string;
  attemptedAction: ChairDecisionAction;
  attemptedAt: string;
  idempotencyKey: string;
  onRetry: () => void;
  onCheckStatus: () => Promise<InstructorApplicationStatus | null>;
  onResolve: () => void;
}

const ACTION_LABEL: Record<ChairDecisionAction, string> = {
  APPROVE: "approve",
  APPROVE_WITH_CONDITIONS: "approve with conditions",
  REJECT: "reject",
  HOLD: "hold",
  WAITLIST: "waitlist",
  REQUEST_INFO: "request info on",
  REQUEST_SECOND_INTERVIEW: "send to second interview",
};

export default function NetworkRecoveryBanner(props: NetworkRecoveryBannerProps) {
  const [checking, setChecking] = useState(false);
  const [resolved, setResolved] = useState<InstructorApplicationStatus | null>(null);

  async function handleCheckStatus() {
    setChecking(true);
    try {
      const status = await props.onCheckStatus();
      setResolved(status);
      if (status && status !== "CHAIR_REVIEW") {
        // Decision already landed — the cockpit will reload via router.refresh.
        props.onResolve();
      }
    } finally {
      setChecking(false);
    }
  }

  return (
    <AnimatePresence>
      {props.open ? (
        <motion.div
          key="network-banner"
          role="alert"
          aria-live="assertive"
          initial={{ y: -12, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -12, opacity: 0 }}
          transition={{ duration: 0.2 }}
          style={{
            position: "sticky",
            top: 0,
            zIndex: 65,
            display: "flex",
            alignItems: "flex-start",
            gap: 12,
            padding: "12px 24px",
            background: "rgba(234, 179, 8, 0.1)",
            borderBottom: "1px solid rgba(234, 179, 8, 0.36)",
            borderLeft: "6px solid var(--score-mixed, #eab308)",
            color: "#92400e",
          }}
        >
          <AlertTriangleIcon size={20} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ margin: 0, fontSize: 13, fontWeight: 700 }}>
              We couldn&apos;t confirm whether your decision saved.
            </p>
            <p style={{ margin: "4px 0 0", fontSize: 12, lineHeight: 1.45 }}>
              Your connection dropped while trying to {ACTION_LABEL[props.attemptedAction]}. If the
              server already processed it, retrying is safe — we&apos;ll detect the duplicate.
            </p>
            {resolved ? (
              <p style={{ margin: "6px 0 0", fontSize: 12, fontWeight: 600 }}>
                Server says status is now <code>{resolved}</code>.
              </p>
            ) : null}
            <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
              <button
                type="button"
                onClick={props.onRetry}
                style={{
                  padding: "6px 12px",
                  borderRadius: 8,
                  border: "1px solid #b45309",
                  background: "#b45309",
                  color: "#fff",
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                Retry
              </button>
              <button
                type="button"
                disabled={checking}
                onClick={handleCheckStatus}
                style={{
                  padding: "6px 12px",
                  borderRadius: 8,
                  border: "1px solid rgba(234, 179, 8, 0.4)",
                  background: "transparent",
                  color: "#92400e",
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: checking ? "wait" : "pointer",
                  opacity: checking ? 0.6 : 1,
                }}
              >
                {checking ? "Checking…" : "Check status"}
              </button>
              <button
                type="button"
                onClick={props.onResolve}
                style={{
                  padding: "6px 12px",
                  borderRadius: 8,
                  border: "none",
                  background: "transparent",
                  color: "#92400e",
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                Dismiss
              </button>
            </div>
          </div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}

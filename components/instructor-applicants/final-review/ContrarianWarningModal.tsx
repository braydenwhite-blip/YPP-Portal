"use client";

/**
 * Pre-pre-confirm step when the chair's chosen action conflicts with reviewer
 * consensus or with the readiness signals. (§8.6)
 */

import { motion, AnimatePresence } from "framer-motion";
import type { ChairDecisionAction } from "@prisma/client";
import type { ContrarianSignal } from "@/lib/contrarian-signals";
import { AlertTriangleIcon } from "./cockpit-icons";

const ACTION_LABEL: Record<ChairDecisionAction, string> = {
  APPROVE: "approve",
  APPROVE_WITH_CONDITIONS: "approve with conditions",
  REJECT: "reject",
  HOLD: "hold",
  WAITLIST: "waitlist",
  REQUEST_INFO: "request information",
  REQUEST_SECOND_INTERVIEW: "send to second interview",
};

export interface ContrarianWarningModalProps {
  open: boolean;
  signals: ContrarianSignal[];
  action: ChairDecisionAction;
  onCancel: () => void;
  onContinue: () => void;
}

export default function ContrarianWarningModal({
  open,
  signals,
  action,
  onCancel,
  onContinue,
}: ContrarianWarningModalProps) {
  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          key="contrarian-backdrop"
          className="cockpit-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(15, 7, 36, 0.45)",
            backdropFilter: "blur(8px)",
            zIndex: 50,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 20,
          }}
          onClick={onCancel}
        >
          <motion.div
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="contrarian-title"
            initial={{ scale: 0.96, y: 16, opacity: 0 }}
            animate={{ scale: 1, y: 0, opacity: 1 }}
            exit={{ scale: 0.96, y: 16, opacity: 0 }}
            transition={{ type: "spring", stiffness: 240, damping: 26 }}
            onClick={(event) => event.stopPropagation()}
            style={{
              maxWidth: 480,
              width: "100%",
              background: "var(--cockpit-surface, #fff)",
              borderRadius: 16,
              padding: 22,
              boxShadow: "0 24px 60px rgba(15, 7, 36, 0.32)",
            }}
          >
            <div style={{ display: "inline-flex", alignItems: "center", gap: 8, color: "#b45309" }}>
              <AlertTriangleIcon size={22} />
              <h2 id="contrarian-title" style={{ margin: 0, fontSize: 18, color: "var(--ink-default, #1a0533)" }}>
                Your decision conflicts with reviewer feedback
              </h2>
            </div>
            <p style={{ marginTop: 10, fontSize: 13, color: "var(--ink-muted, #6b5f7a)" }}>
              You&apos;re about to {ACTION_LABEL[action]} despite the following signals:
            </p>
            <ul style={{ margin: "10px 0 16px", padding: 0, listStyle: "none" }}>
              {signals.map((signal) => (
                <li
                  key={signal.kind}
                  style={{
                    padding: "10px 12px",
                    background: "rgba(234, 179, 8, 0.1)",
                    borderRadius: 10,
                    marginBottom: 8,
                    fontSize: 13,
                    color: "#92400e",
                  }}
                >
                  <strong style={{ display: "block", color: "#a16207" }}>{signal.message}</strong>
                  {signal.detail ? (
                    <span style={{ display: "block", marginTop: 4, fontSize: 12, color: "#92400e" }}>
                      {signal.detail}
                    </span>
                  ) : null}
                </li>
              ))}
            </ul>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
              <button
                type="button"
                onClick={onCancel}
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
                Go back
              </button>
              <button
                type="button"
                onClick={onContinue}
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
                Continue to confirmation
              </button>
            </div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}

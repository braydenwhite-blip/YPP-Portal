"use client";

/**
 * Confirms the outcome of a notification resend. Bottom-right, non-blocking.
 * (§11.3)
 */

import { useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { CheckIcon, AlertTriangleIcon, XIcon } from "./cockpit-icons";

export interface NotificationResendToastProps {
  open: boolean;
  outcome: "success" | "failure" | null;
  applicantName: string;
  onDismiss: () => void;
  onOpenDiagnostic?: () => void;
}

export default function NotificationResendToast(props: NotificationResendToastProps) {
  const timer = useRef<number | null>(null);

  useEffect(() => {
    if (!props.open || props.outcome !== "success") return;
    timer.current = window.setTimeout(props.onDismiss, 5000);
    return () => {
      if (timer.current) window.clearTimeout(timer.current);
    };
  }, [props.open, props.outcome, props.onDismiss]);

  return (
    <AnimatePresence>
      {props.open && props.outcome ? (
        <motion.div
          key="notif-resend-toast"
          role="status"
          aria-live="polite"
          initial={{ y: 16, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 16, opacity: 0 }}
          transition={{ duration: 0.2 }}
          style={{
            position: "fixed",
            right: 24,
            bottom: 80,
            zIndex: 60,
            background: "var(--cockpit-surface, #fff)",
            borderRadius: 12,
            padding: "12px 16px",
            display: "flex",
            alignItems: "center",
            gap: 10,
            border:
              props.outcome === "success"
                ? "1px solid rgba(22, 163, 74, 0.4)"
                : "1px solid rgba(234, 179, 8, 0.45)",
            boxShadow: "0 12px 36px rgba(15, 7, 36, 0.2)",
            color: "var(--ink-default, #1a0533)",
            fontSize: 13,
            fontWeight: 600,
            maxWidth: 360,
          }}
        >
          {props.outcome === "success" ? (
            <CheckIcon size={18} />
          ) : (
            <AlertTriangleIcon size={18} />
          )}
          <span style={{ flex: 1 }}>
            {props.outcome === "success"
              ? `Decision email resent to ${props.applicantName}`
              : "Resend failed — see diagnostic"}
          </span>
          {props.outcome === "failure" && props.onOpenDiagnostic ? (
            <button
              type="button"
              onClick={props.onOpenDiagnostic}
              style={{
                background: "none",
                border: "none",
                color: "var(--ypp-purple-700, #5a1da8)",
                fontSize: 12,
                fontWeight: 600,
                cursor: "pointer",
                padding: 0,
              }}
            >
              Diagnostic
            </button>
          ) : null}
          <button
            type="button"
            onClick={props.onDismiss}
            aria-label="Dismiss"
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              color: "var(--ink-muted, #6b5f7a)",
              padding: 0,
            }}
          >
            <XIcon size={14} />
          </button>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}

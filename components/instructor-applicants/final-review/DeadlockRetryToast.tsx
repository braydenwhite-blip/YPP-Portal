"use client";

/**
 * Surfaces the auto-retry loop run by `useCommitDecision` when a transient
 * Postgres deadlock fires. Hidden during the happy path; visible only while
 * we're waiting on retry attempts. (§10.5)
 */

import { motion, AnimatePresence } from "framer-motion";

export interface DeadlockRetryToastProps {
  open: boolean;
  attempt: number;
  maxAttempts: number;
}

export default function DeadlockRetryToast({
  open,
  attempt,
  maxAttempts,
}: DeadlockRetryToastProps) {
  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          key="deadlock-toast"
          role="status"
          aria-live="polite"
          initial={{ x: -16, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: -16, opacity: 0 }}
          transition={{ duration: 0.18 }}
          style={{
            position: "fixed",
            left: 24,
            bottom: 140,
            zIndex: 60,
            background: "rgba(234, 179, 8, 0.12)",
            border: "1px solid rgba(234, 179, 8, 0.4)",
            borderRadius: 12,
            padding: "10px 14px",
            color: "#a16207",
            fontSize: 13,
            fontWeight: 600,
            boxShadow: "0 12px 36px rgba(15, 7, 36, 0.18)",
          }}
        >
          Busy moment — retrying… (attempt {attempt} of {maxAttempts})
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}

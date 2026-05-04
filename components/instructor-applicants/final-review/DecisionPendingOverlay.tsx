"use client";

/**
 * Lightweight overlay covering the decision dock during commit. Prevents
 * double-clicks and gives the chair a "system is working" signal. (§9.3)
 */

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

export interface DecisionPendingOverlayProps {
  open: boolean;
}

const MESSAGES: Array<{ at: number; text: string }> = [
  { at: 0, text: "Recording decision…" },
  { at: 800, text: "Finalising…" },
  { at: 3000, text: "Still working — this usually takes 1–2 seconds." },
];

export default function DecisionPendingOverlay({ open }: DecisionPendingOverlayProps) {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (!open) {
      setElapsed(0);
      return;
    }
    const start = Date.now();
    const id = window.setInterval(() => {
      setElapsed(Date.now() - start);
    }, 250);
    return () => window.clearInterval(id);
  }, [open]);

  const message =
    MESSAGES.slice()
      .reverse()
      .find((m) => elapsed >= m.at)?.text ?? MESSAGES[0].text;

  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          key="pending-overlay"
          role="status"
          aria-live="polite"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.12 }}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(255, 255, 255, 0.62)",
            backdropFilter: "blur(4px) saturate(0.92)",
            zIndex: 70,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexDirection: "column",
            gap: 12,
          }}
        >
          <span
            aria-hidden="true"
            style={{
              width: 28,
              height: 28,
              borderRadius: "50%",
              border: "3px solid var(--ypp-purple-600, #6b21c8)",
              borderTopColor: "transparent",
              animation: "cockpit-spin 0.8s linear infinite",
            }}
          />
          <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: "var(--ink-default, #1a0533)" }}>
            {message}
          </p>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}

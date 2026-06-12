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
          className="fixed inset-0 z-[70] flex flex-col items-center justify-center gap-3 bg-[rgba(255,255,255,0.62)] backdrop-blur-[4px] backdrop-saturate-[0.92]"
        >
          <span
            aria-hidden="true"
            className="size-7 animate-spin rounded-full border-[3px] border-brand-600 border-t-transparent"
          />
          <p className="m-0 text-[14px] font-semibold text-ink">{message}</p>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}

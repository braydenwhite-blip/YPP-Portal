"use client";

/**
 * Toast that surfaces after a chair decision commits. Offers the next
 * applicant in the queue with their avatar + chapter; one click advances.
 * Phase 2A ships the shell; Phase 2D wires the trigger.
 */

import { useEffect, useRef } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import type { ChairDecisionAction } from "@prisma/client";
import { ArrowRightIcon, CheckIcon, XIcon } from "./cockpit-icons";

const ACTION_LABEL: Record<ChairDecisionAction, string> = {
  APPROVE: "Approved",
  REJECT: "Rejected",
  HOLD: "Placed on hold",
  REQUEST_INFO: "Requested info",
  REQUEST_SECOND_INTERVIEW: "Sent to second interview",
};

export interface PostDecisionToastProps {
  open: boolean;
  decidedAction: ChairDecisionAction | null;
  decidedApplicantName: string | null;
  next: {
    id: string;
    name: string;
    chapterName: string | null;
    href: string;
  } | null;
  onDismiss: () => void;
  onAdvance?: () => void;
  autoDismissMs?: number;
}

export default function PostDecisionToast({
  open,
  decidedAction,
  decidedApplicantName,
  next,
  onDismiss,
  onAdvance,
  autoDismissMs = 8000,
}: PostDecisionToastProps) {
  const timerRef = useRef<number | null>(null);
  const advanceRef = useRef<HTMLAnchorElement | HTMLButtonElement | null>(null);

  useEffect(() => {
    if (!open) return;
    timerRef.current = window.setTimeout(onDismiss, autoDismissMs);
    advanceRef.current?.focus();
    return () => {
      if (timerRef.current) window.clearTimeout(timerRef.current);
    };
  }, [open, autoDismissMs, onDismiss]);

  const decidedLabel = decidedAction ? ACTION_LABEL[decidedAction] : "Decision recorded";

  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          key="post-decision-toast"
          role="status"
          aria-live="polite"
          initial={{ y: 32, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 16, opacity: 0 }}
          transition={{ type: "spring", stiffness: 220, damping: 26 }}
          onMouseEnter={() => {
            if (timerRef.current) window.clearTimeout(timerRef.current);
          }}
          onMouseLeave={() => {
            if (open) {
              timerRef.current = window.setTimeout(onDismiss, autoDismissMs);
            }
          }}
          style={{
            position: "fixed",
            right: 24,
            bottom: 140,
            zIndex: 60,
            background: "var(--cockpit-surface, #fff)",
            borderRadius: 16,
            boxShadow: "0 18px 48px rgba(59, 15, 110, 0.22)",
            padding: 16,
            minWidth: 320,
            maxWidth: 420,
            border: "1px solid var(--cockpit-line, rgba(71,85,105,0.18))",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
            <span
              style={{
                width: 28,
                height: 28,
                borderRadius: "50%",
                background: "rgba(22, 163, 74, 0.16)",
                color: "#15803d",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
              }}
              aria-hidden="true"
            >
              <CheckIcon size={16} />
            </span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: "var(--ink-default, #1a0533)" }}>
                {decidedLabel}
                {decidedApplicantName ? ` — ${decidedApplicantName}` : ""}
              </p>
              <p style={{ margin: 0, fontSize: 12, color: "var(--ink-muted, #6b5f7a)" }}>
                Email queued · audit recorded
              </p>
            </div>
            <button
              type="button"
              onClick={onDismiss}
              aria-label="Dismiss"
              style={{
                background: "none",
                border: "none",
                cursor: "pointer",
                color: "var(--ink-muted, #6b5f7a)",
                padding: 4,
              }}
            >
              <XIcon size={14} />
            </button>
          </div>
          {next ? (
            <Link
              ref={advanceRef as React.RefObject<HTMLAnchorElement>}
              href={next.href}
              prefetch
              onClick={onAdvance}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: "10px 12px",
                background: "var(--ypp-purple-50, #f3ecff)",
                borderRadius: 12,
                textDecoration: "none",
                color: "var(--ypp-purple-700, #5a1da8)",
                fontSize: 13,
                fontWeight: 600,
              }}
            >
              <span
                aria-hidden="true"
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: "50%",
                  background:
                    "linear-gradient(135deg, var(--ypp-purple-500, #8b3fe8), var(--ypp-purple-600, #6b21c8))",
                  color: "#fff",
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontWeight: 600,
                  fontSize: 11,
                }}
              >
                {next.name
                  .split(/\s+/)
                  .slice(0, 2)
                  .map((p) => p[0]?.toUpperCase() ?? "")
                  .join("")}
              </span>
              <span style={{ flex: 1, minWidth: 0 }}>
                <span style={{ display: "block" }}>Next: {next.name}</span>
                <span style={{ display: "block", fontWeight: 400, color: "var(--ink-muted, #6b5f7a)", fontSize: 12 }}>
                  {next.chapterName ?? "Chapter unknown"}
                </span>
              </span>
              <ArrowRightIcon size={16} />
            </Link>
          ) : (
            <p
              style={{
                margin: 0,
                padding: "10px 12px",
                background: "var(--ypp-purple-50, #f3ecff)",
                borderRadius: 12,
                fontSize: 13,
                color: "var(--ypp-purple-700, #5a1da8)",
                fontWeight: 600,
              }}
            >
              Queue cleared — nice work.
            </p>
          )}
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}

"use client";

/**
 * Inline drawer beneath the cockpit's NotificationFailureBanner. Surfaces
 * the raw error chain so chairs can copy a diagnostic block to support
 * without screenshotting and narrating. (§11.5)
 */

import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { ChairDecisionAction } from "@prisma/client";
import type { NotificationAttempt } from "@/lib/final-review-queries";

export interface NotificationDiagnosticDrawerProps {
  open: boolean;
  applicationId: string;
  applicantName: string;
  applicantEmail: string;
  decidedAction: ChairDecisionAction | null;
  attempts: NotificationAttempt[];
  onClose: () => void;
  onCopyTracked?: () => void;
}

function formatAttempts(attempts: NotificationAttempt[]): string {
  return attempts
    .map((a, i) => {
      const idx = attempts.length - i;
      const result = a.kind === "NOTIFICATION_FAILED" ? "FAILED" : "RESENT";
      return `  ${idx} | ${a.at} | ${result}\n      ${a.error ?? a.emailKind ?? ""}`.trimEnd();
    })
    .join("\n");
}

export default function NotificationDiagnosticDrawer(props: NotificationDiagnosticDrawerProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!props.open) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") props.onClose();
    }
    function onClick(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        props.onClose();
      }
    }
    window.addEventListener("keydown", onKey);
    window.addEventListener("mousedown", onClick);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("mousedown", onClick);
    };
  }, [props]);

  const diagnostic =
    `Application: ${props.applicationId}\n` +
    `Applicant:   ${props.applicantEmail} (${props.applicantName})\n` +
    `Action:      ${props.decidedAction ?? "—"}\n\n` +
    `Attempts (most recent first):\n` +
    (props.attempts.length > 0 ? formatAttempts(props.attempts) : "  (none recorded)");

  function handleCopy() {
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard
        .writeText(diagnostic)
        .then(() => {
          setCopied(true);
          props.onCopyTracked?.();
          window.setTimeout(() => setCopied(false), 2000);
        })
        .catch(() => {
          /* ignore clipboard denial — chair can manually select */
        });
    }
  }

  return (
    <AnimatePresence>
      {props.open ? (
        <motion.div
          key="diag-drawer"
          ref={containerRef}
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: "auto", opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          transition={{ duration: 0.18 }}
          style={{
            overflow: "hidden",
            borderLeft: "4px solid var(--cockpit-line, rgba(71,85,105,0.18))",
            background: "var(--cockpit-surface-strong, #faf8ff)",
          }}
        >
          <div
            style={{
              padding: "12px 16px",
              fontFamily: "ui-monospace, SFMono-Regular, monospace",
              fontSize: 12,
              color: "var(--ink-default, #1a0533)",
              whiteSpace: "pre-wrap",
              wordBreak: "break-word",
            }}
          >
            {diagnostic}
          </div>
          <div
            style={{
              display: "flex",
              justifyContent: "flex-end",
              gap: 8,
              padding: "0 16px 12px",
            }}
          >
            <button
              type="button"
              onClick={handleCopy}
              style={{
                padding: "4px 10px",
                fontSize: 12,
                fontWeight: 600,
                borderRadius: 6,
                border: "1px solid var(--cockpit-line, rgba(71,85,105,0.2))",
                background: "var(--cockpit-surface, #fff)",
                color: "var(--ink-default, #1a0533)",
                cursor: "pointer",
              }}
            >
              {copied ? "Copied" : "Copy diagnostic"}
            </button>
            <button
              type="button"
              onClick={props.onClose}
              style={{
                padding: "4px 10px",
                fontSize: 12,
                fontWeight: 600,
                borderRadius: 6,
                border: "none",
                background: "transparent",
                color: "var(--ink-muted, #6b5f7a)",
                cursor: "pointer",
              }}
            >
              Close
            </button>
          </div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}

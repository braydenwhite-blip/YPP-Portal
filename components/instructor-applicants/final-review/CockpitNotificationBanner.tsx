"use client";

/**
 * Cockpit-flavoured notification failure banner.
 *
 * The legacy `NotificationFailureBanner` is kept intact for the public
 * application status page; this component is the cockpit equivalent with
 * aging severity (§11.4), the diagnostic drawer (§11.5), and inline rate
 * limit feedback. Mounted at the cockpit page top when
 * `lastNotificationError != null`.
 */

import { useEffect, useState, useTransition } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { ChairDecisionAction } from "@prisma/client";
import type { NotificationAttempt } from "@/lib/final-review-queries";
import {
  computeAgingSeverity,
  severityBackground,
  severityBorderColor,
} from "@/lib/notification-aging";
import { resendChairDecisionEmail } from "@/lib/instructor-application-actions";
import { useRouter } from "next/navigation";
import NotificationDiagnosticDrawer from "./NotificationDiagnosticDrawer";
import { AlertTriangleIcon, ChevronDownIcon } from "./cockpit-icons";

export interface CockpitNotificationBannerProps {
  applicationId: string;
  applicantName: string;
  applicantEmail: string;
  decidedAction: ChairDecisionAction | null;
  lastNotificationError: string;
  lastNotificationErrorAt: string;
  attempts: NotificationAttempt[];
  onResendOutcome?: (outcome: "success" | "failure") => void;
}

export default function CockpitNotificationBanner(props: CockpitNotificationBannerProps) {
  const router = useRouter();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [, force] = useState(0);
  const [pending, startTransition] = useTransition();
  const [, setLastResendError] = useState<string | null>(null);

  useEffect(() => {
    const id = window.setInterval(() => force((n) => n + 1), 60_000);
    return () => window.clearInterval(id);
  }, []);

  function handleResend() {
    setLastResendError(null);
    startTransition(async () => {
      try {
        const result = await resendChairDecisionEmail(props.applicationId);
        if (result.ok) {
          props.onResendOutcome?.("success");
          router.refresh();
        } else {
          setLastResendError(result.error ?? "Resend failed.");
          props.onResendOutcome?.("failure");
        }
      } catch (err) {
        setLastResendError(err instanceof Error ? err.message : "Resend failed.");
        props.onResendOutcome?.("failure");
      }
    });
  }

  const aging = computeAgingSeverity(props.lastNotificationErrorAt);
  const failedCount = props.attempts.filter((a) => a.kind === "NOTIFICATION_FAILED").length;
  const succeededCount = props.attempts.filter((a) => a.kind === "NOTIFICATION_RESENT").length;

  return (
    <AnimatePresence>
      <motion.section
        key="cockpit-notification-banner"
        role="alert"
        aria-live="polite"
        initial={{ y: -8, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: -8, opacity: 0 }}
        transition={{ duration: 0.2 }}
        style={{
          display: "flex",
          alignItems: "flex-start",
          gap: 12,
          padding: "12px 24px",
          background: severityBackground(aging.severity),
          borderLeft: `6px solid ${severityBorderColor(aging.severity)}`,
          borderBottom: "1px solid var(--cockpit-line, rgba(71,85,105,0.16))",
          position: "sticky",
          top: 0,
          zIndex: 65,
          flexDirection: "column",
        }}
      >
        <div style={{ display: "flex", alignItems: "flex-start", gap: 12, width: "100%" }}>
          <AlertTriangleIcon size={20} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: "var(--ink-default, #1a0533)" }}>
              Decision email didn&apos;t reach{" "}
              <span style={{ fontWeight: 600 }}>{props.applicantName}</span>
              <span style={{ color: "var(--ink-muted, #6b5f7a)", fontWeight: 400 }}>
                {" "}({props.applicantEmail})
              </span>
            </p>
            <p style={{ margin: "4px 0 0", fontSize: 12, color: "var(--ink-muted, #6b5f7a)" }}>
              {aging.copyHint}. Retry history: {failedCount} failed, {succeededCount} succeeded.
            </p>
            <p
              style={{
                margin: "4px 0 0",
                fontSize: 11,
                color: "var(--ink-muted, #6b5f7a)",
                fontFamily: "ui-monospace, SFMono-Regular, monospace",
                wordBreak: "break-word",
              }}
            >
              {props.lastNotificationError}
            </p>
            <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
              <button
                type="button"
                onClick={handleResend}
                disabled={pending}
                style={{
                  padding: "6px 12px",
                  borderRadius: 8,
                  border: "1px solid var(--ypp-purple-600, #6b21c8)",
                  background: pending ? "rgba(107, 33, 200, 0.5)" : "var(--ypp-purple-600, #6b21c8)",
                  color: "#fff",
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: pending ? "wait" : "pointer",
                }}
              >
                {pending ? "Sending…" : "Resend"}
              </button>
              <button
                type="button"
                onClick={() => setDrawerOpen((s) => !s)}
                aria-expanded={drawerOpen}
                style={{
                  padding: "6px 10px",
                  borderRadius: 8,
                  border: "1px solid var(--cockpit-line, rgba(71,85,105,0.2))",
                  background: "transparent",
                  color: "var(--ink-default, #1a0533)",
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: "pointer",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 4,
                }}
              >
                Diagnostic <ChevronDownIcon size={12} />
              </button>
            </div>
          </div>
        </div>
        <NotificationDiagnosticDrawer
          open={drawerOpen}
          applicationId={props.applicationId}
          applicantName={props.applicantName}
          applicantEmail={props.applicantEmail}
          decidedAction={props.decidedAction}
          attempts={props.attempts}
          onClose={() => setDrawerOpen(false)}
        />
      </motion.section>
    </AnimatePresence>
  );
}

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
import type { ChairDecisionAction } from "@prisma/client";
import type { NotificationAttempt } from "@/lib/final-review-queries";
import {
  computeAgingSeverity,
  type NotificationAgingSeverity,
} from "@/lib/notification-aging";
import { resendChairDecisionEmail } from "@/lib/instructor-application-actions";
import { useRouter } from "next/navigation";
import { BannerV2, Button } from "@/components/ui-v2";
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

/** Aging severity → BannerV2 tone (red escalates to danger). */
const SEVERITY_TONE: Record<NotificationAgingSeverity, "warning" | "danger"> = {
  fresh: "warning",
  amber: "warning",
  orange: "warning",
  red: "danger",
};

/** Left accent preserving the legacy three-step escalation colors. */
const SEVERITY_ACCENT: Record<NotificationAgingSeverity, string> = {
  fresh: "border-l-warning-700",
  amber: "border-l-warning-700",
  orange: "border-l-[#f97316]",
  red: "border-l-danger-700",
};

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
    <BannerV2
      tone={SEVERITY_TONE[aging.severity]}
      role="alert"
      sticky
      motionKey="cockpit-notification-banner"
      className={`top-0 z-[65] items-start rounded-none border-l-[6px] px-6 ${SEVERITY_ACCENT[aging.severity]}`}
      icon={<AlertTriangleIcon size={20} />}
    >
      <p className="m-0 text-[13px] font-bold text-ink">
        Decision email didn&apos;t reach{" "}
        <span className="font-semibold">{props.applicantName}</span>
        <span className="font-normal text-ink-muted"> ({props.applicantEmail})</span>
      </p>
      <p className="mx-0 mb-0 mt-1 text-[12px] text-ink-muted">
        {aging.copyHint}. Retry history: {failedCount} failed, {succeededCount} succeeded.
      </p>
      <p className="mx-0 mb-0 mt-1 break-words font-mono text-[11px] text-ink-muted">
        {props.lastNotificationError}
      </p>
      <div className="mt-2.5 flex gap-2">
        <Button variant="primary" size="sm" onClick={handleResend} disabled={pending}>
          {pending ? "Sending…" : "Resend"}
        </Button>
        <Button
          variant="secondary"
          size="sm"
          onClick={() => setDrawerOpen((s) => !s)}
          aria-expanded={drawerOpen}
          className="text-ink"
        >
          Diagnostic <ChevronDownIcon size={12} />
        </Button>
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
    </BannerV2>
  );
}

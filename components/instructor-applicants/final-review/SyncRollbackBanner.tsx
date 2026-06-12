"use client";

/**
 * Highest-severity surface for the chair cockpit. Tells the chair, without
 * ambiguity, that their decision was committed and then automatically
 * reversed because the workflow-sync step failed. (§10.2)
 */

import { useEffect, useRef } from "react";
import type { ChairDecisionAction } from "@prisma/client";
import { BannerV2, Button } from "@/components/ui-v2";
import { AlertOctagonIcon } from "./cockpit-icons";

const ACTION_LABEL: Record<ChairDecisionAction, string> = {
  APPROVE: "Approve",
  APPROVE_WITH_CONDITIONS: "Approve with conditions",
  REJECT: "Reject",
  HOLD: "Hold",
  WAITLIST: "Waitlist",
  REQUEST_INFO: "Request info",
  REQUEST_SECOND_INTERVIEW: "Second interview",
};

export interface SyncRollbackBannerProps {
  open: boolean;
  applicationId: string;
  applicantName: string;
  rolledBackAction: ChairDecisionAction;
  reversedAt: string;
  reason: string;
  idempotencyKey: string;
  chairId: string;
  onRetry: () => void;
}

function buildDiagnostic(props: SyncRollbackBannerProps): string {
  return [
    `Application: ${props.applicationId}`,
    `Applicant:   ${props.applicantName}`,
    `Action:      ${props.rolledBackAction}`,
    `Reversed at: ${props.reversedAt}`,
    `Reason:      ${props.reason}`,
    `Chair:       ${props.chairId}`,
    `Idempotency: ${props.idempotencyKey}`,
  ].join("\n");
}

export default function SyncRollbackBanner(props: SyncRollbackBannerProps) {
  const retryButtonRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (props.open) retryButtonRef.current?.focus();
  }, [props.open]);

  function handleContactSupport() {
    const diagnostic = buildDiagnostic(props);
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(diagnostic).catch(() => {
        /* clipboard denied — chair can fall back to manual paste */
      });
    }
    if (typeof window !== "undefined") {
      const subject = encodeURIComponent(
        `Chair decision rollback — ${props.applicationId}`
      );
      const body = encodeURIComponent(
        `Decision was reversed.\n\n${diagnostic}\n\n[paste anything else here]`
      );
      window.open(`mailto:support@youthpassionproject.org?subject=${subject}&body=${body}`);
    }
  }

  return (
    <BannerV2
      open={props.open}
      tone="danger"
      role="alert"
      sticky
      motionKey="sync-rollback-banner"
      className="top-0 z-[70] items-start rounded-none border-l-8 border-l-danger-700 px-6 py-3.5 text-danger-700"
      icon={<AlertOctagonIcon size={22} />}
    >
      <p className="m-0 text-[14px] font-bold">Decision was reversed.</p>
      <p className="mx-0 mb-0 mt-1 text-[13px] leading-snug">
        We couldn&apos;t finalise &ldquo;{ACTION_LABEL[props.rolledBackAction]}&rdquo;
        for <strong>{props.applicantName}</strong> because the onboarding pipeline
        didn&apos;t update. The decision record was removed and the applicant is
        back in your queue.
      </p>
      <p className="mx-0 mb-0 mt-1 font-mono text-[12px] text-danger-700">
        {props.reason}
      </p>
      <div className="mt-2.5 flex gap-2">
        <Button
          ref={retryButtonRef}
          variant="danger"
          size="sm"
          onClick={props.onRetry}
        >
          Retry decision
        </Button>
        <Button
          variant="secondary"
          size="sm"
          onClick={handleContactSupport}
          className="border-danger-700/40 bg-transparent text-danger-700 hover:border-danger-700 hover:bg-danger-100"
        >
          Contact support
        </Button>
      </div>
    </BannerV2>
  );
}

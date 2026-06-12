"use client";

/**
 * Sticky banner shown when the client lost the response mid-flight (timeout
 * or `AbortError`). Lets the chair retry safely — the idempotency key in
 * `useCommitDecision` ensures the server replays a prior success or processes
 * fresh if the first attempt never landed. (§10.6)
 */

import { useState } from "react";
import type { ChairDecisionAction, InstructorApplicationStatus } from "@prisma/client";
import { BannerV2, Button } from "@/components/ui-v2";
import { AlertTriangleIcon } from "./cockpit-icons";

export interface NetworkRecoveryBannerProps {
  open: boolean;
  applicationId: string;
  attemptedAction: ChairDecisionAction;
  attemptedAt: string;
  idempotencyKey: string;
  onRetry: () => void;
  onCheckStatus: () => Promise<InstructorApplicationStatus | null>;
  onResolve: () => void;
}

const ACTION_LABEL: Record<ChairDecisionAction, string> = {
  APPROVE: "approve",
  APPROVE_WITH_CONDITIONS: "approve with conditions",
  REJECT: "reject",
  HOLD: "hold",
  WAITLIST: "waitlist",
  REQUEST_INFO: "request info on",
  REQUEST_SECOND_INTERVIEW: "send to second interview",
};

export default function NetworkRecoveryBanner(props: NetworkRecoveryBannerProps) {
  const [checking, setChecking] = useState(false);
  const [resolved, setResolved] = useState<InstructorApplicationStatus | null>(null);

  async function handleCheckStatus() {
    setChecking(true);
    try {
      const status = await props.onCheckStatus();
      setResolved(status);
      if (status && status !== "CHAIR_REVIEW") {
        // Decision already landed — the cockpit will reload via router.refresh.
        props.onResolve();
      }
    } finally {
      setChecking(false);
    }
  }

  return (
    <BannerV2
      open={props.open}
      tone="warning"
      role="alert"
      sticky
      motionKey="network-banner"
      className="top-0 z-[65] items-start rounded-none border-l-[6px] border-l-warning-700 px-6 text-warning-700"
      icon={<AlertTriangleIcon size={20} />}
    >
      <p className="m-0 text-[13px] font-bold">
        We couldn&apos;t confirm whether your decision saved.
      </p>
      <p className="mx-0 mb-0 mt-1 text-[12px] leading-snug">
        Your connection dropped while trying to {ACTION_LABEL[props.attemptedAction]}. If the
        server already processed it, retrying is safe — we&apos;ll detect the duplicate.
      </p>
      {resolved ? (
        <p className="mx-0 mb-0 mt-1.5 text-[12px] font-semibold">
          Server says status is now <code>{resolved}</code>.
        </p>
      ) : null}
      <div className="mt-2.5 flex gap-2">
        <Button
          variant="primary"
          size="sm"
          onClick={props.onRetry}
          className="border-warning-700 bg-warning-700 hover:bg-warning-700/90"
        >
          Retry
        </Button>
        <Button
          variant="secondary"
          size="sm"
          disabled={checking}
          onClick={handleCheckStatus}
          className="border-warning-700/40 bg-transparent text-warning-700 hover:border-warning-700 hover:bg-warning-100"
        >
          {checking ? "Checking…" : "Check status"}
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={props.onResolve}
          className="text-warning-700 hover:bg-warning-100"
        >
          Dismiss
        </Button>
      </div>
    </BannerV2>
  );
}

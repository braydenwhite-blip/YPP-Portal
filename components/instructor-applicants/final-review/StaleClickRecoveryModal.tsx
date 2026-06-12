"use client";

/**
 * Modal shown to the chair who lost a race against another chair on the same
 * applicant. Surfaces who won, what they decided, a rationale preview, and
 * routes the chair forward without ambiguity. (§10.3)
 */

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { ChairDecisionAction } from "@prisma/client";
import { Button, ModalFooterV2, ModalV2 } from "@/components/ui-v2";
import { AlertTriangleIcon } from "./cockpit-icons";

const ACTION_LABEL: Record<ChairDecisionAction, string> = {
  APPROVE: "Approved",
  APPROVE_WITH_CONDITIONS: "Approved with conditions",
  REJECT: "Rejected",
  HOLD: "Placed on hold",
  WAITLIST: "Waitlisted",
  REQUEST_INFO: "Requested info",
  REQUEST_SECOND_INTERVIEW: "Sent to second interview",
};

export interface StaleClickRecoveryModalProps {
  open: boolean;
  applicantName: string;
  attemptedAction: ChairDecisionAction;
  winnerChairName: string | null;
  winnerAction: ChairDecisionAction | null;
  winnerDecidedAt: string | null;
  winnerRationalePreview: string | null;
  onAcknowledge: () => void;
  backToQueueHref: string;
}

function relativeTime(iso: string | null): string {
  if (!iso) return "moments ago";
  const ts = new Date(iso).getTime();
  if (Number.isNaN(ts)) return "moments ago";
  const seconds = Math.max(0, Math.floor((Date.now() - ts) / 1000));
  if (seconds < 60) return `${seconds || "a few"} seconds ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? "" : "s"} ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  const days = Math.floor(hours / 24);
  return `${days} day${days === 1 ? "" : "s"} ago`;
}

export default function StaleClickRecoveryModal(props: StaleClickRecoveryModalProps) {
  const router = useRouter();
  const [showFull, setShowFull] = useState(false);

  // Escape acknowledges, but backdrop clicks must NOT dismiss this surface —
  // ModalV2 is mounted `locked` and we keep the Escape handler here.
  const { open, onAcknowledge } = props;
  useEffect(() => {
    if (!open) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") onAcknowledge();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onAcknowledge]);

  function handleContinueAudit() {
    props.onAcknowledge();
    router.refresh();
  }

  function handleBackToQueue() {
    props.onAcknowledge();
    router.push(props.backToQueueHref);
  }

  return (
    <ModalV2
      open={props.open}
      onClose={props.onAcknowledge}
      locked
      size="md"
      accent="warning"
      role="alertdialog"
      labelledBy="stale-click-title"
      motionKey="stale"
      className="max-w-[520px]"
    >
      <div className="flex items-center gap-2 text-warning-700">
        <AlertTriangleIcon size={22} />
        <h2 id="stale-click-title" className="m-0 text-[18px] text-ink">
          This applicant was just decided by another chair.
        </h2>
      </div>
      <p className="m-0 text-[13px] text-ink">
        {props.winnerChairName ? <strong>{props.winnerChairName}</strong> : "Another chair"}{" "}
        marked <strong>{props.applicantName}</strong> as{" "}
        <strong>
          {props.winnerAction ? ACTION_LABEL[props.winnerAction] : "decided"}
        </strong>{" "}
        {relativeTime(props.winnerDecidedAt)}.
      </p>
      {props.winnerRationalePreview ? (
        <blockquote className="m-0 whitespace-pre-wrap border-l-4 border-l-brand-400 bg-brand-50 px-3 py-2.5 text-[12px] text-ink">
          {showFull
            ? props.winnerRationalePreview
            : props.winnerRationalePreview.slice(0, 160)}
          {!showFull && props.winnerRationalePreview.length > 160 ? "…" : ""}
          {props.winnerRationalePreview.length > 160 ? (
            <button
              type="button"
              onClick={() => setShowFull((s) => !s)}
              className="ml-1.5 cursor-pointer border-none bg-transparent p-0 text-[12px] font-semibold text-brand-700"
            >
              {showFull ? "Show less" : "Show more"}
            </button>
          ) : null}
        </blockquote>
      ) : null}
      <p className="m-0 text-[12px] text-ink-muted">
        Your draft rationale stays in the dock. If the decision is later rescinded, you can pick
        up where you left off.
      </p>
      <ModalFooterV2>
        <Button variant="secondary" size="sm" onClick={handleBackToQueue}>
          Back to queue
        </Button>
        <Button variant="primary" size="sm" onClick={handleContinueAudit}>
          Continue reviewing audit
        </Button>
      </ModalFooterV2>
    </ModalV2>
  );
}

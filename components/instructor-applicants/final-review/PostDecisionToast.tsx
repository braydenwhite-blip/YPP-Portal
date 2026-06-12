"use client";

/**
 * Toast that surfaces after a chair decision commits. Offers the next
 * applicant in the queue with their avatar + chapter; one click advances.
 * Phase 2A ships the shell; Phase 2D wires the trigger.
 */

import { useEffect, useRef } from "react";
import Link from "next/link";
import type { ChairDecisionAction } from "@prisma/client";
import { ToastV2 } from "@/components/ui-v2";
import { ArrowRightIcon, CheckIcon, XIcon } from "./cockpit-icons";

const ACTION_LABEL: Record<ChairDecisionAction, string> = {
  APPROVE: "Approved",
  APPROVE_WITH_CONDITIONS: "Approved with conditions",
  REJECT: "Rejected",
  HOLD: "Placed on hold",
  WAITLIST: "Waitlisted",
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
    <ToastV2
      open={open}
      tone="success"
      position="bottom-right"
      bottomOffset={140}
      role="status"
      motionKey="post-decision-toast"
      className="min-w-[320px] max-w-[420px]"
    >
      {/* Hover pauses the auto-dismiss timer; covers the whole card. */}
      <div
        className="-m-4 flex flex-col gap-2 p-4"
        onMouseEnter={() => {
          if (timerRef.current) window.clearTimeout(timerRef.current);
        }}
        onMouseLeave={() => {
          if (open) {
            timerRef.current = window.setTimeout(onDismiss, autoDismissMs);
          }
        }}
      >
        <div className="flex items-center gap-2.5">
          <span
            className="inline-flex size-7 shrink-0 items-center justify-center rounded-full bg-success-100 text-success-700"
            aria-hidden="true"
          >
            <CheckIcon size={16} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="m-0 text-[13px] font-semibold text-ink">
              {decidedLabel}
              {decidedApplicantName ? ` — ${decidedApplicantName}` : ""}
            </p>
            <p className="m-0 text-[12px] text-ink-muted">
              Email queued · audit recorded
            </p>
          </div>
          <button
            type="button"
            onClick={onDismiss}
            aria-label="Dismiss"
            className="cursor-pointer border-none bg-transparent p-1 text-ink-muted"
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
            className="flex items-center gap-2.5 rounded-[12px] bg-brand-50 px-3 py-2.5 text-[13px] font-semibold text-brand-700 no-underline"
          >
            <span
              aria-hidden="true"
              className="inline-flex size-7 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-brand-500 to-brand-600 text-[11px] font-semibold text-white"
            >
              {next.name
                .split(/\s+/)
                .slice(0, 2)
                .map((p) => p[0]?.toUpperCase() ?? "")
                .join("")}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block">Next: {next.name}</span>
              <span className="block text-[12px] font-normal text-ink-muted">
                {next.chapterName ?? "Chapter unknown"}
              </span>
            </span>
            <ArrowRightIcon size={16} />
          </Link>
        ) : (
          <p className="m-0 rounded-[12px] bg-brand-50 px-3 py-2.5 text-[13px] font-semibold text-brand-700">
            Queue cleared — nice work.
          </p>
        )}
      </div>
    </ToastV2>
  );
}

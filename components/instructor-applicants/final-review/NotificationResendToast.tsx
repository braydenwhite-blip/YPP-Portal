"use client";

/**
 * Confirms the outcome of a notification resend. Bottom-right, non-blocking.
 * (§11.3)
 */

import { useEffect, useRef } from "react";
import { ToastV2 } from "@/components/ui-v2";
import { CheckIcon, AlertTriangleIcon, XIcon } from "./cockpit-icons";

export interface NotificationResendToastProps {
  open: boolean;
  outcome: "success" | "failure" | null;
  applicantName: string;
  onDismiss: () => void;
  onOpenDiagnostic?: () => void;
}

export default function NotificationResendToast(props: NotificationResendToastProps) {
  const timer = useRef<number | null>(null);

  useEffect(() => {
    if (!props.open || props.outcome !== "success") return;
    timer.current = window.setTimeout(props.onDismiss, 5000);
    return () => {
      if (timer.current) window.clearTimeout(timer.current);
    };
  }, [props.open, props.outcome, props.onDismiss]);

  return (
    <ToastV2
      open={Boolean(props.open && props.outcome)}
      tone={props.outcome === "failure" ? "warning" : "success"}
      position="bottom-right"
      bottomOffset={80}
      role="status"
      motionKey="notif-resend-toast"
    >
      <div className="flex items-center gap-2.5 text-[13px] font-semibold text-ink">
        {props.outcome === "success" ? (
          <CheckIcon size={18} />
        ) : (
          <AlertTriangleIcon size={18} />
        )}
        <span className="min-w-0 flex-1">
          {props.outcome === "success"
            ? `Decision email resent to ${props.applicantName}`
            : "Resend failed — see diagnostic"}
        </span>
        {props.outcome === "failure" && props.onOpenDiagnostic ? (
          <button
            type="button"
            onClick={props.onOpenDiagnostic}
            className="cursor-pointer border-none bg-transparent p-0 text-[12px] font-semibold text-brand-700"
          >
            Diagnostic
          </button>
        ) : null}
        <button
          type="button"
          onClick={props.onDismiss}
          aria-label="Dismiss"
          className="cursor-pointer border-none bg-transparent p-0 text-ink-muted"
        >
          <XIcon size={14} />
        </button>
      </div>
    </ToastV2>
  );
}

"use client";

/**
 * Surfaces the auto-retry loop run by `useCommitDecision` when a transient
 * Postgres deadlock fires. Hidden during the happy path; visible only while
 * we're waiting on retry attempts. (§10.5)
 */

import { ToastV2 } from "@/components/ui-v2";

export interface DeadlockRetryToastProps {
  open: boolean;
  attempt: number;
  maxAttempts: number;
}

export default function DeadlockRetryToast({
  open,
  attempt,
  maxAttempts,
}: DeadlockRetryToastProps) {
  return (
    <ToastV2
      open={open}
      tone="warning"
      position="bottom-left"
      bottomOffset={140}
      role="status"
      motionKey="deadlock-toast"
      className="w-auto text-[13px] font-semibold text-warning-700"
    >
      Busy moment — retrying… (attempt {attempt} of {maxAttempts})
    </ToastV2>
  );
}

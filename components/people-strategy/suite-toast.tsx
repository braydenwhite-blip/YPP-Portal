"use client";

import { useEffect } from "react";
import { PsIcon } from "@/components/people-strategy/ps-icons";

export type ToastState = { id: number; message: string; tone?: "success" | "error" } | null;

/** Monotonic id helper so callers get a fresh toast (and replayed animation)
 *  even when the same message fires twice in a row. */
let _toastSeq = 0;
export function makeToast(message: string, tone: "success" | "error" = "success"): ToastState {
  _toastSeq += 1;
  return { id: _toastSeq, message, tone };
}

/**
 * Controlled, auto-dismissing toast pinned bottom-right. The parent owns a
 * `ToastState` and clears it on dismiss; keying on `toast.id` replays the
 * entrance animation for back-to-back confirmations. Styling + motion live in
 * the `.psuite-toast` block of `app/globals.css` (reduced-motion safe).
 */
export function SuiteToast({
  toast,
  onDismiss,
  duration = 3500,
}: {
  toast: ToastState;
  onDismiss: () => void;
  duration?: number;
}) {
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(onDismiss, duration);
    return () => clearTimeout(timer);
  }, [toast, duration, onDismiss]);

  if (!toast) return null;
  const tone = toast.tone ?? "success";

  return (
    <div key={toast.id} className={`psuite-toast is-${tone}`} role="status" aria-live="polite">
      <span className="psuite-toast-icon">
        <PsIcon name={tone === "error" ? "alert" : "check"} />
      </span>
      <span>{toast.message}</span>
    </div>
  );
}

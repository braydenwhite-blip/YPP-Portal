"use client";

import { useState, useTransition } from "react";

import { sendImpactMeetingSummary } from "@/lib/people-strategy/impact-meeting-actions";

/**
 * The one and only human trigger for the Impact Meeting summary email. Calls the
 * single `sendImpactMeetingSummary` action; if the email kill-switch
 * (ENABLE_IMPACT_SUMMARY_EMAIL) is off, the action throws a clear message which
 * we surface inline. Nothing here ever sends automatically.
 */
export function ImpactSummarySendButton({ meetingId }: { meetingId: string }) {
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);

  function send() {
    setMessage(null);
    startTransition(async () => {
      try {
        const res = await sendImpactMeetingSummary({ meetingId });
        if (res.sent) {
          const who =
            res.recipientCount === 1 ? "1 person" : `${res.recipientCount} people`;
          const warn = res.warnings.length ? ` (${res.warnings.length} item(s) need attention)` : "";
          setMessage(`Summary emailed to ${who}.${warn}`);
        } else {
          setMessage(`Couldn't send: ${res.error ?? "unknown error"}`);
        }
      } catch (e) {
        setMessage(e instanceof Error ? e.message : "Could not send the summary.");
      }
    });
  }

  return (
    <div className="flex flex-col gap-1">
      <button
        type="button"
        onClick={send}
        disabled={pending}
        className="rounded-md border border-[var(--border)] px-3 py-2 text-sm font-semibold text-ink disabled:opacity-50"
      >
        {pending ? "Sending…" : "Send summary email"}
      </button>
      {message ? <span className="text-xs text-ink-muted">{message}</span> : null}
    </div>
  );
}

"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { Button, cn } from "@/components/ui-v2";
import {
  captureActionBlocker,
  captureActionCompletion,
} from "@/lib/people-strategy/action-items-actions";
import {
  ACTION_COMPLETION_OUTCOME_LABELS,
  ACTION_COMPLETION_OUTCOME_VALUES,
} from "@/lib/people-strategy/action-source";

/**
 * Action System 4.0 — inline structured completion / blocker capture.
 *
 * When someone marks an action COMPLETE this asks for what the 4.0 contract
 * stores (outcome, completion note, optional next follow-up); when they mark
 * it BLOCKED it requires the blocker reason. One focused mutation each
 * (`captureActionCompletion` / `captureActionBlocker`) — no full edit form.
 * Tailwind-only subtree (allowed inside legacy pages per the hybrid rules).
 */

const fieldClass =
  "w-full rounded-[8px] border border-line bg-surface px-2.5 py-2 text-[13px] text-ink focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-brand-400";
const labelClass = "mb-1 block text-[11.5px] font-bold uppercase tracking-[0.05em] text-ink-muted";

export function ActionStatusCapture({
  actionId,
  mode,
  initialOutcome,
  initialNote,
  initialBlockedReason,
  initialNextFollowUpAt,
  onDone,
  onCancel,
}: {
  actionId: string;
  mode: "complete" | "blocked";
  initialOutcome?: string | null;
  initialNote?: string | null;
  initialBlockedReason?: string | null;
  initialNextFollowUpAt?: string | null;
  /** Called after a successful save. */
  onDone: () => void;
  onCancel: () => void;
}) {
  const router = useRouter();
  const [outcome, setOutcome] = useState(initialOutcome ?? "DELIVERED");
  const [note, setNote] = useState(initialNote ?? "");
  const [reason, setReason] = useState(initialBlockedReason ?? "");
  const [followUp, setFollowUp] = useState(toDateInputValue(initialNextFollowUpAt));
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function save() {
    setError(null);
    if (mode === "blocked" && !reason.trim()) {
      setError("Name the blocker so someone can act on it.");
      return;
    }
    startTransition(async () => {
      try {
        if (mode === "complete") {
          await captureActionCompletion({
            id: actionId,
            completionOutcome: outcome,
            completionNote: note.trim() || undefined,
            nextFollowUpAt: followUp || undefined,
          });
        } else {
          await captureActionBlocker({
            id: actionId,
            blockedReason: reason.trim(),
            nextFollowUpAt: followUp || undefined,
          });
        }
        onDone();
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Something went wrong.");
      }
    });
  }

  return (
    <div
      className={cn(
        "mt-2 flex flex-col gap-2.5 rounded-[10px] border p-3.5",
        mode === "complete"
          ? "border-emerald-200 bg-emerald-50/60"
          : "border-amber-200 bg-amber-50/60"
      )}
    >
      <p className="m-0 text-[13px] font-semibold text-ink">
        {mode === "complete"
          ? "Marking complete — capture the outcome"
          : "Marking blocked — capture the blocker"}
      </p>

      {mode === "complete" ? (
        <>
          <div>
            <label className={labelClass} htmlFor={`outcome-${actionId}`}>
              Outcome
            </label>
            <select
              id={`outcome-${actionId}`}
              className={fieldClass}
              value={outcome}
              onChange={(event) => setOutcome(event.target.value)}
              disabled={pending}
            >
              {ACTION_COMPLETION_OUTCOME_VALUES.map((value) => (
                <option key={value} value={value}>
                  {ACTION_COMPLETION_OUTCOME_LABELS[value]}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelClass} htmlFor={`note-${actionId}`}>
              What happened (optional)
            </label>
            <textarea
              id={`note-${actionId}`}
              className={cn(fieldClass, "min-h-16 resize-y")}
              value={note}
              onChange={(event) => setNote(event.target.value)}
              placeholder="What got delivered, what's left, anything the next person should know…"
              disabled={pending}
            />
          </div>
        </>
      ) : (
        <div>
          <label className={labelClass} htmlFor={`reason-${actionId}`}>
            Blocked because
          </label>
          <textarea
            id={`reason-${actionId}`}
            className={cn(fieldClass, "min-h-16 resize-y")}
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            placeholder="What's in the way, and who could unblock it…"
            disabled={pending}
            required
          />
        </div>
      )}

      <div>
        <label className={labelClass} htmlFor={`follow-up-${actionId}`}>
          Next follow-up (optional)
        </label>
        <input
          id={`follow-up-${actionId}`}
          type="date"
          className={fieldClass}
          value={followUp}
          onChange={(event) => setFollowUp(event.target.value)}
          disabled={pending}
        />
      </div>

      {error ? <p className="m-0 text-[12.5px] font-semibold text-danger-700">{error}</p> : null}

      <div className="flex items-center gap-2">
        <Button variant="primary" size="sm" onClick={save} disabled={pending}>
          {pending
            ? "Saving…"
            : mode === "complete"
              ? "Submit for approval"
              : "Mark blocked"}
        </Button>
        <Button variant="ghost" size="sm" onClick={onCancel} disabled={pending}>
          Cancel
        </Button>
      </div>
    </div>
  );
}

function toDateInputValue(value?: string | null): string {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().slice(0, 10);
}

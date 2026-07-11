"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { Button, ModalV2, ModalFooterV2 } from "@/components/ui-v2";
import { recordCheckIn } from "@/lib/mentorship/check-in-actions";
import type { RecordCheckInInput } from "@/lib/mentorship/check-in-schema";

type Participant = { id: string; name: string };

const fieldLabel = "text-[12px] font-semibold uppercase tracking-[0.06em] text-ink-muted";
const fieldInput =
  "w-full rounded-[10px] border border-line bg-surface px-3 py-2 text-[13.5px] text-ink outline-none focus:border-brand-400";

/** Today as a UTC yyyy-mm-dd, matching how the server coerces date-only inputs. */
function todayValue(): string {
  const now = new Date();
  const y = now.getUTCFullYear();
  const m = String(now.getUTCMonth() + 1).padStart(2, "0");
  const d = String(now.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/**
 * Simple meeting log — date + optional note. Mentor and mentee can both use it.
 * Cycle-bound Mentor Check-ins keep the same short form (still advances the cycle).
 */
export function CheckInComposer({
  subjectId,
  mentorshipId,
  selfReflectionId,
  cycleLabel,
  participantOptions,
  personName,
  isSelf = false,
}: {
  subjectId: string;
  mentorshipId: string;
  selfReflectionId?: string | null;
  cycleLabel?: string | null;
  participantOptions: Participant[];
  personName: string;
  /** Viewing own workspace — button copy says "Log a meeting" not "with X". */
  isSelf?: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const isCycleCheckIn = Boolean(selfReflectionId);
  const [occurredAt, setOccurredAt] = useState(todayValue);
  const [notes, setNotes] = useState("");

  function reset() {
    setOccurredAt(todayValue());
    setNotes("");
    setError(null);
  }

  function submit() {
    setError(null);
    const input: RecordCheckInInput = {
      subjectId,
      mentorshipId,
      selfReflectionId: selfReflectionId ?? undefined,
      kind: isCycleCheckIn ? "CHECK_IN" : "MEETING",
      occurredAt: occurredAt || undefined,
      participantIds: participantOptions.map((p) => p.id),
      discussion: notes.trim() || "Meeting done.",
    };
    startTransition(async () => {
      try {
        await recordCheckIn(input);
        setOpen(false);
        reset();
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Could not save the meeting.");
      }
    });
  }

  const buttonLabel = isCycleCheckIn
    ? "Record Mentor Check-in"
    : "Log a meeting";

  return (
    <>
      <Button variant="primary" size="sm" onClick={() => setOpen(true)}>
        {buttonLabel}
      </Button>

      <ModalV2
        open={open}
        onClose={() => setOpen(false)}
        locked={pending}
        accent="brand"
        labelledBy="meeting-log-title"
      >
        <div>
          <h2
            id="meeting-log-title"
            className="m-0 text-[16px] font-bold text-ink"
          >
            {isCycleCheckIn
              ? "Record Mentor Check-in"
              : isSelf
                ? "Log a meeting"
                : `Log a meeting with ${personName}`}
          </h2>
          <p className="m-0 mt-1 text-[13px] text-ink-muted">
            {isCycleCheckIn
              ? `Mark that you talked about ${personName}'s ${cycleLabel ?? "current"} reflection.`
              : "Just mark that you met. Add a short note if you want."}
          </p>
        </div>

        <label className="flex flex-col gap-1">
          <span className={fieldLabel}>When</span>
          <input
            type="date"
            className={fieldInput}
            value={occurredAt}
            onChange={(e) => setOccurredAt(e.target.value)}
          />
        </label>

        <label className="flex flex-col gap-1">
          <span className={fieldLabel}>Note (optional)</span>
          <textarea
            className={`${fieldInput} resize-y leading-relaxed`}
            rows={3}
            value={notes}
            placeholder="What did you cover? Anything to follow up on?"
            onChange={(e) => setNotes(e.target.value)}
          />
        </label>

        {error ? (
          <p className="m-0 text-[12.5px] font-medium text-danger-700">{error}</p>
        ) : null}

        <ModalFooterV2>
          <Button variant="ghost" size="sm" onClick={() => setOpen(false)} disabled={pending}>
            Cancel
          </Button>
          <Button variant="primary" size="sm" onClick={submit} loading={pending}>
            {isCycleCheckIn ? "Mark check-in done" : "Save meeting"}
          </Button>
        </ModalFooterV2>
      </ModalV2>
    </>
  );
}

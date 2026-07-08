"use client";

import { useState, useTransition } from "react";
import { acknowledgeMentorReview } from "@/lib/gr-actions";

const REACTIONS = [
  { value: "GRATEFUL", label: "🙏", text: "Grateful" },
  { value: "MOTIVATED", label: "💪", text: "Motivated" },
  { value: "UNCLEAR", label: "😕", text: "Unclear" },
  { value: "UNSURE", label: "❓", text: "Need to talk" },
] as const;

interface MenteeReviewAckProps {
  reviewId: string;
  existingAck?: { reaction: string; note: string | null } | null;
}

/**
 * The mentee's reaction to a released review — closes the monthly loop and
 * tells the mentor how the feedback landed.
 */
export function MenteeReviewAck({ reviewId, existingAck }: MenteeReviewAckProps) {
  const [selected, setSelected] = useState(existingAck?.reaction ?? "");
  const [note, setNote] = useState(existingAck?.note ?? "");
  const [saved, setSaved] = useState(!!existingAck);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function save(reaction: string) {
    setSelected(reaction);
    setError(null);
    startTransition(async () => {
      try {
        await acknowledgeMentorReview({
          reviewId,
          reaction,
          note: note.trim() || null,
        });
        setSaved(true);
      } catch {
        setSaved(false);
        setError("Couldn't save your reaction — please try again.");
      }
    });
  }

  return (
    <div className="mt-3 rounded-[10px] bg-surface-soft p-4">
      <div className="mb-2 text-[12.5px] text-ink-muted">
        How does this feedback land?
      </div>
      <div className="flex flex-wrap gap-2">
        {REACTIONS.map((r) => (
          <button
            key={r.value}
            type="button"
            disabled={isPending}
            onClick={() => save(r.value)}
            className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[13px] font-semibold transition-colors disabled:opacity-60 ${
              selected === r.value
                ? "border-brand-600 bg-brand-50 text-brand-800"
                : "border-line bg-surface text-ink hover:bg-surface-soft"
            }`}
          >
            <span aria-hidden>{r.label}</span>
            {r.text}
          </button>
        ))}
      </div>
      <textarea
        value={note}
        onChange={(e) => setNote(e.target.value)}
        rows={2}
        placeholder="Add a note for your mentor (optional)"
        className="mt-3 w-full resize-y rounded-lg border border-line bg-surface px-3 py-2 text-[13px] text-ink placeholder:text-ink-muted focus:border-brand-500 focus:outline-none"
      />
      {selected && note.trim() !== (existingAck?.note ?? "") && !isPending ? (
        <button
          type="button"
          onClick={() => save(selected)}
          className="mt-2 block text-[12.5px] font-semibold text-brand-700 hover:underline"
        >
          Save note
        </button>
      ) : null}
      {saved && !isPending ? (
        <p className="m-0 mt-2 text-[12.5px] font-semibold text-complete-700" role="status">
          Shared with your mentor. You can change your reaction any time.
        </p>
      ) : null}
      {error ? (
        <p className="m-0 mt-2 text-[12.5px] font-semibold text-blocked-700" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}

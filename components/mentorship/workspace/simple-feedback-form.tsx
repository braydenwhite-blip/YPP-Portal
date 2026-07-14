"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui-v2";
import { saveGoalReview } from "@/lib/goal-review-actions";
import { getGoalRatingCopy } from "@/lib/mentorship-rubric-copy";

type GoalRow = {
  id: string;
  title: string;
  grDocumentGoalId?: string | null;
};

const RATINGS = [
  "BEHIND_SCHEDULE",
  "GETTING_STARTED",
  "ACHIEVED",
  "ABOVE_AND_BEYOND",
] as const;

const SIMPLE_LABEL: Record<(typeof RATINGS)[number], string> = {
  BEHIND_SCHEDULE: "Behind",
  GETTING_STARTED: "Starting",
  ACHIEVED: "On track",
  ABOVE_AND_BEYOND: "Amazing",
};

const fieldLabel = "text-[13px] font-semibold text-ink";
const fieldHint = "mt-0.5 text-[12.5px] font-normal text-ink-muted";
const fieldInput =
  "mt-2 w-full resize-y rounded-[12px] border border-line bg-surface px-3.5 py-3 text-[15px] leading-relaxed text-ink outline-none placeholder:text-ink-muted/70 focus:border-brand-400";

/**
 * One-page mentor feedback — pick how they did, write two notes, send.
 * Applies the overall rating to every goal so saveGoalReview stays happy.
 */
export function SimpleFeedbackForm({
  reflectionId,
  menteeId,
  menteeName,
  goals,
  initialRating,
  initialComments,
  initialPlan,
  reflectionBlurb,
}: {
  reflectionId: string;
  menteeId: string;
  menteeName: string;
  goals: GoalRow[];
  initialRating?: string | null;
  initialComments?: string;
  initialPlan?: string;
  /** Short peek at what the mentee wrote, if any. */
  reflectionBlurb?: string | null;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [rating, setRating] = useState(
    (initialRating && RATINGS.includes(initialRating as (typeof RATINGS)[number])
      ? initialRating
      : "ACHIEVED") as (typeof RATINGS)[number]
  );
  const [wentWell, setWentWell] = useState(initialComments ?? "");
  const [whatsNext, setWhatsNext] = useState(initialPlan ?? "");
  const [error, setError] = useState<string | null>(null);

  function submit() {
    if (!wentWell.trim()) {
      setError("Write a short note about how they did.");
      return;
    }
    if (!whatsNext.trim()) {
      setError("Tell them one thing to focus on next.");
      return;
    }
    setError(null);

    const fd = new FormData();
    fd.set("reflectionId", reflectionId);
    fd.set("overallRating", rating);
    fd.set("overallComments", wentWell.trim());
    fd.set("planOfAction", whatsNext.trim());
    fd.set("bonusPoints", "0");
    fd.set("submitForApproval", "true");

    goals.forEach((g) => {
      if (g.grDocumentGoalId) {
        fd.append("grGoalIds", g.grDocumentGoalId);
        fd.set(`goal_${g.grDocumentGoalId}_rating`, rating);
        fd.set(`goal_${g.grDocumentGoalId}_comments`, wentWell.trim());
      } else {
        fd.append("goalIds", g.id);
        fd.set(`goal_${g.id}_rating`, rating);
        fd.set(`goal_${g.id}_comments`, wentWell.trim());
      }
    });

    startTransition(async () => {
      try {
        await saveGoalReview(fd);
        router.push(`/mentorship/people/${menteeId}?section=reviews`);
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not send. Try again.");
      }
    });
  }

  return (
    <div className="flex flex-col gap-5">
      {reflectionBlurb ? (
        <div className="rounded-[12px] border border-line-soft bg-surface-soft px-3.5 py-3">
          <p className="m-0 text-[11.5px] font-bold uppercase tracking-[0.05em] text-ink-muted">
            {menteeName} wrote
          </p>
          <p className="m-0 mt-1.5 text-[13.5px] leading-relaxed text-ink">
            {reflectionBlurb}
          </p>
        </div>
      ) : null}

      <div>
        <p className={fieldLabel}>How did they do?</p>
        <p className={fieldHint}>Tap one.</p>
        <div className="mt-2.5 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {RATINGS.map((value) => {
            const copy = getGoalRatingCopy(value);
            const selected = rating === value;
            return (
              <button
                key={value}
                type="button"
                aria-pressed={selected}
                title={copy.mentorDescription}
                onClick={() => setRating(value)}
                disabled={pending}
                className={
                  selected
                    ? "rounded-[12px] border-2 border-brand-600 bg-brand-50 px-3 py-3 text-center text-[14px] font-bold text-brand-800"
                    : "rounded-[12px] border border-line bg-surface px-3 py-3 text-center text-[14px] font-semibold text-ink hover:border-brand-300"
                }
              >
                {SIMPLE_LABEL[value]}
              </button>
            );
          })}
        </div>
      </div>

      <label className="flex flex-col">
        <span className={fieldLabel}>What should they know?</span>
        <span className={fieldHint}>A few sentences is plenty.</span>
        <textarea
          className={fieldInput}
          rows={4}
          value={wentWell}
          onChange={(e) => setWentWell(e.target.value)}
          placeholder={`You did a great job with…`}
          disabled={pending}
        />
      </label>

      <label className="flex flex-col">
        <span className={fieldLabel}>What&apos;s next?</span>
        <span className={fieldHint}>One clear focus for next month.</span>
        <textarea
          className={fieldInput}
          rows={3}
          value={whatsNext}
          onChange={(e) => setWhatsNext(e.target.value)}
          placeholder="Next, try…"
          disabled={pending}
        />
      </label>

      {error ? (
        <p className="m-0 text-[13px] font-medium text-danger-700">{error}</p>
      ) : null}

      <div className="flex justify-end">
        <Button variant="primary" size="md" onClick={submit} loading={pending}>
          Send feedback
        </Button>
      </div>
    </div>
  );
}

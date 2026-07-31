"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui-v2";
import { submitInstructorParentFeedback } from "@/lib/mentorship/parent-instructor-feedback-actions";

const fieldInput =
  "w-full rounded-[10px] border border-line bg-surface px-3 py-2 text-[14px] text-ink outline-none focus:border-brand-400";

export function ParentInstructorFeedbackForm({
  instructorId,
  instructorName,
}: {
  instructorId: string;
  instructorName: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [rating, setRating] = useState(5);
  const [comments, setComments] = useState("");
  const [wouldRecommend, setWouldRecommend] = useState(true);
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  function submit() {
    setError(null);
    startTransition(async () => {
      try {
        await submitInstructorParentFeedback({
          instructorId,
          rating,
          comments: comments.trim(),
          wouldRecommend,
          isAnonymous,
        });
        setDone(true);
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Could not submit feedback.");
      }
    });
  }

  if (done) {
    return (
      <div className="rounded-[14px] border border-complete-200 bg-complete-50 px-4 py-4">
        <p className="m-0 text-[15px] font-semibold text-complete-800">
          Thank you — feedback sent.
        </p>
        <p className="m-0 mt-1 text-[13px] text-ink-muted">
          {instructorName.split(" ")[0]}’s mentor can use this in their next check-in.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 rounded-[16px] border border-line bg-surface p-5 shadow-sm">
      <div>
        <h2 className="m-0 text-[18px] font-semibold text-ink">
          How is {instructorName.split(" ")[0]} doing as a teacher?
        </h2>
        <p className="m-0 mt-1 text-[13.5px] text-ink-muted">
          A short rating and a few sentences is enough.
        </p>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            disabled={pending}
            onClick={() => setRating(n)}
            className={
              rating === n
                ? "h-10 min-w-10 rounded-[8px] bg-ink px-3 text-[14px] font-semibold text-white"
                : "h-10 min-w-10 rounded-[8px] border border-line bg-surface px-3 text-[14px] font-semibold text-ink hover:border-brand-300"
            }
          >
            {n}
          </button>
        ))}
      </div>

      <label className="flex flex-col gap-1">
        <span className="text-[12px] font-semibold uppercase tracking-[0.06em] text-ink-muted">
          Your note
        </span>
        <textarea
          className={`${fieldInput} resize-y`}
          rows={4}
          value={comments}
          disabled={pending}
          onChange={(e) => setComments(e.target.value)}
          placeholder="What went well? What could be better?"
        />
      </label>

      <label className="flex items-center gap-2 text-[13.5px] text-ink">
        <input
          type="checkbox"
          checked={wouldRecommend}
          disabled={pending}
          onChange={(e) => setWouldRecommend(e.target.checked)}
        />
        I would recommend this instructor
      </label>

      <label className="flex items-center gap-2 text-[13.5px] text-ink">
        <input
          type="checkbox"
          checked={isAnonymous}
          disabled={pending}
          onChange={(e) => setIsAnonymous(e.target.checked)}
        />
        Submit anonymously
      </label>

      {error ? (
        <p className="m-0 text-[13px] font-medium text-danger-700">{error}</p>
      ) : null}

      <div className="flex justify-end">
        <Button
          variant="primary"
          size="md"
          loading={pending}
          disabled={!comments.trim()}
          onClick={submit}
        >
          Send feedback
        </Button>
      </div>
    </div>
  );
}

"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui-v2";
import { submitCollaboratorFeedback } from "@/lib/mentorship/collaborator-feedback-actions";

/**
 * Form for a collaborator to write requested feedback about a person.
 * Lands on /people/[id]?giveFeedback=1 (and auto-opens when a request is pending).
 */
export function GiveCollaboratorFeedbackForm({
  requestId,
  subjectName,
  requestedByName,
  reason,
}: {
  requestId: string;
  subjectName: string;
  requestedByName: string | null;
  reason: string | null;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [comment, setComment] = useState("");
  const [rating, setRating] = useState(4);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  function submit() {
    setError(null);
    startTransition(async () => {
      try {
        await submitCollaboratorFeedback({
          requestId,
          comment,
          rating,
          category: "Colleague feedback",
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
      <section className="overflow-hidden rounded-[14px] border border-complete-200 bg-complete-50/60 px-5 py-4">
        <h2 className="m-0 text-[15px] font-semibold text-ink">Thanks — feedback sent</h2>
        <p className="m-0 mt-1 text-[13px] text-ink-muted">
          Your notes about {subjectName} were shared with their mentor.
        </p>
      </section>
    );
  }

  return (
    <section className="overflow-hidden rounded-[14px] border border-brand-200 bg-brand-50/40 shadow-[0_1px_2px_rgb(46_16_101/0.04)]">
      <div className="border-b border-brand-100 px-5 py-4">
        <h2 className="m-0 text-[15px] font-semibold text-ink">
          Write feedback for {subjectName}
        </h2>
        <p className="m-0 mt-0.5 text-[12.5px] text-ink-muted">
          {requestedByName
            ? `${requestedByName} asked for your notes`
            : "A mentor asked for your notes"}
          {" — private to their mentor, not shown to "}
          {subjectName}.
        </p>
        {reason ? (
          <p className="m-0 mt-2 rounded-[8px] bg-surface/80 px-3 py-2 text-[13px] text-ink">
            {reason}
          </p>
        ) : null}
      </div>

      <div className="flex flex-col gap-4 px-5 py-4">
        <fieldset className="m-0 border-0 p-0">
          <legend className="mb-2 text-[12.5px] font-medium text-ink-muted">
            Overall (1–5)
          </legend>
          <div className="flex flex-wrap gap-2">
            {[1, 2, 3, 4, 5].map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => setRating(value)}
                className={
                  rating === value
                    ? "inline-flex size-9 items-center justify-center rounded-[10px] border border-brand-500 bg-brand-600 text-[14px] font-semibold text-white"
                    : "inline-flex size-9 items-center justify-center rounded-[10px] border border-line bg-surface text-[14px] font-medium text-ink hover:border-brand-300"
                }
              >
                {value}
              </button>
            ))}
          </div>
        </fieldset>

        <label className="flex flex-col gap-1.5">
          <span className="text-[12.5px] font-medium text-ink-muted">
            Your notes
          </span>
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            rows={5}
            maxLength={5000}
            placeholder={`What stood out working with ${subjectName}? Strengths, growth areas, examples…`}
            className="resize-y rounded-[10px] border border-line bg-surface px-3 py-2 text-[14px] text-ink outline-none focus:border-brand-400"
          />
        </label>

        {error ? (
          <p className="m-0 text-[12.5px] font-medium text-danger-700">{error}</p>
        ) : null}

        <div className="flex justify-end">
          <Button
            variant="primary"
            size="sm"
            loading={pending}
            disabled={comment.trim().length === 0}
            onClick={submit}
          >
            Submit feedback
          </Button>
        </div>
      </div>
    </section>
  );
}

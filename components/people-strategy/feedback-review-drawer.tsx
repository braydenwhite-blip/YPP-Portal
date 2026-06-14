"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { Button, ModalV2, ModalFooterV2, StatusBadge, cn } from "@/components/ui-v2";
import { compileCheckIn } from "@/lib/people-strategy/check-in-actions";
import {
  loadFeedbackReviewForSubject,
  type FeedbackReview,
  type FeedbackReviewMonth,
} from "@/lib/people-strategy/feedback-plan-actions";
import { RATING_LABELS } from "@/lib/people-strategy/check-in-rating";
import { describeCompileResult } from "@/lib/people-strategy/people-performance-selectors";

/**
 * Feedback review — closes the request → responses → check-in loop (ui-v2).
 *
 * Leadership opens a member's submitted feedback (confidential bodies, read
 * through the requireLeadership-gated loader), sees who is still pending per
 * month, and compiles that month's check-in in one click via the EXISTING
 * `compileCheckIn` upsert — no new check-in concept, no duplicate writes
 * (the unique (userId, month) key makes recompiling refresh the same row).
 */

type Phase = "loading" | "view" | "error";

function formatDate(iso: string): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(iso));
}

function CheckInChip({ month }: { month: FeedbackReviewMonth }) {
  if (!month.checkIn) {
    return <StatusBadge tone="warning">No check-in yet</StatusBadge>;
  }
  const rating = month.checkIn.performanceRating;
  return (
    <StatusBadge
      tone={rating ? "success" : "neutral"}
      title={`Check-in on file since ${formatDate(month.checkIn.compiledAtISO)}`}
    >
      Check-in on file{rating ? ` · ${RATING_LABELS[rating]}` : ""}
    </StatusBadge>
  );
}

export function FeedbackReviewDrawer({
  member,
  onClose,
}: {
  /** The member whose feedback is being reviewed; null = drawer closed. */
  member: { id: string; name: string } | null;
  onClose: () => void;
}) {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>("loading");
  const [review, setReview] = useState<FeedbackReview | null>(null);
  const [error, setError] = useState<string | null>(null);
  /** monthKey currently compiling, and per-month outcome notes. */
  const [compiling, setCompiling] = useState<string | null>(null);
  const [compileNotes, setCompileNotes] = useState<Record<string, string>>({});
  const [, startTransition] = useTransition();

  const open = member !== null;
  const memberId = member?.id ?? null;

  useEffect(() => {
    if (!memberId) return;
    setPhase("loading");
    setReview(null);
    setError(null);
    setCompiling(null);
    setCompileNotes({});
    startTransition(async () => {
      try {
        const loaded = await loadFeedbackReviewForSubject({ subjectUserId: memberId });
        setReview(loaded);
        setPhase("view");
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not load feedback.");
        setPhase("error");
      }
    });
  }, [memberId]);

  function handleCompile(month: FeedbackReviewMonth) {
    if (!memberId || compiling) return;
    setCompiling(month.monthKey);
    startTransition(async () => {
      try {
        const compiled = await compileCheckIn({
          userId: memberId,
          // Any date inside the month works; the action normalizes to its start.
          month: new Date(`${month.monthKey}-01T00:00:00.000Z`),
        });
        setReview((prev) =>
          prev
            ? {
                ...prev,
                months: prev.months.map((m) =>
                  m.monthKey === month.monthKey
                    ? {
                        ...m,
                        checkIn: {
                          performanceRating: compiled.performanceRating,
                          compiledAtISO: new Date().toISOString(),
                        },
                      }
                    : m
                ),
              }
            : prev
        );
        const sentence = describeCompileResult(month.monthLabel, {
          feedbackResponses: compiled.feedbackResponses,
          isRecompile: compiled.isRecompile,
          newResponses: compiled.newResponses,
        });
        const ratingNote = compiled.performanceRating
          ? ` Performance from goal progress: ${RATING_LABELS[compiled.performanceRating]}.`
          : " No goal-progress data yet, so no derived rating.";
        setCompileNotes((prev) => ({
          ...prev,
          [month.monthKey]: sentence + ratingNote,
        }));
        router.refresh(); // dots/stats on the table reflect the new check-in
      } catch (err) {
        setCompileNotes((prev) => ({
          ...prev,
          [month.monthKey]:
            err instanceof Error ? `Could not compile: ${err.message}` : "Could not compile.",
        }));
      } finally {
        setCompiling(null);
      }
    });
  }

  return (
    <ModalV2
      open={open}
      onClose={onClose}
      labelledBy="feedback-review-title"
      size="lg"
      accent="brand"
      motionKey="feedback-review"
    >
      <header className="flex flex-col gap-1">
        <p className="m-0 text-[11.5px] font-bold uppercase tracking-[0.06em] text-brand-700">
          Feedback review · Leadership &amp; Board only
        </p>
        <h2 id="feedback-review-title" className="m-0 text-[19px] font-bold text-ink">
          {member?.name ?? "Member"}
        </h2>
        <p className="m-0 text-[12.5px] text-ink-muted">
          Confidential responses from collaborators, grouped by month. Compile
          turns the month into the member&apos;s check-in record (reflection +
          goal progress; re-running refreshes the same record).
        </p>
      </header>

      {phase === "loading" ? (
        <p className="m-0 py-6 text-center text-[13px] text-ink-muted" role="status">
          Loading feedback…
        </p>
      ) : null}

      {phase === "error" ? (
        <p className="m-0 py-4 text-[13px] font-semibold text-danger-700" role="alert">
          {error}
        </p>
      ) : null}

      {phase === "view" && review ? (
        review.months.length === 0 ? (
          <p className="m-0 rounded-[8px] bg-surface-soft px-3 py-4 text-[13px] text-ink-muted">
            No feedback has been requested about this member yet. Use Request
            feedback on their row first — responses will collect here.
          </p>
        ) : (
          <div className="flex max-h-[60vh] flex-col gap-4 overflow-y-auto pr-1">
            {!review.canCompile ? (
              <p className="m-0 rounded-[8px] bg-warning-100 px-3 py-2 text-[12.5px] text-warning-700">
                Set ENABLE_QUARTERLY_REVIEWS to compile monthly check-ins. The
                responses below stay readable either way.
              </p>
            ) : null}

            {review.months.map((month) => (
              <section
                key={month.monthKey}
                className="flex flex-col gap-2 rounded-[8px] border border-line-soft p-3"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="m-0 text-[14px] font-bold text-ink">{month.monthLabel}</h3>
                    <CheckInChip month={month} />
                    <span className="text-[12px] text-ink-muted">
                      {month.submitted.length} of {month.submitted.length + month.pending.length}{" "}
                      responses in
                    </span>
                  </div>
                  {review.canCompile ? (
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => handleCompile(month)}
                      disabled={compiling !== null}
                    >
                      {compiling === month.monthKey
                        ? "Compiling…"
                        : month.checkIn
                          ? "Recompile check-in"
                          : "Compile monthly check-in"}
                    </Button>
                  ) : null}
                </div>

                {compileNotes[month.monthKey] ? (
                  <p
                    className={cn(
                      "m-0 text-[12.5px] font-semibold",
                      compileNotes[month.monthKey].startsWith("Could not")
                        ? "text-danger-700"
                        : "text-success-700"
                    )}
                    role="status"
                  >
                    {compileNotes[month.monthKey]}
                  </p>
                ) : null}

                {month.submitted.length === 0 ? (
                  <p className="m-0 text-[12.5px] text-ink-muted">No responses yet.</p>
                ) : (
                  <ul className="m-0 flex list-none flex-col gap-2 p-0">
                    {month.submitted.map((response) => (
                      <li
                        key={response.id}
                        className="rounded-[8px] bg-surface-soft px-3 py-2.5"
                      >
                        <p className="m-0 flex flex-wrap items-baseline gap-2">
                          <span className="text-[12.5px] font-semibold text-ink">
                            {response.collaboratorName}
                          </span>
                          <span className="text-[11.5px] text-ink-muted">
                            {formatDate(response.submittedAtISO)}
                          </span>
                        </p>
                        <p className="m-0 mt-1 whitespace-pre-wrap text-[13px] leading-relaxed text-ink">
                          {response.responseBody}
                        </p>
                      </li>
                    ))}
                  </ul>
                )}

                {month.pending.length > 0 ? (
                  <p className="m-0 text-[12px] text-ink-muted">
                    Awaiting: {month.pending.map((p) => p.collaboratorName).join(", ")}
                  </p>
                ) : null}
              </section>
            ))}
          </div>
        )
      ) : null}

      <ModalFooterV2>
        <Button variant="primary" size="md" onClick={onClose}>
          Done
        </Button>
      </ModalFooterV2>
    </ModalV2>
  );
}

"use client";

import Link from "next/link";
import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { Button, ModalFooterV2, ModalV2, StatusBadge, cn } from "@/components/ui-v2";
import { FeedbackRequestDrawer } from "@/components/people-strategy/feedback-request-drawer";
import { FeedbackReviewDrawer } from "@/components/people-strategy/feedback-review-drawer";
import { compileCheckIn } from "@/lib/people-strategy/check-in-actions";
import { RATING_LABELS } from "@/lib/people-strategy/check-in-rating";
import {
  loadCheckInMonthsForSubject,
  type CheckInMonthRow,
  type CheckInMonthsSnapshot,
} from "@/lib/people-strategy/person-detail-actions";
import {
  calendarDotBackground,
  describeCompileResult,
} from "@/lib/people-strategy/people-performance-selectors";
import { summarizeCheckInGaps } from "@/lib/people-strategy/check-in-readiness";

type Phase = "loading" | "view" | "error";

function formatCompiledAt(iso: string): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(iso));
}

function monthStatusLabel(month: CheckInMonthRow): string {
  if (month.state === "not_due") return "Not due yet";
  if (month.state === "missing") return "Not compiled";
  if (month.performanceRating) return RATING_LABELS[month.performanceRating];
  return "Compiled";
}

function monthStatusTone(month: CheckInMonthRow): "success" | "warning" | "danger" | "neutral" | "info" {
  if (month.state === "not_due") return "neutral";
  if (month.state === "missing") return "danger";
  if (month.readiness.suggestRecompile) return "info";
  if (!month.performanceRating) return "warning";
  if (month.performanceRating === "BEHIND_SCHEDULE") return "danger";
  if (month.performanceRating === "GETTING_STARTED") return "warning";
  return "success";
}

function ReadinessChecklist({ month }: { month: CheckInMonthRow }) {
  const items = [
    {
      ok: month.readiness.hasSelfReflection,
      label: month.readiness.hasSelfReflection
        ? "Self-reflection on file"
        : "Self-reflection not submitted",
    },
    {
      ok: month.readiness.hasMentorReview,
      label: month.readiness.hasMentorReview
        ? `Mentor review on file${month.readiness.goalRatingCount > 0 ? ` · ${month.readiness.goalRatingCount} goal ${month.readiness.goalRatingCount === 1 ? "rating" : "ratings"}` : ""}`
        : "Mentor goal review missing",
    },
    {
      ok: month.readiness.feedbackRequested > 0,
      label:
        month.readiness.feedbackRequested === 0
          ? "No feedback requested"
          : month.readiness.feedbackReceived >= month.readiness.feedbackRequested
            ? `${month.readiness.feedbackReceived} of ${month.readiness.feedbackRequested} feedback responses in`
            : `${month.readiness.feedbackReceived} of ${month.readiness.feedbackRequested} feedback responses in · ${month.readiness.feedbackPending} waiting`,
    },
    {
      ok: month.state !== "missing",
      label:
        month.state === "missing"
          ? "Check-in not compiled"
          : month.compiledAtISO
            ? `Compiled ${formatCompiledAt(month.compiledAtISO)}`
            : "Check-in compiled",
    },
  ];

  return (
    <ul className="m-0 mt-2 flex list-none flex-col gap-1 p-0">
      {items.map((item) => (
        <li
          key={item.label}
          className={cn(
            "flex items-start gap-2 text-[12px] leading-snug",
            item.ok ? "text-[#047857]" : "text-[#717189]"
          )}
        >
          <span aria-hidden className="mt-0.5 shrink-0 font-bold">
            {item.ok ? "✓" : "○"}
          </span>
          <span>{item.label}</span>
        </li>
      ))}
    </ul>
  );
}

function MonthRow({
  month,
  canCompile,
  compiling,
  compileNote,
  onCompile,
  onReviewFeedback,
  onRequestFeedback,
}: {
  month: CheckInMonthRow;
  canCompile: boolean;
  compiling: boolean;
  compileNote: string | null;
  onCompile: (month: CheckInMonthRow) => void;
  onReviewFeedback: () => void;
  onRequestFeedback: () => void;
}) {
  const dot = {
    monthKey: month.monthKey,
    monthLabel: month.monthShortLabel,
    state:
      month.state === "missing"
        ? ("missing" as const)
        : month.state === "not_due"
          ? ("not_due" as const)
          : month.performanceRating
            ? ("rated" as const)
            : ("completed" as const),
    rating: month.performanceRating,
  };

  const showCompile =
    canCompile && month.state !== "not_due" && (month.state === "missing" || month.readiness.suggestRecompile);
  const showRecompile =
    canCompile &&
    month.state !== "not_due" &&
    month.state !== "missing" &&
    !month.readiness.suggestRecompile;

  return (
    <div
      className={cn(
        "flex flex-col gap-2 rounded-[10px] border px-3 py-3",
        month.state === "missing"
          ? "border-[#f5d0a8] bg-[#fffbf5]"
          : month.readiness.suggestRecompile
            ? "border-[#dcd4f5] bg-[#faf7ff]"
            : "border-[#ebebf2] bg-white"
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-2.5">
          <span
            aria-hidden
            className="mt-1 size-3 shrink-0 rounded-full"
            style={{ background: calendarDotBackground(dot) }}
          />
          <div className="min-w-0">
            <p className="m-0 text-[14px] font-semibold text-[#1c1a2e]">{month.monthLabel}</p>
            <StatusBadge tone={monthStatusTone(month)}>{monthStatusLabel(month)}</StatusBadge>
          </div>
        </div>
        {canCompile && month.state !== "not_due" ? (
          <div className="flex shrink-0 flex-col items-end gap-1.5">
            {showCompile ? (
              <Button
                variant="primary"
                size="sm"
                className="border-0 bg-gradient-to-br from-[#5a1da8] via-[#6b21c8] to-[#8b3fe8] shadow-none hover:opacity-95"
                disabled={compiling}
                onClick={() => onCompile(month)}
              >
                {compiling ? "Saving…" : month.readiness.suggestRecompile ? "Recompile" : "Compile"}
              </Button>
            ) : showRecompile ? (
              <Button variant="secondary" size="sm" disabled={compiling} onClick={() => onCompile(month)}>
                {compiling ? "Saving…" : "Recompile"}
              </Button>
            ) : null}
          </div>
        ) : null}
      </div>

      <ReadinessChecklist month={month} />

      <p className="m-0 text-[12px] font-medium text-[#5a1da8]">{month.readiness.actionHint}</p>

      {month.compiledNotesPreview && month.state !== "missing" ? (
        <p className="m-0 rounded-[6px] bg-[#f4f4f8] px-2.5 py-2 text-[11.5px] leading-relaxed text-[#5c5c74] whitespace-pre-line">
          {month.compiledNotesPreview}
        </p>
      ) : null}

      {month.state !== "not_due" ? (
        <div className="flex flex-wrap gap-2">
          {month.readiness.feedbackReceived > 0 ? (
            <button
              type="button"
              onClick={onReviewFeedback}
              className="rounded-lg border border-[#dcd4f5] bg-[#f5f0ff] px-2.5 py-1 text-[11.5px] font-semibold text-[#5a1da8] hover:bg-[#ede8fb]"
            >
              Review feedback
            </button>
          ) : null}
          {month.readiness.feedbackRequested === 0 ? (
            <button
              type="button"
              onClick={onRequestFeedback}
              className="rounded-lg border border-[#dcd4f5] bg-white px-2.5 py-1 text-[11.5px] font-semibold text-[#5a1da8] hover:bg-[#f5f0ff]"
            >
              Request feedback
            </button>
          ) : null}
        </div>
      ) : null}

      {compileNote ? (
        <p
          className={cn(
            "m-0 text-[12px] font-medium",
            compileNote.startsWith("Could not") ? "text-[#c0392b]" : "text-[#0e7c52]"
          )}
          role="status"
        >
          {compileNote}
        </p>
      ) : null}
    </div>
  );
}

/** Check-ins drawer — compile/recompile with a clear missing-items checklist per month. */
export function CheckInsDrawer({
  member,
  onClose,
}: {
  member: { id: string; name: string } | null;
  onClose: () => void;
}) {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>("loading");
  const [snapshot, setSnapshot] = useState<CheckInMonthsSnapshot | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [compilingKey, setCompilingKey] = useState<string | null>(null);
  const [compileNotes, setCompileNotes] = useState<Record<string, string>>({});
  const [feedbackReviewOpen, setFeedbackReviewOpen] = useState(false);
  const [feedbackRequestOpen, setFeedbackRequestOpen] = useState(false);
  const [, startTransition] = useTransition();

  const open = member !== null;
  const memberId = member?.id ?? null;

  useEffect(() => {
    if (!memberId) return;
    setPhase("loading");
    setSnapshot(null);
    setError(null);
    setCompilingKey(null);
    setCompileNotes({});
    setFeedbackReviewOpen(false);
    setFeedbackRequestOpen(false);
    startTransition(async () => {
      try {
        const loaded = await loadCheckInMonthsForSubject({ subjectUserId: memberId });
        setSnapshot(loaded);
        setPhase("view");
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not load check-ins.");
        setPhase("error");
      }
    });
  }, [memberId]);

  function reloadSnapshot() {
    if (!memberId) return;
    startTransition(async () => {
      try {
        const loaded = await loadCheckInMonthsForSubject({ subjectUserId: memberId });
        setSnapshot(loaded);
      } catch {
        // Keep the last good snapshot if refresh fails.
      }
    });
  }

  function handleCompile(month: CheckInMonthRow) {
    if (!memberId || compilingKey) return;
    setCompilingKey(month.monthKey);
    startTransition(async () => {
      try {
        const result = await compileCheckIn({
          userId: memberId,
          month: new Date(`${month.monthKey}-01T00:00:00.000Z`),
        });
        setSnapshot((prev) =>
          prev
            ? {
                ...prev,
                months: prev.months.map((m) =>
                  m.monthKey === month.monthKey
                    ? {
                        ...m,
                        state: result.performanceRating ? "rated" : "completed",
                        performanceRating: result.performanceRating,
                        compiledAtISO: new Date().toISOString(),
                        compiledNotesPreview: result.compiledNotes,
                        readiness: {
                          ...m.readiness,
                          feedbackReceived: result.feedbackResponses,
                          feedbackPending: result.feedbackPending,
                          suggestRecompile: false,
                          actionHint: result.performanceRating
                            ? "Up to date for this month"
                            : "Compiled — recompile when more feedback arrives",
                          missingLabels: [],
                        },
                      }
                    : m
                ),
              }
            : prev
        );
        const sentence = describeCompileResult(month.monthLabel, {
          feedbackResponses: result.feedbackResponses,
          isRecompile: result.isRecompile,
          newResponses: result.newResponses,
        });
        setCompileNotes((prev) => ({ ...prev, [month.monthKey]: sentence }));
        router.refresh();
      } catch (err) {
        setCompileNotes((prev) => ({
          ...prev,
          [month.monthKey]:
            err instanceof Error ? `Could not compile: ${err.message}` : "Could not compile.",
        }));
      } finally {
        setCompilingKey(null);
      }
    });
  }

  function handleCompileAllMissing() {
    if (!snapshot || !memberId || compilingKey) return;
    const targets = snapshot.months.filter(
      (m) => m.state === "missing" || m.readiness.suggestRecompile
    );
    if (targets.length === 0) return;

    startTransition(async () => {
      for (const month of targets) {
        setCompilingKey(month.monthKey);
        try {
          const result = await compileCheckIn({
            userId: memberId,
            month: new Date(`${month.monthKey}-01T00:00:00.000Z`),
          });
          setSnapshot((prev) =>
            prev
              ? {
                  ...prev,
                  months: prev.months.map((m) =>
                    m.monthKey === month.monthKey
                      ? {
                          ...m,
                          state: result.performanceRating ? "rated" : "completed",
                          performanceRating: result.performanceRating,
                          compiledAtISO: new Date().toISOString(),
                          compiledNotesPreview: result.compiledNotes,
                          readiness: {
                            ...m.readiness,
                            feedbackReceived: result.feedbackResponses,
                            feedbackPending: result.feedbackPending,
                            suggestRecompile: false,
                            actionHint: "Up to date for this month",
                            missingLabels: [],
                          },
                        }
                      : m
                  ),
                }
              : prev
          );
          setCompileNotes((prev) => ({
            ...prev,
            [month.monthKey]: describeCompileResult(month.monthLabel, {
              feedbackResponses: result.feedbackResponses,
              isRecompile: result.isRecompile,
              newResponses: result.newResponses,
            }),
          }));
        } catch (err) {
          setCompileNotes((prev) => ({
            ...prev,
            [month.monthKey]:
              err instanceof Error ? `Could not compile: ${err.message}` : "Could not compile.",
          }));
          break;
        }
      }
      setCompilingKey(null);
      router.refresh();
    });
  }

  const missingCount = snapshot?.months.filter((m) => m.state === "missing").length ?? 0;
  const recompileCount =
    snapshot?.months.filter((m) => m.readiness.suggestRecompile).length ?? 0;
  const gapSummary = snapshot
    ? summarizeCheckInGaps(
        snapshot.months.map((m) => ({ state: m.state, readiness: m.readiness }))
      )
    : null;
  const hasAnyFeedback = snapshot?.months.some((m) => m.readiness.feedbackReceived > 0) ?? false;
  const needsFeedbackRequest =
    snapshot?.months.some(
      (m) => m.state !== "not_due" && m.readiness.feedbackRequested === 0
    ) ?? false;

  return (
    <>
      <ModalV2
        open={open && !feedbackReviewOpen && !feedbackRequestOpen}
        onClose={onClose}
        labelledBy="check-ins-title"
        size="md"
        accent="brand"
        motionKey="check-ins"
      >
        <header className="flex flex-col gap-1">
          <p className="m-0 text-[11.5px] font-bold uppercase tracking-[0.06em] text-brand-700">
            Monthly check-ins
          </p>
          <h2 id="check-ins-title" className="m-0 text-[19px] font-bold text-ink">
            {member?.name ?? "Member"}
          </h2>
          <p className="m-0 text-[12.5px] text-ink-muted">
            See exactly what is missing each month, then compile in one click.
          </p>
        </header>

        {phase === "loading" ? (
          <p className="m-0 py-6 text-center text-[13px] text-ink-muted" role="status">
            Loading check-ins…
          </p>
        ) : null}

        {phase === "error" ? (
          <p className="m-0 py-4 text-[13px] font-semibold text-danger-700" role="alert">
            {error}
          </p>
        ) : null}

        {phase === "view" && snapshot ? (
          <>
            <div className="flex flex-wrap gap-2">
              {snapshot.personHref ? (
                <Link
                  href={snapshot.personHref}
                  className="inline-flex items-center rounded-lg border border-[#ebebf2] bg-white px-3 py-1.5 text-[12px] font-semibold text-[#1c1a2e] no-underline hover:bg-[#fafafd]"
                >
                  Person record →
                </Link>
              ) : null}
              {needsFeedbackRequest ? (
                <button
                  type="button"
                  onClick={() => setFeedbackRequestOpen(true)}
                  className="inline-flex items-center rounded-lg border border-[#dcd4f5] bg-[#f5f0ff] px-3 py-1.5 text-[12px] font-semibold text-[#5a1da8] hover:bg-[#ede8fb]"
                >
                  Request feedback
                </button>
              ) : null}
              {hasAnyFeedback ? (
                <button
                  type="button"
                  onClick={() => setFeedbackReviewOpen(true)}
                  className="inline-flex items-center rounded-lg border border-[#dcd4f5] bg-[#f5f0ff] px-3 py-1.5 text-[12px] font-semibold text-[#5a1da8] hover:bg-[#ede8fb]"
                >
                  Review feedback
                </button>
              ) : null}
            </div>

            {gapSummary ? (
              <div className="flex flex-wrap items-center justify-between gap-2 rounded-[8px] bg-[#fdf2e3] px-3 py-2.5">
                <p className="m-0 text-[12.5px] font-medium text-[#8a5d00]">{gapSummary}</p>
                {snapshot.canCompile && (missingCount > 0 || recompileCount > 0) ? (
                  <Button
                    variant="primary"
                    size="sm"
                    className="border-0 bg-gradient-to-br from-[#5a1da8] via-[#6b21c8] to-[#8b3fe8] shadow-none hover:opacity-95"
                    disabled={compilingKey !== null}
                    onClick={handleCompileAllMissing}
                  >
                    {compilingKey ? "Compiling…" : "Compile all missing"}
                  </Button>
                ) : null}
              </div>
            ) : (
              <div className="rounded-[8px] bg-[#ecfdf5] px-3 py-2.5">
                <p className="m-0 text-[12.5px] font-medium text-[#047857]">
                  All accountable months are compiled and up to date.
                </p>
              </div>
            )}

            {!snapshot.canCompile ? (
              <p className="m-0 rounded-[8px] bg-warning-100 px-3 py-2 text-[12.5px] text-warning-700">
                Set ENABLE_QUARTERLY_REVIEWS to compile check-ins.
              </p>
            ) : null}

            <div className="flex max-h-[52vh] flex-col gap-2 overflow-y-auto pr-1">
              {snapshot.months.map((month) => (
                <MonthRow
                  key={month.monthKey}
                  month={month}
                  canCompile={snapshot.canCompile}
                  compiling={compilingKey === month.monthKey}
                  compileNote={compileNotes[month.monthKey] ?? null}
                  onCompile={handleCompile}
                  onReviewFeedback={() => setFeedbackReviewOpen(true)}
                  onRequestFeedback={() => setFeedbackRequestOpen(true)}
                />
              ))}
            </div>
          </>
        ) : null}

        <ModalFooterV2>
          <Button variant="primary" size="md" onClick={onClose}>
            Done
          </Button>
        </ModalFooterV2>
      </ModalV2>

      <FeedbackReviewDrawer
        member={feedbackReviewOpen && member ? member : null}
        onClose={() => {
          setFeedbackReviewOpen(false);
          reloadSnapshot();
        }}
      />
      <FeedbackRequestDrawer
        member={feedbackRequestOpen && member ? member : null}
        onClose={() => {
          setFeedbackRequestOpen(false);
          reloadSnapshot();
        }}
      />
    </>
  );
}

"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import {
  Button,
  ButtonLink,
  ModalFooterV2,
  ModalV2,
  StatusBadge,
  cn,
} from "@/components/ui-v2";
import { compileCheckIn } from "@/lib/people-strategy/check-in-actions";
import { RATING_LABELS } from "@/lib/people-strategy/check-in-rating";
import { GROWTH_TAG_META } from "@/lib/people-strategy/growth-signals";
import {
  loadLatestCheckInDetail,
  type PersonCheckInDetail,
} from "@/lib/people-strategy/person-detail-actions";
import {
  checkInCellStatus,
  deriveNextAction,
  describeCompileResult,
  feedbackCellStatus,
  quarterlyCellStatus,
  workloadCellStatus,
  type CheckInDotState,
} from "@/lib/people-strategy/people-performance-selectors";
import type { PeoplePerformanceRow } from "@/lib/people-strategy/people-performance";

/**
 * Person Detail drawer — answers "what is going on with this person?" without
 * bouncing across the portal. One header, one primary action, then the five
 * real surfaces (feedback, check-ins, workload, reviews) at a glance.
 *
 * It shows aggregate facts only; raw confidential collaborator feedback stays
 * behind the leadership-gated "Review feedback" surface (the review drawer),
 * never inline here.
 */

const DOT_TONE: Record<CheckInDotState, string> = {
  rated: "bg-success-500",
  completed: "bg-brand-400",
  missing: "bg-line",
};

function CheckInDots({ row }: { row: PeoplePerformanceRow }) {
  return (
    <div className="flex items-center gap-1.5" aria-hidden>
      {row.calendarDots.map((dot) => (
        <span key={dot.monthKey} className="flex flex-col items-center gap-1">
          <span className={cn("size-3 rounded-full", DOT_TONE[dot.state])} />
          <span className="text-[10px] text-ink-muted">{dot.monthLabel}</span>
        </span>
      ))}
    </div>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-2 border-t border-line-soft pt-3">
      <h3 className="m-0 text-[12px] font-bold uppercase tracking-[0.05em] text-ink-muted">
        {title}
      </h3>
      {children}
    </section>
  );
}

export function PersonDetailDrawer({
  row,
  monthLabel,
  monthShortLabel,
  quarter,
  quarterlyEnabled,
  onClose,
  onReviewFeedback,
  onRequestFeedback,
}: {
  /** The member to detail; null = closed. */
  row: PeoplePerformanceRow | null;
  /** "June 2026" */
  monthLabel: string;
  /** "Jun" — short month label for compact cells. */
  monthShortLabel: string;
  /** "2026-Q2" */
  quarter: string;
  quarterlyEnabled: boolean;
  onClose: () => void;
  onReviewFeedback: (member: { id: string; name: string }) => void;
  onRequestFeedback: (member: { id: string; name: string }) => void;
}) {
  const router = useRouter();
  const [checkIn, setCheckIn] = useState<PersonCheckInDetail>(null);
  const [checkInLoading, setCheckInLoading] = useState(false);
  const [compileNote, setCompileNote] = useState<string | null>(null);
  const [compileError, setCompileError] = useState(false);
  const [compiling, setCompiling] = useState(false);
  const [, startTransition] = useTransition();

  const open = row !== null;
  const memberId = row?.id ?? null;

  useEffect(() => {
    if (!memberId) return;
    setCheckIn(null);
    setCompileNote(null);
    setCompileError(false);
    setCheckInLoading(true);
    startTransition(async () => {
      try {
        const detail = await loadLatestCheckInDetail({ subjectUserId: memberId });
        setCheckIn(detail);
      } catch {
        setCheckIn(null);
      } finally {
        setCheckInLoading(false);
      }
    });
  }, [memberId]);

  if (!row) {
    return (
      <ModalV2 open={false} onClose={onClose} labelledBy="person-detail-title">
        <span />
      </ModalV2>
    );
  }

  const name = row.name || row.email;
  const member = { id: row.id, name };
  const action = deriveNextAction(row.facts, { monthLabel, quarter });
  const feedback = feedbackCellStatus(row.facts);
  const checkInStatus = checkInCellStatus(row.facts, monthShortLabel);
  const workload = workloadCellStatus(row.facts);
  const quarterly = quarterlyCellStatus(row.facts, quarterlyEnabled);
  const activeActions = [...row.leadActions, ...row.executingActions];
  const topActions = activeActions.slice(0, 3);
  const nextDeadline = activeActions.find((a) => a.overdue) ?? activeActions[0] ?? null;
  const strategyHref = `/admin/instructors/${row.id}/manage/strategy`;

  function handleCompile() {
    if (!memberId || compiling || !quarterlyEnabled) return;
    setCompiling(true);
    setCompileNote(null);
    setCompileError(false);
    startTransition(async () => {
      try {
        const result = await compileCheckIn({
          userId: memberId,
          month: new Date(`${row!.facts.currentMonthKey}-01T00:00:00.000Z`),
        });
        setCompileNote(
          describeCompileResult(monthLabel, {
            feedbackResponses: result.feedbackResponses,
            isRecompile: result.isRecompile,
            newResponses: result.newResponses,
          })
        );
        router.refresh();
      } catch (err) {
        setCompileError(true);
        setCompileNote(
          err instanceof Error ? `Could not compile: ${err.message}` : "Could not compile."
        );
      } finally {
        setCompiling(false);
      }
    });
  }

  // The main action button: one concrete next step, wired to the right surface.
  function renderMainAction() {
    switch (action.kind) {
      case "review-feedback":
      case "await-feedback":
        return (
          <Button variant="primary" size="md" onClick={() => onReviewFeedback(member)}>
            {action.actionLabel}
          </Button>
        );
      case "request-feedback":
        return (
          <Button variant="primary" size="md" onClick={() => onRequestFeedback(member)}>
            {action.actionLabel}
          </Button>
        );
      case "compile-check-in":
        return quarterlyEnabled ? (
          <Button
            variant="primary"
            size="md"
            onClick={handleCompile}
            disabled={compiling}
          >
            {compiling ? "Compiling…" : action.actionLabel}
          </Button>
        ) : (
          <ButtonLink href={strategyHref} variant="primary" size="md">
            Open profile
          </ButtonLink>
        );
      case "open-review":
      case "support-checkin":
      case "assign-mentor":
      case "recognize-growth":
        return (
          <ButtonLink href={strategyHref} variant="primary" size="md">
            {action.actionLabel}
          </ButtonLink>
        );
      default:
        return (
          <ButtonLink href={strategyHref} variant="secondary" size="md">
            Open full profile
          </ButtonLink>
        );
    }
  }

  return (
    <ModalV2
      open={open}
      onClose={onClose}
      labelledBy="person-detail-title"
      size="lg"
      accent="brand"
      motionKey="person-detail"
    >
      {/* A. Header */}
      <header className="flex flex-col gap-1.5">
        <h2 id="person-detail-title" className="m-0 text-[20px] font-bold text-ink">
          {name}
        </h2>
        <p className="m-0 text-[12.5px] text-ink-muted">
          {[row.role, ...row.departments].filter(Boolean).join(" · ") || "No role on file"}
        </p>
        {row.expertise.length > 0 ? (
          <div className="flex flex-wrap gap-1.5">
            {row.expertise.slice(0, 6).map((tag) => (
              <span
                key={tag}
                className="rounded-full bg-surface-soft px-2 py-0.5 text-[11px] text-ink-muted ring-1 ring-line-soft"
              >
                {tag}
              </span>
            ))}
          </div>
        ) : null}
        <div className="mt-1 flex flex-col gap-0.5 rounded-[10px] bg-surface-soft px-3 py-2 ring-1 ring-line-soft">
          <span className="text-[10.5px] font-bold uppercase tracking-[0.06em] text-ink-muted">
            Next step
          </span>
          <span className="text-[13px] font-semibold text-ink">
            {action.actionLabel}
            <span className="font-normal text-ink-muted"> · {action.reason}</span>
          </span>
        </div>
      </header>

      <div className="mt-1 flex max-h-[62vh] flex-col gap-4 overflow-y-auto pr-1">
        {/* C. Feedback */}
        <Section title="Feedback">
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge tone={feedback.tone}>{feedback.text}</StatusBadge>
            <span className="text-[12.5px] text-ink-muted">
              {row.facts.monthFeedback.submitted} received ·{" "}
              {row.facts.monthFeedback.pending} awaiting
            </span>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" size="sm" onClick={() => onReviewFeedback(member)}>
              Review feedback
            </Button>
            <Button variant="ghost" size="sm" onClick={() => onRequestFeedback(member)}>
              Request feedback
            </Button>
          </div>
        </Section>

        {/* D. Check-ins */}
        <Section title="Check-ins">
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge tone={checkInStatus.tone}>{checkInStatus.text}</StatusBadge>
            <CheckInDots row={row} />
          </div>
          {checkInLoading ? (
            <p className="m-0 text-[12.5px] text-ink-muted">Loading latest check-in…</p>
          ) : checkIn ? (
            <div className="rounded-[8px] bg-surface-soft px-3 py-2">
              <p className="m-0 text-[12px] font-semibold text-ink">
                {checkIn.monthLabel} check-in
                {checkIn.performanceRating
                  ? ` · ${RATING_LABELS[checkIn.performanceRating]}`
                  : ""}
              </p>
              {checkIn.compiledNotes ? (
                <p className="m-0 mt-1 whitespace-pre-wrap text-[12.5px] leading-relaxed text-ink-muted">
                  {checkIn.compiledNotes}
                </p>
              ) : null}
            </div>
          ) : (
            <p className="m-0 text-[12.5px] text-ink-muted">No check-in compiled yet.</p>
          )}
          {quarterlyEnabled ? (
            <div>
              <Button
                variant="secondary"
                size="sm"
                onClick={handleCompile}
                disabled={compiling}
              >
                {compiling
                  ? "Compiling…"
                  : row.facts.needsCheckIn
                    ? `Compile ${monthShortLabel} check-in`
                    : `Recompile ${monthShortLabel} check-in`}
              </Button>
              {compileNote ? (
                <p
                  className={cn(
                    "m-0 mt-1.5 text-[12.5px] font-semibold",
                    compileError ? "text-danger-700" : "text-success-700"
                  )}
                  role="status"
                >
                  {compileNote}
                </p>
              ) : null}
            </div>
          ) : null}
        </Section>

        {/* E. Workload */}
        <Section title="Workload">
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge tone={workload.tone}>{workload.text}</StatusBadge>
            {nextDeadline ? (
              <span className="text-[12.5px] text-ink-muted">
                Next: {nextDeadline.deadlineLabel}
              </span>
            ) : null}
          </div>
          {topActions.length > 0 ? (
            <ul className="m-0 flex list-none flex-col gap-1.5 p-0">
              {topActions.map((item) => (
                <li
                  key={item.id}
                  className="flex items-center justify-between gap-2 text-[12.5px]"
                >
                  <span className="min-w-0 truncate text-ink">{item.title}</span>
                  <span
                    className={cn(
                      "shrink-0 text-[11.5px] font-medium",
                      item.overdue ? "text-danger-700" : "text-ink-muted"
                    )}
                  >
                    {item.overdue ? "Overdue · " : ""}
                    {item.deadlineLabel}
                  </span>
                </li>
              ))}
            </ul>
          ) : null}
        </Section>

        {/* F. Reviews */}
        <Section title="Quarterly review">
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge tone={quarterly.tone}>{quarterly.text}</StatusBadge>
            {row.quarterly ? (
              <span className="text-[12.5px] text-ink-muted">
                {row.quarterly.quarter} · {row.quarterly.matrixLabel}
              </span>
            ) : (
              <span className="text-[12.5px] text-ink-muted">No review on file</span>
            )}
          </div>
          {row.quarterly ? (
            <p className="m-0 text-[12.5px] text-ink-muted">
              Performance: {RATING_LABELS[row.quarterly.performanceRating]} · Potential:{" "}
              {RATING_LABELS[row.quarterly.potentialRating]}
              {row.quarterly.successionFlag ? " · Succession candidate" : ""}
            </p>
          ) : null}
        </Section>

        {/* G. Mentorship & growth */}
        <Section title="Mentorship & growth">
          <div className="flex flex-wrap items-center gap-2">
            {row.mentorName ? (
              <StatusBadge tone="success">Mentor · {row.mentorName}</StatusBadge>
            ) : row.facts.needsMentor ? (
              <StatusBadge tone="warning">No mentor assigned</StatusBadge>
            ) : (
              <StatusBadge tone="neutral">No mentor on file</StatusBadge>
            )}
          </div>
          {!row.mentorName && row.facts.needsMentor ? (
            <p className="m-0 text-[12.5px] text-ink-muted">
              No mentor is assigned. Assign a mentor or create a mentorship plan.
            </p>
          ) : null}
          {row.growthTags.length > 0 ? (
            <div className="flex flex-wrap gap-1.5">
              {row.growthTags.map((tag) => {
                const meta = GROWTH_TAG_META[tag];
                const tone: "danger" | "warning" | "success" =
                  tag === "AT_RISK_OF_DISENGAGING"
                    ? "danger"
                    : meta.kind === "watch"
                      ? "warning"
                      : "success";
                return (
                  <StatusBadge key={tag} tone={tone}>
                    {meta.label}
                  </StatusBadge>
                );
              })}
            </div>
          ) : (
            <p className="m-0 text-[12px] text-ink-muted">
              No growth signals tagged yet.
            </p>
          )}
        </Section>
      </div>

      <ModalFooterV2>
        <Button variant="ghost" size="md" onClick={onClose}>
          Close
        </Button>
        {renderMainAction()}
      </ModalFooterV2>
    </ModalV2>
  );
}

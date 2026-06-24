"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { Button, ButtonLink, cn } from "@/components/ui-v2";
import { compileCheckIn } from "@/lib/people-strategy/check-in-actions";
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
} from "@/lib/people-strategy/people-performance-selectors";
import type { PeoplePerformanceRow } from "@/lib/people-strategy/people-performance";

/** Compact leadership actions for the person profile page. */
export function PersonReviewPanel({
  row,
  monthLabel,
  monthShortLabel,
  quarter,
  quarterlyEnabled,
  onReviewFeedback,
  onRequestFeedback,
}: {
  row: PeoplePerformanceRow;
  monthLabel: string;
  monthShortLabel: string;
  quarter: string;
  quarterlyEnabled: boolean;
  onReviewFeedback: (member: { id: string; name: string }) => void;
  onRequestFeedback: (member: { id: string; name: string }) => void;
}) {
  const router = useRouter();
  const [checkIn, setCheckIn] = useState<PersonCheckInDetail>(null);
  const [compileNote, setCompileNote] = useState<string | null>(null);
  const [compileError, setCompileError] = useState(false);
  const [compiling, setCompiling] = useState(false);
  const [, startTransition] = useTransition();

  const memberId = row.id;
  const name = row.name || row.email;
  const member = { id: row.id, name };
  const action = deriveNextAction(row.facts, { monthLabel, quarter });
  const feedback = feedbackCellStatus(row.facts);
  const checkInStatus = checkInCellStatus(row.facts, monthShortLabel);
  const quarterly = quarterlyCellStatus(row.facts, quarterlyEnabled);
  const strategyHref = `/admin/instructors/${row.id}/manage/strategy`;

  useEffect(() => {
    startTransition(async () => {
      try {
        const detail = await loadLatestCheckInDetail({ subjectUserId: memberId });
        setCheckIn(detail);
      } catch {
        setCheckIn(null);
      }
    });
  }, [memberId]);

  function handleCompile() {
    if (compiling || !quarterlyEnabled) return;
    setCompiling(true);
    setCompileNote(null);
    setCompileError(false);
    startTransition(async () => {
      try {
        const result = await compileCheckIn({
          userId: memberId,
          month: new Date(`${row.facts.currentMonthKey}-01T00:00:00.000Z`),
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

  function renderPrimaryAction() {
    switch (action.kind) {
      case "review-feedback":
      case "await-feedback":
        return (
          <Button variant="primary" size="sm" onClick={() => onReviewFeedback(member)}>
            {action.actionLabel}
          </Button>
        );
      case "request-feedback":
        return (
          <Button variant="primary" size="sm" onClick={() => onRequestFeedback(member)}>
            {action.actionLabel}
          </Button>
        );
      case "compile-check-in":
        return quarterlyEnabled ? (
          <Button variant="primary" size="sm" onClick={handleCompile} disabled={compiling}>
            {compiling ? "Compiling…" : action.actionLabel}
          </Button>
        ) : (
          <ButtonLink href={strategyHref} variant="primary" size="sm">
            Open strategy
          </ButtonLink>
        );
      case "open-review":
      case "support-checkin":
      case "assign-mentor":
      case "recognize-growth":
        return (
          <ButtonLink href={strategyHref} variant="primary" size="sm">
            {action.actionLabel}
          </ButtonLink>
        );
      default:
        return null;
    }
  }

  const statusLine = [
    `Check-in: ${checkInStatus.text}`,
    `Feedback: ${feedback.text}`,
    row.mentorName ? `Mentor: ${row.mentorName}` : row.facts.needsMentor ? "Mentor: unassigned" : null,
    `Review: ${quarterly.text}`,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <div className="mb-4 rounded-[12px] border border-[#ebebf2] bg-white px-4 py-3.5 shadow-[0_1px_2px_rgba(20,20,50,0.03)]">
      <p className="m-0 text-[14px] font-semibold leading-snug text-[#1c1a2e]">
        {action.actionLabel}
        <span className="font-normal text-[#717189]"> · {action.reason}</span>
      </p>

      <div className="mt-2.5 flex flex-wrap items-center gap-2">
        {renderPrimaryAction()}
        <Button variant="secondary" size="sm" onClick={() => onReviewFeedback(member)}>
          Review feedback
        </Button>
        <Button variant="ghost" size="sm" onClick={() => onRequestFeedback(member)}>
          Request feedback
        </Button>
        {quarterlyEnabled && row.facts.needsCheckIn && action.kind !== "compile-check-in" ? (
          <Button variant="secondary" size="sm" onClick={handleCompile} disabled={compiling}>
            {compiling ? "Saving…" : `Compile ${monthShortLabel}`}
          </Button>
        ) : null}
      </div>

      <p className="m-0 mt-2.5 text-[12.5px] leading-relaxed text-[#717189]">{statusLine}</p>

      {checkIn?.performanceRating ? (
        <p className="m-0 mt-1 text-[12px] text-[#9a9ab0]">
          Latest check-in: {checkIn.monthLabel}
        </p>
      ) : null}

      {compileNote ? (
        <p
          className={cn(
            "m-0 mt-2 text-[12.5px] font-semibold",
            compileError ? "text-danger-700" : "text-success-700"
          )}
          role="status"
        >
          {compileNote}
        </p>
      ) : null}
    </div>
  );
}

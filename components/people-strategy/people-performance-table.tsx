"use client";

import { useState } from "react";
import Link from "next/link";

import {
  Button,
  ButtonLink,
  DataTableShell,
  StatusBadge,
  TableCell,
  TableHeadCell,
  TableV2,
  cn,
} from "@/components/ui-v2";
import { PersonLink } from "@/components/people-strategy/person-link";
import { MonthlyCheckInDots } from "@/components/people-strategy/monthly-check-in-dots";
import { FeedbackRequestDrawer } from "@/components/people-strategy/feedback-request-drawer";
import { FeedbackReviewDrawer } from "@/components/people-strategy/feedback-review-drawer";
import { RATING_LABELS } from "@/lib/people-strategy/check-in-rating";
import type { GoalRatingColor } from "@prisma/client";
import type {
  DashboardActionView,
  PeopleDashboardRow,
} from "@/lib/people-strategy/people-dashboard";
import type { PeoplePerformanceRow } from "@/lib/people-strategy/people-performance";
import type { StatusTone } from "@/components/ui-v2";

/**
 * People & Performance table (ui-v2). One concise row per member: identity,
 * department/expertise, the top active work split Lead vs Executing,
 * quarterly review placement, calendar-anchored monthly check-in dots, and
 * concrete signal chips. Names open the person's 360 preview in place
 * (preview-first, master plan §18); "Open record" goes to the deep
 * review/check-in workspace; "Request feedback" opens the reviewable drawer.
 */

const RATING_BADGE_TONE: Record<GoalRatingColor, StatusTone> = {
  BEHIND_SCHEDULE: "danger",
  GETTING_STARTED: "warning",
  ACHIEVED: "success",
  ABOVE_AND_BEYOND: "brand",
};

const TREND_CLASS: Record<PeopleDashboardRow["trend"], string> = {
  Improving: "text-success-700",
  Declining: "text-danger-700",
  Stable: "text-ink-muted",
  "Insufficient Data": "text-ink-muted",
};

function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

function ActionLines({
  heading,
  headingClass,
  actions,
}: {
  heading: string;
  headingClass: string;
  actions: DashboardActionView[];
}) {
  if (actions.length === 0) return null;
  return (
    <div className="min-w-0">
      <p className={cn("m-0 text-[10.5px] font-bold uppercase tracking-[0.05em]", headingClass)}>
        {heading} ({actions.length})
      </p>
      <ul className="m-0 flex list-none flex-col gap-0.5 p-0">
        {actions.slice(0, 2).map((action) => (
          <li key={action.id} className="truncate text-[12px] leading-snug">
            <Link
              href={`/actions/${action.id}`}
              className={cn(
                "no-underline",
                action.overdue ? "font-semibold text-danger-700" : "text-ink"
              )}
            >
              {action.title}
            </Link>
            <span className={action.overdue ? "text-danger-700" : "text-ink-muted"}>
              {" · "}
              {action.overdue ? "overdue " : "due "}
              {action.deadlineLabel}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function PeoplePerformanceTable({
  rows,
  currentQuarter,
  canRequestFeedback,
}: {
  rows: PeoplePerformanceRow[];
  /** "2026-Q2" — labels the reviews-due flag. */
  currentQuarter: string;
  /** False hides the request actions (ENABLE_ACTION_TRACKER_EMAILS off). */
  canRequestFeedback: boolean;
}) {
  const [feedbackMember, setFeedbackMember] = useState<{ id: string; name: string } | null>(
    null
  );
  const [reviewMember, setReviewMember] = useState<{ id: string; name: string } | null>(
    null
  );

  return (
    <>
      <DataTableShell>
        <TableV2 className="min-w-[980px]">
          <thead>
            <tr>
              <TableHeadCell>Member</TableHeadCell>
              <TableHeadCell>Department / Expertise</TableHeadCell>
              <TableHeadCell>Active work</TableHeadCell>
              <TableHeadCell>Quarterly review</TableHeadCell>
              <TableHeadCell>Monthly check-ins</TableHeadCell>
              <TableHeadCell>Signals</TableHeadCell>
              <TableHeadCell className="text-right">Actions</TableHeadCell>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <TableCell colSpan={7} className="py-8 text-center text-ink-muted">
                  No members match the current filter.
                </TableCell>
              </tr>
            ) : (
              rows.map((row) => {
                const displayName = row.name || row.email;
                const totalActive = row.leadActions.length + row.executingActions.length;
                const shownActive =
                  Math.min(row.leadActions.length, 2) +
                  Math.min(row.executingActions.length, 2);
                return (
                  <tr key={row.id} className="align-top">
                    {/* Member */}
                    <TableCell className="align-top">
                      <div className="flex items-start gap-2.5">
                        <span
                          aria-hidden
                          className="flex size-8 shrink-0 items-center justify-center rounded-full bg-brand-100 text-[11.5px] font-bold text-brand-800"
                        >
                          {initialsOf(displayName)}
                        </span>
                        <div className="min-w-0">
                          <PersonLink
                            id={row.id}
                            className="text-[13.5px] font-semibold text-ink hover:underline"
                          >
                            {displayName}
                          </PersonLink>
                          <p className="m-0 text-[12px] text-ink-muted">
                            {row.role ?? "—"}
                          </p>
                          {row.mentorName ? (
                            <p className="m-0 text-[11.5px] text-ink-muted">
                              Mentor:{" "}
                              <PersonLink id={row.mentorId} className="text-inherit">
                                {row.mentorName}
                              </PersonLink>
                            </p>
                          ) : null}
                        </div>
                      </div>
                    </TableCell>

                    {/* Department / Expertise */}
                    <TableCell className="align-top">
                      <p className="m-0 text-[12.5px] font-semibold text-ink">
                        {row.departments.length > 0 ? row.departments.join(", ") : "—"}
                      </p>
                      {row.expertise.length > 0 ? (
                        <p className="m-0 text-[11.5px] text-ink-muted">
                          {row.expertise.slice(0, 3).join(" · ")}
                        </p>
                      ) : null}
                    </TableCell>

                    {/* Active work */}
                    <TableCell className="align-top">
                      {totalActive === 0 ? (
                        <span className="text-[12px] text-ink-muted">No active actions</span>
                      ) : (
                        <div className="flex max-w-[260px] flex-col gap-1.5">
                          <ActionLines
                            heading="Lead"
                            headingClass="text-info-700"
                            actions={row.leadActions}
                          />
                          <ActionLines
                            heading="Executing"
                            headingClass="text-success-700"
                            actions={row.executingActions}
                          />
                          {totalActive > shownActive ? (
                            <Link
                              href={`/admin/instructors/${row.id}/manage#people-strategy`}
                              className="text-[11.5px] font-semibold text-brand-700 no-underline hover:underline"
                            >
                              View all {totalActive} →
                            </Link>
                          ) : null}
                        </div>
                      )}
                    </TableCell>

                    {/* Quarterly review */}
                    <TableCell className="align-top">
                      {row.quarterly ? (
                        <div className="flex flex-col items-start gap-1">
                          <span className="text-[11px] text-ink-muted">
                            {row.quarterly.quarter} · {row.quarterly.matrixLabel}
                          </span>
                          <StatusBadge
                            tone={RATING_BADGE_TONE[row.quarterly.performanceRating]}
                            title={`Performance: ${RATING_LABELS[row.quarterly.performanceRating]}`}
                          >
                            Perf · {RATING_LABELS[row.quarterly.performanceRating]}
                          </StatusBadge>
                          <StatusBadge
                            tone={RATING_BADGE_TONE[row.quarterly.potentialRating]}
                            title={`Potential: ${RATING_LABELS[row.quarterly.potentialRating]}`}
                          >
                            Pot · {RATING_LABELS[row.quarterly.potentialRating]}
                          </StatusBadge>
                          {row.facts.reviewDue ? (
                            <StatusBadge tone="warning">
                              No review for {currentQuarter}
                            </StatusBadge>
                          ) : null}
                        </div>
                      ) : (
                        <StatusBadge tone="warning">No review yet</StatusBadge>
                      )}
                    </TableCell>

                    {/* Monthly check-ins */}
                    <TableCell className="align-top">
                      <div className="flex flex-col gap-1">
                        <MonthlyCheckInDots dots={row.calendarDots} />
                        <span
                          className={cn(
                            "text-[11.5px] font-semibold",
                            TREND_CLASS[row.trend]
                          )}
                        >
                          {row.trend === "Improving"
                            ? "Improving ↑"
                            : row.trend === "Declining"
                              ? "Declining ↓"
                              : row.trend === "Stable"
                                ? "Stable →"
                                : "Not enough data"}
                        </span>
                      </div>
                    </TableCell>

                    {/* Signals */}
                    <TableCell className="align-top">
                      {row.signals.length === 0 ? (
                        <span className="text-[12px] text-ink-muted">—</span>
                      ) : (
                        <div className="flex max-w-[200px] flex-wrap gap-1">
                          {row.signals.map((signal) => (
                            <StatusBadge key={signal.label} tone={signal.tone}>
                              {signal.label}
                            </StatusBadge>
                          ))}
                        </div>
                      )}
                    </TableCell>

                    {/* Actions */}
                    <TableCell className="align-top text-right">
                      <div className="flex flex-col items-end gap-1.5">
                        {canRequestFeedback ? (
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() =>
                              setFeedbackMember({ id: row.id, name: displayName })
                            }
                          >
                            Request feedback
                          </Button>
                        ) : null}
                        {row.facts.feedback.submitted + row.facts.feedback.outstanding > 0 ? (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() =>
                              setReviewMember({ id: row.id, name: displayName })
                            }
                          >
                            Review feedback ({row.facts.feedback.submitted} in)
                          </Button>
                        ) : null}
                        <ButtonLink
                          href={`/admin/instructors/${row.id}/manage#people-strategy`}
                          variant="ghost"
                          size="sm"
                        >
                          Open review / check-in
                        </ButtonLink>
                      </div>
                    </TableCell>
                  </tr>
                );
              })
            )}
          </tbody>
        </TableV2>
      </DataTableShell>

      <FeedbackRequestDrawer
        member={feedbackMember}
        onClose={() => setFeedbackMember(null)}
      />
      <FeedbackReviewDrawer
        member={reviewMember}
        onClose={() => setReviewMember(null)}
      />
    </>
  );
}

"use client";

import type { GoalRatingColor } from "@prisma/client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { KeyboardEvent, MouseEvent } from "react";

import { cn } from "@/components/ui-v2";
import { initialsFromName } from "@/lib/command-center/shared";
import { RATING_LABELS } from "@/lib/people-strategy/check-in-rating";
import { RATING_COLORS } from "@/lib/people-strategy/people-dashboard-selectors";
import type { PeoplePerformanceRow } from "@/lib/people-strategy/people-performance";
import { mentorReviewCellStatus } from "@/lib/people-strategy/people-performance-selectors";
import { formatRoleLabel } from "@/lib/user-title";
import { PeopleMentorAssignCell } from "@/components/people-strategy/people-mentor-assign-cell";

const AVATAR_HUES = ["#5a1da8", "#e07b2d", "#0891b2", "#0e7c52", "#7c3aed", "#1d6fd6"];

function avatarHue(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return AVATAR_HUES[Math.abs(hash) % AVATAR_HUES.length];
}

function RatingBadge({ rating }: { rating: GoalRatingColor | null | undefined }) {
  if (!rating) return null;
  const meta = RATING_COLORS[rating];
  return (
    <span
      className="inline-flex whitespace-nowrap rounded-md px-1.5 py-0.5 text-[11px] font-semibold"
      style={{ color: meta.text, background: meta.bg }}
    >
      {RATING_LABELS[rating]}
    </span>
  );
}

const STATUS_TONE = {
  neutral: "bg-[#f4f4f8] text-[#717189]",
  warning: "bg-[#fdf2e3] text-[#b45309]",
  danger: "bg-[#fdecea] text-[#c0392b]",
  success: "bg-[#ecfdf5] text-[#0e7c52]",
  info: "bg-[#f3ecff] text-[#5a1da8]",
} as const;

function dedupePeopleRows(rows: PeoplePerformanceRow[]): PeoplePerformanceRow[] {
  const seen = new Set<string>();
  return rows.filter((row) => {
    if (seen.has(row.id)) return false;
    seen.add(row.id);
    return true;
  });
}

function personProfileHref(id: string, personHrefBase = "/people"): string {
  if (personHrefBase.startsWith("/mentorship/people")) {
    return `${personHrefBase}/${id}`;
  }
  return `${personHrefBase}/${id}?from=people`;
}

function stopRowNavigation(event: MouseEvent | KeyboardEvent) {
  event.stopPropagation();
}

function truncatePlan(text: string, max = 90): string {
  const cleaned = text.replace(/\s+/g, " ").trim();
  if (cleaned.length <= max) return cleaned;
  return `${cleaned.slice(0, max - 1).trimEnd()}…`;
}

/**
 * Simple person cards — name, status, mentor. Tap to open.
 */
export function PeoplePerformanceTable({
  rows,
  personHrefBase = "/people",
  mentorCandidates = [],
  canAssignMentors = false,
}: {
  rows: PeoplePerformanceRow[];
  monthLabel: string;
  monthShortLabel: string;
  quarter: string;
  quarterlyEnabled: boolean;
  personHrefBase?: string;
  mentorCandidates?: Array<{
    id: string;
    name: string;
    role?: string | null;
    title?: string | null;
  }>;
  canAssignMentors?: boolean;
}) {
  const router = useRouter();
  const tableRows = dedupePeopleRows(rows);

  function openPerson(row: PeoplePerformanceRow) {
    router.push(personProfileHref(row.id, personHrefBase));
  }

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>, row: PeoplePerformanceRow) {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      openPerson(row);
    }
  }

  if (tableRows.length === 0) {
    return (
      <div className="px-4 py-12 text-center text-[14px] text-[#9a9ab0]">
        No one in this group.
      </div>
    );
  }

  return (
    <div className="flex flex-col divide-y divide-[#f1f1f6]">
      {tableRows.map((row) => {
        const name = row.name || row.email;
        const initials = initialsFromName(name);
        const roleTitle = formatRoleLabel(row.role);
        const titleLine = row.title?.trim() || null;
        const meta = [titleLine, roleTitle].filter(Boolean).join(" · ");
        const status = mentorReviewCellStatus(row.facts);
        const review = row.latestGoalReview;
        const overdue = row.facts.overdueActionCount;

        return (
          <div
            key={row.id}
            role="link"
            tabIndex={0}
            onClick={() => openPerson(row)}
            onKeyDown={(event) => handleKeyDown(event, row)}
            aria-label={`Open ${name}`}
            className="group flex cursor-pointer flex-col gap-3 px-4 py-4 hover:bg-[#faf7ff] focus-visible:bg-[#faf7ff] focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[#6b21c8] sm:flex-row sm:items-center sm:gap-4"
          >
            <div className="flex min-w-0 flex-1 items-center gap-3">
              <span
                aria-hidden
                className="inline-flex size-11 shrink-0 items-center justify-center rounded-full text-[13px] font-bold text-white"
                style={{ background: avatarHue(name) }}
              >
                {initials}
              </span>
              <div className="min-w-0 flex-1">
                <Link
                  href={personProfileHref(row.id, personHrefBase)}
                  onClick={stopRowNavigation}
                  className="block truncate text-[15px] font-bold text-[#1c1a2e] no-underline group-hover:text-[#5a1da8]"
                >
                  {name}
                </Link>
                {meta ? (
                  <p className="m-0 mt-0.5 truncate text-[12.5px] text-[#9a9ab0]">{meta}</p>
                ) : null}
                <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1" onClick={stopRowNavigation}>
                  <a
                    href={`mailto:${row.email}`}
                    className="truncate text-[12px] text-[#5a1da8] no-underline hover:underline"
                    onClick={stopRowNavigation}
                  >
                    {row.email}
                  </a>
                  {row.phone ? (
                    <a
                      href={`tel:${row.phone}`}
                      className="text-[12px] text-[#717189] no-underline hover:text-[#5a1da8]"
                      onClick={stopRowNavigation}
                    >
                      {row.phone}
                    </a>
                  ) : null}
                </div>
              </div>
            </div>

            <div className="flex min-w-0 flex-col gap-2 sm:w-[200px] sm:shrink-0">
              <span
                className={cn(
                  "inline-flex w-fit max-w-full truncate rounded-full px-2.5 py-1 text-[12px] font-semibold",
                  STATUS_TONE[status.tone]
                )}
              >
                {status.text === "—" ? "No review track" : status.text}
              </span>
              {review ? (
                <div className="flex min-w-0 flex-col gap-0.5">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <RatingBadge rating={review.overallRating} />
                    <span className="text-[11px] text-[#9a9ab0]">{review.cycleMonthLabel}</span>
                  </div>
                  {review.planOfAction ? (
                    <p
                      className="m-0 truncate text-[12px] leading-snug text-[#717189]"
                      title={review.planOfAction}
                    >
                      {truncatePlan(review.planOfAction)}
                    </p>
                  ) : null}
                </div>
              ) : null}
              {overdue > 0 ? (
                <span className="text-[12px] font-semibold text-[#c0392b]">
                  {overdue} overdue action{overdue === 1 ? "" : "s"}
                </span>
              ) : null}
            </div>

            <div
              className="flex min-w-0 items-center justify-between gap-3 sm:w-[160px] sm:shrink-0 sm:flex-col sm:items-end sm:justify-center"
              onClick={stopRowNavigation}
            >
              {canAssignMentors ? (
                <PeopleMentorAssignCell
                  menteeId={row.id}
                  menteeName={name}
                  mentorId={row.mentorId}
                  mentorName={row.mentorName}
                  candidates={mentorCandidates}
                  canAssign
                />
              ) : (
                <div className="min-w-0 text-right">
                  <p className="m-0 text-[11px] font-medium uppercase tracking-[0.04em] text-[#9a9ab0]">
                    Mentor
                  </p>
                  <p
                    className={cn(
                      "m-0 truncate text-[13px] font-semibold",
                      row.mentorName ? "text-[#3a3a52]" : "text-[#c0392b]"
                    )}
                  >
                    {row.mentorName ?? "Unassigned"}
                  </p>
                </div>
              )}
              <span className="hidden text-[12px] font-semibold text-[#5a1da8] sm:inline">
                Open →
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

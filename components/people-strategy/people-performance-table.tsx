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

/** Board members have no mentee mentorship home — don't send anyone there. */
function canOpenPersonHome(
  row: PeoplePerformanceRow,
  personHrefBase: string
): boolean {
  if (!row.mentorshipExempt) return true;
  return !personHrefBase.startsWith("/mentorship/people");
}

function stopRowNavigation(event: MouseEvent | KeyboardEvent) {
  event.stopPropagation();
}

/**
 * Simple person cards — name, status, mentor. Tap to open.
 */
export function PeoplePerformanceTable({
  rows,
  personHrefBase = "/people",
  mentorCandidates = [],
  chairCandidates = [],
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
  chairCandidates?: Array<{
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
    if (!canOpenPersonHome(row, personHrefBase)) return;
    router.push(personProfileHref(row.id, personHrefBase));
  }

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>, row: PeoplePerformanceRow) {
    if (!canOpenPersonHome(row, personHrefBase)) return;
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
        const canOpen = canOpenPersonHome(row, personHrefBase);
        const profileHref = personProfileHref(row.id, personHrefBase);

        return (
          <div
            key={row.id}
            role={canOpen ? "link" : undefined}
            tabIndex={canOpen ? 0 : undefined}
            onClick={canOpen ? () => openPerson(row) : undefined}
            onKeyDown={canOpen ? (event) => handleKeyDown(event, row) : undefined}
            aria-label={canOpen ? `Open ${name}` : undefined}
            className={cn(
              "group flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:gap-4",
              canOpen
                ? "cursor-pointer hover:bg-[#faf7ff] focus-visible:bg-[#faf7ff] focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[#6b21c8]"
                : "cursor-default"
            )}
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
                {canOpen ? (
                  <Link
                    href={profileHref}
                    onClick={stopRowNavigation}
                    className="block truncate text-[15px] font-bold text-[#1c1a2e] no-underline group-hover:text-[#5a1da8]"
                  >
                    {name}
                  </Link>
                ) : (
                  <p className="m-0 truncate text-[15px] font-bold text-[#1c1a2e]">{name}</p>
                )}
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
                {row.mentorshipExempt
                  ? "Board member"
                  : status.text === "—"
                    ? "No review track"
                    : status.text}
              </span>
              {!row.mentorshipExempt && review ? (
                <div className="flex flex-wrap items-center gap-1.5">
                  <RatingBadge rating={review.overallRating} />
                  <span className="text-[11px] text-[#9a9ab0]">{review.cycleMonthLabel}</span>
                </div>
              ) : null}
              {!row.mentorshipExempt && overdue > 0 ? (
                <span className="text-[12px] font-semibold text-[#c0392b]">
                  {overdue} overdue action{overdue === 1 ? "" : "s"}
                </span>
              ) : null}
            </div>

            <div
              className="flex min-w-0 items-center justify-between gap-3 sm:w-[200px] sm:shrink-0 sm:flex-col sm:items-end sm:justify-center"
              onClick={stopRowNavigation}
            >
              {canAssignMentors ? (
                <div className="flex w-full min-w-0 flex-col gap-3 sm:items-end">
                  <div className="min-w-0 sm:text-right">
                    <p className="m-0 text-[11px] font-medium uppercase tracking-[0.04em] text-[#9a9ab0]">
                      Mentor
                    </p>
                    <PeopleMentorAssignCell
                      menteeId={row.id}
                      menteeName={name}
                      mentorId={row.mentorId ?? null}
                      mentorName={row.mentorName ?? null}
                      candidates={mentorCandidates}
                      canAssign
                      kind="mentor"
                      mentorshipExempt={Boolean(row.mentorshipExempt)}
                    />
                  </div>
                  {!row.mentorshipExempt ? (
                    <div className="min-w-0 sm:text-right">
                      <p className="m-0 text-[11px] font-medium uppercase tracking-[0.04em] text-[#9a9ab0]">
                        Role Chair
                      </p>
                      <PeopleMentorAssignCell
                        menteeId={row.id}
                        menteeName={name}
                        mentorId={row.chairId ?? null}
                        mentorName={row.chairName ?? null}
                        candidates={
                          chairCandidates.length > 0 ? chairCandidates : mentorCandidates
                        }
                        canAssign
                        kind="chair"
                        requireMentorship
                        hasActiveMentorship={Boolean(row.mentorId)}
                      />
                    </div>
                  ) : null}
                </div>
              ) : (
                <div className="flex min-w-0 flex-col gap-2 text-right">
                  <div>
                    <p className="m-0 text-[11px] font-medium uppercase tracking-[0.04em] text-[#9a9ab0]">
                      Mentor
                    </p>
                    <p
                      className={cn(
                        "m-0 truncate text-[13px] font-semibold",
                        row.mentorshipExempt
                          ? "text-[#3a3a52]"
                          : row.mentorName
                            ? "text-[#3a3a52]"
                            : "text-[#c0392b]"
                      )}
                    >
                      {row.mentorshipExempt
                        ? "Board member"
                        : (row.mentorName ?? "Unassigned")}
                    </p>
                  </div>
                  {!row.mentorshipExempt ? (
                    <div>
                      <p className="m-0 text-[11px] font-medium uppercase tracking-[0.04em] text-[#9a9ab0]">
                        Role Chair
                      </p>
                      <p
                        className={cn(
                          "m-0 truncate text-[13px] font-semibold",
                          row.chairName ? "text-[#3a3a52]" : "text-[#c0392b]"
                        )}
                      >
                        {row.chairName ?? "Not assigned"}
                      </p>
                    </div>
                  ) : null}
                </div>
              )}
              {canOpen ? (
                <span className="hidden text-[12px] font-semibold text-[#5a1da8] sm:inline">
                  Open →
                </span>
              ) : null}
            </div>
          </div>
        );
      })}
    </div>
  );
}

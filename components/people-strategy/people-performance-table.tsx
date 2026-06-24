"use client";

import type { GoalRatingColor } from "@prisma/client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { KeyboardEvent, MouseEvent } from "react";

import { cn } from "@/components/ui-v2";
import { PeopleCheckInCell } from "@/components/people-strategy/people-check-in-cell";
import { initialsFromName } from "@/lib/command-center/shared";
import { RATING_LABELS } from "@/lib/people-strategy/check-in-rating";
import { RATING_COLORS } from "@/lib/people-strategy/people-dashboard-selectors";
import type { DashboardActionView } from "@/lib/people-strategy/people-dashboard";
import type { PeoplePerformanceRow } from "@/lib/people-strategy/people-performance";
import {
  derivePeopleFlagText,
  feedbackStatusLabel,
  nextCheckInDisplay,
  peopleChairTier,
  performanceQuickBullets,
  potentialQuickBullets,
} from "@/lib/people-strategy/people-performance-selectors";
import { formatRoleLabel } from "@/lib/user-title";

const AVATAR_HUES = ["#5a1da8", "#e07b2d", "#0891b2", "#0e7c52", "#7c3aed", "#1d6fd6"];

function avatarHue(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return AVATAR_HUES[Math.abs(hash) % AVATAR_HUES.length];
}

function checkInSeed(id: string): number {
  return id.split("").reduce((sum, char) => sum + char.charCodeAt(0), 0);
}

function RatingBadge({ rating }: { rating: GoalRatingColor | null | undefined }) {
  if (!rating) {
    return null;
  }
  const meta = RATING_COLORS[rating];
  return (
    <span
      className="inline-flex whitespace-nowrap rounded-md px-2 py-1 text-[12px] font-semibold"
      style={{ color: meta.text, background: meta.bg }}
    >
      {RATING_LABELS[rating]}
    </span>
  );
}

function bulletTone(text: string): "neutral" | "warning" | "danger" | "success" {
  const lower = text.toLowerCase();
  if (lower.includes("overdue") || lower.includes("declining") || lower.includes("at risk")) {
    return "danger";
  }
  if (
    lower.includes("missing") ||
    lower.includes("due") ||
    lower.includes("no review")
  ) {
    return "warning";
  }
  if (lower.includes("improving") || lower.includes("on track") || lower.includes("ready for")) {
    return "success";
  }
  return "neutral";
}

const BULLET_TONE_CLASS = {
  neutral: "text-[#5c5c74]",
  warning: "text-[#b45309]",
  danger: "text-[#c0392b]",
  success: "text-[#0e7c52]",
} as const;

function uniqueMemberActions(
  lead: DashboardActionView[],
  executing: DashboardActionView[]
): DashboardActionView[] {
  const seen = new Set<string>();
  const merged: DashboardActionView[] = [];
  for (const action of [...lead, ...executing]) {
    if (seen.has(action.id)) continue;
    seen.add(action.id);
    merged.push(action);
  }
  return merged;
}

function dedupePeopleRows(rows: PeoplePerformanceRow[]): PeoplePerformanceRow[] {
  const seen = new Set<string>();
  return rows.filter((row) => {
    if (seen.has(row.id)) return false;
    seen.add(row.id);
    return true;
  });
}

function QuickBullets({ items }: { items: string[] }) {
  const shown = items.slice(0, 2);
  const hidden = items.length - shown.length;

  return (
    <div className="flex min-w-[120px] flex-col gap-1.5">
      {shown.map((item, index) => {
        const tone = bulletTone(item);
        return (
          <div key={`${index}-${item}`} className="flex items-start gap-2">
            <span
              aria-hidden
              className={cn(
                "mt-[6px] size-1.5 shrink-0 rounded-full",
                tone === "danger" && "bg-[#c0392b]",
                tone === "warning" && "bg-[#e0a008]",
                tone === "success" && "bg-[#0e9f6e]",
                tone === "neutral" && "bg-[#c4c4d4]"
              )}
            />
            <span className={cn("text-[13px] font-medium leading-[1.4]", BULLET_TONE_CLASS[tone])}>
              {item}
            </span>
          </div>
        );
      })}
      {hidden > 0 ? (
        <span className="text-[11px] text-[#9a9ab0]">+{hidden} more</span>
      ) : null}
    </div>
  );
}

function MentorCell({ mentorName, chair }: { mentorName: string | null; chair: string }) {
  return (
    <div className="flex min-w-[96px] flex-col gap-0.5">
      <span className="text-[13.5px] font-semibold leading-snug text-[#3a3a52]">
        {mentorName ?? "Unassigned"}
      </span>
      <span className="text-[12px] leading-snug text-[#9a9ab0]">{chair}</span>
    </div>
  );
}

const MAX_ACTIONS_SHOWN = 3;

function activeActionsFootnote(row: PeoplePerformanceRow): string | null {
  if (row.facts.workloadWarning) return row.facts.workloadWarning;
  if (row.facts.activeActionCount <= 2 && row.facts.trend === "Declining") {
    return "Light workload – performance declining";
  }
  return null;
}

function ActiveActionsCell({ row }: { row: PeoplePerformanceRow }) {
  const allActions = uniqueMemberActions(row.leadActions, row.executingActions);
  const actions = [...allActions]
    .sort((a, b) => Number(b.overdue) - Number(a.overdue))
    .slice(0, MAX_ACTIONS_SHOWN);
  const hidden = allActions.length - actions.length;
  const footnote = activeActionsFootnote(row);

  if (allActions.length === 0) {
    return (
      <div className="min-w-[168px]">
        <span className="text-[13px] text-[#9a9ab0]">No active actions</span>
        {footnote ? (
          <p className="mt-1.5 text-[12px] font-semibold leading-snug text-[#c0392b]">{footnote}</p>
        ) : null}
      </div>
    );
  }

  return (
    <div className="flex min-w-[168px] flex-col gap-1.5">
      <ul className="m-0 flex list-none flex-col gap-1.5 p-0">
        {actions.map((action) => (
          <li
            key={action.id}
            className={cn(
              "border-l-2 pl-2",
              action.overdue ? "border-[#e5484d] bg-[#fdf3f2] py-0.5" : "border-[#e4e4ee]"
            )}
          >
            <Link
              href={`/actions/${action.id}`}
              onClick={stopRowNavigation}
              className="block text-[13px] font-medium leading-snug text-[#3a3a52] no-underline hover:text-[#5a1da8]"
            >
              {action.title}
            </Link>
            <span
              className={cn(
                "text-[11px]",
                action.overdue ? "font-semibold text-[#c0392b]" : "text-[#9a9ab0]"
              )}
            >
              {action.overdue ? "Overdue" : "Due"} · {action.deadlineLabel}
            </span>
          </li>
        ))}
      </ul>
      {hidden > 0 ? <span className="text-[11px] text-[#9a9ab0]">+{hidden} more</span> : null}
      {footnote ? (
        <p className="text-[12px] font-semibold leading-snug text-[#c0392b]">{footnote}</p>
      ) : null}
    </div>
  );
}

function feedbackTone(
  facts: PeoplePerformanceRow["facts"]
): "neutral" | "warning" | "success" | "info" {
  const f = facts.monthFeedback;
  if (f.submitted > 0 && (facts.needsCheckIn || f.newSinceCheckIn)) return "info";
  if (f.requested === 0) return "neutral";
  if (f.submitted === 0) return "warning";
  if (f.pending > 0) return "warning";
  return "success";
}

const FEEDBACK_TONE_CLASS = {
  neutral: "bg-[#f4f4f8] text-[#717189]",
  warning: "bg-[#fdf2e3] text-[#b45309]",
  success: "bg-[#ecfdf5] text-[#0e7c52]",
  info: "bg-[#f3ecff] text-[#5a1da8]",
} as const;

function FeedbackStatusCell({ row }: { row: PeoplePerformanceRow }) {
  const label = feedbackStatusLabel(row.facts);
  const tone = feedbackTone(row.facts);

  return (
    <span
      className={cn(
        "inline-flex whitespace-nowrap rounded-md px-2 py-1 text-[12px] font-semibold",
        FEEDBACK_TONE_CLASS[tone]
      )}
    >
      {label}
    </span>
  );
}

const TABLE_COLUMNS = [
  "Person",
  "Mentor",
  "Actions",
  "Performance",
  "Potential",
  "Check-in",
  "Feedback",
] as const;

function personProfileHref(id: string): string {
  return `/people/${id}?from=people`;
}

function stopRowNavigation(event: MouseEvent | KeyboardEvent) {
  event.stopPropagation();
}

/**
 * People & Reviews table — tap a row to open that person's full profile.
 */
export function PeoplePerformanceTable({
  rows,
  monthLabel,
  monthShortLabel,
  quarterlyEnabled,
}: {
  rows: PeoplePerformanceRow[];
  monthLabel: string;
  monthShortLabel: string;
  quarter: string;
  quarterlyEnabled: boolean;
}) {
  const router = useRouter();
  const tableRows = dedupePeopleRows(rows);

  function openPerson(row: PeoplePerformanceRow) {
    router.push(personProfileHref(row.id));
  }

  function handleRowKeyDown(event: KeyboardEvent<HTMLTableRowElement>, row: PeoplePerformanceRow) {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      openPerson(row);
    }
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[980px] border-collapse text-left">
        <thead>
          <tr className="border-b border-[#f1f1f6] bg-[#fafafd]">
            {TABLE_COLUMNS.map((label) => (
              <th
                key={label}
                className="px-4 py-3 text-left text-[11px] font-semibold tracking-[0.02em] text-[#717189]"
              >
                {label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={7} className="px-4 py-12 text-center text-[13px] text-[#9a9ab0]">
                No one matches this view.
              </td>
            </tr>
          ) : (
            tableRows.map((row) => {
              const name = row.name || row.email;
              const initials = initialsFromName(name);
              const roleTitle = formatRoleLabel(row.role);
              const dept = row.departments[0] ?? null;
              const next = nextCheckInDisplay(row.facts, monthShortLabel, checkInSeed(row.id));
              const flagText = derivePeopleFlagText(row.facts);
              const chair = peopleChairTier(row.role);

              return (
                <tr
                  key={row.id}
                  role="link"
                  tabIndex={0}
                  onClick={() => openPerson(row)}
                  onKeyDown={(event) => handleRowKeyDown(event, row)}
                  aria-label={`Open profile for ${name}`}
                  className="group cursor-pointer border-b border-[#f4f4f8] align-top last:border-b-0 hover:bg-[#f5f0ff]/70 focus-visible:bg-[#f5f0ff] focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[#6b21c8]"
                >
                  <td className="px-4 py-4">
                    <div className="flex items-center gap-3">
                      <span
                        aria-hidden
                        className="inline-flex size-10 shrink-0 items-center justify-center rounded-full text-[13px] font-bold text-white"
                        style={{ background: avatarHue(name) }}
                      >
                        {initials}
                      </span>
                      <span>
                        <Link
                          href={personProfileHref(row.id)}
                          onClick={stopRowNavigation}
                          className="block text-[15px] font-bold text-[#1c1a2e] no-underline group-hover:text-[#5a1da8] hover:underline"
                        >
                          {name}
                        </Link>
                        <span className="mt-0.5 block text-[12.5px] text-[#9a9ab0]">
                          {roleTitle}
                          {dept ? ` · ${dept}` : ""}
                        </span>
                        {(row.isProvisional || flagText) && (
                          <span className="mt-1 flex flex-wrap gap-1">
                            {row.isProvisional ? (
                              <span className="rounded-[5px] bg-[#fdf2e3] px-1.5 py-0.5 text-[10px] font-semibold text-[#8a5d00]">
                                Provisional
                              </span>
                            ) : null}
                            {flagText ? (
                              <span className="rounded-[5px] bg-[#fdecea] px-1.5 py-0.5 text-[10px] font-semibold text-[#c0392b]">
                                ⚑ {flagText}
                              </span>
                            ) : null}
                          </span>
                        )}
                      </span>
                    </div>
                  </td>
                  <td className="min-w-[112px] px-4 py-4">
                    <MentorCell mentorName={row.mentorName} chair={chair} />
                  </td>
                  <td className="min-w-[168px] px-4 py-4">
                    <ActiveActionsCell row={row} />
                  </td>
                  <td className="min-w-[128px] px-4 py-4">
                    {row.quarterly?.performanceRating ? (
                      <RatingBadge rating={row.quarterly.performanceRating} />
                    ) : (
                      <QuickBullets
                        items={performanceQuickBullets(row, monthShortLabel)}
                      />
                    )}
                  </td>
                  <td className="min-w-[128px] px-4 py-4">
                    {row.quarterly?.potentialRating ? (
                      <RatingBadge rating={row.quarterly.potentialRating} />
                    ) : (
                      <QuickBullets items={potentialQuickBullets(row)} />
                    )}
                  </td>
                  <td className="min-w-[148px] px-4 py-4">
                    <PeopleCheckInCell
                      row={row}
                      monthLabel={monthLabel}
                      monthShortLabel={monthShortLabel}
                      nextLabel={next.label}
                      nextUrgent={next.urgent}
                      quarterlyEnabled={quarterlyEnabled}
                    />
                  </td>
                  <td className="px-4 py-4">
                    <FeedbackStatusCell row={row} />
                  </td>
                </tr>
              );
            })
          )}
        </tbody>
      </table>
    </div>
  );
}

import { prisma } from "@/lib/prisma";

import { loadPeopleDashboard, type PeopleDashboardRow } from "./people-dashboard";
import {
  buildCheckInCalendarDots,
  buildSignals,
  computePerformanceStats,
  currentQuarterLabel,
  factsMatchFilter,
  monthKeyUTC,
  type CheckInCalendarDot,
  type MemberFeedbackStatus,
  type PerformanceFilter,
  type PerformanceRowFacts,
  type PerformanceSignal,
  type PerformanceStats,
} from "./people-performance-selectors";

/**
 * People & Performance (`/people/performance`) — data loader.
 *
 * Wraps the existing Leadership People Dashboard loader (same live Action
 * Tracker / Quarterly Review / Monthly Check-In reads — no second source of
 * truth) and layers on what the new surface needs: feedback-request status
 * per member, the needs-check-in / review-due facts for the current
 * month/quarter, calendar-anchored check-in dots (missing months render as an
 * explicit state), and the composed signal chips.
 *
 * Leadership/Board only at the page level; this loader holds no secrets the
 * dashboard rows don't already carry (confidential feedback BODIES are never
 * read here — only counts).
 */

export type PeoplePerformanceRow = PeopleDashboardRow & {
  facts: PerformanceRowFacts;
  signals: PerformanceSignal[];
  calendarDots: CheckInCalendarDot[];
};

export type PeoplePerformanceResult = {
  rows: PeoplePerformanceRow[];
  stats: PerformanceStats;
  /** "2026-Q2" — the quarter the reviews-due flag refers to. */
  currentQuarter: string;
  /** "2026-06" — the month the needs-check-in flag refers to. */
  currentMonthKey: string;
};

async function loadFeedbackStatusByMember(
  memberIds: string[]
): Promise<Map<string, MemberFeedbackStatus>> {
  if (memberIds.length === 0) return new Map();

  const [totals, outstanding] = await Promise.all([
    prisma.feedbackRequest.groupBy({
      by: ["subjectUserId"],
      where: { subjectUserId: { in: memberIds } },
      _count: { _all: true },
      _max: { month: true },
    }),
    prisma.feedbackRequest.groupBy({
      by: ["subjectUserId"],
      where: { subjectUserId: { in: memberIds }, submittedAt: null },
      _count: { _all: true },
    }),
  ]);

  const outstandingById = new Map(
    outstanding.map((g) => [g.subjectUserId, g._count._all])
  );
  const result = new Map<string, MemberFeedbackStatus>();
  for (const g of totals) {
    const open = outstandingById.get(g.subjectUserId) ?? 0;
    result.set(g.subjectUserId, {
      outstanding: open,
      submitted: g._count._all - open,
      lastRequestedMonthKey: g._max.month ? monthKeyUTC(g._max.month) : null,
    });
  }
  return result;
}

const EMPTY_FEEDBACK: MemberFeedbackStatus = {
  outstanding: 0,
  submitted: 0,
  lastRequestedMonthKey: null,
};

export async function loadPeoplePerformance(
  now: Date = new Date()
): Promise<PeoplePerformanceResult> {
  const currentQuarter = currentQuarterLabel(now);
  const currentMonthKey = monthKeyUTC(now);

  const dashboardRows = await loadPeopleDashboard(now);
  const feedbackByMember = await loadFeedbackStatusByMember(
    dashboardRows.map((r) => r.id)
  );

  const rows: PeoplePerformanceRow[] = dashboardRows.map((row) => {
    const feedback = feedbackByMember.get(row.id) ?? EMPTY_FEEDBACK;
    const facts: PerformanceRowFacts = {
      workloadWarning: row.workloadWarning,
      // The action views already carry the overdue flag computed by the
      // dashboard loader — reuse it rather than re-deriving deadlines.
      hasOverdueAction:
        row.leadActions.some((a) => a.overdue) ||
        row.executingActions.some((a) => a.overdue),
      trend: row.trend,
      successor: row.successor,
      needsCheckIn: !row.recentCheckIns.some((c) => c.monthKey === currentMonthKey),
      reviewDue: !row.quarterly || row.quarterly.quarter !== currentQuarter,
      feedback,
      currentMonthKey,
    };
    return {
      ...row,
      facts,
      signals: buildSignals(facts),
      calendarDots: buildCheckInCalendarDots(row.recentCheckIns, now),
    };
  });

  return {
    rows,
    stats: computePerformanceStats(rows),
    currentQuarter,
    currentMonthKey,
  };
}

/** Server-side filter + search over the loaded rows (rows are already capped). */
export function filterPerformanceRows(
  rows: PeoplePerformanceRow[],
  filter: PerformanceFilter,
  q?: string
): PeoplePerformanceRow[] {
  const query = q?.trim().toLowerCase();
  return rows.filter((row) => {
    if (!factsMatchFilter(row.facts, filter)) return false;
    if (query) {
      const haystack = [
        row.name,
        row.email,
        row.role ?? "",
        ...row.departments,
        ...row.expertise,
      ]
        .join(" ")
        .toLowerCase();
      if (!haystack.includes(query)) return false;
    }
    return true;
  });
}

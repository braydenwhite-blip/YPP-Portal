import { prisma } from "@/lib/prisma";

import { loadPeopleDashboard, type PeopleDashboardRow } from "./people-dashboard";
import {
  buildCheckInCalendarDots,
  buildSignals,
  computePerformanceStats,
  currentQuarterLabel,
  EMPTY_CURRENT_MONTH_FEEDBACK,
  factsMatchFilter,
  monthKeyUTC,
  parseMonthKey,
  type CheckInCalendarDot,
  type CurrentMonthFeedback,
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

/**
 * Per-member feedback position for ONE month (the current month). Reads only
 * counts and the latest response timestamp — never response bodies — so this
 * stays safe to compute for every row without touching confidential content.
 * `newSinceCheckIn` compares the latest response against the month's compiled
 * check-in timestamp, which is how "new feedback since check-in" is derived.
 */
async function loadCurrentMonthFeedback(
  memberIds: string[],
  monthStart: Date
): Promise<Map<string, CurrentMonthFeedback>> {
  if (memberIds.length === 0) return new Map();

  const [requests, latestResponse, checkIns] = await Promise.all([
    prisma.feedbackRequest.groupBy({
      by: ["subjectUserId"],
      where: { subjectUserId: { in: memberIds }, month: monthStart },
      _count: { _all: true },
    }),
    prisma.feedbackRequest.groupBy({
      by: ["subjectUserId"],
      where: {
        subjectUserId: { in: memberIds },
        month: monthStart,
        submittedAt: { not: null },
      },
      _count: { _all: true },
      _max: { submittedAt: true },
    }),
    prisma.checkIn.findMany({
      where: { userId: { in: memberIds }, month: monthStart },
      select: { userId: true, createdAt: true },
    }),
  ]);

  const requestedById = new Map(requests.map((g) => [g.subjectUserId, g._count._all]));
  const submittedById = new Map(
    latestResponse.map((g) => [
      g.subjectUserId,
      { count: g._count._all, latest: g._max.submittedAt ?? null },
    ])
  );
  const checkInAtById = new Map(checkIns.map((c) => [c.userId, c.createdAt]));

  const result = new Map<string, CurrentMonthFeedback>();
  for (const id of memberIds) {
    const requested = requestedById.get(id) ?? 0;
    if (requested === 0 && !submittedById.has(id)) continue;
    const submittedInfo = submittedById.get(id);
    const submitted = submittedInfo?.count ?? 0;
    const checkInAt = checkInAtById.get(id) ?? null;
    const newSinceCheckIn = Boolean(
      checkInAt && submittedInfo?.latest && submittedInfo.latest > checkInAt
    );
    result.set(id, {
      requested,
      submitted,
      pending: Math.max(0, requested - submitted),
      newSinceCheckIn,
    });
  }
  return result;
}

export async function loadPeoplePerformance(
  now: Date = new Date()
): Promise<PeoplePerformanceResult> {
  const currentQuarter = currentQuarterLabel(now);
  const currentMonthKey = monthKeyUTC(now);

  const monthStart = parseMonthKey(currentMonthKey) ?? new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)
  );

  const dashboardRows = await loadPeopleDashboard(now);
  const memberIds = dashboardRows.map((r) => r.id);
  const [feedbackByMember, monthFeedbackByMember] = await Promise.all([
    loadFeedbackStatusByMember(memberIds),
    loadCurrentMonthFeedback(memberIds, monthStart),
  ]);

  const rows: PeoplePerformanceRow[] = dashboardRows.map((row) => {
    const feedback = feedbackByMember.get(row.id) ?? EMPTY_FEEDBACK;
    const monthFeedback =
      monthFeedbackByMember.get(row.id) ?? EMPTY_CURRENT_MONTH_FEEDBACK;
    const activeActions = [...row.leadActions, ...row.executingActions];
    const overdueActionCount = activeActions.filter((a) => a.overdue).length;
    const facts: PerformanceRowFacts = {
      workloadWarning: row.workloadWarning,
      // The action views already carry the overdue flag computed by the
      // dashboard loader — reuse it rather than re-deriving deadlines.
      hasOverdueAction: overdueActionCount > 0,
      trend: row.trend,
      successor: row.successor,
      needsCheckIn: !row.recentCheckIns.some((c) => c.monthKey === currentMonthKey),
      reviewDue: !row.quarterly || row.quarterly.quarter !== currentQuarter,
      hasAnyReview: Boolean(row.quarterly),
      feedback,
      monthFeedback,
      activeActionCount: activeActions.length,
      overdueActionCount,
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

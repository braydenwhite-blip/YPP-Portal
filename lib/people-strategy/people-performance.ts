import type { GoalReviewStatus, GrowthTag } from "@prisma/client";

import { prisma } from "@/lib/prisma";

import {
  hasDisengagementRisk,
  isGrowthOpportunity,
} from "./growth-signals";
import {
  loadCompletedContributionsByMember,
  type CompletedContributionsSummary,
} from "./completed-contributions";
import { loadPeopleDashboard, type PeopleDashboardRow } from "./people-dashboard";
import {
  buildCheckInCalendarDots,
  buildSignals,
  CHECK_IN_ACCOUNTABLE_FROM_MONTH_KEY,
  computePerformanceStats,
  currentQuarterLabel,
  EMPTY_CURRENT_MONTH_FEEDBACK,
  factsMatchFilter,
  isCheckInMonthAccountable,
  monthKeyUTC,
  parseMonthKey,
  roleExpectsMentor,
  rowMatchesPeopleReviewsFilters,
  type CheckInCalendarDot,
  type CurrentMonthFeedback,
  type MemberFeedbackStatus,
  type PeopleReviewsTableFilters,
  type PerformanceFilter,
  type PerformanceRowFacts,
  type PerformanceSignal,
  type PerformanceStats,
} from "./people-performance-selectors";
import { computeProvisionalStatus } from "./provisional";
import {
  deriveMonthlyCheckInQueueItem,
  sortMonthlyCheckInQueue,
  type MonthlyCheckInQueueItem,
} from "./monthly-check-in-queue";

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
  /** Within the provisional hire window and not yet confirmed. */
  isProvisional: boolean;
  /** Human-curated growth signals on this member (officer assessment). */
  growthTags: GrowthTag[];
  /** Recent completed work — positive contribution evidence (deterministic). */
  recentCompleted: CompletedContributionsSummary;
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
 * Human-curated `MemberGrowthTag`s per member (the leadership growth signals
 * already shown on the public profile to officers). Read here so the People
 * memory layer can flag "Ready for more" and "At risk of disengaging" without a
 * per-row query — these are officer-visible assessments, never response bodies.
 */
async function loadGrowthSignalsByMember(
  memberIds: string[]
): Promise<Map<string, GrowthTag[]>> {
  if (memberIds.length === 0) return new Map();
  const tags = await prisma.memberGrowthTag.findMany({
    where: { userId: { in: memberIds } },
    select: { userId: true, tag: true },
    orderBy: { createdAt: "asc" },
  });
  const map = new Map<string, GrowthTag[]>();
  for (const t of tags) {
    const list = map.get(t.userId);
    if (list) list.push(t.tag);
    else map.set(t.userId, [t.tag]);
  }
  return map;
}

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

async function loadProvisionalFlags(
  memberIds: string[],
  now: Date
): Promise<Map<string, boolean>> {
  if (memberIds.length === 0) return new Map();
  const users = await prisma.user.findMany({
    where: { id: { in: memberIds } },
    select: { id: true, provisionalStart: true, provisionalConfirmedAt: true },
  });
  return new Map(
    users.map((user) => [
      user.id,
      computeProvisionalStatus(
        user.provisionalStart,
        user.provisionalConfirmedAt,
        now
      ).isProvisional,
    ])
  );
}

async function loadCurrentMonthReflectionFlags(
  memberIds: string[],
  monthStart: Date,
  monthEnd: Date
): Promise<Map<string, boolean>> {
  if (memberIds.length === 0) return new Map();
  const rows = await prisma.monthlySelfReflection.findMany({
    where: {
      menteeId: { in: memberIds },
      cycleMonth: { gte: monthStart, lt: monthEnd },
    },
    select: { menteeId: true },
  });
  return new Map(rows.map((r) => [r.menteeId, true]));
}

async function loadCurrentMonthReviewStatus(
  memberIds: string[],
  monthStart: Date,
  monthEnd: Date
): Promise<Map<string, GoalReviewStatus>> {
  if (memberIds.length === 0) return new Map();
  const rows = await prisma.mentorGoalReview.findMany({
    where: {
      menteeId: { in: memberIds },
      cycleMonth: { gte: monthStart, lt: monthEnd },
    },
    select: { menteeId: true, status: true },
    orderBy: { createdAt: "desc" },
  });
  const map = new Map<string, GoalReviewStatus>();
  for (const row of rows) {
    if (!map.has(row.menteeId)) map.set(row.menteeId, row.status);
  }
  return map;
}

export type MonthlyCheckInQueueResult = PeoplePerformanceResult & {
  queue: MonthlyCheckInQueueItem[];
  monthShortLabel: string;
};

/** People performance rows plus the mockup-style monthly check-in queue. */
export async function loadMonthlyCheckInQueue(
  now: Date = new Date()
): Promise<MonthlyCheckInQueueResult> {
  const base = await loadPeoplePerformance(now);
  const monthStart =
    parseMonthKey(base.currentMonthKey) ??
    new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const monthEnd = new Date(
    Date.UTC(monthStart.getUTCFullYear(), monthStart.getUTCMonth() + 1, 1)
  );
  const memberIds = base.rows.map((r) => r.id);

  const [reflectionFlags, reviewStatus] = await Promise.all([
    loadCurrentMonthReflectionFlags(memberIds, monthStart, monthEnd),
    loadCurrentMonthReviewStatus(memberIds, monthStart, monthEnd),
  ]);

  const monthShortLabel = new Intl.DateTimeFormat("en-US", {
    month: "short",
    timeZone: "UTC",
  }).format(monthStart);

  const queue = sortMonthlyCheckInQueue(
    base.rows.map((row) =>
      deriveMonthlyCheckInQueueItem(row, {
        hasSelfReflection: reflectionFlags.get(row.id) ?? false,
        reviewStatus: reviewStatus.get(row.id) ?? null,
        monthShortLabel,
      })
    )
  );

  return { ...base, queue, monthShortLabel };
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
  const [feedbackByMember, monthFeedbackByMember, growthByMember, completedByMember, provisionalByMember] =
    await Promise.all([
      loadFeedbackStatusByMember(memberIds),
      loadCurrentMonthFeedback(memberIds, monthStart),
      loadGrowthSignalsByMember(memberIds),
      loadCompletedContributionsByMember(memberIds, { now }),
      loadProvisionalFlags(memberIds, now),
    ]);

  const rows: PeoplePerformanceRow[] = dashboardRows.map((row) => {
    const feedback = feedbackByMember.get(row.id) ?? EMPTY_FEEDBACK;
    const monthFeedback =
      monthFeedbackByMember.get(row.id) ?? EMPTY_CURRENT_MONTH_FEEDBACK;
    const growthTags = growthByMember.get(row.id) ?? [];
    const activeActions = [...row.leadActions, ...row.executingActions];
    const overdueActionCount = activeActions.filter((a) => a.overdue).length;
    // Mentorship: a missing mentor is only a gap for mentor-eligible roles
    // (instructors / chapter presidents — the program's two lanes).
    const hasMentor = Boolean(row.mentorId);
    const mentorEligible = roleExpectsMentor(row.role);
    const facts: PerformanceRowFacts = {
      workloadWarning: row.workloadWarning,
      // The action views already carry the overdue flag computed by the
      // dashboard loader — reuse it rather than re-deriving deadlines.
      hasOverdueAction: overdueActionCount > 0,
      trend: row.trend,
      successor: row.successor,
      needsCheckIn:
        isCheckInMonthAccountable(
          currentMonthKey,
          CHECK_IN_ACCOUNTABLE_FROM_MONTH_KEY,
          currentMonthKey
        ) &&
        !row.recentCheckIns.some((c) => c.monthKey === currentMonthKey),
      reviewDue: !row.quarterly || row.quarterly.quarter !== currentQuarter,
      hasAnyReview: Boolean(row.quarterly),
      feedback,
      monthFeedback,
      activeActionCount: activeActions.length,
      overdueActionCount,
      currentMonthKey,
      hasMentor,
      mentorEligible,
      needsMentor: mentorEligible && !hasMentor,
      growthOpportunity: isGrowthOpportunity(growthTags),
      disengagementRisk: hasDisengagementRisk(growthTags),
    };
    return {
      ...row,
      facts,
      signals: buildSignals(facts),
      calendarDots: buildCheckInCalendarDots(row.recentCheckIns, now, 3),
      isProvisional: provisionalByMember.get(row.id) ?? false,
      growthTags,
      recentCompleted:
        completedByMember.get(row.id) ?? {
          total: 0,
          thisWeek: 0,
          thisMonth: 0,
          asLead: 0,
          lastCompletedAtISO: null,
          label: null,
        },
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
  q?: string,
  tableFilters?: PeopleReviewsTableFilters
): PeoplePerformanceRow[] {
  const query = q?.trim().toLowerCase();
  return rows.filter((row) => {
    if (!factsMatchFilter(row.facts, filter)) return false;
    if (tableFilters && !rowMatchesPeopleReviewsFilters(row, tableFilters)) return false;
    if (query) {
      const haystack = [
        row.name,
        row.email,
        row.role ?? "",
        row.mentorName ?? "",
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

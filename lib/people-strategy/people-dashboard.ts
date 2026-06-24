import type { GoalRatingColor, QuarterlyReviewDecision } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { isPeopleDashboardEnabled } from "@/lib/feature-flags";
import { formatDueDate, startOfDay } from "@/lib/leadership-action-center/dates";
import { getMatrixLabel } from "@/lib/matrix";

import { monthKeyUTC } from "./people-performance-selectors";

import {
  computeTrend,
  isActionOverdue,
  lastCheckIns,
  splitActiveActions,
  workloadWarning,
  type DashboardAction,
  type TrendWord,
} from "./people-dashboard-selectors";

/**
 * People Strategy — Leadership People Dashboard (`/people`) data loader.
 *
 * Reads LIVE Action Tracker / Quarterly Review / Monthly Check-In data already
 * in the schema and reduces each person to a fully display-ready, serializable
 * row for the client table. No new source of truth is created — this only
 * compiles what already exists (mirroring the read-query convention in
 * `lib/people-strategy/action-queries.ts`). With ENABLE_PEOPLE_DASHBOARD off it
 * returns an empty list.
 */

/** One action rendered in the "Active Actions & Deadlines" cell. */
export interface DashboardActionView {
  id: string;
  title: string;
  deadlineLabel: string;
  overdue: boolean;
}

/** The latest Quarterly Review placement on the Performance x Potential matrix. */
export interface DashboardQuarterlyView {
  quarter: string;
  performanceRating: GoalRatingColor;
  potentialRating: GoalRatingColor;
  matrixLabel: string;
  decision: QuarterlyReviewDecision;
  successionFlag: boolean;
}

/** One colored check-in dot (most-recent-first in the row). */
export interface DashboardCheckInDot {
  monthLabel: string;
  rating: GoalRatingColor | null;
}

/** A fully computed, serializable member row for the People Dashboard table. */
export interface PeopleDashboardRow {
  id: string;
  name: string;
  email: string;
  role: string | null;
  avatarUrl: string | null;
  mentorName: string | null;
  mentorId: string | null;
  departments: string[];
  expertise: string[];
  leadActions: DashboardActionView[];
  executingActions: DashboardActionView[];
  quarterly: DashboardQuarterlyView | null;
  /** True when the latest review flags this person as a succession candidate. */
  successor: boolean;
  checkInDots: DashboardCheckInDot[];
  /**
   * The same last-3 check-ins keyed by UTC month ("2026-06"), most recent
   * first — lets People & Performance map them onto fixed calendar months
   * (and render explicit "missing" dots) without a second query.
   */
  recentCheckIns: Array<{ monthKey: string; rating: GoalRatingColor | null }>;
  trend: TrendWord;
  workloadWarning: string | null;
}

/** June 2026 — first month monthly check-ins are compiled. */
const CHECK_IN_PROGRAM_START = new Date(Date.UTC(2026, 5, 1));

const ACTION_SELECT = {
  id: true,
  title: true,
  status: true,
  deadlineStart: true,
  deadlineEnd: true,
  department: { select: { name: true } },
} as const;

function toDashboardAction(item: {
  id: string;
  title: string;
  status: DashboardAction["status"];
  deadlineStart: Date;
  deadlineEnd: Date | null;
  department: { name: string } | null;
}): DashboardAction {
  return {
    id: item.id,
    title: item.title,
    status: item.status,
    deadlineStart: item.deadlineStart,
    deadlineEnd: item.deadlineEnd,
    departmentName: item.department?.name ?? null,
  };
}

function toActionView(action: DashboardAction, now: Date): DashboardActionView {
  return {
    id: action.id,
    title: action.title,
    deadlineLabel: formatDueDate(action.deadlineEnd ?? action.deadlineStart),
    overdue: isActionOverdue(action, now),
  };
}

const MONTH_FORMAT: Intl.DateTimeFormatOptions = { month: "short", year: "2-digit" };

/**
 * Load the People Dashboard rows. Includes every active user who has a
 * People-Strategy footprint — a Quarterly Review, a Monthly Check-In, an action
 * they lead, or an action assignment — so the table reflects the people in the
 * leadership pipeline rather than every portal user.
 */
export async function loadPeopleDashboard(
  now: Date = new Date()
): Promise<PeopleDashboardRow[]> {
  if (!isPeopleDashboardEnabled()) return [];

  const today = startOfDay(now);

  const users = await prisma.user.findMany({
    where: {
      archivedAt: null,
      OR: [
        { quarterlyReviews: { some: {} } },
        { peopleCheckIns: { some: {} } },
        { actionItemsLed: { some: {} } },
        { actionAssignments: { some: {} } },
      ],
    },
    select: {
      id: true,
      name: true,
      email: true,
      primaryRole: true,
      profile: { select: { avatarUrl: true, interests: true } },
      menteePairs: {
        where: { status: "ACTIVE" },
        select: { mentor: { select: { id: true, name: true, email: true } } },
        take: 1,
      },
      actionItemsLed: {
        where: { status: { not: "COMPLETE" } },
        select: ACTION_SELECT,
      },
      actionAssignments: {
        where: { role: "EXECUTING", actionItem: { status: { not: "COMPLETE" } } },
        select: { actionItem: { select: ACTION_SELECT } },
      },
      quarterlyReviews: {
        orderBy: [{ quarter: "desc" }, { createdAt: "desc" }],
        take: 1,
        select: {
          quarter: true,
          performanceRating: true,
          potentialRating: true,
          decision: true,
          successionFlag: true,
        },
      },
      peopleCheckIns: {
        where: { month: { gte: CHECK_IN_PROGRAM_START } },
        orderBy: { month: "desc" },
        select: { month: true, performanceRating: true },
      },
    },
    orderBy: [{ name: "asc" }, { email: "asc" }],
    take: 500,
  });

  return users.map((user): PeopleDashboardRow => {
    const led = user.actionItemsLed.map(toDashboardAction);
    const executing = user.actionAssignments
      .map((a) => a.actionItem)
      .filter((item): item is NonNullable<typeof item> => item != null)
      .map(toDashboardAction);

    const split = splitActiveActions({ led, executing });
    const leadIds = new Set(split.lead.map((a) => a.id));

    const departments = Array.from(
      new Set(
        [...split.lead, ...split.executing]
          .map((a) => a.departmentName)
          .filter((d): d is string => Boolean(d))
      )
    ).sort();

    const review = user.quarterlyReviews[0] ?? null;
    const quarterly: DashboardQuarterlyView | null = review
      ? {
          quarter: review.quarter,
          performanceRating: review.performanceRating,
          potentialRating: review.potentialRating,
          matrixLabel: getMatrixLabel(review.performanceRating, review.potentialRating),
          decision: review.decision,
          successionFlag: review.successionFlag,
        }
      : null;

    const recent = lastCheckIns(user.peopleCheckIns, 3);
    const checkInDots: DashboardCheckInDot[] = recent.map((c) => ({
      monthLabel: c.month.toLocaleDateString("en-US", MONTH_FORMAT),
      rating: c.performanceRating,
    }));
    const recentCheckIns = user.peopleCheckIns.map((c) => ({
      monthKey: monthKeyUTC(c.month),
      rating: c.performanceRating,
    }));

    return {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.primaryRole,
      avatarUrl: user.profile?.avatarUrl ?? null,
      mentorName: user.menteePairs[0]?.mentor?.name ?? user.menteePairs[0]?.mentor?.email ?? null,
      mentorId: user.menteePairs[0]?.mentor?.id ?? null,
      departments,
      expertise: user.profile?.interests ?? [],
      leadActions: split.lead.map((a) => toActionView(a, today)),
      executingActions: split.executing
        .filter((a) => !leadIds.has(a.id))
        .map((a) => toActionView(a, today)),
      quarterly,
      successor: review?.successionFlag ?? false,
      checkInDots,
      recentCheckIns,
      trend: computeTrend(user.peopleCheckIns),
      workloadWarning: workloadWarning(split, today),
    };
  });
}

/** Distinct department names across all rows, for the "All Departments" filter. */
export function collectDepartments(rows: PeopleDashboardRow[]): string[] {
  return Array.from(new Set(rows.flatMap((r) => r.departments))).sort();
}

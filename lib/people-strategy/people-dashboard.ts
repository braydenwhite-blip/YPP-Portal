import type { GoalRatingColor, QuarterlyReviewDecision, RoleType } from "@prisma/client";

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

/** Roles that belong on the admin People roster (ops / leadership pipeline). */
export const PEOPLE_DASHBOARD_ROSTER_ROLES: RoleType[] = [
  "ADMIN",
  "STAFF",
  "CHAPTER_PRESIDENT",
  "HIRING_CHAIR",
  "INSTRUCTOR",
  "MENTOR",
];

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

/** Most recent MentorGoalReview (performance review) — overall rating + plan of action. */
export interface DashboardLatestGoalReviewView {
  cycleMonthKey: string;
  cycleMonthLabel: string;
  overallRating: GoalRatingColor;
  planOfAction: string;
  status: string;
  released: boolean;
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
  phone: string | null;
  /** Free-text / canonical org title (Manager, Director, …). */
  title: string | null;
  role: string | null;
  /** Admin subtypes (e.g. SUPER_ADMIN for Board). */
  adminSubtypes: string[];
  /** Persisted org ladder level when set. */
  internalLevel: number | null;
  /** Manual board / mentor-only opt-out — does not need a mentee mentor. */
  mentorshipExempt: boolean;
  avatarUrl: string | null;
  mentorName: string | null;
  mentorId: string | null;
  /** Active pairing Role Chair (Mentorship.chairId). */
  chairName: string | null;
  chairId: string | null;
  /** Person's org Function (e.g. Operations). */
  functionName: string | null;
  /** Person's org Department (e.g. Technology). */
  departmentName: string | null;
  /** Action-derived department names (fallback / multi-team signals). */
  departments: string[];
  expertise: string[];
  leadActions: DashboardActionView[];
  executingActions: DashboardActionView[];
  quarterly: DashboardQuarterlyView | null;
  /** Most recent performance review (MentorGoalReview), if any. */
  latestGoalReview: DashboardLatestGoalReviewView | null;
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
 * Load the People Dashboard rows. Restricted to staff, instructors, chapter
 * presidents, hiring chairs, mentors, and admins — not students, parents, or
 * applicants — even when those people appear on actions or mentorships.
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
        { primaryRole: { in: PEOPLE_DASHBOARD_ROSTER_ROLES } },
        { roles: { some: { role: { in: PEOPLE_DASHBOARD_ROSTER_ROLES } } } },
      ],
    },
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      title: true,
      canonicalTitle: true,
      primaryRole: true,
      internalLevel: true,
      mentorshipExempt: true,
      adminSubtypes: { select: { subtype: true } },
      orgFunction: { select: { name: true } },
      orgDepartment: { select: { name: true } },
      profile: { select: { avatarUrl: true, interests: true } },
      menteePairs: {
        where: { status: "ACTIVE" },
        select: {
          mentor: { select: { id: true, name: true, email: true } },
          chair: { select: { id: true, name: true, email: true } },
        },
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
      goalReviewsReceived: {
        orderBy: [{ cycleMonth: "desc" }, { updatedAt: "desc" }],
        take: 1,
        select: {
          cycleMonth: true,
          overallRating: true,
          planOfAction: true,
          status: true,
          releasedToMenteeAt: true,
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

    const functionName = user.orgFunction?.name ?? null;
    const departmentName = user.orgDepartment?.name ?? null;
    // Prefer assigned placement; still surface action teams for search/filter.
    const departmentLabels = Array.from(
      new Set(
        [departmentName, ...departments].filter((d): d is string => Boolean(d))
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

    const goalReview = user.goalReviewsReceived[0] ?? null;
    const latestGoalReview: DashboardLatestGoalReviewView | null = goalReview
      ? {
          cycleMonthKey: monthKeyUTC(goalReview.cycleMonth),
          cycleMonthLabel: goalReview.cycleMonth.toLocaleDateString("en-US", MONTH_FORMAT),
          overallRating: goalReview.overallRating,
          planOfAction: goalReview.planOfAction.trim(),
          status: goalReview.status,
          released: Boolean(goalReview.releasedToMenteeAt),
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
      phone: user.phone?.trim() || null,
      title: user.title?.trim() || user.canonicalTitle?.trim() || null,
      role: user.primaryRole,
      adminSubtypes: user.adminSubtypes.map((row) => row.subtype),
      internalLevel: user.internalLevel ?? null,
      mentorshipExempt: Boolean(user.mentorshipExempt),
      avatarUrl: user.profile?.avatarUrl ?? null,
      mentorName: user.menteePairs[0]?.mentor?.name ?? user.menteePairs[0]?.mentor?.email ?? null,
      mentorId: user.menteePairs[0]?.mentor?.id ?? null,
      chairName: user.menteePairs[0]?.chair?.name ?? user.menteePairs[0]?.chair?.email ?? null,
      chairId: user.menteePairs[0]?.chair?.id ?? null,
      functionName,
      departmentName,
      departments: departmentLabels,
      expertise: user.profile?.interests ?? [],
      leadActions: split.lead.map((a) => toActionView(a, today)),
      executingActions: split.executing
        .filter((a) => !leadIds.has(a.id))
        .map((a) => toActionView(a, today)),
      quarterly,
      latestGoalReview,
      successor: review?.successionFlag ?? false,
      checkInDots,
      recentCheckIns,
      trend: computeTrend(user.peopleCheckIns),
      workloadWarning: workloadWarning(split, today),
    };
  });
}

/** Distinct Function names across rows. */
export function collectFunctions(rows: PeopleDashboardRow[]): string[] {
  return Array.from(
    new Set(rows.map((r) => r.functionName).filter((v): v is string => Boolean(v)))
  ).sort();
}

/** Distinct department names across all rows, for the "All Departments" filter. */
export function collectDepartments(rows: PeopleDashboardRow[]): string[] {
  return Array.from(
    new Set(
      rows.flatMap((r) =>
        [r.departmentName, ...r.departments].filter((v): v is string => Boolean(v))
      )
    )
  ).sort();
}

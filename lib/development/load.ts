import "server-only";

import type { GoalRatingColor, GrowthTag, RoleType } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { requireLeadership } from "@/lib/authorization";
import { FULL_PROGRAM_MENTOR_CAP } from "@/lib/mentorship-canonical";
import { computeExpectationProgress } from "@/lib/leadership/expectations";
import {
  isActionOverdue,
  type DashboardAction,
} from "@/lib/people-strategy/people-dashboard-selectors";
import {
  CHECK_IN_ACCOUNTABLE_FROM_MONTH_KEY,
  currentQuarterLabel,
  isCheckInMonthAccountable,
  monthKeyUTC,
  roleExpectsMentor,
} from "@/lib/people-strategy/people-performance-selectors";
import { startOfDay } from "@/lib/leadership-action-center/dates";

import {
  buildDevelopmentCockpit,
  EMPTY_DEVELOPMENT_FACTS,
  type DevelopmentCockpit,
  type DevelopmentPersonFacts,
  type DevelopmentPopulation,
} from "./signals";
import {
  buildReviewQueue,
  type ActiveCycleQueueInput,
  type PendingChairApproval,
  type RecentStrongReview,
  type ReviewQueueItem,
} from "./review-queue";
import { deriveCycleDisplayState } from "./cycle-flow";

/**
 * Leadership Development — data loader.
 *
 * Shapes `DevelopmentPersonFacts` for the two development populations —
 * instructors (incl. mentors) and officers (chapter presidents, staff, hiring
 * chairs, admins) — from data that already exists: mentorship pairings and
 * sessions, People-Strategy check-ins and quarterly reviews, the Action
 * Tracker, teams/committees, growth tags, and leadership contributions. No new
 * source of truth; this only compiles what other surfaces already write.
 *
 * Leadership-only (`requireLeadership()`), mirroring `/people` performance
 * surfaces: rating colors are leadership-confidential. Review comments and
 * feedback bodies are never read here.
 */

const OFFICER_ROLES: RoleType[] = ["ADMIN", "STAFF", "CHAPTER_PRESIDENT", "HIRING_CHAIR"];
const INSTRUCTOR_ROLES: RoleType[] = ["INSTRUCTOR", "MENTOR"];
const OFFICER_ROLE_SET = new Set<string>(OFFICER_ROLES);
const INSTRUCTOR_ROLE_SET = new Set<string>(INSTRUCTOR_ROLES);
/** Non-primary roles that still pull someone into a development population. */
const SECONDARY_POPULATION_ROLES: RoleType[] = ["INSTRUCTOR", "MENTOR", "CHAPTER_PRESIDENT"];

const ROLE_LABELS: Record<string, string> = {
  ADMIN: "Admin",
  STAFF: "Staff",
  CHAPTER_PRESIDENT: "Chapter President",
  HIRING_CHAIR: "Hiring Chair",
  INSTRUCTOR: "Instructor",
  MENTOR: "Mentor",
};

const POPULATION_CAP = 500;
const DAY_MS = 24 * 60 * 60 * 1000;

function daysBetween(from: Date, to: Date): number {
  return Math.max(0, Math.floor((to.getTime() - from.getTime()) / DAY_MS));
}

/** "June" — UTC month name for a date. */
function monthNameUTC(d: Date): string {
  return new Intl.DateTimeFormat("en-US", { month: "long", timeZone: "UTC" }).format(d);
}

function classifyPopulation(
  primaryRole: string,
  roles: string[]
): DevelopmentPopulation | null {
  const all = new Set([primaryRole, ...roles]);
  // Officer tier wins: a chapter president who also teaches is developed as an
  // officer (their instructor work still shows on the record).
  for (const role of all) {
    if (OFFICER_ROLE_SET.has(role)) return "officer";
  }
  for (const role of all) {
    if (INSTRUCTOR_ROLE_SET.has(role)) return "instructor";
  }
  return null;
}

const ACTION_SELECT = {
  id: true,
  title: true,
  status: true,
  deadlineStart: true,
  deadlineEnd: true,
} as const;

type ActionRow = {
  id: string;
  title: string;
  status: DashboardAction["status"];
  deadlineStart: Date;
  deadlineEnd: Date | null;
};

function toDashboardAction(row: ActionRow): DashboardAction {
  return { ...row, departmentName: null };
}

export type DevelopmentOverview = {
  cockpit: DevelopmentCockpit;
  reviewQueue: ReviewQueueItem[];
  /** Facts for BOTH populations (the cockpit is built per population). */
  population: DevelopmentPopulation;
  populationCounts: Record<DevelopmentPopulation, number>;
  currentQuarter: string;
};

/** Load every development-population member's facts, plus queue inputs. */
async function loadDevelopmentFacts(now: Date): Promise<{
  people: DevelopmentPersonFacts[];
  pendingApprovals: PendingChairApproval[];
  strongReviews: RecentStrongReview[];
  activeCycles: ActiveCycleQueueInput[];
}> {
  const today = startOfDay(now);
  const currentQuarter = currentQuarterLabel(now);
  const currentMonthKey = monthKeyUTC(now);
  const checkInAccountable = isCheckInMonthAccountable(
    currentMonthKey,
    CHECK_IN_ACCOUNTABLE_FROM_MONTH_KEY,
    currentMonthKey
  );

  const users = await prisma.user.findMany({
    where: {
      archivedAt: null,
      OR: [
        { primaryRole: { in: [...OFFICER_ROLES, ...INSTRUCTOR_ROLES] } },
        { roles: { some: { role: { in: SECONDARY_POPULATION_ROLES } } } },
      ],
    },
    select: {
      id: true,
      name: true,
      email: true,
      primaryRole: true,
      createdAt: true,
      chapter: { select: { name: true } },
      roles: { select: { role: true } },
      menteePairs: {
        where: { status: "ACTIVE" },
        select: {
          mentor: { select: { name: true, email: true } },
          sessions: {
            where: { completedAt: { not: null } },
            orderBy: { completedAt: "desc" },
            take: 1,
            select: { completedAt: true },
          },
        },
      },
      actionItemsLed: {
        where: { status: { notIn: ["COMPLETE", "DROPPED"] } },
        select: ACTION_SELECT,
      },
      actionAssignments: {
        where: {
          role: "EXECUTING",
          actionItem: { status: { notIn: ["COMPLETE", "DROPPED"] } },
        },
        select: { actionItem: { select: ACTION_SELECT } },
      },
      quarterlyReviews: {
        orderBy: [{ quarter: "desc" }, { createdAt: "desc" }],
        take: 1,
        select: {
          quarter: true,
          performanceRating: true,
          potentialRating: true,
          successionFlag: true,
        },
      },
      peopleCheckIns: {
        orderBy: { month: "desc" },
        take: 1,
        select: { month: true, performanceRating: true, createdAt: true },
      },
    },
    orderBy: [{ name: "asc" }, { email: "asc" }],
    take: POPULATION_CAP,
  });

  const classified = users
    .map((user) => ({
      user,
      population: classifyPopulation(
        user.primaryRole,
        user.roles.map((r) => r.role)
      ),
    }))
    .filter(
      (entry): entry is { user: (typeof users)[number]; population: DevelopmentPopulation } =>
        entry.population != null
    );

  const ids = classified.map((entry) => entry.user.id);
  if (ids.length === 0) {
    return { people: [], pendingApprovals: [], strongReviews: [], activeCycles: [] };
  }

  const [
    teamLeads,
    committeeChairs,
    openFollowUps,
    mentorLoads,
    releasedReviews,
    pendingReviews,
    growthTags,
    contributions,
    teachingCounts,
    openCycles,
  ] = await Promise.all([
    prisma.teamMembership.findMany({
      where: { userId: { in: ids }, isLead: true, team: { status: "ACTIVE" } },
      select: { userId: true },
    }),
    prisma.committeeMembership.findMany({
      where: {
        userId: { in: ids },
        isActive: true,
        role: { contains: "chair", mode: "insensitive" },
        committee: { archivedAt: null },
      },
      select: { userId: true },
    }),
    prisma.meetingFollowUp.findMany({
      where: { ownerId: { in: ids }, status: { in: ["OPEN", "IN_PROGRESS"] } },
      select: { ownerId: true },
    }),
    prisma.mentorship.groupBy({
      by: ["mentorId"],
      where: { mentorId: { in: ids }, status: "ACTIVE" },
      _count: { id: true },
    }),
    prisma.mentorGoalReview.findMany({
      where: { menteeId: { in: ids }, releasedToMenteeAt: { not: null } },
      orderBy: { releasedToMenteeAt: "desc" },
      select: {
        menteeId: true,
        overallRating: true,
        cycleMonth: true,
        releasedToMenteeAt: true,
      },
    }),
    prisma.mentorGoalReview.findMany({
      where: { menteeId: { in: ids }, status: "PENDING_CHAIR_APPROVAL" },
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        menteeId: true,
        createdAt: true,
        mentee: { select: { name: true, email: true } },
        mentor: { select: { name: true, email: true } },
      },
    }),
    prisma.memberGrowthTag.findMany({
      where: { userId: { in: ids } },
      select: { userId: true, tag: true },
      orderBy: { createdAt: "asc" },
    }),
    prisma.leadershipContribution.findMany({
      where: { instructorId: { in: ids } },
      select: {
        instructorId: true,
        category: true,
        status: true,
        weight: true,
        isOwnership: true,
        reviewVisible: true,
      },
    }),
    prisma.classOffering.groupBy({
      by: ["instructorId"],
      where: {
        instructorId: { in: ids },
        status: { in: ["PUBLISHED", "IN_PROGRESS"] },
      },
      _count: { id: true },
    }),
    prisma.reviewCycle.findMany({
      where: { revieweeId: { in: ids }, state: { not: "COMPLETED" } },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        revieweeId: true,
        state: true,
        dueDate: true,
        selfInputSubmittedAt: true,
        synthesisSubmittedAt: true,
        followUpDueAt: true,
        releasedToRevieweeAt: true,
        completedAt: true,
        feedback: { select: { submittedAt: true } },
      },
    }),
  ]);

  const countBy = <T>(rows: T[], key: (row: T) => string | null): Map<string, number> => {
    const map = new Map<string, number>();
    for (const row of rows) {
      const k = key(row);
      if (!k) continue;
      map.set(k, (map.get(k) ?? 0) + 1);
    }
    return map;
  };

  const teamLeadCounts = countBy(teamLeads, (r) => r.userId);
  const chairCounts = countBy(committeeChairs, (r) => r.userId);
  const followUpCounts = countBy(openFollowUps, (r) => r.ownerId);
  const menteeCounts = new Map(mentorLoads.map((r) => [r.mentorId, r._count.id]));
  const teachingByUser = new Map(
    teachingCounts.map((r) => [r.instructorId, r._count.id])
  );

  const latestReleasedByMentee = new Map<
    string,
    { overallRating: GoalRatingColor; cycleMonth: Date | null; releasedToMenteeAt: Date | null }
  >();
  for (const review of releasedReviews) {
    if (!latestReleasedByMentee.has(review.menteeId)) {
      latestReleasedByMentee.set(review.menteeId, review);
    }
  }

  const growthByUser = new Map<string, GrowthTag[]>();
  for (const tag of growthTags) {
    const list = growthByUser.get(tag.userId);
    if (list) list.push(tag.tag);
    else growthByUser.set(tag.userId, [tag.tag]);
  }

  const contributionsByUser = new Map<string, typeof contributions>();
  for (const contribution of contributions) {
    const list = contributionsByUser.get(contribution.instructorId);
    if (list) list.push(contribution);
    else contributionsByUser.set(contribution.instructorId, [contribution]);
  }

  // Newest open cycle per reviewee (findMany is createdAt-desc).
  const cycleByReviewee = new Map<
    string,
    { id: string; displayState: ReturnType<typeof deriveCycleDisplayState> }
  >();
  for (const cycle of openCycles) {
    if (cycleByReviewee.has(cycle.revieweeId)) continue;
    cycleByReviewee.set(cycle.revieweeId, {
      id: cycle.id,
      displayState: deriveCycleDisplayState(
        {
          state: cycle.state,
          dueDate: cycle.dueDate,
          selfInputSubmittedAt: cycle.selfInputSubmittedAt,
          synthesisSubmittedAt: cycle.synthesisSubmittedAt,
          followUpDueAt: cycle.followUpDueAt,
          releasedToRevieweeAt: cycle.releasedToRevieweeAt,
          completedAt: cycle.completedAt,
          feedbackRequested: cycle.feedback.length,
          feedbackSubmitted: cycle.feedback.filter((f) => f.submittedAt).length,
        },
        now
      ),
    });
  }

  const people: DevelopmentPersonFacts[] = classified.map(({ user, population }) => {
    const actions = new Map<string, DashboardAction>();
    for (const item of user.actionItemsLed) {
      actions.set(item.id, toDashboardAction(item));
    }
    for (const assignment of user.actionAssignments) {
      if (assignment.actionItem) {
        actions.set(assignment.actionItem.id, toDashboardAction(assignment.actionItem));
      }
    }
    const openActions = [...actions.values()];
    const overdueActionCount = openActions.filter((a) => isActionOverdue(a, today)).length;

    const pair = user.menteePairs[0] ?? null;
    const lastSessionAt = pair?.sessions[0]?.completedAt ?? null;

    const checkIn = user.peopleCheckIns[0] ?? null;
    const review = user.quarterlyReviews[0] ?? null;
    const released = latestReleasedByMentee.get(user.id) ?? null;

    const activeMenteeCount = menteeCounts.get(user.id) ?? 0;
    const progress = computeExpectationProgress(
      contributionsByUser.get(user.id) ?? []
    );

    const oldestPending = pendingReviews.find((r) => r.menteeId === user.id) ?? null;

    const roleLabel = ROLE_LABELS[user.primaryRole] ?? user.primaryRole;
    const chapterName = user.chapter?.name ?? null;

    return {
      ...EMPTY_DEVELOPMENT_FACTS,
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.primaryRole,
      contextLabel: chapterName ? `${roleLabel} · ${chapterName}` : roleLabel,
      population,
      daysSinceJoined: daysBetween(user.createdAt, now),
      mentorName: pair?.mentor?.name ?? pair?.mentor?.email ?? null,
      mentorEligible: roleExpectsMentor(user.primaryRole),
      daysSinceLastSession: lastSessionAt ? daysBetween(lastSessionAt, now) : null,
      checkInAccountable,
      hasCurrentMonthCheckIn: checkIn
        ? monthKeyUTC(checkIn.month) === currentMonthKey
        : false,
      lastCheckInRating: checkIn?.performanceRating ?? null,
      lastCheckInMonthLabel: checkIn ? monthNameUTC(checkIn.month) : null,
      daysSinceLastCheckIn: checkIn ? daysBetween(checkIn.createdAt, now) : null,
      reviewDue: !review || review.quarter !== currentQuarter,
      hasAnyReview: Boolean(review),
      lastReviewQuarter: review?.quarter ?? null,
      lastReviewPerformance: review?.performanceRating ?? null,
      lastReviewPotential: review?.potentialRating ?? null,
      successionFlag: review?.successionFlag ?? false,
      lastMentorReviewRating: released?.overallRating ?? null,
      pendingChairReviewDays: oldestPending
        ? daysBetween(oldestPending.createdAt, now)
        : null,
      openActionCount: openActions.length,
      overdueActionCount,
      openFollowUpCount: followUpCounts.get(user.id) ?? 0,
      teamsLeadingCount: teamLeadCounts.get(user.id) ?? 0,
      committeesChairedCount: chairCounts.get(user.id) ?? 0,
      activeMenteeCount,
      mentorCap: activeMenteeCount > 0 ? FULL_PROGRAM_MENTOR_CAP : null,
      classesTeachingCount: teachingByUser.get(user.id) ?? 0,
      growthTags: growthByUser.get(user.id) ?? [],
      meetsSeniorExpectations: progress.senior.met,
      meetsLeadExpectations: progress.lead.met,
      activeReviewCycle: cycleByReviewee.get(user.id) ?? null,
    };
  });

  const factsById = new Map(people.map((p) => [p.id, p]));

  const activeCycles: ActiveCycleQueueInput[] = [];
  for (const [revieweeId, cycle] of cycleByReviewee) {
    const personFacts = factsById.get(revieweeId);
    if (!personFacts) continue;
    activeCycles.push({
      cycleId: cycle.id,
      revieweeId,
      revieweeName: personFacts.name || personFacts.email,
      contextLabel: personFacts.contextLabel,
      displayState: cycle.displayState,
    });
  }

  const pendingApprovals: PendingChairApproval[] = pendingReviews.map((review) => ({
    reviewId: review.id,
    menteeId: review.menteeId,
    menteeName: review.mentee.name || review.mentee.email,
    mentorName: review.mentor.name || review.mentor.email,
    daysWaiting: daysBetween(review.createdAt, now),
  }));

  const RECOGNITION_WINDOW_DAYS = 45;
  const strongReviews: RecentStrongReview[] = [];
  for (const [menteeId, review] of latestReleasedByMentee) {
    if (review.overallRating !== "ABOVE_AND_BEYOND") continue;
    if (
      !review.releasedToMenteeAt ||
      daysBetween(review.releasedToMenteeAt, now) > RECOGNITION_WINDOW_DAYS
    ) {
      continue;
    }
    const facts = factsById.get(menteeId);
    if (!facts) continue;
    strongReviews.push({
      menteeId,
      menteeName: facts.name || facts.email,
      contextLabel: facts.contextLabel,
      overallRating: review.overallRating,
      monthLabel: review.cycleMonth ? monthNameUTC(review.cycleMonth) : null,
    });
  }

  return { people, pendingApprovals, strongReviews, activeCycles };
}

/** The Development cockpit for one population, plus the shared review queue. */
export async function loadDevelopmentOverview(
  population: DevelopmentPopulation,
  now: Date = new Date()
): Promise<DevelopmentOverview> {
  await requireLeadership();

  const { people, pendingApprovals, strongReviews, activeCycles } =
    await loadDevelopmentFacts(now);

  const populationCounts: Record<DevelopmentPopulation, number> = {
    instructor: people.filter((p) => p.population === "instructor").length,
    officer: people.filter((p) => p.population === "officer").length,
  };

  const scoped = people.filter((p) => p.population === population);
  const scopedIds = new Set(scoped.map((p) => p.id));

  return {
    cockpit: buildDevelopmentCockpit(scoped),
    reviewQueue: buildReviewQueue({
      people: scoped,
      activeCycles: activeCycles.filter((c) => scopedIds.has(c.revieweeId)),
      pendingApprovals: pendingApprovals.filter((a) => scopedIds.has(a.menteeId)),
      strongReviews: strongReviews.filter((r) => scopedIds.has(r.menteeId)),
    }),
    population,
    populationCounts,
    currentQuarter: currentQuarterLabel(now),
  };
}

/** Facts for one person (for the development record). Null when out of scope. */
export async function loadDevelopmentFactsForPerson(
  userId: string,
  now: Date = new Date()
): Promise<DevelopmentPersonFacts | null> {
  await requireLeadership();

  const { people } = await loadDevelopmentFacts(now);
  return people.find((p) => p.id === userId) ?? null;
}

/**
 * Facts for one person WITHOUT the leadership gate — for the review-cycle
 * workspace, where access is granted per cycle (assigned reviewer/creator; see
 * lib/development/cycle-access.ts). Callers MUST have verified cycle access
 * first; never expose this from a route without that check.
 */
export async function loadDevelopmentFactsForReview(
  userId: string,
  now: Date = new Date()
): Promise<DevelopmentPersonFacts | null> {
  const { people } = await loadDevelopmentFacts(now);
  return people.find((p) => p.id === userId) ?? null;
}

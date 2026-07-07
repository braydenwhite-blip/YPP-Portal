/**
 * Admin-side operational queries for the instructor mentorship program.
 *
 * Mentorship is currently launched for instructors only. These helpers are
 * scoped to the instructor + leadership lanes (the visible lanes from
 * `ADMIN_MENTORSHIP_LANES`) and intentionally exclude students — student
 * mentorship is not yet rolled out.
 *
 * All callers must be admins. Each exported helper enforces this with
 * `requireAdminForOps`. Pages that already gate on ADMIN can rely on the
 * helper's gate as defense in depth.
 */

import { MentorshipType } from "@prisma/client";

import { getSession } from "@/lib/auth-supabase";
import { prisma } from "@/lib/prisma";
import { FULL_PROGRAM_MENTOR_CAP } from "@/lib/mentorship-canonical";
import { SHOW_STUDENT_MENTORSHIP_LANE } from "@/lib/mentorship-admin-helpers";
import { getPortalSettings } from "@/lib/portal-settings";

// Single boundary for "instructor mentorship vs student mentorship". Until
// student mentorship launches we exclude STUDENT from every helper here.
const INSTRUCTOR_MENTORSHIP_TYPE_FILTER = SHOW_STUDENT_MENTORSHIP_LANE
  ? undefined
  : { not: MentorshipType.STUDENT };

// `STALE_SESSION_DAYS` is admin-configurable via portal settings
// (instructorMentorship.staleSessionDays); default remains 30.
const STALE_GOAL_NO_UPDATE_DAYS = 30;
export const ADMIN_QUEUE_PAGE_SIZE = 200;

// Primary roles that the admin instructor-mentorship surfaces treat as
// eligible mentees. INSTRUCTOR + LEADERSHIP roles match the visible lanes
// on /admin/mentorship-program (Instructors and Leadership). STUDENT is
// intentionally excluded because student mentorship is not yet launched.
const ELIGIBLE_MENTEE_PRIMARY_ROLES = [
  "INSTRUCTOR",
  "CHAPTER_PRESIDENT",
  "ADMIN",
  "STAFF",
] as const;

async function requireAdminForOps() {
  const session = await getSession();
  if (!session?.user?.id) {
    throw new Error("Unauthorized");
  }
  const roles = session.user.roles ?? [];
  if (!roles.includes("ADMIN")) {
    throw new Error("Unauthorized");
  }
  return session;
}

export interface InstructorMentorshipOpsSummary {
  activeRelationships: number;
  /** Eligible mentees (instructors + leadership) with no active mentor. */
  unassignedInstructors: number;
  mentorsAtOrOverCapacity: number;
  mentorsOverCapacity: number;
  overdueCheckIns: number;
  stalledGoals: number;
  pendingReviews: number;
  relationshipsWithoutGoals: number;
  recentlyActive: number;
}

export async function getInstructorMentorshipOpsSummary(): Promise<InstructorMentorshipOpsSummary> {
  await requireAdminForOps();

  const now = new Date();
  const { staleSessionDays } = (await getPortalSettings()).instructorMentorship;
  const staleSessionCutoff = new Date(
    now.getTime() - staleSessionDays * 24 * 60 * 60 * 1000
  );

  const [
    activeRelationships,
    unassignedInstructors,
    mentorAggregates,
    overdueCheckIns,
    stalledGoalsCount,
    pendingReviews,
    relationshipsWithoutGoals,
    recentlyActive,
  ] = await Promise.all([
    prisma.mentorship.count({
      where: { status: "ACTIVE", type: INSTRUCTOR_MENTORSHIP_TYPE_FILTER },
    }),
    prisma.user.count({
      where: {
        primaryRole: { in: [...ELIGIBLE_MENTEE_PRIMARY_ROLES] },
        menteePairs: { none: { status: "ACTIVE" } },
      },
    }),
    prisma.mentorship.groupBy({
      by: ["mentorId"],
      where: { status: "ACTIVE", type: INSTRUCTOR_MENTORSHIP_TYPE_FILTER },
      _count: { id: true },
    }),
    prisma.mentorship.count({
      where: {
        status: "ACTIVE",
        type: INSTRUCTOR_MENTORSHIP_TYPE_FILTER,
        sessions: {
          none: {
            OR: [
              { completedAt: { gte: staleSessionCutoff } },
              { scheduledAt: { gte: now } },
            ],
          },
        },
      },
    }),
    prisma.gRDocumentGoal.count({
      where: {
        lifecycleStatus: "ACTIVE",
        OR: [
          {
            dueDate: { lt: now },
            progressState: { in: ["NOT_STARTED", "IN_PROGRESS", "BLOCKED"] },
          },
          {
            progressState: "BLOCKED",
          },
        ],
        document: {
          mentorship: { status: "ACTIVE", type: INSTRUCTOR_MENTORSHIP_TYPE_FILTER },
        },
      },
    }),
    prisma.mentorGoalReview.count({
      where: { status: "PENDING_CHAIR_APPROVAL" },
    }),
    prisma.mentorship.count({
      where: {
        status: "ACTIVE",
        type: INSTRUCTOR_MENTORSHIP_TYPE_FILTER,
        grDocuments: {
          none: { status: { in: ["ACTIVE", "PENDING_APPROVAL"] } },
        },
      },
    }),
    prisma.mentorship.count({
      where: {
        status: "ACTIVE",
        type: INSTRUCTOR_MENTORSHIP_TYPE_FILTER,
        sessions: { some: { completedAt: { gte: staleSessionCutoff } } },
      },
    }),
  ]);

  const mentorsAtOrOverCapacity = mentorAggregates.filter(
    (row) => row._count.id >= FULL_PROGRAM_MENTOR_CAP
  ).length;
  const mentorsOverCapacity = mentorAggregates.filter(
    (row) => row._count.id > FULL_PROGRAM_MENTOR_CAP
  ).length;

  return {
    activeRelationships,
    unassignedInstructors,
    mentorsAtOrOverCapacity,
    mentorsOverCapacity,
    overdueCheckIns,
    stalledGoals: stalledGoalsCount,
    pendingReviews,
    relationshipsWithoutGoals,
    recentlyActive,
  };
}

export interface UnassignedInstructorRow {
  id: string;
  name: string;
  email: string;
  primaryRole: string;
  chapterName: string | null;
  joinedAt: string;
  reason: string;
}

export async function getUnassignedInstructorQueue(): Promise<UnassignedInstructorRow[]> {
  await requireAdminForOps();

  const instructors = await prisma.user.findMany({
    where: {
      primaryRole: { in: [...ELIGIBLE_MENTEE_PRIMARY_ROLES] },
      menteePairs: { none: { status: "ACTIVE" } },
    },
    select: {
      id: true,
      name: true,
      email: true,
      primaryRole: true,
      createdAt: true,
      chapter: { select: { name: true } },
      menteePairs: {
        orderBy: { startDate: "desc" },
        take: 1,
        select: { status: true, endDate: true },
      },
    },
    orderBy: [{ createdAt: "desc" }],
  });

  return instructors.map((user) => {
    const lastPair = user.menteePairs[0];
    const reason = lastPair
      ? lastPair.status === "PAUSED"
        ? "Mentorship paused — needs reassignment"
        : "Previous mentorship ended"
      : "Never assigned a mentor";

    return {
      id: user.id,
      name: user.name,
      email: user.email,
      primaryRole: user.primaryRole,
      chapterName: user.chapter?.name ?? null,
      joinedAt: user.createdAt.toISOString(),
      reason,
    };
  });
}

export interface MentorWorkloadRow {
  id: string;
  name: string;
  email: string;
  activeMenteeCount: number;
  capacity: number;
  isAtCapacity: boolean;
  isOverCapacity: boolean;
  overdueCheckIns: number;
  stalledGoals: number;
  lastActivityAt: string | null;
  warning: string | null;
}

export async function getMentorWorkload(): Promise<MentorWorkloadRow[]> {
  await requireAdminForOps();

  const now = new Date();
  const { staleSessionDays } = (await getPortalSettings()).instructorMentorship;
  const staleSessionCutoff = new Date(
    now.getTime() - staleSessionDays * 24 * 60 * 60 * 1000
  );

  const mentors = await prisma.user.findMany({
    where: {
      OR: [
        { roles: { some: { role: "MENTOR" } } },
        { mentorPairs: { some: { status: "ACTIVE" } } },
      ],
    },
    select: {
      id: true,
      name: true,
      email: true,
      mentorPairs: {
        where: { status: "ACTIVE", type: INSTRUCTOR_MENTORSHIP_TYPE_FILTER },
        select: {
          id: true,
          sessions: {
            orderBy: [{ completedAt: "desc" }, { scheduledAt: "desc" }],
            take: 1,
            select: { completedAt: true, scheduledAt: true },
          },
          grDocuments: {
            where: { status: { in: ["ACTIVE", "PENDING_APPROVAL"] } },
            select: {
              goals: {
                where: {
                  lifecycleStatus: "ACTIVE",
                  OR: [
                    {
                      dueDate: { lt: now },
                      progressState: {
                        in: ["NOT_STARTED", "IN_PROGRESS", "BLOCKED"],
                      },
                    },
                    { progressState: "BLOCKED" },
                  ],
                },
                select: { id: true },
              },
            },
          },
        },
      },
    },
    orderBy: { name: "asc" },
  });

  return mentors
    .map((mentor) => {
      const activeMenteeCount = mentor.mentorPairs.length;
      const overdueCheckIns = mentor.mentorPairs.filter((pair) => {
        const latest = pair.sessions[0];
        const latestActivity =
          latest?.completedAt ??
          (latest?.scheduledAt && latest.scheduledAt > now
            ? latest.scheduledAt
            : null);
        return !latestActivity || latestActivity < staleSessionCutoff;
      }).length;
      const stalledGoals = mentor.mentorPairs.reduce(
        (acc, pair) =>
          acc +
          pair.grDocuments.reduce(
            (innerAcc, doc) => innerAcc + doc.goals.length,
            0
          ),
        0
      );
      const lastActivityAt = mentor.mentorPairs
        .flatMap((pair) =>
          pair.sessions.map(
            (session) =>
              session.completedAt?.toISOString() ??
              session.scheduledAt.toISOString()
          )
        )
        .sort()
        .reverse()[0] ?? null;

      const isAtCapacity = activeMenteeCount >= FULL_PROGRAM_MENTOR_CAP;
      const isOverCapacity = activeMenteeCount > FULL_PROGRAM_MENTOR_CAP;
      const warning = isOverCapacity
        ? `${activeMenteeCount} active mentees — over the cap of ${FULL_PROGRAM_MENTOR_CAP}`
        : isAtCapacity
        ? `At cap (${FULL_PROGRAM_MENTOR_CAP} mentees)`
        : null;

      return {
        id: mentor.id,
        name: mentor.name,
        email: mentor.email,
        activeMenteeCount,
        capacity: FULL_PROGRAM_MENTOR_CAP,
        isAtCapacity,
        isOverCapacity,
        overdueCheckIns,
        stalledGoals,
        lastActivityAt,
        warning,
      };
    })
    .filter(
      (row) => row.activeMenteeCount > 0 || row.isAtCapacity || row.warning
    )
    .sort((left, right) => right.activeMenteeCount - left.activeMenteeCount);
}

export interface OverdueCheckInRow {
  mentorshipId: string;
  menteeId: string;
  menteeName: string;
  menteeRole: string;
  mentorName: string;
  daysSinceActivity: number | null;
  lastActivityAt: string | null;
}

export async function getOverdueCheckInQueue(): Promise<OverdueCheckInRow[]> {
  await requireAdminForOps();

  const now = new Date();
  const { staleSessionDays } = (await getPortalSettings()).instructorMentorship;
  const staleSessionCutoff = new Date(
    now.getTime() - staleSessionDays * 24 * 60 * 60 * 1000
  );

  const mentorships = await prisma.mentorship.findMany({
    where: {
      status: "ACTIVE",
      type: INSTRUCTOR_MENTORSHIP_TYPE_FILTER,
      sessions: {
        none: {
          OR: [
            { completedAt: { gte: staleSessionCutoff } },
            { scheduledAt: { gte: now } },
          ],
        },
      },
    },
    select: {
      id: true,
      menteeId: true,
      mentee: { select: { name: true, primaryRole: true } },
      mentor: { select: { name: true } },
      sessions: {
        orderBy: [{ completedAt: "desc" }, { scheduledAt: "desc" }],
        take: 1,
        select: { completedAt: true, scheduledAt: true },
      },
    },
    orderBy: { startDate: "asc" },
    take: ADMIN_QUEUE_PAGE_SIZE,
  });

  return mentorships.map((mentorship) => {
    const session = mentorship.sessions[0];
    const last = session?.completedAt ?? session?.scheduledAt ?? null;
    const days = last
      ? Math.floor((now.getTime() - last.getTime()) / (1000 * 60 * 60 * 24))
      : null;

    return {
      mentorshipId: mentorship.id,
      menteeId: mentorship.menteeId,
      menteeName: mentorship.mentee.name,
      menteeRole: mentorship.mentee.primaryRole,
      mentorName: mentorship.mentor.name,
      daysSinceActivity: days,
      lastActivityAt: last?.toISOString() ?? null,
    };
  });
}

export interface StalledGoalRow {
  goalId: string;
  goalTitle: string;
  documentId: string;
  mentorshipId: string;
  menteeId: string;
  menteeName: string;
  mentorName: string;
  dueDate: string | null;
  progressState: string;
  lifecycleStatus: string;
  daysOverdue: number | null;
  reason: string;
}

export async function getStalledGoalQueue(): Promise<StalledGoalRow[]> {
  await requireAdminForOps();

  const now = new Date();
  const staleNoUpdateCutoff = new Date(
    now.getTime() - STALE_GOAL_NO_UPDATE_DAYS * 24 * 60 * 60 * 1000
  );

  const goals = await prisma.gRDocumentGoal.findMany({
    where: {
      lifecycleStatus: "ACTIVE",
      OR: [
        {
          dueDate: { lt: now },
          progressState: { in: ["NOT_STARTED", "IN_PROGRESS", "BLOCKED"] },
        },
        { progressState: "BLOCKED" },
        {
          updatedAt: { lt: staleNoUpdateCutoff },
          progressState: { in: ["NOT_STARTED", "IN_PROGRESS"] },
        },
      ],
      document: {
        mentorship: { status: "ACTIVE", type: INSTRUCTOR_MENTORSHIP_TYPE_FILTER },
      },
    },
    select: {
      id: true,
      title: true,
      progressState: true,
      lifecycleStatus: true,
      dueDate: true,
      updatedAt: true,
      document: {
        select: {
          id: true,
          mentorshipId: true,
          mentorship: {
            select: {
              menteeId: true,
              mentee: { select: { name: true } },
              mentor: { select: { name: true } },
            },
          },
        },
      },
    },
    orderBy: [{ dueDate: "asc" }],
    take: ADMIN_QUEUE_PAGE_SIZE,
  });

  return goals.map((goal) => {
    const due = goal.dueDate;
    const daysOverdue = due
      ? Math.max(
          0,
          Math.floor((now.getTime() - due.getTime()) / (1000 * 60 * 60 * 24))
        )
      : null;

    let reason: string;
    if (goal.progressState === "BLOCKED") {
      reason = "Marked blocked by mentee or mentor";
    } else if (due && due < now) {
      reason = `Overdue by ${daysOverdue} day${daysOverdue === 1 ? "" : "s"}`;
    } else {
      reason = `No update in ${STALE_GOAL_NO_UPDATE_DAYS}+ days`;
    }

    return {
      goalId: goal.id,
      goalTitle: goal.title,
      documentId: goal.document.id,
      mentorshipId: goal.document.mentorshipId,
      menteeId: goal.document.mentorship.menteeId,
      menteeName: goal.document.mentorship.mentee.name,
      mentorName: goal.document.mentorship.mentor.name,
      dueDate: due?.toISOString() ?? null,
      progressState: goal.progressState,
      lifecycleStatus: goal.lifecycleStatus,
      daysOverdue,
      reason,
    };
  });
}

export interface AdminActionItem {
  id: string;
  kind:
    | "UNASSIGNED_INSTRUCTOR"
    | "OVERDUE_CHECK_IN"
    | "STALLED_GOAL"
    | "PENDING_REVIEW"
    | "NO_GOALS";
  title: string;
  detail: string;
  emphasis: string;
  href: string;
  priority: number;
}

export async function getAdminMentorshipActionQueue(): Promise<AdminActionItem[]> {
  await requireAdminForOps();

  const [unassigned, overdue, stalled, pendingReviews, withoutGoals] =
    await Promise.all([
      getUnassignedInstructorQueue(),
      getOverdueCheckInQueue(),
      getStalledGoalQueue(),
      prisma.mentorGoalReview.findMany({
        where: { status: "PENDING_CHAIR_APPROVAL" },
        orderBy: { createdAt: "asc" },
        select: {
          id: true,
          mentee: { select: { id: true, name: true } },
          mentor: { select: { name: true } },
          createdAt: true,
        },
        take: 50,
      }),
      prisma.mentorship.findMany({
        where: {
          status: "ACTIVE",
          type: INSTRUCTOR_MENTORSHIP_TYPE_FILTER,
          grDocuments: {
            none: { status: { in: ["ACTIVE", "PENDING_APPROVAL"] } },
          },
        },
        select: {
          id: true,
          menteeId: true,
          mentee: { select: { name: true } },
          mentor: { select: { name: true } },
        },
        take: 50,
      }),
    ]);

  const items: AdminActionItem[] = [];

  for (const row of unassigned) {
    items.push({
      id: `unassigned-${row.id}`,
      kind: "UNASSIGNED_INSTRUCTOR",
      title: `${row.name} needs a mentor`,
      detail: `${row.primaryRole}${row.chapterName ? ` · ${row.chapterName}` : ""} · ${row.reason}`,
      emphasis: "Assign mentor",
      href: `/mentorship?view=admin&tab=assignments&menteeId=${row.id}&supportRole=PRIMARY_MENTOR`,
      priority: 0,
    });
  }

  for (const row of withoutGoals) {
    items.push({
      id: `nogoals-${row.id}`,
      kind: "NO_GOALS",
      title: `${row.mentee.name} has no active G&R`,
      detail: `Mentor: ${row.mentor.name}`,
      emphasis: "Open relationship",
      href: `/admin/mentorship/relationships/${row.id}`,
      priority: 1,
    });
  }

  for (const row of overdue) {
    items.push({
      id: `overdue-${row.mentorshipId}`,
      kind: "OVERDUE_CHECK_IN",
      title: `${row.menteeName} has no recent check-in`,
      detail: `Mentor: ${row.mentorName} · ${row.daysSinceActivity ?? "?"} days since activity`,
      emphasis: "Open relationship",
      href: `/admin/mentorship/relationships/${row.mentorshipId}`,
      priority: 2,
    });
  }

  for (const row of stalled) {
    items.push({
      id: `stalled-${row.goalId}`,
      kind: "STALLED_GOAL",
      title: `Stalled goal: ${row.goalTitle}`,
      detail: `${row.menteeName} (mentor: ${row.mentorName}) · ${row.reason}`,
      emphasis: "Review goal",
      href: `/admin/mentorship/relationships/${row.mentorshipId}`,
      priority: 3,
    });
  }

  for (const row of pendingReviews) {
    items.push({
      id: `review-${row.id}`,
      kind: "PENDING_REVIEW",
      title: `Goal review pending chair approval`,
      detail: `${row.mentee.name} · mentor ${row.mentor.name}`,
      emphasis: "Approve in queue",
      href: `/mentorship?view=admin&tab=approvals`,
      priority: 4,
    });
  }

  return items.sort((left, right) => left.priority - right.priority);
}

import { prisma } from "@/lib/prisma";

/**
 * Instructor full-360 record reads (Knowledge OS V2, plan §11).
 *
 * The instructor record page reuses the rich existing loaders
 * (`getInstructorOpsProfile`, `loadInstructorLeadership`,
 * `getLatestQuarterlyReview`, `getOperationalContextForEntity`) unchanged —
 * this module adds only the reads those loaders don't carry at record
 * altitude: the advisor caseload with per-advisee check-in state, upcoming
 * class sessions, and the quarterly review history line.
 */

export type AdvisorCaseloadRow = {
  assignmentId: string;
  student: { id: string; name: string; email: string };
  advisingStatus: string;
  needsFollowUp: boolean;
  followUpNote: string | null;
  lastCheckInISO: string | null;
  nextCheckInISO: string | null;
  overdue: boolean;
};

/**
 * Active advisees for an advisor, overdue check-ins first (advisor
 * visibility matrix, plan §12).
 */
export async function loadAdvisorCaseload(
  advisorId: string,
  now: Date = new Date()
): Promise<AdvisorCaseloadRow[]> {
  const assignments = await prisma.studentAdvisorAssignment.findMany({
    where: { advisorId, isActive: true },
    select: {
      id: true,
      advisingStatus: true,
      needsFollowUp: true,
      followUpNote: true,
      lastCheckInAt: true,
      nextCheckInDueAt: true,
      student: { select: { id: true, name: true, email: true } },
    },
  });

  const rows = assignments.map((a) => {
    const overdue = Boolean(
      a.nextCheckInDueAt && a.nextCheckInDueAt.getTime() < now.getTime()
    );
    return {
      assignmentId: a.id,
      student: {
        id: a.student.id,
        name: a.student.name || a.student.email,
        email: a.student.email,
      },
      advisingStatus: a.advisingStatus,
      needsFollowUp: a.needsFollowUp,
      followUpNote: a.followUpNote,
      lastCheckInISO: a.lastCheckInAt?.toISOString() ?? null,
      nextCheckInISO: a.nextCheckInDueAt?.toISOString() ?? null,
      overdue,
    };
  });

  // Overdue first, then by next check-in date; never-scheduled last.
  return rows.sort((a, b) => {
    if (a.overdue !== b.overdue) return a.overdue ? -1 : 1;
    const aT = a.nextCheckInISO ? Date.parse(a.nextCheckInISO) : Infinity;
    const bT = b.nextCheckInISO ? Date.parse(b.nextCheckInISO) : Infinity;
    return aT - bT;
  });
}

export type UpcomingSessionRow = {
  id: string;
  dateISO: string;
  startTime: string;
  topic: string;
  offering: { id: string; title: string };
};

/** Next scheduled sessions across the instructor's lead-instructed classes. */
export async function loadUpcomingSessions(
  instructorId: string,
  now: Date = new Date(),
  take = 5
): Promise<UpcomingSessionRow[]> {
  const sessions = await prisma.classSession.findMany({
    where: {
      isCancelled: false,
      date: { gte: now },
      offering: { instructorId, status: { in: ["PUBLISHED", "IN_PROGRESS"] } },
    },
    orderBy: { date: "asc" },
    take,
    select: {
      id: true,
      date: true,
      startTime: true,
      topic: true,
      offering: { select: { id: true, title: true } },
    },
  });
  return sessions.map((s) => ({
    id: s.id,
    dateISO: s.date.toISOString(),
    startTime: s.startTime,
    topic: s.topic,
    offering: s.offering,
  }));
}

export type QuarterlyReviewHistoryRow = {
  id: string;
  quarter: string;
  performanceRating: string;
  potentialRating: string;
  decision: string;
  createdAtISO: string;
};

/** Past quarterly reviews, newest first — the concrete review history line. */
export async function loadQuarterlyReviewHistory(
  userId: string,
  take = 4
): Promise<QuarterlyReviewHistoryRow[]> {
  const reviews = await prisma.quarterlyReview.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take,
    select: {
      id: true,
      quarter: true,
      performanceRating: true,
      potentialRating: true,
      decision: true,
      createdAt: true,
    },
  });
  return reviews.map((r) => ({
    id: r.id,
    quarter: r.quarter,
    performanceRating: r.performanceRating,
    potentialRating: r.potentialRating,
    decision: r.decision,
    createdAtISO: r.createdAt.toISOString(),
  }));
}

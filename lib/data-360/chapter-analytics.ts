/**
 * Data 360 — chapter comparison (server loader).
 *
 * Builds the chapter-comparison grid: one row per chapter, every operating +
 * workflow metric as a concrete current count, each graded against the central
 * expectations (`./expectations`) with a plain status and a real drilldown.
 * Workflow counts come from already-loaded, health-scored instances (passed in
 * from `loadWorkflowAnalyticsInstances`) so we never load or re-score twice.
 *
 * Cost is bounded: six `groupBy` reads for the count metrics, a windowed read
 * for sessions/attendance, and in-memory tallies for the relation-joined ones.
 * Honest gaps are surfaced as `null` values / disabled drilldowns rather than
 * invented numbers.
 */

import "server-only";

import { prisma } from "@/lib/prisma";
import { addWeeks, weekStartFor } from "@/lib/weekly-meetings/week";

import {
  CHAPTER_EXPECTATION_LIST,
  chapterPhase,
  CHAPTER_PHASE_LABELS,
  type ChapterMetricKey,
} from "./expectations";
import {
  buildChapterMetricCell,
  type ChapterComparison,
  type ChapterComparisonRow,
  type ChapterMetricCell,
} from "./chapter-metrics";
import { isActiveHealth, type WorkflowAnalyticsInstance } from "./workflow-analytics-core";

export type { ChapterComparison, ChapterComparisonRow, ChapterMetricCell };
export { chapterMetricDrilldownHref } from "./chapter-metrics";

const ATTENDANCE_WINDOW_WEEKS = 8;

/** count → map keyed by chapterId, from a Prisma groupBy result. */
function groupCount(
  rows: { chapterId: string | null; _count: { _all: number } }[]
): Map<string, number> {
  const m = new Map<string, number>();
  for (const r of rows) {
    if (r.chapterId) m.set(r.chapterId, r._count._all);
  }
  return m;
}

export async function loadChapterComparison(
  now: Date,
  workflowInstances: WorkflowAnalyticsInstance[],
  opts: { chapterIds?: string[] } = {}
): Promise<ChapterComparison> {
  const chapters = await prisma.chapter.findMany({
    where: {
      archivedAt: null,
      ...(opts.chapterIds ? { id: { in: opts.chapterIds } } : {}),
    },
    select: { id: true, name: true, region: true, lifecycleStatus: true },
    orderBy: { name: "asc" },
  });
  if (chapters.length === 0) {
    return { expectations: CHAPTER_EXPECTATION_LIST, rows: [] };
  }
  const chapterIds = chapters.map((c) => c.id);
  const attendanceWindowStart = addWeeks(weekStartFor(now), -(ATTENDANCE_WINDOW_WEEKS - 1));

  const [
    partnerGroups,
    instructorGroups,
    studentGroups,
    classGroups,
    meetingGroups,
    completedActionGroups,
    applications,
    followUps,
    sessions,
    attendance,
  ] = await Promise.all([
    prisma.partner.groupBy({
      by: ["chapterId"],
      where: { chapterId: { in: chapterIds }, archivedAt: null },
      _count: { _all: true },
    }),
    prisma.user.groupBy({
      by: ["chapterId"],
      where: { chapterId: { in: chapterIds }, primaryRole: "INSTRUCTOR", archivedAt: null },
      _count: { _all: true },
    }),
    prisma.user.groupBy({
      by: ["chapterId"],
      where: { chapterId: { in: chapterIds }, primaryRole: "STUDENT", archivedAt: null },
      _count: { _all: true },
    }),
    prisma.classOffering.groupBy({
      by: ["chapterId"],
      where: { chapterId: { in: chapterIds }, status: { in: ["PUBLISHED", "IN_PROGRESS"] } },
      _count: { _all: true },
    }),
    prisma.meeting.groupBy({
      by: ["chapterId"],
      where: { chapterId: { in: chapterIds }, status: "COMPLETED" },
      _count: { _all: true },
    }),
    prisma.actionItem.groupBy({
      by: ["chapterId"],
      where: { chapterId: { in: chapterIds }, status: "COMPLETE" },
      _count: { _all: true },
    }),
    prisma.instructorApplication.findMany({
      where: {
        status: { notIn: ["APPROVED", "REJECTED", "WITHDRAWN"] },
        applicant: { chapterId: { in: chapterIds } },
      },
      select: { applicant: { select: { chapterId: true } } },
    }),
    prisma.meetingFollowUp.findMany({
      where: { meeting: { chapterId: { in: chapterIds } } },
      select: { status: true, meeting: { select: { chapterId: true } } },
    }),
    prisma.classSession.findMany({
      where: {
        isCancelled: false,
        date: { gte: attendanceWindowStart, lte: now },
        offering: { chapterId: { in: chapterIds } },
      },
      select: { offering: { select: { chapterId: true } } },
    }),
    prisma.classAttendanceRecord.findMany({
      where: {
        session: {
          date: { gte: attendanceWindowStart, lte: now },
          offering: { chapterId: { in: chapterIds } },
        },
      },
      select: {
        status: true,
        session: { select: { offering: { select: { chapterId: true } } } },
      },
    }),
  ]);

  const partners = groupCount(partnerGroups);
  const instructors = groupCount(instructorGroups);
  const students = groupCount(studentGroups);
  const classes = groupCount(classGroups);
  const meetingsHeld = groupCount(meetingGroups);
  const completedActions = groupCount(completedActionGroups);

  const applicants = new Map<string, number>();
  for (const a of applications) {
    const cid = a.applicant?.chapterId;
    if (cid) applicants.set(cid, (applicants.get(cid) ?? 0) + 1);
  }

  const pendingFollowUps = new Map<string, number>();
  const completedFollowUps = new Map<string, number>();
  for (const f of followUps) {
    const cid = f.meeting?.chapterId;
    if (!cid) continue;
    if (f.status === "COMPLETED") {
      completedFollowUps.set(cid, (completedFollowUps.get(cid) ?? 0) + 1);
    } else {
      pendingFollowUps.set(cid, (pendingFollowUps.get(cid) ?? 0) + 1);
    }
  }

  const sessionsHeld = new Map<string, number>();
  for (const s of sessions) {
    const cid = s.offering?.chapterId;
    if (cid) sessionsHeld.set(cid, (sessionsHeld.get(cid) ?? 0) + 1);
  }

  const attPresent = new Map<string, number>();
  const attTotal = new Map<string, number>();
  for (const r of attendance) {
    const cid = r.session?.offering?.chapterId;
    if (!cid) continue;
    attTotal.set(cid, (attTotal.get(cid) ?? 0) + 1);
    if (r.status === "PRESENT" || r.status === "LATE") {
      attPresent.set(cid, (attPresent.get(cid) ?? 0) + 1);
    }
  }

  // Workflow metrics per chapter, from the already-scored instances.
  const wfActive = new Map<string, number>();
  const wfBlocked = new Map<string, number>();
  const wfOverdue = new Map<string, number>();
  for (const i of workflowInstances) {
    if (!i.chapterId) continue;
    if (isActiveHealth(i.health)) {
      wfActive.set(i.chapterId, (wfActive.get(i.chapterId) ?? 0) + 1);
    }
    if (i.health === "BLOCKED") wfBlocked.set(i.chapterId, (wfBlocked.get(i.chapterId) ?? 0) + 1);
    if (i.health === "OVERDUE") wfOverdue.set(i.chapterId, (wfOverdue.get(i.chapterId) ?? 0) + 1);
  }

  const rows: ChapterComparisonRow[] = chapters.map((c) => {
    const phase = chapterPhase(c.lifecycleStatus);
    const total = attTotal.get(c.id) ?? 0;
    const attendancePct = total > 0 ? Math.round(((attPresent.get(c.id) ?? 0) / total) * 100) : null;

    const values: Record<ChapterMetricKey, number | null> = {
      partners: partners.get(c.id) ?? 0,
      applicants: applicants.get(c.id) ?? 0,
      instructors: instructors.get(c.id) ?? 0,
      students: students.get(c.id) ?? 0,
      classes: classes.get(c.id) ?? 0,
      sessions: sessionsHeld.get(c.id) ?? 0,
      attendance: attendancePct,
      meetingsHeld: meetingsHeld.get(c.id) ?? 0,
      pendingFollowUps: pendingFollowUps.get(c.id) ?? 0,
      completedFollowUps: completedFollowUps.get(c.id) ?? 0,
      completedActions: completedActions.get(c.id) ?? 0,
      activeWorkflows: wfActive.get(c.id) ?? 0,
      blockedWorkflows: wfBlocked.get(c.id) ?? 0,
      overdueWorkflows: wfOverdue.get(c.id) ?? 0,
    };

    const metrics = {} as Record<ChapterMetricKey, ChapterMetricCell>;
    for (const exp of CHAPTER_EXPECTATION_LIST) {
      metrics[exp.key] = buildChapterMetricCell(exp.key, values[exp.key], phase, c.id);
    }

    return {
      chapterId: c.id,
      chapterName: c.name,
      region: c.region,
      lifecycleStatus: c.lifecycleStatus,
      phase,
      phaseLabel: CHAPTER_PHASE_LABELS[phase],
      metrics,
    };
  });

  return { expectations: CHAPTER_EXPECTATION_LIST, rows };
}

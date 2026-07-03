// DB loader for the Impact Meeting brief. Reuses the six-room Chapter OS load
// (metrics, growth, blockers, student community, playbook prep) and adds the
// chapter's open work (ActionItems), support requests, decision-flagged Weekly
// Impact rows, this week's CHAPTER_IMPACT meeting, and the missing-data probes
// (weekly entry, attendance, saved snapshot) — then hands plain records to the
// pure builder in lib/chapters/impact-brief.ts. Caller authorizes with
// `requireChapterManager(chapterId)`.

import "server-only";

import { prisma } from "@/lib/prisma";
import { withPrismaFallback } from "@/lib/prisma-guard";
import { weekStartFor } from "@/lib/weekly-meetings/week";
import { loadChapterOS, type ChapterOSModel } from "@/lib/chapters/chapter-os";
import { summarizeChapterExpectations } from "@/lib/chapters/expectations";
import {
  buildChapterImpactBrief,
  type BriefActionRecord,
  type BriefMeetingInfo,
  type BriefSupportRequest,
  type ChapterImpactBrief,
  type WeeklyEntryState,
} from "@/lib/chapters/impact-brief";
import type { PreviousSnapshotSource } from "@/lib/chapters/chapter-growth";
import type { ImpactMeetingPrep } from "@/lib/chapters/impact-meeting";

export type ChapterImpactBriefModel = {
  brief: ChapterImpactBrief;
  /** The week-appropriate playbook metric groups (rendered as the numbers block). */
  prep: ImpactMeetingPrep;
  chapter: ChapterOSModel["chapter"];
  growthBaselineSource: PreviousSnapshotSource;
};

/** Load everything the Impact Meeting page renders. Null if the chapter is missing. */
export async function loadChapterImpactBrief(
  chapterId: string,
  opts: { isLeadership?: boolean } = {}
): Promise<ChapterImpactBriefModel | null> {
  const now = new Date();
  const weekStart = weekStartFor(now);

  const os = await loadChapterOS(chapterId, opts);
  if (!os) return null;

  const [actionRows, supportRows, decisionRowsRaw, entryRows, weekMeeting, upcomingMeeting, attendanceThisWeek, savedSnapshot] =
    await Promise.all([
      withPrismaFallback(
        "impact-brief:actions",
        () =>
          prisma.actionItem.findMany({
            where: { chapterId },
            orderBy: { updatedAt: "desc" },
            take: 200,
            select: {
              id: true,
              title: true,
              status: true,
              deadlineStart: true,
              deadlineEnd: true,
              completedAt: true,
              blockedReason: true,
              lead: { select: { name: true } },
            },
          }),
        []
      ),
      withPrismaFallback(
        "impact-brief:support-requests",
        () =>
          prisma.chapterSupportRequest.findMany({
            where: { chapterId, status: { in: ["OPEN", "IN_PROGRESS"] } },
            orderBy: { createdAt: "desc" },
            take: 20,
            select: {
              id: true,
              title: true,
              category: true,
              priority: true,
              createdAt: true,
              assignedTo: { select: { name: true } },
            },
          }),
        []
      ),
      withPrismaFallback(
        "impact-brief:decision-rows",
        () =>
          prisma.weeklyImpactRow.findMany({
            where: { decisionNeeded: true, entry: { chapterId, weekStart } },
            take: 20,
            select: { id: true, whatGoal: true, evidenceNext: true },
          }),
        []
      ),
      withPrismaFallback(
        "impact-brief:weekly-entries",
        () =>
          prisma.weeklyImpactEntry.findMany({
            where: { chapterId, weekStart },
            take: 20,
            select: { status: true },
          }),
        []
      ),
      withPrismaFallback(
        "impact-brief:week-meeting",
        () =>
          prisma.meeting.findFirst({
            where: { chapterId, type: "CHAPTER_IMPACT", weekStart, status: { not: "CANCELLED" } },
            orderBy: { scheduledAt: "asc" },
            select: { id: true, scheduledAt: true, status: true },
          }),
        null
      ),
      withPrismaFallback(
        "impact-brief:upcoming-meeting",
        () =>
          prisma.meeting.findFirst({
            where: {
              chapterId,
              type: "CHAPTER_IMPACT",
              status: "SCHEDULED",
              scheduledAt: { gte: now },
            },
            orderBy: { scheduledAt: "asc" },
            select: { id: true, scheduledAt: true, status: true },
          }),
        null
      ),
      withPrismaFallback(
        "impact-brief:attendance-this-week",
        () =>
          prisma.classAttendanceRecord.count({
            where: { session: { offering: { chapterId }, date: { gte: weekStart } } },
          }),
        0
      ),
      withPrismaFallback(
        "impact-brief:saved-snapshot",
        () =>
          prisma.chapterWeeklyKpiSnapshot.findUnique({
            where: { chapterId_weekStart: { chapterId, weekStart } },
            select: { id: true },
          }),
        null
      ),
    ]);

  const actions: BriefActionRecord[] = actionRows.map((a) => ({
    id: a.id,
    title: a.title,
    status: a.status,
    dueAt: a.deadlineEnd ?? a.deadlineStart,
    completedAt: a.completedAt,
    leadName: a.lead?.name ?? null,
    blockedReason: a.blockedReason ?? null,
  }));

  const supportRequests: BriefSupportRequest[] = supportRows.map((s) => ({
    id: s.id,
    title: s.title,
    category: s.category,
    priority: s.priority,
    createdAt: s.createdAt,
    assignedToName: s.assignedTo?.name ?? null,
  }));

  const weeklyEntry: WeeklyEntryState = entryRows.some((e) => e.status === "SUBMITTED")
    ? "SUBMITTED"
    : entryRows.length > 0
      ? "DRAFT"
      : "MISSING";

  const meetingRow = weekMeeting ?? upcomingMeeting;
  const meeting: BriefMeetingInfo | null = meetingRow
    ? {
        id: meetingRow.id,
        scheduledAt: meetingRow.scheduledAt,
        status: meetingRow.status,
        isThisWeek: weekMeeting != null,
      }
    : null;

  const expectations = summarizeChapterExpectations({
    confirmedPartners: os.partners.confirmed,
    instructorApplicants: os.instructors.applicants,
    instructorsHired: os.instructors.hired,
    studentsEnrolled: os.studentCommunity.metrics.enrolledCount,
    classesRunning: os.metrics.classesRunning,
  });

  const sm = os.studentCommunity.metrics;

  const brief = buildChapterImpactBrief({
    chapter: {
      id: os.chapter.id,
      name: os.chapter.name,
      lifecycleLabel: os.chapter.lifecycleLabel,
      presidentName: os.chapter.president?.name ?? null,
    },
    weekNumber: os.weekNumber,
    focus: os.focus,
    weekStart,
    weekLabel: os.impact.weekLabel,
    now,
    growth: os.growth,
    expectations,
    metrics: os.metrics,
    studentMetrics: {
      enrolledCount: sm.enrolledCount,
      attendancePercent: sm.attendancePercent,
      hasAttendanceData: sm.hasAttendanceData,
      retentionPercent: sm.retentionPercent,
      feedbackCount: sm.feedbackCount,
      unresolvedConcerns: sm.unresolvedConcerns,
    },
    studentNeeds: os.studentCommunity.needsAttention.map((n) => ({
      title: n.title,
      severity: n.severity,
      href: n.href,
    })),
    blockers: os.blockers,
    actions,
    supportRequests,
    decisionRows: decisionRowsRaw.map((r) => ({
      id: r.id,
      title: r.whatGoal || "Decision needed",
      detail: r.evidenceNext || null,
    })),
    weeklyEntry,
    meeting,
    attendanceRecordedThisWeek: attendanceThisWeek > 0,
    snapshotSavedThisWeek: savedSnapshot != null,
    partnerFollowUpsDue: os.partners.followUpNeeded,
  });

  return {
    brief,
    prep: os.impact,
    chapter: os.chapter,
    growthBaselineSource: os.growthBaselineSource,
  };
}

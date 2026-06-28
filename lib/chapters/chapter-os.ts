// THE six-room Chapter Operating System loader. Builds on the existing
// `loadChapterOperatingSystem` (partners · instructors · curriculum · classes)
// and adds the two newest rooms — Student Community and Chapter Growth — then
// projects all six into the shared `ChapterRoom` shape and a single, unified
// "Needs You" feed.
//
// This file is the only DB-touching layer for the new rooms: it gathers
// chapter-scoped enrollment / attendance / feedback / concern rows and the
// timestamped data needed to reconstruct last week's KPI snapshot, then hands
// plain records to the pure summarizers. No invented data; absent data yields
// honest empty states.

import "server-only";

import { prisma } from "@/lib/prisma";
import { withPrismaFallback } from "@/lib/prisma-guard";
import { weekStartFor, weekKey, addWeeks } from "@/lib/weekly-meetings/week";
import { loadChapterOperatingSystem, type ChapterOperatingSystem } from "@/lib/chapters/operating-system";
import {
  summarizeStudentCommunity,
  type StudentEnrollmentRecord,
  type AttendanceMark,
  type StudentFeedbackRecord,
  type StudentConcernRecord,
  type StudentCommunitySummary,
} from "@/lib/chapters/student-community";
import {
  summarizeChapterGrowth,
  rowToKpiSnapshotInput,
  pickPreviousSnapshot,
  type KpiSnapshotInput,
  type ChapterGrowthSummary,
  type PreviousSnapshotSource,
} from "@/lib/chapters/chapter-growth";
import { buildChapterRooms, collectNeedsYou, type RoomNeedsItem } from "@/lib/chapters/rooms";
import { withRoomActions, type ChapterRoomWithActions } from "@/lib/chapters/room-actions";

export type ChapterOS = NonNullable<Awaited<ReturnType<typeof loadChapterOS>>>;

export type ChapterOSModel = {
  chapter: ChapterOperatingSystem["chapter"];
  weekNumber: number;
  focus: string;
  rooms: ChapterRoomWithActions[];
  needsYou: RoomNeedsItem[];
  blockerSummary: ChapterOperatingSystem["blockerSummary"];
  studentCommunity: StudentCommunitySummary;
  growth: ChapterGrowthSummary;
  /** Whether the growth baseline is a saved snapshot, reconstructed, or absent. */
  growthBaselineSource: PreviousSnapshotSource;
  impact: ChapterOperatingSystem["impact"];
};

const ACTIVE_ENROLLMENT = ["ENROLLED", "COMPLETED"];

/**
 * Load the full six-room Chapter OS for a chapter. Caller authorizes
 * (`requireChapterManager(chapterId)`). Returns null if the chapter is missing.
 */
export async function loadChapterOS(chapterId: string): Promise<ChapterOSModel | null> {
  const now = new Date();
  const cutoff = weekStartFor(now); // Monday 00:00 UTC of the current reporting week

  const os = await loadChapterOperatingSystem(chapterId);
  if (!os) return null;

  // --- Student Community raw rows ------------------------------------------
  const [enrollmentRows, attendanceRows, classFeedbackRows, parentFeedbackRows, concernRows] = await Promise.all([
    withPrismaFallback(
      "chapter-os:enrollments",
      () =>
        prisma.classEnrollment.findMany({
          where: { offering: { chapterId } },
          take: 5000,
          select: {
            studentId: true,
            status: true,
            enrolledAt: true,
            droppedAt: true,
            offeringId: true,
            student: { select: { name: true } },
            offering: { select: { title: true } },
          },
        }),
      []
    ),
    withPrismaFallback(
      "chapter-os:attendance",
      () =>
        prisma.classAttendanceRecord.findMany({
          where: { session: { offering: { chapterId } } },
          take: 8000,
          select: {
            sessionId: true,
            status: true,
            studentId: true,
            student: { select: { name: true } },
            session: { select: { date: true, offeringId: true, offering: { select: { title: true } } } },
          },
        }),
      []
    ),
    withPrismaFallback(
      "chapter-os:class-feedback",
      () =>
        prisma.classFeedback.findMany({
          where: { offering: { chapterId } },
          take: 2000,
          select: { id: true, rating: true, liked: true, improve: true, createdAt: true, offering: { select: { title: true } } },
        }),
      []
    ),
    withPrismaFallback(
      "chapter-os:parent-feedback",
      () =>
        prisma.parentChapterFeedback.findMany({
          where: { chapterId },
          take: 2000,
          select: { id: true, rating: true, comments: true, createdAt: true, student: { select: { name: true } } },
        }),
      []
    ),
    withPrismaFallback(
      "chapter-os:concerns",
      () =>
        prisma.studentIntakeCase.findMany({
          where: { chapterId, status: { in: ["SUBMITTED", "UNDER_REVIEW"] } },
          take: 200,
          select: { id: true, studentName: true, supportNeeds: true, blockerNote: true, createdAt: true },
        }),
      []
    ),
  ]);

  const enrollments: StudentEnrollmentRecord[] = enrollmentRows.map((e) => ({
    studentId: e.studentId,
    studentName: e.student?.name ?? "Student",
    offeringId: e.offeringId,
    className: e.offering?.title ?? "Class",
    status: e.status,
    enrolledAt: e.enrolledAt,
    droppedAt: e.droppedAt,
  }));

  const attendance: AttendanceMark[] = attendanceRows.map((a) => ({
    offeringId: a.session?.offeringId ?? "",
    className: a.session?.offering?.title ?? "Class",
    sessionId: a.sessionId,
    studentId: a.studentId,
    studentName: a.student?.name ?? "Student",
    date: a.session?.date ?? now,
    status: a.status,
  }));

  const feedback: StudentFeedbackRecord[] = [
    ...classFeedbackRows.map((f) => ({
      id: f.id,
      studentName: null,
      className: f.offering?.title ?? null,
      rating: f.rating,
      comment: [f.liked, f.improve].filter(Boolean).join(" · ") || null,
      source: "student" as const,
      createdAt: f.createdAt,
    })),
    ...parentFeedbackRows.map((f) => ({
      id: f.id,
      studentName: f.student?.name ?? null,
      className: null,
      rating: f.rating,
      comment: f.comments ?? null,
      source: "parent" as const,
      createdAt: f.createdAt,
    })),
  ];

  const concerns: StudentConcernRecord[] = concernRows.map((c) => ({
    id: c.id,
    studentName: c.studentName ?? null,
    summary: c.blockerNote?.trim() || c.supportNeeds?.trim() || "Pending student intake case",
    createdAt: c.createdAt,
    href: "/chapter/student-intake",
  }));

  const studentCommunity = summarizeStudentCommunity({ enrollments, attendance, feedback, concerns }, now);

  // --- Chapter Growth snapshots -------------------------------------------
  const curriculaSubmittedTotal =
    os.curriculum.byStatus.submitted + os.curriculum.byStatus.needs_revision + os.curriculum.byStatus.approved;
  const partnersContactedNow =
    os.partners.byStatus.contacted +
    os.partners.byStatus.interested +
    os.partners.byStatus.meeting_scheduled +
    os.partners.byStatus.final_conversation +
    os.partners.byStatus.confirmed;

  const current: KpiSnapshotInput = {
    weekStartISO: weekKey(cutoff),
    weekNumber: os.weekNumber,
    values: {
      partnersContacted: partnersContactedNow,
      partnerMeetingsScheduled: os.partners.byStatus.meeting_scheduled,
      confirmedPartners: os.partners.confirmed,
      instructorApplicants: os.instructors.applicants,
      interviewsCompleted: os.instructors.byStage.interview_complete,
      instructorsHired: os.instructors.hired,
      curriculaSubmitted: curriculaSubmittedTotal,
      curriculaApproved: os.curriculum.approved,
      classesCreated: os.launch.total,
      classesReady: os.launch.ready,
      studentsEnrolled: studentCommunity.metrics.enrolledCount,
      attendancePercent: studentCommunity.metrics.attendancePercent,
      retentionPercent: studentCommunity.metrics.retentionPercent,
      feedbackCollected: studentCommunity.metrics.feedbackCount,
      unresolvedBlockers: os.blockerSummary.total,
    },
  };

  // Prior-week baseline. Prefer a REAL persisted weekly snapshot (saved via the
  // "Save snapshot" room action); fall back to timestamp reconstruction; else
  // none (brand-new chapter). Only meaningful once there is a full week behind us.
  let reconstructed: KpiSnapshotInput | null = null;
  let persisted: KpiSnapshotInput | null = null;
  if (os.weekNumber > 1) {
    const prevWeekStart = addWeeks(cutoff, -1);
    [reconstructed, persisted] = await Promise.all([
      buildPreviousSnapshot(chapterId, cutoff, current),
      withPrismaFallback(
        "chapter-os:prev-weekly-snapshot",
        async () => {
          const row = await prisma.chapterWeeklyKpiSnapshot.findUnique({
            where: { chapterId_weekStart: { chapterId, weekStart: prevWeekStart } },
          });
          return row
            ? rowToKpiSnapshotInput(row, { weekStartISO: weekKey(prevWeekStart), weekNumber: os.weekNumber - 1 })
            : null;
        },
        null
      ),
    ]);
  }
  const baseline = pickPreviousSnapshot(persisted, reconstructed);

  const growth = summarizeChapterGrowth({ weekNumber: os.weekNumber, current, previous: baseline.previous });

  // --- Compose six rooms (+ contextual room actions) -----------------------
  const rooms = withRoomActions(buildChapterRooms(os, studentCommunity, growth));
  const needsYou = collectNeedsYou(rooms);

  return {
    chapter: os.chapter,
    weekNumber: os.weekNumber,
    focus: os.impact.focus,
    rooms,
    needsYou,
    blockerSummary: os.blockerSummary,
    studentCommunity,
    growth,
    growthBaselineSource: baseline.source,
    impact: os.impact,
  };
}

/**
 * Reconstruct last week's KPI snapshot from timestamped data (state as of the
 * start of the current reporting week). Metrics with a reliable timestamp are
 * counted as-of the cutoff; point-in-time metrics without history carry forward
 * the current value (flat trend, never a false regression). Persisting real
 * weekly snapshots for full history is Phase 3.
 */
async function buildPreviousSnapshot(
  chapterId: string,
  cutoff: Date,
  current: KpiSnapshotInput
): Promise<KpiSnapshotInput> {
  const [
    partnersContacted,
    partnerMeetingsScheduled,
    instructorApplicants,
    instructorsHired,
    curriculaSubmitted,
    classesCreated,
    studentsEnrolled,
    classFeedbackCount,
    parentFeedbackCount,
  ] = await Promise.all([
    withPrismaFallback(
      "chapter-os:prev-partners-contacted",
      () => prisma.partner.count({ where: { chapterId, archivedAt: null, lastContactedAt: { lte: cutoff } } }),
      0
    ),
    withPrismaFallback(
      "chapter-os:prev-partner-meetings",
      () => prisma.partner.count({ where: { chapterId, archivedAt: null, meetingDate: { lte: cutoff } } }),
      0
    ),
    withPrismaFallback(
      "chapter-os:prev-applicants",
      () =>
        prisma.instructorApplication.count({
          where: { applicant: { chapterId }, createdAt: { lte: cutoff }, status: { notIn: ["WITHDRAWN", "REJECTED"] } },
        }),
      0
    ),
    withPrismaFallback(
      "chapter-os:prev-hired",
      () => prisma.instructorApplication.count({ where: { applicant: { chapterId }, approvedAt: { lte: cutoff } } }),
      0
    ),
    withPrismaFallback(
      "chapter-os:prev-curricula-submitted",
      () => prisma.classTemplate.count({ where: { chapterId, submittedAt: { lte: cutoff } } }),
      0
    ),
    withPrismaFallback(
      "chapter-os:prev-classes",
      () => prisma.classOffering.count({ where: { chapterId, status: { not: "CANCELLED" }, createdAt: { lte: cutoff } } }),
      0
    ),
    withPrismaFallback(
      "chapter-os:prev-enrolled",
      () =>
        prisma.classEnrollment.count({
          where: {
            offering: { chapterId },
            status: { in: ACTIVE_ENROLLMENT },
            enrolledAt: { lte: cutoff },
            OR: [{ droppedAt: null }, { droppedAt: { gt: cutoff } }],
          },
        }),
      0
    ),
    withPrismaFallback(
      "chapter-os:prev-class-feedback",
      () => prisma.classFeedback.count({ where: { offering: { chapterId }, createdAt: { lte: cutoff } } }),
      0
    ),
    withPrismaFallback(
      "chapter-os:prev-parent-feedback",
      () => prisma.parentChapterFeedback.count({ where: { chapterId, createdAt: { lte: cutoff } } }),
      0
    ),
  ]);

  return {
    weekStartISO: current.weekStartISO,
    weekNumber: current.weekNumber - 1,
    values: {
      partnersContacted,
      partnerMeetingsScheduled,
      instructorApplicants,
      instructorsHired,
      curriculaSubmitted,
      classesCreated,
      studentsEnrolled,
      feedbackCollected: classFeedbackCount + parentFeedbackCount,
      // Point-in-time metrics without history: carry forward (flat trend).
      confirmedPartners: current.values.confirmedPartners ?? 0,
      interviewsCompleted: current.values.interviewsCompleted ?? 0,
      curriculaApproved: current.values.curriculaApproved ?? 0,
      classesReady: current.values.classesReady ?? 0,
      attendancePercent: current.values.attendancePercent ?? 0,
      retentionPercent: current.values.retentionPercent ?? 0,
      unresolvedBlockers: current.values.unresolvedBlockers ?? 0,
    },
  };
}

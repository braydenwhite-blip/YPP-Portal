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

import type { ClassEnrollmentStatus } from "@prisma/client";

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
import { loadChapterClassRuntime } from "@/lib/classes/chapter-class-runtime";
import { interventionRoom, type ClassIntervention } from "@/lib/classes/interventions";
import {
  buildRoomActivity,
  partnerNoteActivity,
  curriculumReviewActivity,
  classTimelineActivity,
  applicantTimelineActivity,
  enrollmentActivity,
  classFeedbackActivity,
  snapshotActivity,
  attendanceActivity,
  reflectionActivity,
  type RoomActivityItem,
} from "@/lib/chapters/room-activity";

export type ChapterOS = NonNullable<Awaited<ReturnType<typeof loadChapterOS>>>;

export type ChapterOSModel = {
  chapter: ChapterOperatingSystem["chapter"];
  weekNumber: number;
  focus: string;
  rooms: ChapterRoomWithActions[];
  needsYou: RoomNeedsItem[];
  recentActivity: RoomActivityItem[];
  /** Server render time (ISO) — the stable reference for relative timestamps. */
  nowISO: string;
  blockerSummary: ChapterOperatingSystem["blockerSummary"];
  studentCommunity: StudentCommunitySummary;
  growth: ChapterGrowthSummary;
  /** Whether the growth baseline is a saved snapshot, reconstructed, or absent. */
  growthBaselineSource: PreviousSnapshotSource;
  impact: ChapterOperatingSystem["impact"];
  // Re-exposed so the Automation Brain can build `ChapterFacts` from this single
  // load (no extra DB reads). These are the inner OS summaries verbatim.
  metrics: ChapterOperatingSystem["metrics"];
  partners: ChapterOperatingSystem["partners"];
  instructors: ChapterOperatingSystem["instructors"];
  curriculum: ChapterOperatingSystem["curriculum"];
  launch: ChapterOperatingSystem["launch"];
  blockers: ChapterOperatingSystem["blockers"];
};

const ACTIVE_ENROLLMENT: ClassEnrollmentStatus[] = ["ENROLLED", "COMPLETED"];

/**
 * Load the full six-room Chapter OS for a chapter. Caller authorizes
 * (`requireChapterManager(chapterId)`). Returns null if the chapter is missing.
 */
export async function loadChapterOS(
  chapterId: string,
  opts: { isLeadership?: boolean } = {}
): Promise<ChapterOSModel | null> {
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
  const curriculaSubmittedTotal = os.curriculum.submittedEver;
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

  // --- Live class runtime: interventions feed the rooms + recent activity ---
  const [classRuntime, recentActivity] = await Promise.all([
    loadChapterClassRuntime(chapterId, now),
    loadRecentActivity(chapterId),
  ]);
  // Merge live class interventions into the operating graph BEFORE the rooms are
  // built, so they flow into the rooms' Needs You, the contextual room actions,
  // and the Track-as-Action bridge — deduped against the existing blockers.
  injectClassInterventions(os, studentCommunity, classRuntime.interventions);

  // --- Compose six rooms (+ contextual room actions) -----------------------
  const rooms = withRoomActions(buildChapterRooms(os, studentCommunity, growth), {
    isLeadership: opts.isLeadership,
  });
  const needsYou = collectNeedsYou(rooms);

  return {
    chapter: os.chapter,
    weekNumber: os.weekNumber,
    focus: os.impact.focus,
    rooms,
    needsYou,
    recentActivity,
    nowISO: now.toISOString(),
    blockerSummary: os.blockerSummary,
    studentCommunity,
    growth,
    growthBaselineSource: baseline.source,
    impact: os.impact,
    metrics: os.metrics,
    partners: os.partners,
    instructors: os.instructors,
    curriculum: os.curriculum,
    launch: os.launch,
    blockers: os.blockers,
  };
}

/**
 * Merge live class interventions into the operating graph: class-operational
 * triggers become "classes"-lane blockers (Live Classes room); student-experience
 * triggers become Student Community needs. Deduped by key so an intervention that
 * already exists as a pipeline blocker (e.g. under-enrolled) isn't doubled.
 */
function injectClassInterventions(
  os: ChapterOperatingSystem,
  studentCommunity: StudentCommunitySummary,
  interventions: ClassIntervention[]
): void {
  const classKeys = new Set(os.blockers.map((b) => b.key));
  const studentKeys = new Set(studentCommunity.needsAttention.map((n) => n.key));
  for (const iv of interventions) {
    const detail = `${iv.evidence} · ${iv.recommendedAction}`;
    if (interventionRoom(iv) === "student_community") {
      if (studentKeys.has(iv.key)) continue;
      studentKeys.add(iv.key);
      studentCommunity.needsAttention.push({
        key: iv.key,
        title: iv.title,
        detail,
        severity: iv.severity,
        href: iv.href,
        entityType: "CLASS_OFFERING",
        entityId: iv.classId,
      });
    } else {
      if (classKeys.has(iv.key)) continue;
      classKeys.add(iv.key);
      os.blockers.push({
        key: iv.key,
        lane: "classes",
        severity: iv.severity,
        title: iv.title,
        detail,
        href: iv.href,
        suggestedAction: iv.recommendedAction,
        entityType: "CLASS_OFFERING",
        entityId: iv.classId,
      });
    }
  }
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

/**
 * Unified recent-activity feed for the six rooms, read from existing timestamped
 * sources of truth — partner touchpoints, the two-stage curriculum audit trail,
 * class + applicant timeline events, enrollments, feedback, and KPI snapshots.
 * Nothing is fabricated. Each source is fault-tolerant (a missing table or a
 * transient error contributes nothing rather than failing the page), then all
 * are merged newest-first by the pure room-activity model.
 */
async function loadRecentActivity(chapterId: string): Promise<RoomActivityItem[]> {
  const PER_SOURCE = 8;
  const [partnerNotes, curriculumEvents, classEvents, applicantEvents, enrollments, feedback, snapshots, attendanceRecords, reflections] =
    await Promise.all([
      withPrismaFallback(
        "chapter-os:activity-partner-notes",
        () =>
          prisma.partnerNote.findMany({
            where: { partner: { chapterId } },
            orderBy: { createdAt: "desc" },
            take: PER_SOURCE,
            select: { id: true, kind: true, body: true, createdAt: true, partnerId: true, partner: { select: { name: true } } },
          }),
        []
      ),
      withPrismaFallback(
        "chapter-os:activity-curriculum",
        () =>
          prisma.curriculumReviewEvent.findMany({
            where: { approval: { classTemplate: { chapterId } } },
            orderBy: { createdAt: "desc" },
            take: PER_SOURCE,
            select: {
              id: true,
              decision: true,
              actorName: true,
              createdAt: true,
              approval: { select: { classTemplateId: true, classTemplate: { select: { title: true } } } },
            },
          }),
        []
      ),
      withPrismaFallback(
        "chapter-os:activity-class-timeline",
        () =>
          prisma.classOfferingTimelineEvent.findMany({
            where: { offering: { chapterId } },
            orderBy: { createdAt: "desc" },
            take: PER_SOURCE,
            select: { id: true, kind: true, summary: true, createdAt: true, offeringId: true, offering: { select: { title: true } } },
          }),
        []
      ),
      withPrismaFallback(
        "chapter-os:activity-applicant-timeline",
        () =>
          prisma.instructorApplicationTimelineEvent.findMany({
            where: { application: { applicant: { chapterId } } },
            orderBy: { createdAt: "desc" },
            take: PER_SOURCE,
            select: { id: true, kind: true, createdAt: true, applicationId: true, application: { select: { applicant: { select: { name: true } } } } },
          }),
        []
      ),
      withPrismaFallback(
        "chapter-os:activity-enrollments",
        () =>
          prisma.classEnrollment.findMany({
            where: { offering: { chapterId } },
            orderBy: { enrolledAt: "desc" },
            take: PER_SOURCE,
            select: { id: true, enrolledAt: true, student: { select: { name: true } }, offering: { select: { title: true } } },
          }),
        []
      ),
      withPrismaFallback(
        "chapter-os:activity-feedback",
        () =>
          prisma.classFeedback.findMany({
            where: { offering: { chapterId } },
            orderBy: { createdAt: "desc" },
            take: PER_SOURCE,
            select: { id: true, rating: true, createdAt: true, offering: { select: { title: true } } },
          }),
        []
      ),
      withPrismaFallback(
        "chapter-os:activity-snapshots",
        () =>
          prisma.chapterWeeklyKpiSnapshot.findMany({
            where: { chapterId },
            orderBy: { createdAt: "desc" },
            take: 4,
            select: { id: true, weekStart: true, createdAt: true },
          }),
        []
      ),
      withPrismaFallback(
        "chapter-os:activity-attendance",
        () =>
          prisma.classAttendanceRecord.findMany({
            where: { session: { offering: { chapterId } } },
            orderBy: { checkedInAt: "desc" },
            take: 60,
            select: {
              checkedInAt: true,
              sessionId: true,
              session: { select: { offeringId: true, offering: { select: { title: true } } } },
            },
          }),
        []
      ),
      withPrismaFallback(
        "chapter-os:activity-reflections",
        () =>
          prisma.classSessionReflection.findMany({
            where: { session: { offering: { chapterId } } },
            orderBy: { createdAt: "desc" },
            take: PER_SOURCE,
            select: {
              id: true,
              instructorName: true,
              createdAt: true,
              offeringId: true,
              session: { select: { offering: { select: { title: true } } } },
            },
          }),
        []
      ),
    ]);

  // Attendance is per-student; collapse to one "session recorded" item per
  // session (latest mark wins for the timestamp, with a marked-count).
  const attendanceBySession = new Map<
    string,
    { sessionId: string; offeringId: string; className: string | null; count: number; occurredAt: Date }
  >();
  for (const rec of attendanceRecords) {
    const key = rec.sessionId;
    const existing = attendanceBySession.get(key);
    if (existing) {
      existing.count += 1;
      if (rec.checkedInAt.getTime() > existing.occurredAt.getTime()) existing.occurredAt = rec.checkedInAt;
    } else {
      attendanceBySession.set(key, {
        sessionId: key,
        offeringId: rec.session?.offeringId ?? "",
        className: rec.session?.offering?.title ?? null,
        count: 1,
        occurredAt: rec.checkedInAt,
      });
    }
  }

  const items: RoomActivityItem[] = [
    ...partnerNotes.map((n) =>
      partnerNoteActivity({ id: n.id, kind: n.kind, body: n.body, createdAt: n.createdAt, partnerId: n.partnerId, partnerName: n.partner?.name ?? null })
    ),
    ...curriculumEvents.map((e) =>
      curriculumReviewActivity({
        id: e.id,
        decision: e.decision,
        actorName: e.actorName,
        createdAt: e.createdAt,
        classTemplateId: e.approval?.classTemplateId ?? "",
        classTemplateTitle: e.approval?.classTemplate?.title ?? null,
      })
    ),
    ...classEvents.map((t) =>
      classTimelineActivity({ id: t.id, kind: t.kind, summary: t.summary, createdAt: t.createdAt, offeringId: t.offeringId, offeringTitle: t.offering?.title ?? null })
    ),
    ...applicantEvents.map((t) =>
      applicantTimelineActivity({ id: t.id, kind: t.kind, createdAt: t.createdAt, applicationId: t.applicationId, applicantName: t.application?.applicant?.name ?? null })
    ),
    ...enrollments.map((e) =>
      enrollmentActivity({ id: e.id, enrolledAt: e.enrolledAt, studentName: e.student?.name ?? null, className: e.offering?.title ?? null })
    ),
    ...feedback.map((f) => classFeedbackActivity({ id: f.id, rating: f.rating, createdAt: f.createdAt, className: f.offering?.title ?? null })),
    ...snapshots.map((s) => snapshotActivity({ id: s.id, weekStart: s.weekStart, createdAt: s.createdAt })),
    ...[...attendanceBySession.values()].map((a) => attendanceActivity(a)),
    ...reflections.map((r) =>
      reflectionActivity({
        id: r.id,
        className: r.session?.offering?.title ?? null,
        actorName: r.instructorName,
        createdAt: r.createdAt,
        offeringId: r.offeringId,
      })
    ),
  ];

  return buildRoomActivity(items);
}

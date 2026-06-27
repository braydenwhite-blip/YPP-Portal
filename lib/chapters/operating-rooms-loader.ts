// THE Organizational Operating System loader — composes the six operating rooms
// from real data. The four pipeline rooms reuse `loadChapterOperatingSystem`
// (no duplicate queries); Student Community and Chapter Growth add focused
// queries over enrollment / attendance / feedback and goals / KPI snapshots.
// All logic lives in the pure modules — this file only gathers rows, maps them
// to record shapes, and assembles serializable DTOs. Caller handles authZ
// (`requireChapterManager`).

import "server-only";

import { prisma } from "@/lib/prisma";
import { withPrismaFallback } from "@/lib/prisma-guard";
import { weekStartFor } from "@/lib/weekly-meetings/week";
import { chapterLifecycleLabel } from "@/lib/chapters/lifecycle";
import { relativeAgo } from "@/lib/chapters/format";
import { gatherChapterSignals, healthFromSignals } from "@/lib/chapters/signals";
import { loadChapterOperatingSystem } from "@/lib/chapters/operating-system";
import {
  PARTNER_PLAYBOOK_STATUS_LABELS,
  INSTRUCTOR_PLAYBOOK_STAGE_LABELS,
  partnerPlaybookStatus,
  instructorPlaybookStage,
} from "@/lib/chapters/pipeline";
import { CURRICULUM_SHORT_STAGE, curriculumPlaybookStatus } from "@/lib/chapters/curriculum-review";
import {
  DOMAIN_META,
  OPERATING_DOMAINS,
  deriveRoomHealth,
  rankNeedsYou,
  blockerToNeedsYou,
  toRoomSummary,
  summarizeBuildingHealth,
  type ActivityEvent,
  type ActivityTone,
  type EvidencePayload,
  type NeedsYouItem,
  type OperatingDomainSlug,
  type OperatingRoom,
  type OperatingRoomCore,
  type RoomInsight,
  type RoomMetric,
  type RoomNextAction,
  type RoomSummary,
} from "@/lib/chapters/operating-rooms";
import {
  studentEvidenceRows,
  summarizeStudentCommunity,
  studentCommunityNeedsYou,
  studentCommunityInsights,
  studentCommunityNextAction,
  studentCommunityMetrics,
  type StudentRecord,
} from "@/lib/chapters/student-community";
import {
  growthEvidenceRows,
  summarizeGrowth,
  growthNeedsYou,
  growthInsights,
  growthNextAction,
  growthMetrics,
  growthHealth,
  type GoalRecord,
  type GrowthSignals,
  type TrendRecord,
} from "@/lib/chapters/chapter-growth";
import type { DeliberableStat } from "@/lib/chapters/operating-system";

const DAY_MS = 24 * 60 * 60 * 1000;
const ROW_CAP = 8;
const ACTIVITY_CAP = 5;

const STRONG_HEADLINE: Record<OperatingDomainSlug, string> = {
  "partner-network": "Your partner network is healthy",
  teaching: "Your teaching team is on track",
  learning: "Curriculum is ready to teach",
  classes: "Your classes are healthy",
  students: "Students are thriving",
  growth: "The chapter is on track",
};

const CLASS_STATUS_ACTIVITY: Record<string, { label: string; tone: ActivityTone }> = {
  DRAFT: { label: "Class drafted", tone: "neutral" },
  PUBLISHED: { label: "Class published", tone: "good" },
  IN_PROGRESS: { label: "Class running", tone: "good" },
  COMPLETED: { label: "Class completed", tone: "good" },
  CANCELLED: { label: "Class cancelled", tone: "warn" },
};

export type OperatingRoomsBundle = {
  chapter: { id: string; name: string; lifecycleStatus: string; lifecycleLabel: string };
  rooms: OperatingRoom[];
};

// ---------------------------------------------------------------------------
// Pure-ish shaping helpers
// ---------------------------------------------------------------------------

/** Insights for a pipeline room: surface the flagged (non-zero) stats. */
function pipelineInsights(stats: DeliberableStat[]): RoomInsight[] {
  return stats
    .filter((s) => (s.tone === "warning" || s.tone === "danger") && s.value > 0)
    .map((s) => ({
      key: s.label,
      text: `${s.value} ${s.label.toLowerCase()} — ${s.hint.toLowerCase()}.`,
      tone: s.tone === "danger" ? ("danger" as const) : ("warn" as const),
    }));
}

function statMetrics(stats: DeliberableStat[]): RoomMetric[] {
  return stats.map((s) => ({ label: s.label, value: String(s.value), hint: s.hint }));
}

/** Assemble one of the four pipeline rooms from the operating-system DTO. */
function buildPipelineRoom(args: {
  slug: OperatingDomainSlug;
  stats: DeliberableStat[];
  needsYou: NeedsYouItem[];
  recentActivity: ActivityEvent[];
  nextAction: RoomNextAction;
  evidence: EvidencePayload;
}): OperatingRoom {
  const meta = DOMAIN_META[args.slug];
  const needsYou = rankNeedsYou(args.needsYou);
  const health = deriveRoomHealth(needsYou, STRONG_HEADLINE[args.slug]);
  let insights = pipelineInsights(args.stats);
  if (insights.length === 0 && health.status === "strong") {
    insights = [{ key: "ok", text: `${meta.title} is healthy — nothing is blocked.`, tone: "good" }];
  }
  return {
    slug: args.slug,
    title: meta.title,
    mission: meta.mission,
    question: meta.question,
    icon: meta.icon,
    health,
    metrics: statMetrics(args.stats),
    needsYou,
    recentActivity: args.recentActivity,
    insights,
    nextAction: args.nextAction,
    evidence: args.evidence,
  };
}

// ---------------------------------------------------------------------------
// Loader
// ---------------------------------------------------------------------------

export async function loadOperatingRooms(chapterId: string): Promise<OperatingRoomsBundle | null> {
  const now = new Date();
  const os = await loadChapterOperatingSystem(chapterId);
  if (!os) return null;

  const thisWeekStart = weekStartFor(now);

  const [
    chapter,
    partnerActivityRows,
    instructorActivityRows,
    curriculumActivityRows,
    classActivityRows,
    enrollmentRows,
    sessionRows,
    feedbackRows,
    attendanceRows,
    goalRows,
    kpiRows,
    impactSubmittedCount,
    meetingRows,
    signalsMap,
  ] = await Promise.all([
    prisma.chapter.findUnique({
      where: { id: chapterId },
      select: { id: true, name: true, lifecycleStatus: true, launchTargetDate: true, launchedAt: true },
    }),
    withPrismaFallback(
      "rooms:partner-activity",
      () =>
        prisma.partner.findMany({
          where: { chapterId, archivedAt: null },
          orderBy: { updatedAt: "desc" },
          take: ACTIVITY_CAP,
          select: { id: true, name: true, stage: true, updatedAt: true },
        }),
      []
    ),
    withPrismaFallback(
      "rooms:instructor-activity",
      () =>
        prisma.instructorApplication.findMany({
          where: { applicant: { chapterId } },
          orderBy: { updatedAt: "desc" },
          take: ACTIVITY_CAP,
          select: { id: true, status: true, updatedAt: true, applicant: { select: { name: true } } },
        }),
      []
    ),
    withPrismaFallback(
      "rooms:curriculum-activity",
      () =>
        prisma.classTemplate.findMany({
          where: { chapterId },
          orderBy: { updatedAt: "desc" },
          take: ACTIVITY_CAP,
          select: { id: true, title: true, submissionStatus: true, updatedAt: true },
        }),
      []
    ),
    withPrismaFallback(
      "rooms:class-activity",
      () =>
        prisma.classOffering.findMany({
          where: { chapterId, status: { not: "CANCELLED" } },
          orderBy: { updatedAt: "desc" },
          take: ACTIVITY_CAP,
          select: { id: true, title: true, status: true, updatedAt: true },
        }),
      []
    ),
    withPrismaFallback(
      "rooms:enrollments",
      () =>
        prisma.classEnrollment.findMany({
          where: { offering: { chapterId } },
          take: 600,
          select: {
            studentId: true,
            status: true,
            sessionsAttended: true,
            enrolledAt: true,
            student: { select: { id: true, name: true } },
            offering: { select: { id: true, title: true } },
          },
        }),
      []
    ),
    withPrismaFallback(
      "rooms:sessions-held",
      () =>
        prisma.classSession.findMany({
          where: { offering: { chapterId }, date: { lte: now }, isCancelled: false },
          select: { offeringId: true },
        }),
      []
    ),
    withPrismaFallback(
      "rooms:feedback",
      () =>
        prisma.classFeedback.findMany({
          where: { offering: { chapterId } },
          orderBy: { createdAt: "desc" },
          take: 400,
          select: {
            studentId: true,
            rating: true,
            createdAt: true,
            offering: { select: { title: true } },
          },
        }),
      []
    ),
    withPrismaFallback(
      "rooms:attendance",
      () =>
        prisma.classAttendanceRecord.findMany({
          where: { session: { offering: { chapterId } } },
          orderBy: { checkedInAt: "desc" },
          take: 2000,
          select: { studentId: true, checkedInAt: true },
        }),
      []
    ),
    withPrismaFallback(
      "rooms:goals",
      () =>
        prisma.chapterGoal.findMany({
          where: { chapterId },
          take: 20,
          orderBy: { createdAt: "desc" },
          select: {
            id: true,
            title: true,
            currentValue: true,
            targetValue: true,
            unit: true,
            status: true,
            deadline: true,
          },
        }),
      []
    ),
    withPrismaFallback(
      "rooms:kpi",
      () =>
        prisma.chapterKpiSnapshot.findMany({
          where: { chapterId },
          orderBy: { snapshotDate: "desc" },
          take: 16,
          select: {
            snapshotDate: true,
            activeStudents: true,
            activeInstructors: true,
            enrollmentFillPercent: true,
            retentionRate: true,
          },
        }),
      []
    ),
    withPrismaFallback(
      "rooms:impact-submitted",
      () =>
        prisma.weeklyImpactEntry.count({
          where: { chapterId, weekStart: thisWeekStart, status: "SUBMITTED" },
        }),
      0
    ),
    withPrismaFallback(
      "rooms:meetings",
      () =>
        prisma.meeting.findMany({
          where: { chapterId },
          orderBy: { scheduledAt: "desc" },
          take: ACTIVITY_CAP,
          select: { id: true, title: true, status: true, scheduledAt: true },
        }),
      []
    ),
    withPrismaFallback("rooms:signals", () => gatherChapterSignals([chapterId], now), new Map()),
  ]);

  if (!chapter) return null;

  // --- Recent activity feeds ------------------------------------------------

  const partnerActivity: ActivityEvent[] = partnerActivityRows.map((p) => ({
    key: `partner:${p.id}`,
    label: PARTNER_PLAYBOOK_STATUS_LABELS[partnerPlaybookStatus(p.stage)],
    detail: p.name,
    when: relativeAgo(p.updatedAt, now),
    tone: "neutral",
  }));

  const instructorActivity: ActivityEvent[] = instructorActivityRows.map((a) => {
    const stage = instructorPlaybookStage(a.status);
    return {
      key: `instructor:${a.id}`,
      label: INSTRUCTOR_PLAYBOOK_STAGE_LABELS[stage],
      detail: a.applicant?.name ?? "Applicant",
      when: relativeAgo(a.updatedAt, now),
      tone: stage === "hired" ? "good" : stage === "rejected" ? "warn" : "neutral",
    };
  });

  const curriculumActivity: ActivityEvent[] = curriculumActivityRows.map((c) => {
    const status = curriculumPlaybookStatus(c.submissionStatus);
    return {
      key: `curriculum:${c.id}`,
      label: `Curriculum ${CURRICULUM_SHORT_STAGE[status]}`,
      detail: c.title,
      when: relativeAgo(c.updatedAt, now),
      tone: status === "approved" ? "good" : status === "needs_revision" ? "warn" : "neutral",
    };
  });

  const classActivity: ActivityEvent[] = classActivityRows.map((c) => {
    const map = CLASS_STATUS_ACTIVITY[c.status] ?? { label: "Class updated", tone: "neutral" as ActivityTone };
    return {
      key: `class:${c.id}`,
      label: map.label,
      detail: c.title,
      when: relativeAgo(c.updatedAt, now),
      tone: map.tone,
    };
  });

  const studentActivity: ActivityEvent[] = feedbackRows.slice(0, ACTIVITY_CAP).map((f, i) => ({
    key: `feedback:${i}`,
    label: `Feedback received · ${f.rating}★`,
    detail: f.offering?.title ?? "A class",
    when: relativeAgo(f.createdAt, now),
    tone: f.rating >= 4 ? "good" : f.rating <= 2 ? "warn" : "neutral",
  }));

  const growthActivity: ActivityEvent[] = meetingRows.map((m) => ({
    key: `meeting:${m.id}`,
    label: m.status === "COMPLETED" ? "Meeting held" : m.status === "CANCELLED" ? "Meeting cancelled" : "Meeting scheduled",
    detail: m.title,
    when: relativeAgo(m.scheduledAt, now),
    tone: m.status === "COMPLETED" ? "good" : m.status === "CANCELLED" ? "warn" : "neutral",
  }));

  // --- Student Community records --------------------------------------------

  const heldByOffering = new Map<string, number>();
  for (const s of sessionRows) {
    heldByOffering.set(s.offeringId, (heldByOffering.get(s.offeringId) ?? 0) + 1);
  }
  const feedbackByStudent = new Map<string, number[]>();
  for (const f of feedbackRows) {
    const arr = feedbackByStudent.get(f.studentId);
    if (arr) arr.push(f.rating);
    else feedbackByStudent.set(f.studentId, [f.rating]);
  }
  // Rows arrive newest-first, so the first record seen per student is their most
  // recent check-in.
  const lastAttendanceByStudent = new Map<string, Date>();
  for (const a of attendanceRows) {
    if (!lastAttendanceByStudent.has(a.studentId)) lastAttendanceByStudent.set(a.studentId, a.checkedInAt);
  }

  type StudentAgg = {
    id: string;
    name: string;
    classTitles: string[];
    attended: number;
    held: number;
    lastActivity: Date;
    statuses: string[];
  };
  const byStudent = new Map<string, StudentAgg>();
  for (const e of enrollmentRows) {
    const id = e.studentId;
    const agg =
      byStudent.get(id) ??
      ({ id, name: e.student?.name ?? "Student", classTitles: [], attended: 0, held: 0, lastActivity: e.enrolledAt, statuses: [] } as StudentAgg);
    if (e.offering?.title) agg.classTitles.push(e.offering.title);
    agg.attended += e.sessionsAttended;
    agg.held += heldByOffering.get(e.offering?.id ?? "") ?? 0;
    if (e.enrolledAt.getTime() > agg.lastActivity.getTime()) agg.lastActivity = e.enrolledAt;
    agg.statuses.push(e.status);
    byStudent.set(id, agg);
  }
  const students: StudentRecord[] = [...byStudent.values()].map((s) => {
    const lastAtt = lastAttendanceByStudent.get(s.id) ?? null;
    const lastActivity = lastAtt && lastAtt.getTime() > s.lastActivity.getTime() ? lastAtt : s.lastActivity;
    const ratings = feedbackByStudent.get(s.id) ?? [];
    const enrollmentStatus = s.statuses.includes("ENROLLED")
      ? "ENROLLED"
      : s.statuses.includes("COMPLETED")
        ? "COMPLETED"
        : s.statuses.includes("WAITLISTED")
          ? "WAITLISTED"
          : "DROPPED";
    return {
      id: s.id,
      name: s.name,
      className: s.classTitles[0] ?? null,
      classCount: s.classTitles.length,
      attendanceRate: s.held > 0 ? Math.min(1, s.attended / s.held) : null,
      feedbackRating: ratings.length > 0 ? ratings.reduce((a, b) => a + b, 0) / ratings.length : null,
      inactiveDays: Math.floor((now.getTime() - lastActivity.getTime()) / DAY_MS),
      enrollmentStatus,
      advisorOverdue: false,
    };
  });

  // --- Chapter Growth records -----------------------------------------------

  const goals: GoalRecord[] = goalRows.map((g) => ({
    id: g.id,
    title: g.title,
    currentValue: g.currentValue,
    targetValue: g.targetValue,
    unit: g.unit,
    status: g.status,
    deadline: g.deadline,
  }));

  const latestKpi = kpiRows[0] ?? null;
  const priorTarget = latestKpi ? latestKpi.snapshotDate.getTime() - 6 * DAY_MS : 0;
  const priorKpi = kpiRows.find((k) => k.snapshotDate.getTime() <= priorTarget) ?? null;
  const pct = (v: number | null | undefined): number | null =>
    v == null ? null : v <= 1 ? Math.round(v * 100) : Math.round(v);
  const trends: TrendRecord[] = latestKpi
    ? [
        { key: "students", label: "Active students", current: latestKpi.activeStudents, previous: priorKpi?.activeStudents ?? null, unit: "" },
        { key: "instructors", label: "Active instructors", current: latestKpi.activeInstructors, previous: priorKpi?.activeInstructors ?? null, unit: "" },
        ...(latestKpi.enrollmentFillPercent != null
          ? [{ key: "fill", label: "Enrollment fill", current: pct(latestKpi.enrollmentFillPercent)!, previous: pct(priorKpi?.enrollmentFillPercent), unit: "%" }]
          : []),
        ...(latestKpi.retentionRate != null
          ? [{ key: "retention", label: "Retention", current: pct(latestKpi.retentionRate)!, previous: pct(priorKpi?.retentionRate), unit: "%" }]
          : []),
      ]
    : [];

  const raw = signalsMap.get(chapterId) ?? null;
  const launched = chapter.launchedAt != null || chapter.lifecycleStatus === "ACTIVE";
  const growthSignals: GrowthSignals = {
    weekNumber: os.weekNumber,
    focus: os.impact.focus,
    impactSubmittedThisWeek: impactSubmittedCount > 0,
    hasUpcomingMeeting: raw?.nextMeetingAt != null,
    lastMeetingDaysAgo: raw?.lastMeetingAt ? Math.floor((now.getTime() - raw.lastMeetingAt.getTime()) / DAY_MS) : null,
    launchTargetPassed: chapter.launchTargetDate != null && chapter.launchTargetDate.getTime() < now.getTime() && !launched,
    launched,
  };
  const chapterHealth = raw ? healthFromSignals(raw, chapter.lifecycleStatus, chapter.launchTargetDate, now) : null;

  // --- Assemble the six rooms -----------------------------------------------

  const blockersByLane = (lane: string) => os.blockers.filter((b) => b.lane === lane).map(blockerToNeedsYou);

  const partnerRoom = buildPipelineRoom({
    slug: "partner-network",
    stats: os.deliberables.partner.stats,
    needsYou: blockersByLane("partners"),
    recentActivity: partnerActivity,
    nextAction: os.deliberables.partner.recommendation,
    evidence: { kind: "partner", rows: os.deliberables.partner.rows, totalRows: os.deliberables.partner.totalRows },
  });
  const teachingRoom = buildPipelineRoom({
    slug: "teaching",
    stats: os.deliberables.instructor.stats,
    needsYou: blockersByLane("instructors"),
    recentActivity: instructorActivity,
    nextAction: os.deliberables.instructor.recommendation,
    evidence: { kind: "instructor", rows: os.deliberables.instructor.rows, totalRows: os.deliberables.instructor.totalRows },
  });
  const learningRoom = buildPipelineRoom({
    slug: "learning",
    stats: os.deliberables.curriculum.stats,
    needsYou: blockersByLane("curriculum"),
    recentActivity: curriculumActivity,
    nextAction: os.deliberables.curriculum.recommendation,
    evidence: { kind: "curriculum", rows: os.deliberables.curriculum.rows, totalRows: os.deliberables.curriculum.totalRows },
  });
  const classesRoom = buildPipelineRoom({
    slug: "classes",
    stats: os.deliberables.class.stats,
    needsYou: blockersByLane("classes"),
    recentActivity: classActivity,
    nextAction: os.deliberables.class.recommendation,
    evidence: { kind: "class", rows: os.deliberables.class.rows, totalRows: os.deliberables.class.totalRows },
  });

  const studentSummary = summarizeStudentCommunity(students);
  const studentNeeds = rankNeedsYou(studentCommunityNeedsYou(students));
  const studentRows = studentEvidenceRows(students);
  const studentsRoom: OperatingRoom = {
    ...roomShell("students"),
    health: deriveRoomHealth(studentNeeds, STRONG_HEADLINE.students),
    metrics: studentCommunityMetrics(studentSummary),
    needsYou: studentNeeds,
    recentActivity: studentActivity,
    insights: studentCommunityInsights(studentSummary),
    nextAction: studentCommunityNextAction(studentSummary, studentNeeds),
    evidence: { kind: "student", rows: studentRows.slice(0, ROW_CAP), totalRows: studentRows.length },
  };

  const growthSummary = summarizeGrowth(goals, growthSignals, now);
  const growthNeeds = rankNeedsYou(growthNeedsYou(goals, growthSignals, now));
  const growthRows = growthEvidenceRows(goals, trends, now);
  const growthRoom: OperatingRoom = {
    ...roomShell("growth"),
    health: chapterHealth ? growthHealth(chapterHealth.label, chapterHealth.reasons) : deriveRoomHealth(growthNeeds, STRONG_HEADLINE.growth),
    metrics: growthMetrics(growthSummary, trends),
    needsYou: growthNeeds,
    recentActivity: growthActivity,
    insights: growthInsights(growthSummary, trends),
    nextAction: growthNextAction(growthSignals, growthSummary),
    evidence: { kind: "growth", rows: growthRows.slice(0, ROW_CAP), totalRows: growthRows.length },
  };

  const roomsBySlug: Record<OperatingDomainSlug, OperatingRoom> = {
    "partner-network": partnerRoom,
    teaching: teachingRoom,
    learning: learningRoom,
    classes: classesRoom,
    students: studentsRoom,
    growth: growthRoom,
  };

  return {
    chapter: {
      id: chapter.id,
      name: chapter.name,
      lifecycleStatus: chapter.lifecycleStatus,
      lifecycleLabel: chapterLifecycleLabel(chapter.lifecycleStatus),
    },
    rooms: OPERATING_DOMAINS.map((slug) => roomsBySlug[slug]),
  };
}

/** The static room scaffold (mission/question/icon) for a non-pipeline room. */
function roomShell(slug: OperatingDomainSlug): Pick<OperatingRoomCore, "slug" | "title" | "mission" | "question" | "icon"> {
  const meta = DOMAIN_META[slug];
  return { slug, title: meta.title, mission: meta.mission, question: meta.question, icon: meta.icon };
}

// ---------------------------------------------------------------------------
// Public surface loaders
// ---------------------------------------------------------------------------

export type OperatingHub = {
  chapter: OperatingRoomsBundle["chapter"];
  summaries: RoomSummary[];
  building: ReturnType<typeof summarizeBuildingHealth>;
};

export async function loadOperatingHub(chapterId: string): Promise<OperatingHub | null> {
  const bundle = await loadOperatingRooms(chapterId);
  if (!bundle) return null;
  const summaries = bundle.rooms.map(toRoomSummary);
  return { chapter: bundle.chapter, summaries, building: summarizeBuildingHealth(summaries) };
}

export type OperatingRoomView = {
  chapter: OperatingRoomsBundle["chapter"];
  room: OperatingRoom;
  nav: RoomSummary[];
};

export async function loadOperatingRoom(
  chapterId: string,
  slug: OperatingDomainSlug
): Promise<OperatingRoomView | null> {
  const bundle = await loadOperatingRooms(chapterId);
  if (!bundle) return null;
  const room = bundle.rooms.find((r) => r.slug === slug);
  if (!room) return null;
  return { chapter: bundle.chapter, room, nav: bundle.rooms.map(toRoomSummary) };
}

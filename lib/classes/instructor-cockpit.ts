import "server-only";

// Class Runtime OS (Phase 5) — the Instructor Cockpit loader. Gathers the
// classes a person teaches (lead instructor OR confirmed co-instructor), maps
// each onto the pure runtime + student-signal models, and produces the cockpit
// (Today / Needs You / per-class cards) and the per-class command surface.
// No invented data; absent data yields honest empty/null values.

import { prisma } from "@/lib/prisma";
import { withPrismaFallback } from "@/lib/prisma-guard";
import { curriculumSatisfiesLaunch } from "@/lib/chapters/curriculum-review";
import { computeClassRuntime, type ClassRuntimeInput, type ClassRuntimeSession } from "@/lib/classes/class-runtime";
import { tallyAttendance, type AttendanceStatusValue } from "@/lib/classes/attendance";
import {
  summarizeClassStudentSignals,
  deriveStudentSignals,
  type StudentSignalInput,
  type StudentAttendanceMark,
  type StudentSignalResult,
} from "@/lib/classes/student-signals";
import {
  buildInstructorCockpit,
  pickNextSession,
  pickLastUnrecordedSession,
  pickReflectionDueSession,
  type CockpitClass,
  type CockpitSession,
  type InstructorCockpit,
} from "@/lib/classes/cockpit";

const CONFIRMED_RIA = ["INSTRUCTOR_CONFIRMED", "CHAPTER_CONFIRMED", "FULLY_CONFIRMED"];
const NOT_READY_RIA = ["NEEDS_TRAINING", "NEEDS_CURRICULUM"];
const ACTIVE_ENROLLMENT = ["ENROLLED", "COMPLETED"];

// The shape we select for an offering. Hand-typed so the mappers stay
// prisma-generation-independent (the client isn't always generated locally).
export type OfferingRow = {
  id: string;
  title: string;
  status: string;
  startDate: Date | null;
  meetingDays: string[];
  meetingTime: string | null;
  deliveryMode: string;
  locationName: string | null;
  room: string | null;
  zoomLink: string | null;
  capacity: number;
  enrollmentOpen: boolean;
  instructorId: string | null;
  chapterId: string | null;
  partnerId: string | null;
  grandfatheredTrainingExemption: boolean;
  template: { submissionStatus: string | null; targetAgeGroup: string | null; curriculumApproval: { stage: string } | null } | null;
  approval: { status: string } | null;
  regularInstructorAssignments: { status: string }[];
  reminders: { status: string }[];
  partner: { agreements: { status: string }[] } | null;
  sessions: {
    id: string;
    sessionNumber: number;
    date: Date;
    topic: string;
    isCancelled: boolean;
    attendance: { status: string; studentId: string }[];
    reflection: { needsCpHelp: boolean } | null;
  }[];
  enrollments: { studentId: string; status: string; student: { name: string | null } | null }[];
  feedback: { studentId: string; rating: number }[];
};

export const OFFERING_SELECT = {
  id: true,
  title: true,
  status: true,
  startDate: true,
  meetingDays: true,
  meetingTime: true,
  deliveryMode: true,
  locationName: true,
  room: true,
  zoomLink: true,
  capacity: true,
  enrollmentOpen: true,
  instructorId: true,
  chapterId: true,
  partnerId: true,
  grandfatheredTrainingExemption: true,
  template: { select: { submissionStatus: true, targetAgeGroup: true, curriculumApproval: { select: { stage: true } } } },
  approval: { select: { status: true } },
  regularInstructorAssignments: { select: { status: true } },
  reminders: { select: { status: true } },
  partner: { select: { agreements: { select: { status: true } } } },
  sessions: {
    orderBy: { date: "asc" as const },
    select: {
      id: true,
      sessionNumber: true,
      date: true,
      topic: true,
      isCancelled: true,
      attendance: { select: { status: true, studentId: true } },
      reflection: { select: { needsCpHelp: true } },
    },
  },
  enrollments: { select: { studentId: true, status: true, student: { select: { name: true } } } },
  feedback: { select: { studentId: true, rating: true } },
};

function scheduleLabel(o: OfferingRow): string {
  if (o.meetingDays.length === 0 || !o.meetingTime) return "Schedule TBD";
  return `${o.meetingDays.join(", ")} · ${o.meetingTime}`;
}

function locationLabel(o: OfferingRow): string {
  if (o.deliveryMode === "VIRTUAL") return o.zoomLink ? "Virtual" : "Virtual (link pending)";
  return o.room || o.locationName || "Location TBD";
}

function toRuntimeSession(s: OfferingRow["sessions"][number]): ClassRuntimeSession {
  return {
    id: s.id,
    date: s.date,
    isCancelled: s.isCancelled,
    attendanceRecorded: s.attendance.length > 0,
    reflectionDone: s.reflection != null,
  };
}

/** Map one offering row onto the pure runtime input. */
export function toRuntimeInput(o: OfferingRow): ClassRuntimeInput {
  const riaStatuses = o.regularInstructorAssignments.map((r) => r.status);
  const isVirtual = o.deliveryMode === "VIRTUAL";
  const activeEnrollments = o.enrollments.filter((e) => ACTIVE_ENROLLMENT.includes(e.status));
  const allStatuses: AttendanceStatusValue[] = o.sessions
    .filter((s) => !s.isCancelled)
    .flatMap((s) => s.attendance.map((a) => a.status as AttendanceStatusValue));
  const tally = tallyAttendance(allStatuses);
  const ratings = o.feedback.map((f) => f.rating);

  return {
    id: o.id,
    title: o.title,
    ageRange: o.template?.targetAgeGroup ?? null,
    startDate: o.startDate,
    status: o.status,
    partnerConfirmed: o.partnerId != null,
    hasRoom: isVirtual ? !!o.zoomLink : !!(o.room || o.locationName),
    hasTimes: o.meetingDays.length > 0 && !!o.meetingTime,
    hasInstructor: o.instructorId != null,
    instructorConfirmed: o.instructorId != null || riaStatuses.some((s) => CONFIRMED_RIA.includes(s)),
    curriculumApproved: curriculumSatisfiesLaunch({
      approvalStage: o.template?.curriculumApproval?.stage ?? null,
      status: o.template?.submissionStatus ?? null,
    }),
    publiclyVisible:
      (o.status === "PUBLISHED" || o.status === "IN_PROGRESS") &&
      (o.approval?.status === "APPROVED" || o.grandfatheredTrainingExemption === true),
    enrolledCount: activeEnrollments.length,
    capacity: o.capacity,
    instructorReady: riaStatuses.length > 0 ? !riaStatuses.some((s) => NOT_READY_RIA.includes(s)) : o.instructorId != null,
    preLaunchReminderSent: o.reminders.some((r) => r.status === "SENT"),
    logisticsInWriting: (o.partner?.agreements ?? []).some((a) => a.status === "SIGNED"),
    enrollmentOpen: o.enrollmentOpen,
    droppedCount: o.enrollments.filter((e) => e.status === "DROPPED").length,
    sessions: o.sessions.map(toRuntimeSession),
    attendancePercent: tally.percent,
    feedbackCount: ratings.length,
    averageRating: ratings.length ? ratings.reduce((a, b) => a + b, 0) / ratings.length : null,
    negativeFeedbackCount: ratings.filter((r) => r <= 2).length,
    openIssueCount: 0, // filled in by the caller from ActionItem counts
    needsHelp: o.sessions.some((s) => s.reflection?.needsCpHelp === true),
    curriculumSubmitted: o.template?.submissionStatus != null && o.template.submissionStatus !== "DRAFT",
  };
}

/** Build per-student signal inputs from an offering's enrollments + attendance. */
export function toStudentSignalInputs(o: OfferingRow): StudentSignalInput[] {
  const sessionsHeldDates = o.sessions
    .filter((s) => !s.isCancelled && s.attendance.length > 0)
    .sort((a, b) => a.date.getTime() - b.date.getTime());
  const sessionsHeld = sessionsHeldDates.length;
  const ratingByStudent = new Map(o.feedback.map((f) => [f.studentId, f.rating]));

  return o.enrollments.map((e) => {
    const marks: StudentAttendanceMark[] = sessionsHeldDates
      .map((s) => {
        const rec = s.attendance.find((a) => a.studentId === e.studentId);
        return rec ? { sessionDate: s.date, status: rec.status as StudentAttendanceMark["status"] } : null;
      })
      .filter((m): m is StudentAttendanceMark => m != null);
    return {
      studentId: e.studentId,
      studentName: e.student?.name ?? "Student",
      enrollmentStatus: e.status,
      marks,
      sessionsHeld,
      feedbackRating: ratingByStudent.get(e.studentId) ?? null,
      flaggedByInstructor: false,
      parentConcern: false,
    };
  });
}

function toCockpitClass(o: OfferingRow, openIssueCount: number, now: Date): CockpitClass {
  const input = { ...toRuntimeInput(o), openIssueCount };
  const runtime = computeClassRuntime(input, now);
  const signals = summarizeClassStudentSignals(toStudentSignalInputs(o));

  const liteSessions = o.sessions.map((s) => ({
    id: s.id,
    sessionNumber: s.sessionNumber,
    topic: s.topic,
    date: s.date,
    isCancelled: s.isCancelled,
    attendanceRecorded: s.attendance.length > 0,
    reflectionDone: s.reflection != null,
  }));
  const asCockpitSession = (s: (typeof liteSessions)[number] | null): CockpitSession | null => s;

  return {
    id: o.id,
    title: o.title,
    stage: runtime.stage,
    stageLabel: runtime.stageLabel,
    health: runtime.health,
    isLive: runtime.isLive,
    scheduleLabel: scheduleLabel(o),
    locationLabel: locationLabel(o),
    rosterCount: input.enrolledCount,
    nextSession: asCockpitSession(pickNextSession(liteSessions, now)),
    attendanceDueSession: runtime.isLive ? asCockpitSession(pickLastUnrecordedSession(liteSessions, now)) : null,
    reflectionDueSession: runtime.isLive ? asCockpitSession(pickReflectionDueSession(liteSessions, now)) : null,
    atRiskCount: signals.atRiskCount,
    feedbackCount: input.feedbackCount,
    interventionCount: runtime.blockers.filter((b) => b.severity !== "info").length,
    nextStep: runtime.nextStep,
  };
}

/** Count open ActionItems linked to each offering (issues). */
export async function openIssueCounts(offeringIds: string[]): Promise<Map<string, number>> {
  if (offeringIds.length === 0) return new Map();
  const rows = await withPrismaFallback(
    "cockpit:open-issues",
    () =>
      prisma.actionItem.findMany({
        where: { relatedEntityType: "CLASS_OFFERING", relatedEntityId: { in: offeringIds }, status: { not: "COMPLETE" } },
        select: { relatedEntityId: true },
      }),
    [] as { relatedEntityId: string | null }[]
  );
  const map = new Map<string, number>();
  for (const r of rows) {
    if (r.relatedEntityId) map.set(r.relatedEntityId, (map.get(r.relatedEntityId) ?? 0) + 1);
  }
  return map;
}

async function loadOfferingsForInstructor(viewerId: string): Promise<OfferingRow[]> {
  return withPrismaFallback(
    "cockpit:offerings",
    () =>
      prisma.classOffering.findMany({
        where: {
          status: { not: "CANCELLED" },
          OR: [
            { instructorId: viewerId },
            { regularInstructorAssignments: { some: { instructorId: viewerId, status: { in: CONFIRMED_RIA } } } },
          ],
        },
        take: 100,
        select: OFFERING_SELECT,
      }) as unknown as Promise<OfferingRow[]>,
    []
  );
}

/** The Instructor Cockpit read model for `viewerId`. */
export async function loadInstructorCockpit(viewerId: string): Promise<InstructorCockpit> {
  const now = new Date();
  const offerings = await loadOfferingsForInstructor(viewerId);
  const issueCounts = await openIssueCounts(offerings.map((o) => o.id));
  const classes = offerings.map((o) => toCockpitClass(o, issueCounts.get(o.id) ?? 0, now));
  // Most-urgent classes first in the master list.
  const ranked = [...classes].sort((a, b) => {
    const rank = { critical: 0, at_risk: 1, watch: 2, healthy: 3, unknown: 4 } as const;
    return rank[a.health] - rank[b.health];
  });
  return buildInstructorCockpit(ranked, now);
}

// --- Per-class command surface ---------------------------------------------

export type CockpitRosterStudent = {
  studentId: string;
  name: string;
  status: string;
  signals: StudentSignalResult["signals"];
  atRisk: boolean;
};

export type CockpitClassDetail = {
  id: string;
  title: string;
  scheduleLabel: string;
  locationLabel: string;
  ageRange: string | null;
  runtime: ReturnType<typeof computeClassRuntime>;
  nextSession: CockpitSession | null;
  attendanceDueSession: CockpitSession | null;
  reflectionDueSession: CockpitSession | null;
  sessions: {
    id: string;
    sessionNumber: number;
    topic: string;
    date: Date;
    isCancelled: boolean;
    attendanceRecorded: boolean;
    reflectionDone: boolean;
    /** Existing marks so the roll-call pre-fills (no data loss on re-submit). */
    marks: { studentId: string; status: string }[];
  }[];
  roster: CockpitRosterStudent[];
  signalSummary: ReturnType<typeof summarizeClassStudentSignals>;
  feedback: { studentName: string | null; rating: number }[];
};

/**
 * Load one class's command surface for an instructor, or null if not found /
 * not theirs. Returns the runtime, roster (with per-student signals), sessions,
 * and feedback so the detail page can drive attendance + reflection.
 */
export async function loadInstructorClassDetail(
  viewerId: string,
  offeringId: string
): Promise<CockpitClassDetail | null> {
  const now = new Date();
  const offering = (await withPrismaFallback(
    "cockpit:offering-detail",
    () =>
      prisma.classOffering.findFirst({
        where: {
          id: offeringId,
          OR: [
            { instructorId: viewerId },
            { regularInstructorAssignments: { some: { instructorId: viewerId, status: { in: CONFIRMED_RIA } } } },
          ],
        },
        select: { ...OFFERING_SELECT, feedback: { select: { studentId: true, rating: true } } },
      }) as unknown as Promise<OfferingRow | null>,
    null
  )) as OfferingRow | null;
  if (!offering) return null;

  const issues = await openIssueCounts([offeringId]);
  const input = { ...toRuntimeInput(offering), openIssueCount: issues.get(offeringId) ?? 0 };
  const runtime = computeClassRuntime(input, now);
  const signalInputs = toStudentSignalInputs(offering);
  const signalSummary = summarizeClassStudentSignals(signalInputs);
  const signalById = new Map(signalInputs.map((s) => [s.studentId, deriveStudentSignals(s)]));
  const nameById = new Map(offering.enrollments.map((e) => [e.studentId, e.student?.name ?? null]));

  const liteSessions = offering.sessions.map((s) => ({
    id: s.id,
    sessionNumber: s.sessionNumber,
    topic: s.topic,
    date: s.date,
    isCancelled: s.isCancelled,
    attendanceRecorded: s.attendance.length > 0,
    reflectionDone: s.reflection != null,
  }));

  const roster: CockpitRosterStudent[] = offering.enrollments.map((e) => {
    const sig = signalById.get(e.studentId);
    return {
      studentId: e.studentId,
      name: e.student?.name ?? "Student",
      status: e.status,
      signals: sig?.signals ?? [],
      atRisk: sig?.atRisk ?? false,
    };
  });

  return {
    id: offering.id,
    title: offering.title,
    scheduleLabel: scheduleLabel(offering),
    locationLabel: locationLabel(offering),
    ageRange: offering.template?.targetAgeGroup ?? null,
    runtime,
    nextSession: pickNextSession(liteSessions, now),
    attendanceDueSession: runtime.isLive ? pickLastUnrecordedSession(liteSessions, now) : null,
    reflectionDueSession: runtime.isLive ? pickReflectionDueSession(liteSessions, now) : null,
    sessions: offering.sessions.map((s) => ({
      id: s.id,
      sessionNumber: s.sessionNumber,
      topic: s.topic,
      date: s.date,
      isCancelled: s.isCancelled,
      attendanceRecorded: s.attendance.length > 0,
      reflectionDone: s.reflection != null,
      marks: s.attendance.map((a) => ({ studentId: a.studentId, status: a.status })),
    })),
    roster,
    signalSummary,
    feedback: offering.feedback.map((f) => ({ studentName: nameById.get(f.studentId) ?? null, rating: f.rating })),
  };
}

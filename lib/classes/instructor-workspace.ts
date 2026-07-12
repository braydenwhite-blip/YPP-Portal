import "server-only";

import type { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { getInstructorReadiness } from "@/lib/instructor-readiness";
import {
  deriveSessionState,
  sessionDateTime,
  type DerivedSessionState,
  type InstructorSessionAction,
  type SessionStateInput,
} from "@/lib/classes/instructor-state";
import {
  deriveStudentSignals,
  type StudentAttendanceMark,
  type StudentSignal,
} from "@/lib/classes/student-signals";
import {
  INSTRUCTOR_REQUESTED_FOLLOW_UP_SOURCE_PREFIX,
  instructorFollowUpSourceId,
  parseInstructorRequestedFollowUpSourceId,
} from "@/lib/classes/student-follow-up";
import { preparationReviewFingerprint } from "@/lib/classes/preparation-fingerprint";

const CONFIRMED_CO_INSTRUCTOR = [
  "INSTRUCTOR_CONFIRMED",
  "FULLY_CONFIRMED",
] as const;

const TEACHING_ASSIGNMENT_ROLES = ["LEAD", "CO_INSTRUCTOR", "ASSISTANT"] as const;

const ACTIVE_ENROLLMENT = new Set(["ENROLLED", "COMPLETED"]);
const ACTIVE_CLASS_STATUS = new Set(["DRAFT", "PUBLISHED", "IN_PROGRESS"]);
const TEACHING_CLASS_STATUS = new Set(["PUBLISHED", "IN_PROGRESS"]);

const INSTRUCTOR_OFFERING_SELECT = {
  id: true,
  title: true,
  status: true,
  startDate: true,
  endDate: true,
  meetingDays: true,
  meetingTime: true,
  timezone: true,
  deliveryMode: true,
  locationName: true,
  locationAddress: true,
  room: true,
  arrivalInstructions: true,
  materialsList: true,
  zoomLink: true,
  chapterId: true,
  instructorId: true,
  template: {
    select: {
      id: true,
      title: true,
      targetAgeGroup: true,
      submissionStatus: true,
      reviewNotes: true,
      curriculumApproval: {
        select: {
          stage: true,
          cpReviewNotes: true,
          globalReviewNotes: true,
        },
      },
      lessonPlans: {
        orderBy: { updatedAt: "desc" as const },
        select: {
          id: true,
          title: true,
          description: true,
          totalMinutes: true,
          updatedAt: true,
          activities: {
            orderBy: { sortOrder: "asc" as const },
            select: {
              id: true,
              title: true,
              resources: true,
              notes: true,
              durationMin: true,
            },
          },
        },
      },
    },
  },
  approval: {
    select: {
      status: true,
      requestNotes: true,
      reviewNotes: true,
      requestedAt: true,
      reviewedAt: true,
    },
  },
  sessions: {
    orderBy: { date: "asc" as const },
    select: {
      id: true,
      sessionNumber: true,
      date: true,
      startTime: true,
      endTime: true,
      topic: true,
      description: true,
      learningOutcomes: true,
      milestone: true,
      materialsUrl: true,
      notesUrl: true,
      recordingUrl: true,
      lessonPlanId: true,
      lessonPlan: {
        select: {
          id: true,
          title: true,
          description: true,
          totalMinutes: true,
          activities: {
            orderBy: { sortOrder: "asc" as const },
            select: {
              id: true,
              title: true,
              description: true,
              resources: true,
              notes: true,
              durationMin: true,
            },
          },
        },
      },
      isCancelled: true,
      cancelReason: true,
      attendance: {
        select: {
          studentId: true,
          status: true,
          notes: true,
          checkedInAt: true,
        },
      },
      reflection: {
        select: {
          wentWell: true,
          struggled: true,
          studentToWatch: true,
          changeNextTime: true,
          logisticsIssue: true,
          needsCpHelp: true,
          confidence: true,
          updatedAt: true,
        },
      },
      preparations: {
        select: {
          instructorId: true,
          lessonReviewedAt: true,
          materialsReviewedAt: true,
          studentContextReviewedAt: true,
          completedAt: true,
          reviewFingerprint: true,
          note: true,
        },
      },
    },
  },
  enrollments: {
    select: {
      studentId: true,
      status: true,
      enrolledAt: true,
      droppedAt: true,
      instructorNotes: true,
      signupGoal: true,
      signupNote: true,
      student: {
        select: {
          name: true,
          email: true,
        },
      },
    },
  },
  assignments: {
    where: { isPublished: true },
    orderBy: [{ hardDeadline: "asc" as const }, { suggestedDueDate: "asc" as const }],
    select: {
      id: true,
      title: true,
      sessionId: true,
      suggestedDueDate: true,
      hardDeadline: true,
      submissions: {
        select: {
          id: true,
          studentId: true,
          status: true,
          submittedAt: true,
          feedbackGivenAt: true,
          workUrl: true,
          workText: true,
        },
      },
    },
  },
  feedback: {
    select: {
      studentId: true,
      rating: true,
      liked: true,
      improve: true,
      wouldRecommend: true,
      createdAt: true,
    },
  },
  outcome: {
    select: {
      instructorWentWell: true,
      instructorChallenges: true,
      instructorStudentImpact: true,
      instructorWouldTeachAgain: true,
      instructorReflectedAt: true,
    },
  },
} satisfies Prisma.ClassOfferingSelect;

type OfferingRow = Prisma.ClassOfferingGetPayload<{
  select: typeof INSTRUCTOR_OFFERING_SELECT;
}>;

export type TeachingMaterial = {
  key: string;
  label: string;
  kind: "lesson" | "slides_or_activity" | "class_material" | "recording";
  href: string | null;
  detail: string | null;
};

export type TeachingSession = {
  id: string;
  sessionNumber: number;
  topic: string;
  date: Date;
  startTime: string;
  endTime: string;
  description: string | null;
  learningOutcomes: string[];
  milestone: string | null;
  isCancelled: boolean;
  cancelReason: string | null;
  materialsUrl: string | null;
  notesUrl: string | null;
  recordingUrl: string | null;
  lessonPlan: OfferingRow["sessions"][number]["lessonPlan"];
  materials: TeachingMaterial[];
  state: DerivedSessionState;
  attendanceMarks: {
    studentId: string;
    status: string;
    note: string | null;
  }[];
  expectedStudentIds: string[];
  reflection: OfferingRow["sessions"][number]["reflection"];
  preparation: OfferingRow["sessions"][number]["preparations"][number] | null;
};

export type TeachingStudent = {
  studentId: string;
  name: string;
  email: string;
  status: string;
  instructorNotes: string | null;
  signupGoal: string | null;
  signupNote: string | null;
  signals: StudentSignal[];
};

export type StudentAttentionItem = {
  key: string;
  kind: "attendance" | "missing_work" | "feedback_waiting" | "requested_follow_up";
  studentId: string;
  studentName: string;
  classId: string;
  className: string;
  reason: string;
  expectedAction: string;
  href: string;
  evidenceAt: Date | null;
  actionId: string | null;
  assignmentId: string | null;
  submissionId: string | null;
  workUrl: string | null;
  workText: string | null;
};

export type LeadershipRequest = {
  id: string;
  classId: string | null;
  title: string;
  reason: string;
  dueAt: Date;
  status: string;
  href: string;
  requestedBy: string;
};

export type TeachingClass = {
  id: string;
  title: string;
  canManageSettings: boolean;
  status: string;
  startDate: Date;
  endDate: Date;
  timezone: string;
  deliveryMode: string;
  scheduleLabel: string;
  locationLabel: string;
  locationAddress: string | null;
  arrivalInstructions: string | null;
  zoomLink: string | null;
  materialsList: string[];
  ageRange: string | null;
  roster: TeachingStudent[];
  sessions: TeachingSession[];
  nextSession: TeachingSession | null;
  primaryAction: InstructorSessionAction | null;
  stateReason: string;
  leadershipRequests: LeadershipRequest[];
  studentAttention: StudentAttentionItem[];
  lessonPlans: OfferingRow["template"]["lessonPlans"];
  approval: OfferingRow["approval"];
  curriculumApproval: OfferingRow["template"]["curriculumApproval"];
  evidence: {
    sessionsHeld: number;
    attendanceComplete: number;
    recapsComplete: number;
    feedbackCount: number;
    recommendCount: number;
  };
};

export type WorkspacePriorityAction = InstructorSessionAction & {
  classId: string | null;
  className: string | null;
  source: "session" | "leadership" | "readiness" | "student";
};

export type InstructorTeachingWorkspace = {
  classes: TeachingClass[];
  activeClasses: TeachingClass[];
  completedClasses: TeachingClass[];
  nextClass: { teachingClass: TeachingClass; session: TeachingSession } | null;
  priorityAction: WorkspacePriorityAction | null;
  studentsNeedingAttention: StudentAttentionItem[];
  leadershipRequests: LeadershipRequest[];
  readiness: {
    available: boolean;
    complete: boolean;
    missingRequirements: { code: string; title: string; detail: string; href: string }[];
  };
  evidence: {
    sessionsHeld: number;
    attendanceComplete: number;
    recapsComplete: number;
    feedbackCount: number;
    recommendCount: number;
  };
};

function scheduleLabel(row: OfferingRow) {
  const days = row.meetingDays.length > 0 ? row.meetingDays.join(", ") : "Schedule not set";
  return row.meetingTime ? `${days} · ${row.meetingTime}` : days;
}

function locationLabel(row: OfferingRow) {
  if (row.deliveryMode === "VIRTUAL") return row.zoomLink ? "Online" : "Online · link missing";
  const physical = [row.locationName, row.room].filter(Boolean).join(" · ");
  if (row.deliveryMode === "HYBRID") {
    const inPerson = physical || row.locationAddress || "location missing";
    return `${inPerson} + online${row.zoomLink ? "" : " · link missing"}`;
  }
  return physical || row.locationAddress || "Location missing";
}

function sessionMaterials(row: OfferingRow, session: OfferingRow["sessions"][number]): TeachingMaterial[] {
  const materials: TeachingMaterial[] = [];
  if (session.lessonPlan) {
    materials.push({
      key: `${session.id}-linked-lesson`,
      label: session.lessonPlan.title,
      kind: "lesson",
      href: `/instructor/classes/${row.id}?session=${session.id}#before`,
      detail: session.lessonPlan.description,
    });
    for (const activity of session.lessonPlan.activities) {
      if (!activity.resources?.trim()) continue;
      materials.push({
        key: `${session.id}-activity-${activity.id}`,
        label: activity.title,
        kind: "slides_or_activity",
        href: /^https?:\/\/\S+$/i.test(activity.resources.trim())
          ? activity.resources.trim()
          : null,
        detail: activity.resources,
      });
    }
  }
  if (session.notesUrl) {
    materials.push({
      key: `${session.id}-lesson`,
      label: `Session ${session.sessionNumber} lesson notes`,
      kind: "lesson",
      href: session.notesUrl,
      detail: session.description,
    });
  }
  if (session.materialsUrl) {
    materials.push({
      key: `${session.id}-materials`,
      label: `Session ${session.sessionNumber} teaching materials`,
      kind: "slides_or_activity",
      href: session.materialsUrl,
      detail: session.topic,
    });
  }
  for (const [index, item] of row.materialsList.entries()) {
    materials.push({
      key: `${session.id}-class-material-${index}`,
      label: item,
      kind: "class_material",
      href: null,
      detail: `Required for ${row.title}`,
    });
  }
  if (session.recordingUrl) {
    materials.push({
      key: `${session.id}-recording`,
      label: `Session ${session.sessionNumber} recording`,
      kind: "recording",
      href: session.recordingUrl,
      detail: null,
    });
  }
  return materials;
}

function expectedRoster(row: OfferingRow, session: OfferingRow["sessions"][number]) {
  const startsAt = sessionDateTime(session.date, session.startTime, row.timezone);
  const rawEnd = sessionDateTime(session.date, session.endTime, row.timezone);
  const endsAt = rawEnd.getTime() > startsAt.getTime()
    ? rawEnd
    : new Date(rawEnd.getTime() + 24 * 60 * 60 * 1000);
  return row.enrollments.filter((enrollment) => {
    if (enrollment.status === "WAITLISTED") return false;
    if (enrollment.enrolledAt.getTime() > endsAt.getTime()) return false;
    return enrollment.droppedAt == null || enrollment.droppedAt.getTime() > startsAt.getTime();
  });
}

function expectedRosterCount(row: OfferingRow, session: OfferingRow["sessions"][number]) {
  return expectedRoster(row, session).length;
}

function toStateInput(
  row: OfferingRow,
  session: OfferingRow["sessions"][number],
  instructorId: string
): SessionStateInput {
  const preparation = session.preparations.find((item) => item.instructorId === instructorId) ?? null;
  const roster = expectedRoster(row, session);
  const expectedStudentIds = new Set(roster.map((enrollment) => enrollment.studentId));
  const reviewFingerprint = preparationReviewFingerprint({
    lessonPlanId: session.lessonPlanId,
    notesUrl: session.notesUrl,
    description: session.description,
    learningOutcomes: session.learningOutcomes,
    materialsUrl: session.materialsUrl,
    classMaterials: row.materialsList,
    deliveryMode: row.deliveryMode,
    zoomLink: row.zoomLink,
    locationName: row.locationName,
    locationAddress: row.locationAddress,
    room: row.room,
    students: roster.map((enrollment) => ({
      studentId: enrollment.studentId,
      signupGoal: enrollment.signupGoal,
      signupNote: enrollment.signupNote,
      instructorNotes: enrollment.instructorNotes,
    })),
  });
  return {
    id: session.id,
    classId: row.id,
    sessionNumber: session.sessionNumber,
    topic: session.topic,
    date: session.date,
    startTime: session.startTime,
    endTime: session.endTime,
    timezone: row.timezone,
    isCancelled: session.isCancelled,
    notesUrl: session.notesUrl,
    lessonPlanId: session.lessonPlanId,
    description: session.description,
    learningOutcomes: session.learningOutcomes,
    materialsUrl: session.materialsUrl,
    classMaterials: row.materialsList,
    deliveryMode: row.deliveryMode,
    zoomLink: row.zoomLink,
    locationName: row.locationName,
    locationAddress: row.locationAddress,
    room: row.room,
    activeStudentCount: roster.length,
    attendanceRecordCount: session.attendance.filter((mark) => expectedStudentIds.has(mark.studentId)).length,
    reflectionDone: session.reflection != null,
    preparationCompletedAt:
      preparation?.reviewFingerprint === reviewFingerprint
        ? preparation.completedAt
        : null,
  };
}

function attentionReason(signal: StudentSignal, markCount: number): string {
  switch (signal.key) {
    case "never_attended":
      return `No present or late attendance mark has been recorded across ${markCount} session${markCount === 1 ? "" : "s"}.`;
    case "missed_two_in_a_row":
      return "The student was absent from the two most recent recorded sessions.";
    case "attendance_dropping":
      return "The student's recent attendance is lower than their earlier attendance in this class.";
    case "negative_feedback":
      return "The student shared negative class feedback that needs an instructor response.";
    case "parent_concern":
      return "A parent or guardian concern is still open.";
    case "needs_encouragement":
      return "The student's most recent attendance mark was absent.";
    case "highly_engaged":
    case "strong_retention":
      return "Consistent attendance is a concrete opportunity for positive recognition.";
  }
}

function teachingSessions(row: OfferingRow, now: Date, instructorId: string): TeachingSession[] {
  return row.sessions.map((session) => ({
    id: session.id,
    sessionNumber: session.sessionNumber,
    topic: session.topic,
    date: session.date,
    startTime: session.startTime,
    endTime: session.endTime,
    description: session.description,
    learningOutcomes: session.learningOutcomes,
    milestone: session.milestone,
    isCancelled: session.isCancelled,
    cancelReason: session.cancelReason,
    materialsUrl: session.materialsUrl,
    notesUrl: session.notesUrl,
    recordingUrl: session.recordingUrl,
    lessonPlan: session.lessonPlan,
    materials: sessionMaterials(row, session),
    state: deriveSessionState(toStateInput(row, session, instructorId), now),
    attendanceMarks: session.attendance.map((mark) => ({
      studentId: mark.studentId,
      status: mark.status,
      note: mark.notes,
    })),
    expectedStudentIds: expectedRoster(row, session).map((enrollment) => enrollment.studentId),
    reflection: session.reflection,
    preparation: session.preparations.find((item) => item.instructorId === instructorId) ?? null,
  }));
}

function studentRows(row: OfferingRow): TeachingStudent[] {
  const recordedSessions = row.sessions
    .filter((session) => {
      const expected = expectedRosterCount(row, session);
      return !session.isCancelled && expected > 0 && session.attendance.length >= expected;
    })
    .sort((a, b) => a.date.getTime() - b.date.getTime());
  const feedbackByStudent = new Map(row.feedback.map((feedback) => [feedback.studentId, feedback.rating]));

  return row.enrollments.map((enrollment) => {
    const marks: StudentAttendanceMark[] = recordedSessions.flatMap((session) => {
      const mark = session.attendance.find((attendance) => attendance.studentId === enrollment.studentId);
      return mark ? [{ sessionDate: session.date, status: mark.status }] : [];
    });
    const signal = deriveStudentSignals({
      studentId: enrollment.studentId,
      studentName: enrollment.student.name ?? "Student",
      enrollmentStatus: enrollment.status,
      marks,
      sessionsHeld: recordedSessions.length,
      feedbackRating: feedbackByStudent.get(enrollment.studentId) ?? null,
      flaggedByInstructor: false,
      parentConcern: false,
    });
    return {
      studentId: enrollment.studentId,
      name: enrollment.student.name ?? "Student",
      email: enrollment.student.email,
      status: enrollment.status,
      instructorNotes: enrollment.instructorNotes,
      signupGoal: enrollment.signupGoal,
      signupNote: enrollment.signupNote,
      signals: signal.signals,
    };
  });
}

function studentAttention(row: OfferingRow, roster: TeachingStudent[], now: Date): StudentAttentionItem[] {
  const attention: StudentAttentionItem[] = [];
  const recordedSessions = row.sessions
    .filter((session) => {
      const expected = expectedRosterCount(row, session);
      return !session.isCancelled && expected > 0 && session.attendance.length >= expected;
    })
    .sort((a, b) => a.date.getTime() - b.date.getTime());

  for (const student of roster) {
    if (!ACTIVE_ENROLLMENT.has(student.status)) continue;
    const primary = student.signals.find((signal) => signal.category !== "positive");
    if (primary) {
      const marks = recordedSessions.flatMap((session) =>
        session.attendance.some((mark) => mark.studentId === student.studentId) ? [session] : []
      );
      const latestEvidence = marks.at(-1) ?? null;
      attention.push({
        key: `${row.id}:${student.studentId}:attendance:${primary.key}:${latestEvidence?.id ?? "none"}`,
        kind: "attendance",
        studentId: student.studentId,
        studentName: student.name,
        classId: row.id,
        className: row.title,
        reason: attentionReason(primary, marks.length),
        expectedAction: "Contact the student or family, then record the follow-up.",
        href: `/instructor/students?class=${row.id}#student-${student.studentId}`,
        evidenceAt: latestEvidence?.date ?? null,
        actionId: null,
        assignmentId: null,
        submissionId: null,
        workUrl: null,
        workText: null,
      });
    }

    for (const assignment of row.assignments) {
      const submission = assignment.submissions.find((item) => item.studentId === student.studentId);
      if (submission?.submittedAt || submission?.status === "SUBMITTED" || submission?.status === "FEEDBACK_GIVEN") {
        if (submission.submittedAt && !submission.feedbackGivenAt) {
          attention.push({
            key: `${row.id}:${student.studentId}:feedback:${submission.id}`,
            kind: "feedback_waiting",
            studentId: student.studentId,
            studentName: student.name,
            classId: row.id,
            className: row.title,
            reason: `“${assignment.title}” was submitted ${submission.submittedAt.toLocaleDateString("en-US", { month: "short", day: "numeric" })} and has not received instructor feedback.`,
            expectedAction: "Review the work and give the student concise, useful feedback.",
            href: `/instructor/students?class=${row.id}#student-${student.studentId}`,
            evidenceAt: submission.submittedAt,
            actionId: null,
            assignmentId: assignment.id,
            submissionId: submission.id,
            workUrl: submission.workUrl,
            workText: submission.workText,
          });
        }
        continue;
      }
      const dueAt = assignment.hardDeadline;
      if (!dueAt || dueAt.getTime() >= now.getTime()) continue;
      attention.push({
        key: `${row.id}:${student.studentId}:assignment:${assignment.id}`,
        kind: "missing_work",
        studentId: student.studentId,
        studentName: student.name,
        classId: row.id,
        className: row.title,
        reason: `“${assignment.title}” was due ${dueAt.toLocaleDateString("en-US", { month: "short", day: "numeric" })} and has no submission.`,
        expectedAction: "Check in about the missing work and record the agreed next step.",
        href: `/instructor/students?class=${row.id}#student-${student.studentId}`,
        evidenceAt: dueAt,
        actionId: null,
        assignmentId: assignment.id,
        submissionId: null,
        workUrl: null,
        workText: null,
      });
    }
  }
  return attention;
}

function unresolvedSessionAction(sessions: TeachingSession[]) {
  const actionable = sessions.filter(
    (session) => !session.isCancelled && session.state.action.kind !== "view_recap"
  );
  return actionable.sort((a, b) => {
    const rank = a.state.action.rank - b.state.action.rank;
    if (rank !== 0) return rank;
    return a.state.startsAt.getTime() - b.state.startsAt.getTime();
  })[0] ?? null;
}

function nextTeachingSession(sessions: TeachingSession[], now: Date) {
  return sessions
    .filter(
      (session) =>
        !session.isCancelled &&
        (session.state.lifecycle === "before" || session.state.lifecycle === "during") &&
        session.state.endsAt.getTime() >= now.getTime()
    )
    .sort((a, b) => a.state.startsAt.getTime() - b.state.startsAt.getTime())[0] ?? null;
}

async function loadLeadershipRequests(userId: string, offeringIds: string[]): Promise<LeadershipRequest[]> {
  const rows = await prisma.actionItem.findMany({
    where: {
      status: { in: ["NOT_STARTED", "IN_PROGRESS", "OVERDUE", "BLOCKED"] },
      visibility: "ALL_LEADERSHIP",
      NOT: { sourceId: { startsWith: INSTRUCTOR_REQUESTED_FOLLOW_UP_SOURCE_PREFIX } },
      AND: [
        { OR: [{ leadId: userId }, { assignments: { some: { userId } } }] },
        {
          OR: [
            { relatedEntityType: { not: "CLASS_OFFERING" } },
            { relatedEntityType: null },
            { relatedEntityId: { in: offeringIds } },
          ],
        },
      ],
    },
    orderBy: [{ deadlineStart: "asc" }, { createdAt: "asc" }],
    select: {
      id: true,
      title: true,
      description: true,
      deadlineStart: true,
      status: true,
      relatedEntityType: true,
      relatedEntityId: true,
      createdBy: { select: { name: true } },
    },
  });
  return rows.map((row) => ({
    id: row.id,
    classId:
      row.relatedEntityType === "CLASS_OFFERING" ? row.relatedEntityId : null,
    title: row.title,
    reason: row.description?.trim() || "YPP assigned this request directly to you.",
    dueAt: row.deadlineStart,
    status: row.status,
    href: `/#ypp-request-${row.id}`,
    requestedBy: row.createdBy.name ?? "YPP leadership",
  }));
}

type RequestedStudentFollowUp = {
  id: string;
  offeringId: string;
  sessionId: string;
  studentId: string;
  reason: string;
  createdAt: Date;
};

async function loadRequestedStudentFollowUps(
  userId: string,
  offeringIds: string[]
): Promise<RequestedStudentFollowUp[]> {
  if (offeringIds.length === 0) return [];
  const allowedOfferings = new Set(offeringIds);
  const rows = await prisma.actionItem.findMany({
    where: {
      leadId: userId,
      status: { in: ["NOT_STARTED", "IN_PROGRESS", "OVERDUE", "BLOCKED"] },
      sourceId: { startsWith: INSTRUCTOR_REQUESTED_FOLLOW_UP_SOURCE_PREFIX },
      relatedEntityType: "USER",
    },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      description: true,
      sourceId: true,
      relatedEntityId: true,
      createdAt: true,
    },
  });
  return rows.flatMap((row) => {
    const source = parseInstructorRequestedFollowUpSourceId(row.sourceId);
    if (
      !source ||
      !allowedOfferings.has(source.offeringId) ||
      row.relatedEntityId !== source.studentId
    ) {
      return [];
    }
    return [{
      id: row.id,
      offeringId: source.offeringId,
      sessionId: source.sessionId,
      studentId: source.studentId,
      reason: row.description?.trim() || "The instructor flagged this student for a class follow-up.",
      createdAt: row.createdAt,
    }];
  });
}

/**
 * Authoritative instructor workspace read model. It reads the newer
 * ClassOffering/ClassSession system only; legacy Course/AttendanceSession rows
 * are intentionally not mixed into teaching completion state.
 */
export async function loadInstructorTeachingWorkspace(
  instructorId: string,
  now = new Date()
): Promise<InstructorTeachingWorkspace> {
  const [rows, readiness] = await Promise.all([
    prisma.classOffering.findMany({
      where: {
        status: { not: "CANCELLED" },
        OR: [
          { instructorId },
          {
            regularInstructorAssignments: {
              some: {
                instructorId,
                status: { in: [...CONFIRMED_CO_INSTRUCTOR] },
                role: { in: [...TEACHING_ASSIGNMENT_ROLES] },
              },
            },
          },
        ],
      },
      orderBy: [{ startDate: "asc" }, { title: "asc" }],
      take: 100,
      select: INSTRUCTOR_OFFERING_SELECT,
    }),
    getInstructorReadiness(instructorId),
  ]);

  const offeringIds = rows.map((row) => row.id);
  const [leadershipRequests, requestedStudentFollowUps] = await Promise.all([
    loadLeadershipRequests(instructorId, offeringIds),
    loadRequestedStudentFollowUps(instructorId, offeringIds),
  ]);
  const requestsByClass = new Map<string, LeadershipRequest[]>();
  for (const request of leadershipRequests) {
    if (!request.classId) continue;
    requestsByClass.set(request.classId, [
      ...(requestsByClass.get(request.classId) ?? []),
      request,
    ]);
  }

  let classes: TeachingClass[] = rows.map((row) => {
    const sessions = teachingSessions(row, now, instructorId);
    const roster = studentRows(row);
    const requestedAttention: StudentAttentionItem[] = requestedStudentFollowUps
      .filter((item) => item.offeringId === row.id && row.sessions.some((session) => session.id === item.sessionId))
      .flatMap((item) => {
        const student = roster.find((candidate) => candidate.studentId === item.studentId);
        if (!student) return [];
        return [{
          key: `${row.id}:${item.studentId}:requested:${item.id}`,
          kind: "requested_follow_up" as const,
          studentId: item.studentId,
          studentName: student.name,
          classId: row.id,
          className: row.title,
          reason: item.reason,
          expectedAction: "Complete the check-in, then record what happened.",
          href: `/instructor/students?class=${row.id}#student-${item.studentId}`,
          evidenceAt: item.createdAt,
          actionId: item.id,
          assignmentId: null,
          submissionId: null,
          workUrl: null,
          workText: null,
        }];
      });
    const attention = [...requestedAttention, ...studentAttention(row, roster, now)];
    const unresolved = unresolvedSessionAction(sessions);
    const nextSession = nextTeachingSession(sessions, now);
    const classRequests = requestsByClass.get(row.id) ?? [];
    const held = sessions.filter((session) => session.state.lifecycle === "after" && !session.isCancelled);
    const primaryAction = unresolved?.state.action ?? null;
    const stateReason = primaryAction
      ? primaryAction.reason
      : classRequests[0]
        ? `${classRequests[0].requestedBy} is waiting on “${classRequests[0].title}.”`
        : attention[0]
          ? `${attention[0].studentName} needs follow-up: ${attention[0].reason}`
          : nextSession
            ? `The next session is ${nextSession.topic}; no earlier teaching task is incomplete.`
            : row.status === "COMPLETED"
              ? "This teaching responsibility is complete."
              : "No upcoming session is scheduled.";

    return {
      id: row.id,
      title: row.title,
      canManageSettings: row.instructorId === instructorId,
      status: row.status,
      startDate: row.startDate,
      endDate: row.endDate,
      timezone: row.timezone,
      deliveryMode: row.deliveryMode,
      scheduleLabel: scheduleLabel(row),
      locationLabel: locationLabel(row),
      locationAddress: row.locationAddress,
      arrivalInstructions: row.arrivalInstructions,
      zoomLink: row.zoomLink,
      materialsList: row.materialsList,
      ageRange: row.template.targetAgeGroup,
      roster,
      sessions,
      nextSession,
      primaryAction,
      stateReason,
      leadershipRequests: classRequests,
      studentAttention: attention,
      lessonPlans: row.template.lessonPlans,
      approval: row.approval,
      curriculumApproval: row.template.curriculumApproval,
      evidence: {
        sessionsHeld: held.length,
        attendanceComplete: held.filter(
          (session) => session.state.attendance === "complete" || session.state.attendance === "not_required"
        ).length,
        recapsComplete: held.filter((session) => session.reflection != null).length,
        feedbackCount: row.feedback.length,
        recommendCount: row.feedback.filter((feedback) => feedback.wouldRecommend === true).length,
      },
    };
  });

  const followUpSources = classes.flatMap((teachingClass) =>
    teachingClass.studentAttention.map((item) => instructorFollowUpSourceId(item.key))
  );
  if (followUpSources.length > 0) {
    const completedFollowUps = await prisma.actionItem.findMany({
      where: {
        leadId: instructorId,
        status: "COMPLETE",
        sourceId: { in: followUpSources },
      },
      select: { sourceId: true, nextFollowUpAt: true },
    });
    const completed = new Set(
      completedFollowUps.flatMap((item) =>
        item.sourceId && (!item.nextFollowUpAt || item.nextFollowUpAt.getTime() > now.getTime())
          ? [item.sourceId]
          : []
      )
    );
    classes = classes.map((teachingClass) => {
      const attention = teachingClass.studentAttention.filter(
        (item) => !completed.has(instructorFollowUpSourceId(item.key))
      );
      const stateReason = teachingClass.primaryAction
        ? teachingClass.primaryAction.reason
        : teachingClass.leadershipRequests[0]
          ? `${teachingClass.leadershipRequests[0].requestedBy} is waiting on “${teachingClass.leadershipRequests[0].title}.”`
          : attention[0]
            ? `${attention[0].studentName} needs follow-up: ${attention[0].reason}`
            : teachingClass.nextSession
              ? `The next session is ${teachingClass.nextSession.topic}; no earlier teaching task is incomplete.`
              : teachingClass.status === "COMPLETED"
                ? "This teaching responsibility is complete."
                : "No upcoming session is scheduled.";
      return { ...teachingClass, studentAttention: attention, stateReason };
    });
  }

  const hasOpenResponsibility = (teachingClass: TeachingClass) =>
    teachingClass.primaryAction != null ||
    teachingClass.leadershipRequests.length > 0 ||
    teachingClass.studentAttention.length > 0;
  const activeClasses = classes.filter(
    (teachingClass) =>
      ACTIVE_CLASS_STATUS.has(teachingClass.status) ||
      (teachingClass.status === "COMPLETED" && hasOpenResponsibility(teachingClass))
  );
  const completedClasses = classes.filter(
    (teachingClass) =>
      teachingClass.status === "COMPLETED" && !hasOpenResponsibility(teachingClass)
  );
  const nextCandidates = activeClasses
    .filter((teachingClass) => TEACHING_CLASS_STATUS.has(teachingClass.status) && teachingClass.nextSession)
    .map((teachingClass) => ({ teachingClass, session: teachingClass.nextSession! }))
    .sort((a, b) => a.session.state.startsAt.getTime() - b.session.state.startsAt.getTime());

  const studentsNeedingAttention = activeClasses
    .flatMap((teachingClass) => teachingClass.studentAttention)
    .sort((a, b) => (b.evidenceAt?.getTime() ?? 0) - (a.evidenceAt?.getTime() ?? 0));

  const sessionActions: WorkspacePriorityAction[] = activeClasses.flatMap((teachingClass) =>
    teachingClass.primaryAction
      ? [
          {
            ...teachingClass.primaryAction,
            classId: teachingClass.id,
            className: teachingClass.title,
            source: "session" as const,
          },
        ]
      : []
  );
  const leadershipActions: WorkspacePriorityAction[] = leadershipRequests.map((request) => ({
    kind: "view_recap",
    label: "Complete YPP request",
    title: request.title,
    reason: `${request.requestedBy} is waiting on this class-related request. ${request.reason}`,
    href: request.href,
    rank: 2,
    classId: request.classId,
    className: request.classId
      ? classes.find((teachingClass) => teachingClass.id === request.classId)?.title ?? null
      : null,
    source: "leadership",
  }));
  const studentActions: WorkspacePriorityAction[] = studentsNeedingAttention.slice(0, 1).map((item) => ({
    kind: "view_recap",
    label: "Follow up with student",
    title: `${item.studentName} needs your attention`,
    reason: item.reason,
    href: item.href,
    rank: 2.5,
    classId: item.classId,
    className: item.className,
    source: "student",
  }));
  const readinessActions: WorkspacePriorityAction[] = readiness.missingRequirements.slice(0, 1).map((item) => ({
    kind: "finish_preparation",
    label: "Complete YPP requirement",
    title: item.title,
    reason: item.detail,
    href: item.href,
    rank: 2,
    classId: null,
    className: null,
    source: "readiness",
  }));

  const priorityAction = [...sessionActions, ...leadershipActions, ...studentActions, ...readinessActions]
    .sort((a, b) => a.rank - b.rank)[0] ?? null;

  const evidence = classes.reduce(
    (total, teachingClass) => ({
      sessionsHeld: total.sessionsHeld + teachingClass.evidence.sessionsHeld,
      attendanceComplete: total.attendanceComplete + teachingClass.evidence.attendanceComplete,
      recapsComplete: total.recapsComplete + teachingClass.evidence.recapsComplete,
      feedbackCount: total.feedbackCount + teachingClass.evidence.feedbackCount,
      recommendCount: total.recommendCount + teachingClass.evidence.recommendCount,
    }),
    { sessionsHeld: 0, attendanceComplete: 0, recapsComplete: 0, feedbackCount: 0, recommendCount: 0 }
  );

  return {
    classes,
    activeClasses,
    completedClasses,
    nextClass: nextCandidates[0] ?? null,
    priorityAction,
    studentsNeedingAttention,
    leadershipRequests,
    readiness: {
      available: readiness.featureEnabled,
      complete: readiness.baseReadinessComplete,
      missingRequirements: readiness.missingRequirements,
    },
    evidence,
  };
}

export async function loadInstructorTeachingClass(
  instructorId: string,
  classId: string,
  now = new Date()
): Promise<TeachingClass | null> {
  const workspace = await loadInstructorTeachingWorkspace(instructorId, now);
  return workspace.classes.find((teachingClass) => teachingClass.id === classId) ?? null;
}

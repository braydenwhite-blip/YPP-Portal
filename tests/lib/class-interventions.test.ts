import { describe, it, expect } from "vitest";
import { deriveClassInterventions, summarizeInterventions } from "@/lib/classes/interventions";
import type { ClassRuntimeInput, ClassRuntimeSession } from "@/lib/classes/class-runtime";
import type { StudentSignalInput, AttendanceMarkStatus } from "@/lib/classes/student-signals";

const NOW = new Date("2026-06-24T12:00:00.000Z");
const PAST = new Date("2026-06-01T00:00:00.000Z");
const FUTURE = new Date("2026-07-30T00:00:00.000Z");
const SOON = new Date("2026-06-30T00:00:00.000Z");

function session(date: Date, o: Partial<ClassRuntimeSession> = {}): ClassRuntimeSession {
  return { id: `s-${date.getTime()}`, date, isCancelled: false, attendanceRecorded: true, reflectionDone: true, ...o };
}

function liveKlass(overrides: Partial<ClassRuntimeInput> = {}): ClassRuntimeInput {
  return {
    id: "c1",
    title: "Robotics",
    ageRange: "12-14",
    startDate: PAST,
    status: "IN_PROGRESS",
    partnerConfirmed: true,
    hasRoom: true,
    hasTimes: true,
    hasInstructor: true,
    instructorConfirmed: true,
    curriculumApproved: true,
    publiclyVisible: true,
    enrolledCount: 12,
    capacity: 25,
    instructorReady: true,
    preLaunchReminderSent: true,
    logisticsInWriting: true,
    enrollmentOpen: true,
    droppedCount: 0,
    sessions: [session(PAST)],
    attendancePercent: 90,
    feedbackCount: 3,
    averageRating: 4.5,
    negativeFeedbackCount: 0,
    openIssueCount: 0,
    needsHelp: false,
    curriculumSubmitted: true,
    ...overrides,
  };
}

const NO_STUDENTS: StudentSignalInput[] = [];
function marks(...statuses: AttendanceMarkStatus[]): StudentSignalInput["marks"] {
  return statuses.map((status, i) => ({ sessionDate: new Date(`2026-06-0${i + 1}T00:00:00Z`), status }));
}

describe("deriveClassInterventions", () => {
  it("a healthy live class needs no intervention", () => {
    expect(deriveClassInterventions(liveKlass(), NO_STUDENTS, NOW)).toHaveLength(0);
  });

  it("flags attendance missing as critical (instructor)", () => {
    const out = deriveClassInterventions(liveKlass({ sessions: [session(PAST, { attendanceRecorded: false })] }), NO_STUDENTS, NOW);
    const m = out.find((i) => i.trigger === "ATTENDANCE_MISSING");
    expect(m?.severity).toBe("critical");
    expect(m?.owner).toBe("instructor");
    expect(m?.key).toBe("class-attendance-missing:c1");
  });

  it("flags low attendance, negative feedback, help, issues, retention", () => {
    const out = deriveClassInterventions(
      liveKlass({ attendancePercent: 40, negativeFeedbackCount: 1, averageRating: 2, needsHelp: true, openIssueCount: 2, enrolledCount: 5, droppedCount: 3 }),
      NO_STUDENTS,
      NOW
    );
    const triggers = out.map((i) => i.trigger);
    expect(triggers).toContain("ATTENDANCE_BELOW_THRESHOLD");
    expect(triggers).toContain("NEGATIVE_FEEDBACK");
    expect(triggers).toContain("INSTRUCTOR_NEEDS_HELP");
    expect(triggers).toContain("UNRESOLVED_ISSUE");
    expect(triggers).toContain("RETENTION_RISK");
    // critical sorts first
    expect(out[0].severity).toBe("critical");
  });

  it("flags no-feedback and reflection-due as info", () => {
    const out = deriveClassInterventions(
      liveKlass({ feedbackCount: 0, averageRating: null, sessions: [session(PAST, { reflectionDone: false })] }),
      NO_STUDENTS,
      NOW
    );
    expect(out.find((i) => i.trigger === "NO_FEEDBACK_AFTER_FIRST_SESSION")?.severity).toBe("info");
    expect(out.find((i) => i.trigger === "REFLECTION_NOT_SUBMITTED")?.severity).toBe("info");
  });

  it("flags under-enrollment pre-live (no live triggers)", () => {
    const out = deriveClassInterventions(
      liveKlass({ status: "PUBLISHED", startDate: SOON, enrolledCount: 2, sessions: [] }),
      NO_STUDENTS,
      NOW
    );
    expect(out.find((i) => i.trigger === "ENROLLMENT_BELOW_TARGET")).toBeTruthy();
    expect(out.every((i) => i.trigger !== "ATTENDANCE_MISSING")).toBe(true);
  });

  it("surfaces per-student interventions from signals with stable keys", () => {
    const students: StudentSignalInput[] = [
      { studentId: "u9", studentName: "Ben", enrollmentStatus: "ENROLLED", sessionsHeld: 2, marks: marks("ABSENT", "ABSENT"), feedbackRating: null, flaggedByInstructor: false, parentConcern: false },
    ];
    const out = deriveClassInterventions(liveKlass(), students, NOW);
    const s = out.find((i) => i.trigger === "STUDENT_NEVER_ATTENDED");
    expect(s?.studentId).toBe("u9");
    expect(s?.key).toBe("student-never_attended:c1:u9");
  });

  it("returns nothing for a cancelled class", () => {
    expect(deriveClassInterventions(liveKlass({ status: "CANCELLED" }), NO_STUDENTS, NOW)).toHaveLength(0);
  });
});

describe("summarizeInterventions", () => {
  it("counts by severity and trigger", () => {
    const out = deriveClassInterventions(
      liveKlass({ sessions: [session(PAST, { attendanceRecorded: false })], openIssueCount: 1 }),
      NO_STUDENTS,
      NOW
    );
    const s = summarizeInterventions(out);
    expect(s.total).toBe(out.length);
    expect(s.critical).toBeGreaterThanOrEqual(1);
    expect(s.byTrigger.ATTENDANCE_MISSING).toBe(1);
  });
});

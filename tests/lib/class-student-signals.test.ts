import { describe, it, expect } from "vitest";
import {
  deriveStudentSignals,
  summarizeClassStudentSignals,
  studentAttendanceRate,
  missedTwoInARow,
  attendanceDropping,
  type StudentSignalInput,
  type StudentAttendanceMark,
  type AttendanceMarkStatus,
} from "@/lib/classes/student-signals";

const D = (n: number) => new Date(`2026-06-${String(n).padStart(2, "0")}T00:00:00.000Z`);
function marks(...statuses: AttendanceMarkStatus[]): StudentAttendanceMark[] {
  return statuses.map((status, i) => ({ sessionDate: D(i + 1), status }));
}

function student(o: Partial<StudentSignalInput> = {}): StudentSignalInput {
  return {
    studentId: "u1",
    studentName: "Ada",
    enrollmentStatus: "ENROLLED",
    marks: [],
    sessionsHeld: 0,
    feedbackRating: null,
    flaggedByInstructor: false,
    parentConcern: false,
    ...o,
  };
}

describe("attendance helpers", () => {
  it("studentAttendanceRate counts present + late", () => {
    expect(studentAttendanceRate(marks("PRESENT", "LATE", "ABSENT", "ABSENT"))).toBeCloseTo(0.5);
    expect(studentAttendanceRate([])).toBeNull();
  });
  it("missedTwoInARow detects two trailing absences", () => {
    expect(missedTwoInARow(marks("PRESENT", "ABSENT", "ABSENT"))).toBe(true);
    expect(missedTwoInARow(marks("ABSENT", "PRESENT"))).toBe(false);
  });
  it("attendanceDropping detects a real decline", () => {
    expect(attendanceDropping(marks("PRESENT", "PRESENT", "ABSENT", "ABSENT"))).toBe(true);
    expect(attendanceDropping(marks("PRESENT", "PRESENT", "PRESENT"))).toBe(false);
  });
});

describe("deriveStudentSignals — risk", () => {
  it("never_attended when enrolled, sessions held, zero present", () => {
    const r = deriveStudentSignals(student({ sessionsHeld: 2, marks: marks("ABSENT", "ABSENT") }));
    expect(r.signals.map((s) => s.key)).toContain("never_attended");
    expect(r.atRisk).toBe(true);
    expect(r.primary?.key).toBe("never_attended");
  });
  it("missed_two_in_a_row flags a slipping attender", () => {
    const r = deriveStudentSignals(student({ sessionsHeld: 3, marks: marks("PRESENT", "ABSENT", "ABSENT") }));
    expect(r.signals.map((s) => s.key)).toContain("missed_two_in_a_row");
    expect(r.atRisk).toBe(true);
  });
  it("negative_feedback flags a low rating", () => {
    const r = deriveStudentSignals(student({ sessionsHeld: 2, marks: marks("PRESENT", "PRESENT"), feedbackRating: 2 }));
    expect(r.signals.map((s) => s.key)).toContain("negative_feedback");
    expect(r.atRisk).toBe(true);
  });
  it("parent_concern is a risk signal", () => {
    const r = deriveStudentSignals(student({ parentConcern: true, sessionsHeld: 1, marks: marks("PRESENT") }));
    expect(r.signals.map((s) => s.key)).toContain("parent_concern");
    expect(r.atRisk).toBe(true);
  });
  it("a dropped student is at risk", () => {
    expect(deriveStudentSignals(student({ enrollmentStatus: "DROPPED" })).atRisk).toBe(true);
  });
});

describe("deriveStudentSignals — positive + watch", () => {
  it("highly_engaged + strong_retention for a consistent attender", () => {
    const r = deriveStudentSignals(student({ sessionsHeld: 4, marks: marks("PRESENT", "PRESENT", "PRESENT", "PRESENT") }));
    const keys = r.signals.map((s) => s.key);
    expect(keys).toContain("highly_engaged");
    expect(keys).toContain("strong_retention");
    expect(r.atRisk).toBe(false);
  });
  it("does not award positive signals when a risk is present", () => {
    const r = deriveStudentSignals(student({ sessionsHeld: 4, marks: marks("PRESENT", "PRESENT", "ABSENT", "ABSENT") }));
    expect(r.signals.some((s) => s.category === "positive")).toBe(false);
  });
  it("needs_encouragement for a recent single absence (no hard risk)", () => {
    const r = deriveStudentSignals(student({ sessionsHeld: 2, marks: marks("PRESENT", "ABSENT") }));
    expect(r.signals.map((s) => s.key)).toContain("needs_encouragement");
  });
});

describe("summarizeClassStudentSignals", () => {
  it("aggregates counts and surfaces at-risk students most-urgent-first", () => {
    const summary = summarizeClassStudentSignals([
      student({ studentId: "a", studentName: "Ada", sessionsHeld: 4, marks: marks("PRESENT", "PRESENT", "PRESENT", "PRESENT") }), // engaged
      student({ studentId: "b", studentName: "Ben", sessionsHeld: 2, marks: marks("ABSENT", "ABSENT") }), // never attended
      student({ studentId: "c", studentName: "Cy", sessionsHeld: 3, marks: marks("PRESENT", "ABSENT", "ABSENT") }), // missed two
    ]);
    expect(summary.total).toBe(3);
    expect(summary.atRiskCount).toBe(2);
    expect(summary.engagedCount).toBe(1);
    expect(summary.byKey.never_attended).toBe(1);
    // never_attended (rank 0) sorts before missed_two_in_a_row (rank 1)
    expect(summary.atRiskStudents[0].studentName).toBe("Ben");
  });
});

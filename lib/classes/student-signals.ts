// Class Runtime OS (Phase 5) — per-student signals. Turns a student's real
// enrollment + attendance + feedback (+ instructor/parent flags) into the
// concrete signals a Chapter President and instructor act on: never attended,
// missed two in a row, attendance dropping, highly engaged, needs
// encouragement, parent concern, negative feedback, at risk, strong retention.
//
// Pure + deterministic (pass `now` where time matters) so it is fully
// unit-testable; the loaders map DB rows onto `StudentSignalInput`.

import { NEGATIVE_RATING } from "@/lib/classes/class-runtime";

export type AttendanceMarkStatus = "PRESENT" | "ABSENT" | "LATE" | "EXCUSED";

/** One attendance mark for a student, for a session that actually occurred. */
export type StudentAttendanceMark = { sessionDate: Date; status: AttendanceMarkStatus };

export type StudentSignalInput = {
  studentId: string;
  studentName: string;
  /** ClassEnrollmentStatus — ENROLLED | WAITLISTED | DROPPED | COMPLETED. */
  enrollmentStatus: string;
  /** Chronological marks (oldest → newest) for sessions that were held. */
  marks: StudentAttendanceMark[];
  /** Total sessions held so far in the class (for never-attended detection). */
  sessionsHeld: number;
  /** The student's own feedback rating (1–5), if they gave one. */
  feedbackRating: number | null;
  /** An instructor reflection flagged this student to watch. */
  flaggedByInstructor: boolean;
  /** A parent/guardian concern was raised about this student. */
  parentConcern: boolean;
};

export const STUDENT_SIGNAL_KEYS = [
  "never_attended",
  "missed_two_in_a_row",
  "attendance_dropping",
  "parent_concern",
  "negative_feedback",
  "needs_encouragement",
  "highly_engaged",
  "strong_retention",
] as const;
export type StudentSignalKey = (typeof STUDENT_SIGNAL_KEYS)[number];

export type StudentSignalCategory = "risk" | "watch" | "positive";

export type StudentSignal = {
  key: StudentSignalKey;
  label: string;
  category: StudentSignalCategory;
  /** 0 = most urgent. */
  rank: number;
};

const SIGNAL: Record<StudentSignalKey, Omit<StudentSignal, "key">> = {
  never_attended: { label: "Never attended", category: "risk", rank: 0 },
  missed_two_in_a_row: { label: "Missed 2 in a row", category: "risk", rank: 1 },
  attendance_dropping: { label: "Attendance dropping", category: "risk", rank: 2 },
  parent_concern: { label: "Parent concern", category: "risk", rank: 3 },
  negative_feedback: { label: "Negative feedback", category: "risk", rank: 4 },
  needs_encouragement: { label: "Needs encouragement", category: "watch", rank: 5 },
  highly_engaged: { label: "Highly engaged", category: "positive", rank: 6 },
  strong_retention: { label: "Strong retention", category: "positive", rank: 7 },
};

function makeSignal(key: StudentSignalKey): StudentSignal {
  return { key, ...SIGNAL[key] };
}

function presentCount(marks: StudentAttendanceMark[]): number {
  return marks.filter((m) => m.status === "PRESENT" || m.status === "LATE").length;
}

function isPresent(m: StudentAttendanceMark): boolean {
  return m.status === "PRESENT" || m.status === "LATE";
}

/** Attendance rate over recorded marks (0–1), or null when no marks. */
export function studentAttendanceRate(marks: StudentAttendanceMark[]): number | null {
  if (marks.length === 0) return null;
  return presentCount(marks) / marks.length;
}

/** The two most recent marks are both absences (not excused). */
export function missedTwoInARow(marks: StudentAttendanceMark[]): boolean {
  if (marks.length < 2) return false;
  const last2 = marks.slice(-2);
  return last2.every((m) => m.status === "ABSENT");
}

/**
 * Attendance is declining: the student attended earlier sessions but their
 * recent attendance rate has fallen well below their earlier rate. Needs ≥3
 * marks so a single miss isn't over-read.
 */
export function attendanceDropping(marks: StudentAttendanceMark[]): boolean {
  if (marks.length < 3) return false;
  const split = Math.floor(marks.length / 2);
  const earlier = marks.slice(0, split);
  const recent = marks.slice(split);
  const earlierRate = presentCount(earlier) / earlier.length;
  const recentRate = presentCount(recent) / recent.length;
  return earlierRate >= 0.6 && recentRate < earlierRate - 0.25;
}

export type StudentSignalResult = {
  studentId: string;
  studentName: string;
  signals: StudentSignal[];
  /** The headline signal (most urgent), or null when nothing notable. */
  primary: StudentSignal | null;
  atRisk: boolean;
};

/** Derive every applicable signal for one student. */
export function deriveStudentSignals(input: StudentSignalInput): StudentSignalResult {
  const keys = new Set<StudentSignalKey>();
  const dropped = input.enrollmentStatus === "DROPPED";

  // Risk signals.
  if (!dropped && input.sessionsHeld >= 1 && input.marks.length > 0 && presentCount(input.marks) === 0) {
    keys.add("never_attended");
  }
  if (missedTwoInARow(input.marks)) keys.add("missed_two_in_a_row");
  if (attendanceDropping(input.marks)) keys.add("attendance_dropping");
  if (input.parentConcern) keys.add("parent_concern");
  if (input.feedbackRating != null && input.feedbackRating <= NEGATIVE_RATING) keys.add("negative_feedback");

  // Watch.
  if (
    !keys.has("never_attended") &&
    !keys.has("missed_two_in_a_row") &&
    (input.flaggedByInstructor || input.marks.slice(-1).some((m) => m.status === "ABSENT"))
  ) {
    keys.add("needs_encouragement");
  }

  // Positive — only when there is enough history and no active risk.
  const rate = studentAttendanceRate(input.marks);
  const hasRisk = [...keys].some((k) => SIGNAL[k].category === "risk");
  if (!hasRisk && rate != null && input.marks.length >= 3) {
    if (rate >= 0.9) keys.add("highly_engaged");
    if ((input.enrollmentStatus === "ENROLLED" || input.enrollmentStatus === "COMPLETED") && rate >= 0.8) {
      keys.add("strong_retention");
    }
  }

  const signals = [...keys].map(makeSignal).sort((a, b) => a.rank - b.rank);
  const atRisk = dropped || signals.some((s) => s.category === "risk");
  return {
    studentId: input.studentId,
    studentName: input.studentName,
    signals,
    primary: signals[0] ?? null,
    atRisk,
  };
}

// --- Class-level aggregation -----------------------------------------------

export type ClassSignalSummary = {
  total: number;
  atRiskCount: number;
  engagedCount: number;
  byKey: Record<StudentSignalKey, number>;
  /** At-risk students, most urgent first — what surfaces in the cockpit / Needs You. */
  atRiskStudents: StudentSignalResult[];
};

/** Roll per-student signals into a class headline. */
export function summarizeClassStudentSignals(students: StudentSignalInput[]): ClassSignalSummary {
  const byKey = Object.fromEntries(STUDENT_SIGNAL_KEYS.map((k) => [k, 0])) as Record<StudentSignalKey, number>;
  const results = students.map(deriveStudentSignals);

  let atRiskCount = 0;
  let engagedCount = 0;
  for (const r of results) {
    if (r.atRisk) atRiskCount += 1;
    if (r.signals.some((s) => s.key === "highly_engaged" || s.key === "strong_retention")) engagedCount += 1;
    for (const s of r.signals) byKey[s.key] += 1;
  }

  const atRiskStudents = results
    .filter((r) => r.atRisk && r.primary)
    .sort((a, b) => (a.primary!.rank - b.primary!.rank));

  return { total: results.length, atRiskCount, engagedCount, byKey, atRiskStudents };
}

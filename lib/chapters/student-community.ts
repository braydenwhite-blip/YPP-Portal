// Student Community read model — the post-enrollment student experience.
//
// Pure + deterministic (pass `now`) so it is fully unit-testable. The DB loader
// gathers enrollment + attendance + feedback rows and hands plain records here;
// this module classifies each student, rolls up the community, and derives the
// room's needs-you / insights / next action. Every signal is concrete
// (inactive N days, attendance below bar, advisor overdue, low feedback) — never
// an opaque score, and nothing is invented: a null means "no data yet".

import type {
  NeedsYouItem,
  RoomInsight,
  RoomMetric,
  RoomNextAction,
} from "@/lib/chapters/operating-rooms";

/** A student is "inactive" after this many days with no logged activity. */
export const STUDENT_INACTIVE_DAYS = 14;
/** Attendance below this fraction flags the student at risk. */
export const ATTENDANCE_AT_RISK = 0.6;
/** Average feedback (1–5) below this flags a poor experience. */
export const FEEDBACK_LOW = 3;

/** The minimal student shape the community read model needs. */
export type StudentRecord = {
  /** The student's user id (opens Person 360). */
  id: string;
  name: string;
  /** A representative class title for the table. */
  className: string | null;
  classCount: number;
  /** Attendance fraction 0–1 across sessions held so far; null if none yet. */
  attendanceRate: number | null;
  /** Average feedback rating 1–5 the student has given; null if none. */
  feedbackRating: number | null;
  /** Days since the student's last logged activity; null if unknown. */
  inactiveDays: number | null;
  /** Enrollment status: ENROLLED | WAITLISTED | DROPPED | COMPLETED. */
  enrollmentStatus: string;
  /** Their advisor check-in is overdue. */
  advisorOverdue: boolean;
};

export type StudentEvidenceStatus = "thriving" | "at_risk" | "inactive";

export type StudentEvidenceRow = {
  id: string;
  name: string;
  className: string;
  /** "85%" or "—". */
  attendance: string;
  /** "4.5 ★" or "—". */
  feedback: string;
  status: StudentEvidenceStatus;
};

/** Has this student gone quiet (or dropped)? */
export function studentIsInactive(s: StudentRecord): boolean {
  if (s.enrollmentStatus === "DROPPED") return true;
  return s.inactiveDays != null && s.inactiveDays >= STUDENT_INACTIVE_DAYS;
}

/** Classify a single student's experience. */
export function studentEvidenceStatus(s: StudentRecord): StudentEvidenceStatus {
  if (studentIsInactive(s)) return "inactive";
  if (
    (s.attendanceRate != null && s.attendanceRate < ATTENDANCE_AT_RISK) ||
    (s.feedbackRating != null && s.feedbackRating < FEEDBACK_LOW) ||
    s.advisorOverdue
  ) {
    return "at_risk";
  }
  return "thriving";
}

function fmtAttendance(rate: number | null): string {
  if (rate == null) return "—";
  return `${Math.round(rate * 100)}%`;
}
function fmtFeedback(rating: number | null): string {
  if (rating == null) return "—";
  return `${rating.toFixed(1)} ★`;
}

export function studentEvidenceRow(s: StudentRecord): StudentEvidenceRow {
  const extra = s.classCount > 1 ? ` +${s.classCount - 1}` : "";
  return {
    id: s.id,
    name: s.name,
    className: (s.className ? s.className : "—") + extra,
    attendance: fmtAttendance(s.attendanceRate),
    feedback: fmtFeedback(s.feedbackRating),
    status: studentEvidenceStatus(s),
  };
}

export type StudentCommunitySummary = {
  total: number;
  thriving: number;
  atRisk: number;
  inactive: number;
  /** Average attendance across students that have any sessions; null if none. */
  avgAttendance: number | null;
  /** Average of students' feedback ratings; null if none. */
  avgFeedback: number | null;
  /** Retention = active (not dropped/inactive) / total; null if no students. */
  retention: number | null;
  advisorOverdue: number;
};

function average(values: number[]): number | null {
  if (values.length === 0) return null;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

export function summarizeStudentCommunity(students: StudentRecord[]): StudentCommunitySummary {
  const statuses = students.map(studentEvidenceStatus);
  const attendanceVals = students.map((s) => s.attendanceRate).filter((r): r is number => r != null);
  const feedbackVals = students.map((s) => s.feedbackRating).filter((r): r is number => r != null);
  const active = statuses.filter((s) => s !== "inactive").length;
  return {
    total: students.length,
    thriving: statuses.filter((s) => s === "thriving").length,
    atRisk: statuses.filter((s) => s === "at_risk").length,
    inactive: statuses.filter((s) => s === "inactive").length,
    avgAttendance: average(attendanceVals),
    avgFeedback: average(feedbackVals),
    retention: students.length === 0 ? null : active / students.length,
    advisorOverdue: students.filter((s) => s.advisorOverdue).length,
  };
}

const STUDENT_STATUS_ORDER: Record<StudentEvidenceStatus, number> = {
  inactive: 0,
  at_risk: 1,
  thriving: 2,
};
/** Build evidence rows, most-in-need first. */
export function studentEvidenceRows(students: StudentRecord[]): StudentEvidenceRow[] {
  return students
    .map(studentEvidenceRow)
    .sort((a, b) => STUDENT_STATUS_ORDER[a.status] - STUDENT_STATUS_ORDER[b.status]);
}

/** The room's "Needs You" — concrete student-experience problems. */
export function studentCommunityNeedsYou(students: StudentRecord[]): NeedsYouItem[] {
  const out: NeedsYouItem[] = [];
  for (const s of students) {
    if (studentIsInactive(s)) {
      const dropped = s.enrollmentStatus === "DROPPED";
      out.push({
        key: `student-inactive:${s.id}`,
        severity: dropped ? "warning" : "info",
        title: dropped ? `${s.name} dropped a class` : `${s.name} has gone quiet`,
        detail: dropped
          ? "Reach out to understand why and offer a path back."
          : `No activity in ${s.inactiveDays} days — check in before they disengage.`,
        href: "/chapter/students",
        entityType: "STUDENT",
        entityId: s.id,
        suggestedAction: `Re-engage ${s.name}`,
      });
      continue;
    }
    if (s.attendanceRate != null && s.attendanceRate < ATTENDANCE_AT_RISK) {
      out.push({
        key: `student-attendance:${s.id}`,
        severity: "warning",
        title: `${s.name}'s attendance is low (${Math.round(s.attendanceRate * 100)}%)`,
        detail: "Talk with the family and the instructor to remove barriers.",
        href: "/chapter/students",
        entityType: "STUDENT",
        entityId: s.id,
        suggestedAction: `Support ${s.name}'s attendance`,
      });
    }
    if (s.feedbackRating != null && s.feedbackRating < FEEDBACK_LOW) {
      out.push({
        key: `student-feedback:${s.id}`,
        severity: "warning",
        title: `${s.name} rated their experience ${s.feedbackRating.toFixed(1)}/5`,
        detail: "Follow up on what would make the class better.",
        href: "/chapter/students",
        entityType: "STUDENT",
        entityId: s.id,
        suggestedAction: `Follow up on ${s.name}'s feedback`,
      });
    }
    if (s.advisorOverdue) {
      out.push({
        key: `student-advisor:${s.id}`,
        severity: "info",
        title: `${s.name}'s advisor check-in is overdue`,
        detail: "Log a check-in to keep the student supported.",
        href: "/chapter/students",
        entityType: "STUDENT",
        entityId: s.id,
        suggestedAction: `Check in with ${s.name}`,
      });
    }
  }
  return out;
}

export function studentCommunityMetrics(summary: StudentCommunitySummary): RoomMetric[] {
  return [
    { label: "Students", value: String(summary.total), hint: "Enrolled" },
    {
      label: "Retention",
      value: summary.retention == null ? "—" : `${Math.round(summary.retention * 100)}%`,
      hint: "Still active",
    },
    {
      label: "Attendance",
      value: summary.avgAttendance == null ? "—" : `${Math.round(summary.avgAttendance * 100)}%`,
      hint: "Average",
    },
    {
      label: "Feedback",
      value: summary.avgFeedback == null ? "—" : `${summary.avgFeedback.toFixed(1)} ★`,
      hint: "Average rating",
    },
  ];
}

export function studentCommunityInsights(summary: StudentCommunitySummary): RoomInsight[] {
  const out: RoomInsight[] = [];
  if (summary.total === 0) {
    out.push({ key: "no-students", text: "No students enrolled yet.", tone: "neutral" });
    return out;
  }
  if (summary.inactive > 0) {
    out.push({
      key: "inactive",
      text: `${summary.inactive} ${summary.inactive === 1 ? "student has" : "students have"} gone quiet or dropped.`,
      tone: "warn",
    });
  }
  if (summary.avgAttendance != null && summary.avgAttendance < ATTENDANCE_AT_RISK) {
    out.push({
      key: "attendance",
      text: `Average attendance is ${Math.round(summary.avgAttendance * 100)}% — below the ${Math.round(
        ATTENDANCE_AT_RISK * 100
      )}% bar.`,
      tone: "danger",
    });
  }
  if (summary.avgFeedback != null) {
    out.push({
      key: "feedback",
      text: `Students rate their experience ${summary.avgFeedback.toFixed(1)} out of 5 on average.`,
      tone: summary.avgFeedback >= 4 ? "good" : summary.avgFeedback >= FEEDBACK_LOW ? "neutral" : "danger",
    });
  }
  if (summary.atRisk === 0 && summary.inactive === 0 && summary.total > 0) {
    out.push({ key: "healthy", text: "Every student is engaged and on track.", tone: "good" });
  }
  return out;
}

export function studentCommunityNextAction(
  summary: StudentCommunitySummary,
  needsYou: NeedsYouItem[]
): RoomNextAction {
  if (summary.total === 0) {
    return { text: "Enroll your first students to start building the community.", cta: "Open Students", href: "/chapter/students" };
  }
  if (summary.inactive > 0) {
    return {
      text: `Re-engage ${summary.inactive} ${summary.inactive === 1 ? "student" : "students"} who have gone quiet.`,
      cta: "Open Students",
      href: "/chapter/students",
    };
  }
  if (needsYou.length > 0) {
    return { text: `Support ${needsYou.length} ${needsYou.length === 1 ? "student" : "students"} who need attention.`, cta: "Open Students", href: "/chapter/students" };
  }
  return { text: "Keep the momentum — students are thriving.", cta: "Open Students", href: "/chapter/students" };
}

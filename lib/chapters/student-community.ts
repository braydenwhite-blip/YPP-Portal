// Chapter STUDENT COMMUNITY read model — "Are students having a great
// experience?" Turns the portal's existing enrollment, attendance, feedback and
// student-intake data into the one honest answer a Chapter President needs:
// are students enrolling, attending, staying, and giving positive feedback?
//
// Pure + deterministic (pass `now`) so it is fully unit testable: no Prisma, no
// `server-only`, only type-level imports. The DB loader in
// `lib/chapters/chapter-os.ts` gathers the raw rows and hands plain records to
// these summarizers. NO student data is invented — when nothing has been
// collected yet, the summary says so ("No Data Yet").

import { relativeAgo } from "./format";

const DAY_MS = 24 * 60 * 60 * 1000;

// ---------------------------------------------------------------------------
// Record shapes (the loader maps DB rows → these)
// ---------------------------------------------------------------------------

/** One student's enrollment in a class offering. */
export type StudentEnrollmentRecord = {
  studentId: string;
  studentName: string;
  offeringId: string;
  className: string;
  /** ClassEnrollmentStatus: ENROLLED | WAITLISTED | DROPPED | COMPLETED. */
  status: string;
  enrolledAt: Date;
  droppedAt: Date | null;
};

/** One attendance mark for a student at a single class session. */
export type AttendanceMark = {
  offeringId: string;
  className: string;
  sessionId: string;
  studentId: string;
  studentName: string;
  date: Date;
  /** AttendanceStatus: PRESENT | ABSENT | LATE | EXCUSED. */
  status: string;
};

/** One piece of student/parent feedback. */
export type StudentFeedbackRecord = {
  id: string;
  studentName: string | null;
  className: string | null;
  /** 1–5, or null if unrated. */
  rating: number | null;
  comment: string | null;
  source: "student" | "parent";
  createdAt: Date;
};

/** An unresolved student / family concern (e.g. a pending intake case). */
export type StudentConcernRecord = {
  id: string;
  studentName: string | null;
  summary: string;
  createdAt: Date;
  href: string;
};

export type StudentCommunityInput = {
  enrollments: StudentEnrollmentRecord[];
  attendance: AttendanceMark[];
  feedback: StudentFeedbackRecord[];
  concerns: StudentConcernRecord[];
};

// ---------------------------------------------------------------------------
// Pure metric helpers (each independently unit-tested)
// ---------------------------------------------------------------------------

const ATTENDED = new Set(["PRESENT", "LATE"]);

/**
 * Share of attendance marks that were actually attended (PRESENT or LATE).
 * EXCUSED marks are excluded from the denominator — an excused absence is not a
 * missed class. Returns a whole 0–100 percentage; 0 when there is nothing to
 * count.
 */
export function calculateAttendancePercent(marks: { status: string }[]): number {
  const countable = marks.filter((m) => m.status !== "EXCUSED");
  if (countable.length === 0) return 0;
  const attended = countable.filter((m) => ATTENDED.has(m.status)).length;
  return Math.round((attended / countable.length) * 100);
}

/**
 * Retention: of the students who actually started (anything but WAITLISTED),
 * how many are still enrolled or completed (i.e. did not drop). Whole 0–100;
 * 0 when nobody has started.
 */
export function calculateRetentionPercent(enrollments: { status: string }[]): number {
  const started = enrollments.filter((e) => e.status !== "WAITLISTED");
  if (started.length === 0) return 0;
  const retained = started.filter((e) => e.status === "ENROLLED" || e.status === "COMPLETED").length;
  return Math.round((retained / started.length) * 100);
}

export type AbsenceStreak = {
  studentId: string;
  studentName: string;
  offeringId: string;
  className: string;
  /** Length of the trailing run of consecutive ABSENT marks. */
  streak: number;
  lastSession: Date;
};

/**
 * Students whose most recent sessions in a class are a run of consecutive
 * ABSENT marks of length ≥ `threshold`. A PRESENT/LATE/EXCUSED mark breaks the
 * run (an excused absence is not a red flag). Most-absent first.
 */
export function getStudentsWithConsecutiveAbsences(
  marks: AttendanceMark[],
  threshold = 2
): AbsenceStreak[] {
  const groups = new Map<string, AttendanceMark[]>();
  for (const m of marks) {
    const key = `${m.studentId}:${m.offeringId}`;
    const list = groups.get(key);
    if (list) list.push(m);
    else groups.set(key, [m]);
  }

  const out: AbsenceStreak[] = [];
  for (const list of groups.values()) {
    const sorted = [...list].sort((a, b) => a.date.getTime() - b.date.getTime());
    let streak = 0;
    for (let i = sorted.length - 1; i >= 0; i--) {
      if (sorted[i].status === "ABSENT") streak += 1;
      else break;
    }
    if (streak >= threshold) {
      const last = sorted[sorted.length - 1];
      out.push({
        studentId: last.studentId,
        studentName: last.studentName,
        offeringId: last.offeringId,
        className: last.className,
        streak,
        lastSession: last.date,
      });
    }
  }
  return out.sort((a, b) => b.streak - a.streak);
}

export type ClassAttendanceSeries = {
  offeringId: string;
  className: string;
  /** Chronological weekly attendance points (Monday-keyed). */
  weeks: { weekStart: Date; percent: number; present: number; total: number }[];
};

/** Monday 00:00 UTC for a date — the reporting-week key (mirrors week.ts). */
function mondayUTC(d: Date): Date {
  const x = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const dow = x.getUTCDay(); // 0 Sun … 6 Sat
  const back = (dow + 6) % 7; // days since Monday
  return new Date(x.getTime() - back * DAY_MS);
}

/** Bucket attendance marks into per-class weekly attendance-percent series. */
export function buildClassAttendanceSeries(marks: AttendanceMark[]): ClassAttendanceSeries[] {
  const byClass = new Map<string, { className: string; weeks: Map<number, AttendanceMark[]> }>();
  for (const m of marks) {
    let cls = byClass.get(m.offeringId);
    if (!cls) {
      cls = { className: m.className, weeks: new Map() };
      byClass.set(m.offeringId, cls);
    }
    const wk = mondayUTC(m.date).getTime();
    const bucket = cls.weeks.get(wk);
    if (bucket) bucket.push(m);
    else cls.weeks.set(wk, [m]);
  }

  const out: ClassAttendanceSeries[] = [];
  for (const [offeringId, cls] of byClass) {
    const weeks = [...cls.weeks.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([wk, list]) => {
        const countable = list.filter((m) => m.status !== "EXCUSED");
        const present = countable.filter((m) => ATTENDED.has(m.status)).length;
        return {
          weekStart: new Date(wk),
          percent: calculateAttendancePercent(list),
          present,
          total: countable.length,
        };
      });
    out.push({ offeringId, className: cls.className, weeks });
  }
  return out;
}

export type AttendanceDecline = {
  offeringId: string;
  className: string;
  previousPercent: number;
  latestPercent: number;
  /** Positive number of percentage points lost from the prior week. */
  drop: number;
};

/**
 * Classes whose latest week's attendance dropped by ≥ `minDrop` points versus
 * the prior week. Needs at least two weeks of data per class.
 */
export function getClassesWithAttendanceDecline(
  series: ClassAttendanceSeries[],
  minDrop = 10
): AttendanceDecline[] {
  const out: AttendanceDecline[] = [];
  for (const s of series) {
    if (s.weeks.length < 2) continue;
    const latest = s.weeks[s.weeks.length - 1];
    const prev = s.weeks[s.weeks.length - 2];
    const drop = prev.percent - latest.percent;
    if (drop >= minDrop) {
      out.push({
        offeringId: s.offeringId,
        className: s.className,
        previousPercent: prev.percent,
        latestPercent: latest.percent,
        drop,
      });
    }
  }
  return out.sort((a, b) => b.drop - a.drop);
}

export type FeedbackSummary = {
  count: number;
  /** Mean rating 1–5, or null if no ratings were given. */
  averageRating: number | null;
  sentiment: "positive" | "mixed" | "negative" | "none";
  positiveCount: number; // rating ≥ 4
  negativeCount: number; // rating ≤ 2
  highlights: { text: string; rating: number | null; who: string }[];
};

/** Roll feedback into a count, average rating, sentiment band, and highlights. */
export function getFeedbackSummary(feedback: StudentFeedbackRecord[]): FeedbackSummary {
  if (feedback.length === 0) {
    return { count: 0, averageRating: null, sentiment: "none", positiveCount: 0, negativeCount: 0, highlights: [] };
  }
  const rated = feedback.filter((f) => f.rating != null) as (StudentFeedbackRecord & { rating: number })[];
  const averageRating = rated.length
    ? Math.round((rated.reduce((s, f) => s + f.rating, 0) / rated.length) * 10) / 10
    : null;
  const positiveCount = rated.filter((f) => f.rating >= 4).length;
  const negativeCount = rated.filter((f) => f.rating <= 2).length;

  let sentiment: FeedbackSummary["sentiment"] = "none";
  if (averageRating != null) {
    sentiment = averageRating >= 4 ? "positive" : averageRating >= 3 ? "mixed" : "negative";
  }

  const highlights = [...feedback]
    .filter((f) => f.comment && f.comment.trim())
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    .slice(0, 3)
    .map((f) => ({
      text: f.comment!.trim(),
      rating: f.rating,
      who: [f.studentName, f.className].filter(Boolean).join(" · ") || (f.source === "parent" ? "Parent" : "Student"),
    }));

  return { count: feedback.length, averageRating, sentiment, positiveCount, negativeCount, highlights };
}

// ---------------------------------------------------------------------------
// Status + next action
// ---------------------------------------------------------------------------

export type AttendanceTrend = "up" | "down" | "flat" | "none";

export const STUDENT_COMMUNITY_STATUSES = [
  "Strong",
  "Needs Feedback",
  "Attendance Risk",
  "Retention Risk",
  "No Data Yet",
  "Critical",
] as const;
export type StudentCommunityStatus = (typeof STUDENT_COMMUNITY_STATUSES)[number];

/** The metrics the status + next-action functions reason over. */
export type StudentCommunityMetrics = {
  enrolledCount: number;
  activeCount: number;
  classesWithEnrollment: number;
  attendancePercent: number;
  hasAttendanceData: boolean;
  attendanceTrend: AttendanceTrend;
  retentionPercent: number;
  retentionBase: number;
  consecutiveAbsentees: number;
  neverAttended: number;
  decliningClasses: number;
  feedbackCount: number;
  averageRating: number | null;
  negativeFeedback: number;
  unresolvedConcerns: number;
};

/**
 * Derive the one evidence-backed status label. Order matters: the most severe
 * honest signal wins. "No Data Yet" is only returned when literally nothing has
 * been collected — never to paper over a real problem.
 */
export function getStudentCommunityStatus(m: StudentCommunityMetrics): StudentCommunityStatus {
  const nothingCollected = !m.hasAttendanceData && m.feedbackCount === 0;
  if (m.enrolledCount === 0 && nothingCollected) return "No Data Yet";

  // Critical: multiple or severe failures of the core experience.
  if (m.hasAttendanceData && m.attendancePercent < 50) return "Critical";
  if (m.retentionBase >= 3 && m.retentionPercent < 50) return "Critical";
  if (m.negativeFeedback >= 2 && (m.consecutiveAbsentees > 0 || (m.hasAttendanceData && m.attendancePercent < 75)))
    return "Critical";

  if (nothingCollected) return "No Data Yet";

  // Attendance risk: people are slipping out of the room.
  if (
    (m.hasAttendanceData && m.attendancePercent < 75) ||
    m.consecutiveAbsentees > 0 ||
    m.decliningClasses > 0
  )
    return "Attendance Risk";

  // Retention risk: people are leaving (or never showed).
  if ((m.retentionBase >= 3 && m.retentionPercent < 75) || m.neverAttended > 0) return "Retention Risk";

  // Strong attendance/retention but we are flying blind on sentiment.
  if (m.feedbackCount === 0 || (m.negativeFeedback > 0 && m.feedbackCount < 3)) return "Needs Feedback";

  return "Strong";
}

/** The single recommended next action, derived from the same metrics. */
export function getStudentCommunityNextAction(m: StudentCommunityMetrics): string {
  const n = (x: number, s: string, p = `${s}s`) => `${x} ${x === 1 ? s : p}`;
  if (m.enrolledCount === 0) return "Enroll your first students, then attendance and feedback will track here.";
  if (m.consecutiveAbsentees > 0)
    return `Reach out to ${n(m.consecutiveAbsentees, "student")} who missed 2+ classes in a row.`;
  if (m.hasAttendanceData && m.attendancePercent < 50)
    return "Attendance is critically low — check in with instructors and families this week.";
  if (m.decliningClasses > 0)
    return `Investigate ${n(m.decliningClasses, "class", "classes")} where attendance dropped week over week.`;
  if (m.neverAttended > 0)
    return `Follow up with ${n(m.neverAttended, "enrolled student")} who never attended.`;
  if (m.hasAttendanceData && m.attendancePercent < 75)
    return "Lift attendance above 75% — confirm reminders are going out before each session.";
  if (m.retentionBase >= 3 && m.retentionPercent < 75)
    return "Win back students who dropped — a quick personal note often brings them back.";
  if (m.feedbackCount === 0)
    return "Collect feedback after the first sessions so you can hear how students are doing.";
  if (m.negativeFeedback > 0)
    return `Respond to ${n(m.negativeFeedback, "piece")} of negative feedback and close the loop.`;
  if (m.unresolvedConcerns > 0)
    return `Resolve ${n(m.unresolvedConcerns, "open student/family concern")}.`;
  return "Students are engaged — keep collecting feedback and celebrating wins.";
}

// ---------------------------------------------------------------------------
// Evidence + needs-attention + full summary
// ---------------------------------------------------------------------------

export type StudentEvidenceStatus = "strong" | "attendance_risk" | "retention_risk" | "needs_feedback" | "no_data";

/** Class-level evidence row (Class · Enrollment · Attendance % · Feedback · Retention · Status). */
export type StudentEvidenceRow = {
  id: string;
  className: string;
  enrollment: number;
  attendance: string;
  feedback: string;
  retention: string;
  status: StudentEvidenceStatus;
  href: string;
};

export type StudentCommunityNeed = {
  key: string;
  title: string;
  detail?: string;
  severity: "critical" | "warning" | "info";
  href: string;
  entityType?: "CLASS_OFFERING";
  entityId?: string;
};

export type StudentCommunitySummary = {
  status: StudentCommunityStatus;
  metrics: StudentCommunityMetrics;
  feedback: FeedbackSummary;
  consecutiveAbsentees: AbsenceStreak[];
  decliningClasses: AttendanceDecline[];
  neverAttended: { studentId: string; studentName: string; offeringId: string; className: string }[];
  recentFeedback: FeedbackSummary["highlights"];
  concerns: StudentConcernRecord[];
  needsAttention: StudentCommunityNeed[];
  nextAction: string;
  evidence: StudentEvidenceRow[];
};

const STUDENT_STATUS_ORDER: Record<StudentEvidenceStatus, number> = {
  no_data: 0,
  attendance_risk: 1,
  retention_risk: 2,
  needs_feedback: 3,
  strong: 4,
};

/** Overall attendance trend across all classes, latest week vs the prior week. */
function overallTrend(marks: AttendanceMark[]): AttendanceTrend {
  if (marks.length === 0) return "none";
  const weeks = new Map<number, AttendanceMark[]>();
  for (const m of marks) {
    const wk = mondayUTC(m.date).getTime();
    const bucket = weeks.get(wk);
    if (bucket) bucket.push(m);
    else weeks.set(wk, [m]);
  }
  const ordered = [...weeks.entries()].sort((a, b) => a[0] - b[0]);
  if (ordered.length < 2) return "none";
  const latest = calculateAttendancePercent(ordered[ordered.length - 1][1]);
  const prev = calculateAttendancePercent(ordered[ordered.length - 2][1]);
  if (latest > prev + 2) return "up";
  if (latest < prev - 2) return "down";
  return "flat";
}

/**
 * Assemble the full Student Community summary from the raw records. Everything
 * is derived from real data; absent data yields honest empty signals.
 */
export function summarizeStudentCommunity(input: StudentCommunityInput, now: Date): StudentCommunitySummary {
  const { enrollments, attendance, feedback, concerns } = input;

  // Active enrollments = currently in a class (not dropped, not waitlisted).
  const activeEnrollments = enrollments.filter((e) => e.status === "ENROLLED" || e.status === "COMPLETED");
  const enrolledStudents = new Set(activeEnrollments.map((e) => e.studentId));
  const classesWithEnrollment = new Set(
    enrollments.filter((e) => e.status !== "WAITLISTED").map((e) => e.offeringId)
  );

  const attendancePercent = calculateAttendancePercent(attendance);
  const retentionPercent = calculateRetentionPercent(enrollments);
  const retentionBase = enrollments.filter((e) => e.status !== "WAITLISTED").length;

  const absentees = getStudentsWithConsecutiveAbsences(attendance, 2);
  const series = buildClassAttendanceSeries(attendance);
  const declines = getClassesWithAttendanceDecline(series, 10);
  const feedbackSummary = getFeedbackSummary(feedback);

  // Enrolled students who never attended a single session.
  const attendedStudents = new Set(attendance.filter((m) => ATTENDED.has(m.status)).map((m) => m.studentId));
  const hasAttendanceData = attendance.length > 0;
  const neverAttended = hasAttendanceData
    ? activeEnrollments
        .filter((e) => !attendedStudents.has(e.studentId))
        .map((e) => ({ studentId: e.studentId, studentName: e.studentName, offeringId: e.offeringId, className: e.className }))
    : [];

  const metrics: StudentCommunityMetrics = {
    enrolledCount: enrolledStudents.size,
    activeCount: enrolledStudents.size,
    classesWithEnrollment: classesWithEnrollment.size,
    attendancePercent,
    hasAttendanceData,
    attendanceTrend: overallTrend(attendance),
    retentionPercent,
    retentionBase,
    consecutiveAbsentees: absentees.length,
    neverAttended: neverAttended.length,
    decliningClasses: declines.length,
    feedbackCount: feedbackSummary.count,
    averageRating: feedbackSummary.averageRating,
    negativeFeedback: feedbackSummary.negativeCount,
    unresolvedConcerns: concerns.length,
  };

  const status = getStudentCommunityStatus(metrics);
  const nextAction = getStudentCommunityNextAction(metrics);

  // --- Needs You ----------------------------------------------------------
  const needs: StudentCommunityNeed[] = [];
  for (const a of absentees) {
    needs.push({
      key: `student-absences:${a.studentId}:${a.offeringId}`,
      title: `${a.studentName}: missed ${a.streak} classes in a row`,
      detail: `In ${a.className}. A quick check-in keeps them from dropping.`,
      severity: a.streak >= 3 ? "critical" : "warning",
      href: `/admin/classes/${a.offeringId}`,
      entityType: "CLASS_OFFERING",
      entityId: a.offeringId,
    });
  }
  for (const d of declines) {
    needs.push({
      key: `class-attendance-decline:${d.offeringId}`,
      title: `${d.className}: attendance dropped ${d.drop} points`,
      detail: `Down from ${d.previousPercent}% to ${d.latestPercent}% week over week.`,
      severity: "warning",
      href: `/admin/classes/${d.offeringId}`,
      entityType: "CLASS_OFFERING",
      entityId: d.offeringId,
    });
  }
  // Group never-attended by class so the list stays compact.
  const neverByClass = new Map<string, { className: string; count: number }>();
  for (const s of neverAttended) {
    const e = neverByClass.get(s.offeringId);
    if (e) e.count += 1;
    else neverByClass.set(s.offeringId, { className: s.className, count: 1 });
  }
  for (const [offeringId, e] of neverByClass) {
    needs.push({
      key: `class-never-attended:${offeringId}`,
      title: `${e.className}: ${e.count} enrolled never attended`,
      detail: "Confirm they still plan to come, or free up the seats.",
      severity: "info",
      href: `/admin/classes/${offeringId}`,
      entityType: "CLASS_OFFERING",
      entityId: offeringId,
    });
  }
  // Classes that have run sessions but collected no feedback yet.
  const classesWithSessions = new Set(attendance.map((m) => m.offeringId));
  const classesWithFeedback = new Set(feedback.map((f) => f.className).filter(Boolean));
  if (hasAttendanceData) {
    const seriesByClass = new Map(series.map((s) => [s.offeringId, s]));
    for (const offeringId of classesWithSessions) {
      const s = seriesByClass.get(offeringId);
      if (!s) continue;
      if (!classesWithFeedback.has(s.className)) {
        needs.push({
          key: `class-no-feedback:${offeringId}`,
          title: `${s.className}: no feedback collected yet`,
          detail: "Send a short feedback form after the first session.",
          severity: "info",
          href: `/admin/classes/${offeringId}`,
          entityType: "CLASS_OFFERING",
          entityId: offeringId,
        });
      }
    }
  }
  if (feedbackSummary.negativeCount > 0) {
    needs.push({
      key: "student-negative-feedback",
      title: `${feedbackSummary.negativeCount} piece${feedbackSummary.negativeCount === 1 ? "" : "s"} of negative feedback`,
      detail: "Read it, respond, and close the loop with the family.",
      severity: "warning",
      href: "/chapter/students",
    });
  }
  for (const c of concerns) {
    needs.push({
      key: `student-concern:${c.id}`,
      title: c.studentName ? `${c.studentName}: ${c.summary}` : c.summary,
      detail: `Open since ${relativeAgo(c.createdAt, now)}.`,
      severity: "warning",
      href: c.href,
    });
  }

  const SEV_RANK = { critical: 0, warning: 1, info: 2 } as const;
  needs.sort((a, b) => SEV_RANK[a.severity] - SEV_RANK[b.severity]);

  // --- Class-level evidence ----------------------------------------------
  const declineSet = new Set(declines.map((d) => d.offeringId));
  const byClass = new Map<
    string,
    { className: string; enrollment: number; started: { status: string }[]; marks: AttendanceMark[] }
  >();
  for (const e of enrollments) {
    let row = byClass.get(e.offeringId);
    if (!row) {
      row = { className: e.className, enrollment: 0, started: [], marks: [] };
      byClass.set(e.offeringId, row);
    }
    if (e.status === "ENROLLED" || e.status === "COMPLETED") row.enrollment += 1;
    if (e.status !== "WAITLISTED") row.started.push({ status: e.status });
  }
  for (const m of attendance) {
    let row = byClass.get(m.offeringId);
    if (!row) {
      row = { className: m.className, enrollment: 0, started: [], marks: [] };
      byClass.set(m.offeringId, row);
    }
    row.marks.push(m);
  }
  const feedbackClassNames = new Set(feedback.map((f) => f.className).filter(Boolean));

  const evidence: StudentEvidenceRow[] = [...byClass.entries()].map(([offeringId, row]) => {
    const hasMarks = row.marks.length > 0;
    const att = hasMarks ? calculateAttendancePercent(row.marks) : null;
    const ret = row.started.length ? calculateRetentionPercent(row.started) : null;
    const hasFeedback = feedbackClassNames.has(row.className);

    let st: StudentEvidenceStatus;
    if (!hasMarks && !hasFeedback) st = "no_data";
    else if (att != null && (att < 75 || declineSet.has(offeringId))) st = "attendance_risk";
    else if (ret != null && row.started.length >= 3 && ret < 75) st = "retention_risk";
    else if (!hasFeedback) st = "needs_feedback";
    else st = "strong";

    return {
      id: offeringId,
      className: row.className,
      enrollment: row.enrollment,
      attendance: att != null ? `${att}%` : "—",
      feedback: hasFeedback ? "Collected" : "—",
      retention: ret != null ? `${ret}%` : "—",
      status: st,
      href: `/admin/classes/${offeringId}`,
    };
  });
  evidence.sort((a, b) => STUDENT_STATUS_ORDER[a.status] - STUDENT_STATUS_ORDER[b.status]);

  return {
    status,
    metrics,
    feedback: feedbackSummary,
    consecutiveAbsentees: absentees,
    decliningClasses: declines,
    neverAttended,
    recentFeedback: feedbackSummary.highlights,
    concerns,
    needsAttention: needs,
    nextAction,
    evidence,
  };
}

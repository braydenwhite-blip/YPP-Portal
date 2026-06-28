import { describe, it, expect } from "vitest";
import {
  calculateAttendancePercent,
  calculateRetentionPercent,
  getStudentsWithConsecutiveAbsences,
  getClassesWithAttendanceDecline,
  getFeedbackSummary,
  getStudentCommunityStatus,
  getStudentCommunityNextAction,
  summarizeStudentCommunity,
  type AttendanceMark,
  type StudentFeedbackRecord,
  type StudentCommunityMetrics,
  type StudentEnrollmentRecord,
} from "@/lib/chapters/student-community";

const NOW = new Date("2026-06-24T12:00:00.000Z");

function mark(overrides: Partial<AttendanceMark> = {}): AttendanceMark {
  return {
    offeringId: "off1",
    className: "Intro to Robotics",
    sessionId: "s1",
    studentId: "stu1",
    studentName: "Avery",
    date: new Date("2026-06-01T00:00:00.000Z"),
    status: "PRESENT",
    ...overrides,
  };
}

function feedback(overrides: Partial<StudentFeedbackRecord> = {}): StudentFeedbackRecord {
  return {
    id: "f1",
    studentName: "Avery",
    className: "Intro to Robotics",
    rating: 5,
    comment: "Loved it",
    source: "student",
    createdAt: new Date("2026-06-10T00:00:00.000Z"),
    ...overrides,
  };
}

function metrics(overrides: Partial<StudentCommunityMetrics> = {}): StudentCommunityMetrics {
  return {
    enrolledCount: 10,
    activeCount: 10,
    classesWithEnrollment: 2,
    attendancePercent: 90,
    hasAttendanceData: true,
    attendanceTrend: "flat",
    retentionPercent: 90,
    retentionBase: 10,
    consecutiveAbsentees: 0,
    neverAttended: 0,
    decliningClasses: 0,
    feedbackCount: 5,
    averageRating: 4.5,
    negativeFeedback: 0,
    unresolvedConcerns: 0,
    ...overrides,
  };
}

describe("calculateAttendancePercent", () => {
  it("counts PRESENT and LATE as attended", () => {
    expect(calculateAttendancePercent([{ status: "PRESENT" }, { status: "PRESENT" }, { status: "ABSENT" }, { status: "LATE" }])).toBe(75);
  });
  it("excludes EXCUSED from the denominator", () => {
    expect(calculateAttendancePercent([{ status: "PRESENT" }, { status: "ABSENT" }, { status: "EXCUSED" }])).toBe(50);
  });
  it("is 0 with nothing countable", () => {
    expect(calculateAttendancePercent([])).toBe(0);
    expect(calculateAttendancePercent([{ status: "EXCUSED" }])).toBe(0);
  });
});

describe("calculateRetentionPercent", () => {
  it("retains ENROLLED + COMPLETED out of everyone who started", () => {
    expect(
      calculateRetentionPercent([{ status: "ENROLLED" }, { status: "COMPLETED" }, { status: "DROPPED" }, { status: "WAITLISTED" }])
    ).toBe(67);
  });
  it("is 0 when nobody started", () => {
    expect(calculateRetentionPercent([{ status: "WAITLISTED" }])).toBe(0);
  });
});

describe("getStudentsWithConsecutiveAbsences", () => {
  it("flags a trailing run of 2+ absences", () => {
    const marks = [
      mark({ sessionId: "a", date: new Date("2026-06-01T00:00:00Z"), status: "PRESENT" }),
      mark({ sessionId: "b", date: new Date("2026-06-08T00:00:00Z"), status: "ABSENT" }),
      mark({ sessionId: "c", date: new Date("2026-06-15T00:00:00Z"), status: "ABSENT" }),
    ];
    const res = getStudentsWithConsecutiveAbsences(marks, 2);
    expect(res).toHaveLength(1);
    expect(res[0]).toMatchObject({ studentId: "stu1", streak: 2 });
  });
  it("does not flag when the latest session was attended", () => {
    const marks = [
      mark({ sessionId: "a", date: new Date("2026-06-01T00:00:00Z"), status: "ABSENT" }),
      mark({ sessionId: "b", date: new Date("2026-06-08T00:00:00Z"), status: "ABSENT" }),
      mark({ sessionId: "c", date: new Date("2026-06-15T00:00:00Z"), status: "PRESENT" }),
    ];
    expect(getStudentsWithConsecutiveAbsences(marks, 2)).toHaveLength(0);
  });
});

describe("getClassesWithAttendanceDecline", () => {
  it("detects a week-over-week drop beyond the threshold", () => {
    const res = getClassesWithAttendanceDecline(
      [
        {
          offeringId: "off1",
          className: "Robotics",
          weeks: [
            { weekStart: new Date("2026-06-08T00:00:00Z"), percent: 80, present: 8, total: 10 },
            { weekStart: new Date("2026-06-15T00:00:00Z"), percent: 60, present: 6, total: 10 },
          ],
        },
      ],
      10
    );
    expect(res).toHaveLength(1);
    expect(res[0]).toMatchObject({ offeringId: "off1", drop: 20 });
  });
  it("ignores classes with fewer than two weeks or small drops", () => {
    const series = [
      { offeringId: "a", className: "A", weeks: [{ weekStart: NOW, percent: 90, present: 9, total: 10 }] },
      {
        offeringId: "b",
        className: "B",
        weeks: [
          { weekStart: NOW, percent: 90, present: 9, total: 10 },
          { weekStart: NOW, percent: 85, present: 17, total: 20 },
        ],
      },
    ];
    expect(getClassesWithAttendanceDecline(series, 10)).toHaveLength(0);
  });
});

describe("getFeedbackSummary", () => {
  it("averages ratings and bands sentiment", () => {
    const s = getFeedbackSummary([feedback({ rating: 5 }), feedback({ id: "f2", rating: 3, comment: "ok" })]);
    expect(s.count).toBe(2);
    expect(s.averageRating).toBe(4);
    expect(s.sentiment).toBe("positive");
    expect(s.positiveCount).toBe(1);
    expect(s.highlights.length).toBeGreaterThan(0);
  });
  it("reports an empty/none summary when there is no feedback", () => {
    const s = getFeedbackSummary([]);
    expect(s).toMatchObject({ count: 0, averageRating: null, sentiment: "none", highlights: [] });
  });
  it("flags negative sentiment", () => {
    expect(getFeedbackSummary([feedback({ rating: 1 }), feedback({ id: "f2", rating: 2 })]).sentiment).toBe("negative");
  });
});

describe("getStudentCommunityStatus", () => {
  it("returns No Data Yet when nothing has been collected", () => {
    expect(
      getStudentCommunityStatus(metrics({ enrolledCount: 0, hasAttendanceData: false, feedbackCount: 0, retentionBase: 0 }))
    ).toBe("No Data Yet");
  });
  it("returns Critical when attendance collapses", () => {
    expect(getStudentCommunityStatus(metrics({ attendancePercent: 40 }))).toBe("Critical");
  });
  it("returns Attendance Risk for sub-75% attendance", () => {
    expect(getStudentCommunityStatus(metrics({ attendancePercent: 70 }))).toBe("Attendance Risk");
  });
  it("returns Retention Risk when students leave or never show", () => {
    expect(getStudentCommunityStatus(metrics({ retentionPercent: 60, neverAttended: 0 }))).toBe("Retention Risk");
    expect(getStudentCommunityStatus(metrics({ neverAttended: 2 }))).toBe("Retention Risk");
  });
  it("returns Needs Feedback when engaged but unmeasured", () => {
    expect(getStudentCommunityStatus(metrics({ feedbackCount: 0 }))).toBe("Needs Feedback");
  });
  it("returns Strong when everything is healthy", () => {
    expect(getStudentCommunityStatus(metrics())).toBe("Strong");
  });
});

describe("getStudentCommunityNextAction", () => {
  it("prioritizes consecutive absentees", () => {
    expect(getStudentCommunityNextAction(metrics({ consecutiveAbsentees: 2 }))).toMatch(/missed 2\+ classes/);
  });
  it("asks for feedback when none exists", () => {
    expect(getStudentCommunityNextAction(metrics({ feedbackCount: 0 }))).toMatch(/Collect feedback/);
  });
  it("celebrates a healthy community", () => {
    expect(getStudentCommunityNextAction(metrics())).toMatch(/engaged/);
  });
});

describe("summarizeStudentCommunity", () => {
  it("returns an honest empty state with no data", () => {
    const s = summarizeStudentCommunity({ enrollments: [], attendance: [], feedback: [], concerns: [] }, NOW);
    expect(s.status).toBe("No Data Yet");
    expect(s.evidence).toHaveLength(0);
    expect(s.metrics.hasAttendanceData).toBe(false);
    expect(s.nextAction).toMatch(/Enroll your first students/);
  });

  it("derives metrics, evidence, and needs from real records", () => {
    const enrollments: StudentEnrollmentRecord[] = [
      { studentId: "stu1", studentName: "Avery", offeringId: "off1", className: "Robotics", status: "ENROLLED", enrolledAt: new Date("2026-05-01T00:00:00Z"), droppedAt: null },
      { studentId: "stu2", studentName: "Blake", offeringId: "off1", className: "Robotics", status: "DROPPED", enrolledAt: new Date("2026-05-01T00:00:00Z"), droppedAt: new Date("2026-06-01T00:00:00Z") },
    ];
    const attendance: AttendanceMark[] = [
      mark({ studentId: "stu1", sessionId: "a", date: new Date("2026-06-08T00:00:00Z"), status: "ABSENT" }),
      mark({ studentId: "stu1", sessionId: "b", date: new Date("2026-06-15T00:00:00Z"), status: "ABSENT" }),
    ];
    const s = summarizeStudentCommunity({ enrollments, attendance, feedback: [], concerns: [] }, NOW);
    expect(s.metrics.enrolledCount).toBe(1);
    expect(s.metrics.consecutiveAbsentees).toBe(1);
    expect(s.consecutiveAbsentees[0].streak).toBe(2);
    expect(s.evidence.some((r) => r.className === "Robotics")).toBe(true);
    expect(s.needsAttention.some((n) => n.key.startsWith("student-absences"))).toBe(true);
    // No fake data: feedback was empty, so it stays empty.
    expect(s.feedback.count).toBe(0);
  });
});

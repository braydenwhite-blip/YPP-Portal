import { describe, it, expect } from "vitest";
import {
  studentEvidenceStatus,
  studentEvidenceRow,
  studentIsInactive,
  summarizeStudentCommunity,
  studentCommunityNeedsYou,
  studentCommunityInsights,
  studentCommunityNextAction,
  type StudentRecord,
} from "@/lib/chapters/student-community";

function student(o: Partial<StudentRecord> = {}): StudentRecord {
  return {
    id: "s1",
    name: "Ada Lovelace",
    className: "Robotics 101",
    classCount: 1,
    attendanceRate: 0.9,
    feedbackRating: 4.5,
    inactiveDays: 2,
    enrollmentStatus: "ENROLLED",
    advisorOverdue: false,
    ...o,
  };
}

describe("studentEvidenceStatus", () => {
  it("thriving when engaged with good attendance and feedback", () => {
    expect(studentEvidenceStatus(student())).toBe("thriving");
  });
  it("inactive when dropped or quiet 14+ days", () => {
    expect(studentEvidenceStatus(student({ enrollmentStatus: "DROPPED" }))).toBe("inactive");
    expect(studentEvidenceStatus(student({ inactiveDays: 21 }))).toBe("inactive");
    expect(studentIsInactive(student({ inactiveDays: 21 }))).toBe(true);
  });
  it("at risk on low attendance, low feedback, or overdue advisor", () => {
    expect(studentEvidenceStatus(student({ attendanceRate: 0.5 }))).toBe("at_risk");
    expect(studentEvidenceStatus(student({ feedbackRating: 2 }))).toBe("at_risk");
    expect(studentEvidenceStatus(student({ advisorOverdue: true }))).toBe("at_risk");
  });
});

describe("studentEvidenceRow", () => {
  it("formats attendance, feedback, and multi-class", () => {
    expect(studentEvidenceRow(student({ classCount: 3 }))).toMatchObject({
      name: "Ada Lovelace",
      className: "Robotics 101 +2",
      attendance: "90%",
      feedback: "4.5 ★",
      status: "thriving",
    });
  });
  it("shows a dash when there is no data yet", () => {
    const row = studentEvidenceRow(student({ attendanceRate: null, feedbackRating: null }));
    expect(row.attendance).toBe("—");
    expect(row.feedback).toBe("—");
  });
});

describe("summarizeStudentCommunity", () => {
  it("counts statuses and averages real values only", () => {
    const s = summarizeStudentCommunity([
      student({ id: "a" }),
      student({ id: "b", inactiveDays: 30 }),
      student({ id: "c", attendanceRate: 0.4 }),
    ]);
    expect(s.total).toBe(3);
    expect(s.thriving).toBe(1);
    expect(s.atRisk).toBe(1);
    expect(s.inactive).toBe(1);
    expect(s.retention).toBeCloseTo(2 / 3, 5);
    expect(s.avgAttendance).toBeCloseTo((0.9 + 0.9 + 0.4) / 3, 5);
  });
  it("returns null averages when there's no data", () => {
    const s = summarizeStudentCommunity([]);
    expect(s.retention).toBeNull();
    expect(s.avgAttendance).toBeNull();
  });
});

describe("studentCommunityNeedsYou", () => {
  it("surfaces concrete experience problems", () => {
    const items = studentCommunityNeedsYou([
      student({ id: "a", inactiveDays: 30 }),
      student({ id: "b", enrollmentStatus: "DROPPED" }),
      student({ id: "c", attendanceRate: 0.4 }),
      student({ id: "d", advisorOverdue: true }),
    ]);
    const keys = items.map((i) => i.key);
    expect(keys).toContain("student-inactive:a");
    expect(keys).toContain("student-inactive:b");
    expect(keys).toContain("student-attendance:c");
    expect(keys).toContain("student-advisor:d");
    // dropped is a warning, gone-quiet is just info
    expect(items.find((i) => i.key === "student-inactive:b")?.severity).toBe("warning");
    expect(items.find((i) => i.key === "student-inactive:a")?.severity).toBe("info");
    // every student item carries the Person 360 link
    expect(items.every((i) => i.entityType === "STUDENT" && i.entityId)).toBe(true);
  });
});

describe("insights + next action", () => {
  it("recommends re-engagement when students go quiet", () => {
    const summary = summarizeStudentCommunity([student({ inactiveDays: 30 }), student({ id: "b" })]);
    expect(studentCommunityNextAction(summary, []).text).toMatch(/Re-engage/);
    expect(studentCommunityInsights(summary).some((i) => i.key === "inactive")).toBe(true);
  });
  it("handles the empty community", () => {
    const summary = summarizeStudentCommunity([]);
    expect(studentCommunityNextAction(summary, []).text).toMatch(/Enroll your first/);
    expect(studentCommunityInsights(summary)[0].key).toBe("no-students");
  });
});

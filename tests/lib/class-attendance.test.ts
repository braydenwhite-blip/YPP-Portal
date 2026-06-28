import { describe, it, expect } from "vitest";
import {
  attendanceCompletion,
  tallyAttendance,
  canManageClassAttendance,
  SubmitAttendanceSchema,
  UpdateAttendanceSchema,
} from "@/lib/classes/attendance";

describe("attendanceCompletion", () => {
  it("is missing with no records, partial when short, submitted when complete", () => {
    expect(attendanceCompletion(10, 0)).toBe("missing");
    expect(attendanceCompletion(10, 6)).toBe("partial");
    expect(attendanceCompletion(10, 10)).toBe("submitted");
    expect(attendanceCompletion(0, 0)).toBe("missing");
  });
});

describe("tallyAttendance", () => {
  it("counts statuses and computes present+late rate", () => {
    const t = tallyAttendance(["PRESENT", "PRESENT", "LATE", "ABSENT", "EXCUSED"]);
    expect(t).toMatchObject({ present: 2, late: 1, absent: 1, excused: 1, total: 5 });
    expect(t.percent).toBe(60); // (2 present + 1 late) / 5
  });
  it("returns null percent with no marks", () => {
    expect(tallyAttendance([]).percent).toBeNull();
  });
});

describe("canManageClassAttendance", () => {
  const offering = { instructorId: "lead1", chapterId: "ch1" };
  it("allows admins", () => {
    expect(canManageClassAttendance({ id: "x", roles: ["ADMIN"] }, offering)).toBe(true);
  });
  it("allows the lead instructor", () => {
    expect(canManageClassAttendance({ id: "lead1", roles: ["INSTRUCTOR"] }, offering)).toBe(true);
  });
  it("allows a confirmed co-instructor", () => {
    expect(canManageClassAttendance({ id: "co1", roles: ["INSTRUCTOR"] }, offering, { isConfirmedCoInstructor: true })).toBe(true);
  });
  it("allows the Chapter President managing the chapter", () => {
    expect(canManageClassAttendance({ id: "cp1", roles: ["CHAPTER_PRESIDENT"] }, offering, { managesChapter: true })).toBe(true);
  });
  it("blocks an unrelated instructor", () => {
    expect(canManageClassAttendance({ id: "other", roles: ["INSTRUCTOR"] }, offering)).toBe(false);
  });
});

describe("SubmitAttendanceSchema", () => {
  it("accepts a well-formed roster submission", () => {
    const r = SubmitAttendanceSchema.safeParse({
      offeringId: "o1",
      sessionId: "s1",
      marks: [
        { studentId: "u1", status: "PRESENT" },
        { studentId: "u2", status: "ABSENT", note: "Sick" },
      ],
    });
    expect(r.success).toBe(true);
  });
  it("rejects an empty roster, bad status, and missing ids", () => {
    expect(SubmitAttendanceSchema.safeParse({ offeringId: "o1", sessionId: "s1", marks: [] }).success).toBe(false);
    expect(
      SubmitAttendanceSchema.safeParse({ offeringId: "o1", sessionId: "s1", marks: [{ studentId: "u1", status: "MAYBE" }] }).success
    ).toBe(false);
    expect(SubmitAttendanceSchema.safeParse({ sessionId: "s1", marks: [{ studentId: "u1", status: "PRESENT" }] }).success).toBe(false);
  });
});

describe("UpdateAttendanceSchema", () => {
  it("validates a single correction", () => {
    expect(UpdateAttendanceSchema.safeParse({ offeringId: "o1", sessionId: "s1", studentId: "u1", status: "LATE" }).success).toBe(true);
    expect(UpdateAttendanceSchema.safeParse({ offeringId: "o1", sessionId: "s1", studentId: "u1", status: "X" }).success).toBe(false);
  });
});

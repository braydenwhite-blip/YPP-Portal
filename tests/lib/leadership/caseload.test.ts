import { describe, expect, it } from "vitest";

import {
  advisorActivityHealth,
  assignmentsNeedingFollowUp,
  caseloadBand,
  studentsWithoutAdvisor,
  summarizeAdvisorCaseloads,
  type AssignmentLike,
} from "@/lib/leadership/caseload";

const NOW = new Date("2026-06-11T12:00:00.000Z");

function daysAgo(days: number): Date {
  return new Date(NOW.getTime() - days * 24 * 60 * 60 * 1000);
}

function assignment(overrides: Partial<AssignmentLike> = {}): AssignmentLike {
  return {
    advisorId: "advisor-1",
    studentId: "student-1",
    isActive: true,
    advisingStatus: "ENGAGED",
    needsFollowUp: false,
    lastCheckInAt: daysAgo(5),
    startDate: daysAgo(40),
    ...overrides,
  };
}

describe("caseload bands", () => {
  it("classifies high (>=8), low (<=2), and typical caseloads", () => {
    expect(caseloadBand(8)).toBe("HIGH");
    expect(caseloadBand(12)).toBe("HIGH");
    expect(caseloadBand(2)).toBe("LOW");
    expect(caseloadBand(0)).toBe("LOW");
    expect(caseloadBand(5)).toBe("TYPICAL");
  });
});

describe("advisor activity health", () => {
  it("is ACTIVE with a check-in inside 30 days", () => {
    expect(advisorActivityHealth([assignment({ lastCheckInAt: daysAgo(29) })], NOW)).toBe("ACTIVE");
  });

  it("is STALE between 30 and 60 days and INACTIVE after 60", () => {
    expect(advisorActivityHealth([assignment({ lastCheckInAt: daysAgo(45) })], NOW)).toBe("STALE");
    expect(advisorActivityHealth([assignment({ lastCheckInAt: daysAgo(61) })], NOW)).toBe("INACTIVE");
  });

  it("uses the most recent check-in across the caseload", () => {
    const health = advisorActivityHealth(
      [
        assignment({ studentId: "s1", lastCheckInAt: daysAgo(90) }),
        assignment({ studentId: "s2", lastCheckInAt: daysAgo(3) }),
      ],
      NOW,
    );
    expect(health).toBe("ACTIVE");
  });

  it("grants a grace period to brand-new caseloads with no check-ins", () => {
    expect(
      advisorActivityHealth([assignment({ lastCheckInAt: null, startDate: daysAgo(10) })], NOW),
    ).toBe("ACTIVE");
    expect(
      advisorActivityHealth([assignment({ lastCheckInAt: null, startDate: daysAgo(45) })], NOW),
    ).toBe("STALE");
    expect(
      advisorActivityHealth([assignment({ lastCheckInAt: null, startDate: daysAgo(90) })], NOW),
    ).toBe("INACTIVE");
  });

  it("is INACTIVE with no active assignments", () => {
    expect(advisorActivityHealth([assignment({ isActive: false })], NOW)).toBe("INACTIVE");
  });
});

describe("caseload summaries", () => {
  it("summarizes per advisor, counting only active assignments", () => {
    const summaries = summarizeAdvisorCaseloads(
      [
        assignment({ studentId: "s1" }),
        assignment({ studentId: "s2", needsFollowUp: true }),
        assignment({ studentId: "s3", advisingStatus: "NEEDS_ATTENTION" }),
        assignment({ studentId: "s4", isActive: false }),
        assignment({ advisorId: "advisor-2", studentId: "s5", lastCheckInAt: null, startDate: daysAgo(2) }),
      ],
      NOW,
    );

    const advisor1 = summaries.find((s) => s.advisorId === "advisor-1");
    expect(advisor1?.activeCount).toBe(3);
    expect(advisor1?.needsFollowUpCount).toBe(1);
    expect(advisor1?.needsAttentionCount).toBe(1);
    expect(advisor1?.band).toBe("TYPICAL");

    const advisor2 = summaries.find((s) => s.advisorId === "advisor-2");
    expect(advisor2?.activeCount).toBe(1);
    expect(advisor2?.band).toBe("LOW");
    expect(advisor2?.lastCheckInAt).toBeNull();
  });
});

describe("coverage helpers", () => {
  it("finds students without an active advisor", () => {
    const result = studentsWithoutAdvisor(
      ["s1", "s2", "s3"],
      [
        assignment({ studentId: "s1" }),
        assignment({ studentId: "s2", isActive: false }),
      ],
    );
    expect(result).toEqual(["s2", "s3"]);
  });

  it("collects active assignments flagged for follow-up or needing attention", () => {
    const flagged = assignment({ studentId: "s1", needsFollowUp: true });
    const attention = assignment({ studentId: "s2", advisingStatus: "NEEDS_ATTENTION" });
    const fine = assignment({ studentId: "s3" });
    const endedButFlagged = assignment({ studentId: "s4", needsFollowUp: true, isActive: false });

    const result = assignmentsNeedingFollowUp([flagged, attention, fine, endedButFlagged]);
    expect(result).toEqual([flagged, attention]);
  });
});

import { describe, expect, it } from "vitest";
import {
  ACTIVE_ASSIGNMENT_STATUSES,
  deriveCoverage,
  needsAttention,
  rankCandidates,
  scoreInstructorMatch,
  type CandidateInstructor,
  type MatchScore,
} from "@/lib/instructor-assignment-matching";

const baseInstructor: CandidateInstructor = {
  id: "u1",
  city: "Boston",
  state: "MA",
  subjects: "Physics, Math",
  applicationStatus: "APPROVED",
  applicationTrack: "STANDARD_INSTRUCTOR",
  activeAssignmentCount: 0,
  hasApprovedProposal: false,
  teachingLevels: [],
};

describe("deriveCoverage", () => {
  it("counts only PENDING + CONFIRMED as active slots", () => {
    const coverage = deriveCoverage(2, [
      { status: "PENDING" },
      { status: "SUGGESTED" },
      { status: "DECLINED" },
    ]);
    expect(coverage.active).toBe(1);
    expect(coverage.confirmed).toBe(0);
    expect(coverage.uncovered).toBe(true);
    expect(coverage.fullyCovered).toBe(false);
  });

  it("marks an opportunity as fully covered when active meets needed", () => {
    const coverage = deriveCoverage(2, [
      { status: "PENDING" },
      { status: "CONFIRMED" },
    ]);
    expect(coverage.fullyCovered).toBe(true);
    expect(coverage.uncovered).toBe(false);
    expect(coverage.overstaffed).toBe(false);
  });

  it("flags overstaffed when active exceeds needed", () => {
    const coverage = deriveCoverage(1, [
      { status: "CONFIRMED" },
      { status: "CONFIRMED" },
    ]);
    expect(coverage.overstaffed).toBe(true);
  });

  it("exports the canonical active-status set", () => {
    expect(ACTIVE_ASSIGNMENT_STATUSES).toEqual(["PENDING", "CONFIRMED"]);
  });
});

describe("needsAttention", () => {
  it("flags uncovered active opportunities", () => {
    const coverage = deriveCoverage(2, []);
    expect(
      needsAttention({
        status: "OPEN",
        urgency: "NORMAL",
        fillByDate: null,
        coverage,
      }),
    ).toBe(true);
  });

  it("does not flag completed opportunities even when uncovered", () => {
    const coverage = deriveCoverage(2, []);
    expect(
      needsAttention({
        status: "COMPLETED",
        urgency: "URGENT",
        fillByDate: null,
        coverage,
      }),
    ).toBe(false);
  });

  it("flags rows whose fillByDate has passed", () => {
    const coverage = deriveCoverage(1, [{ status: "CONFIRMED" }]);
    expect(
      needsAttention({
        status: "OPEN",
        urgency: "NORMAL",
        fillByDate: new Date("2020-01-01T00:00:00.000Z"),
        coverage,
        now: new Date("2026-05-12T00:00:00.000Z"),
      }),
    ).toBe(true);
  });

  it("flags URGENT urgency even when staffed", () => {
    const coverage = deriveCoverage(1, [{ status: "CONFIRMED" }]);
    expect(
      needsAttention({
        status: "OPEN",
        urgency: "URGENT",
        fillByDate: null,
        coverage,
      }),
    ).toBe(true);
  });
});

describe("scoreInstructorMatch", () => {
  it("rewards topic match and same-city placement", () => {
    const score = scoreInstructorMatch(baseInstructor, {
      topicTags: ["physics"],
      deliveryMode: "IN_PERSON",
      locationCity: "Boston",
      locationState: "MA",
      requiredCourseLevel: null,
    });
    expect(score.total).toBeGreaterThan(0);
    expect(score.reasons.some((r) => r.label.includes("Topic match"))).toBe(true);
    expect(score.reasons.some((r) => r.label.includes("Same city"))).toBe(true);
  });

  it("ignores region for virtual programs", () => {
    const score = scoreInstructorMatch(
      { ...baseInstructor, city: "Boston" },
      {
        topicTags: ["physics"],
        deliveryMode: "VIRTUAL",
        locationCity: "Chicago",
        locationState: "IL",
        requiredCourseLevel: null,
      },
    );
    expect(score.reasons.some((r) => r.label.includes("Online program"))).toBe(true);
    expect(score.reasons.some((r) => r.label.includes("Same city"))).toBe(false);
  });

  it("penalizes overloaded instructors", () => {
    const score = scoreInstructorMatch(
      { ...baseInstructor, activeAssignmentCount: 4 },
      {
        topicTags: [],
        deliveryMode: "IN_PERSON",
        locationCity: null,
        locationState: null,
        requiredCourseLevel: null,
      },
    );
    expect(score.reasons.some((r) => r.label.includes("Overloaded"))).toBe(true);
    expect(score.total).toBeLessThan(2);
  });

  it("penalizes unapproved applicants", () => {
    const score = scoreInstructorMatch(
      { ...baseInstructor, applicationStatus: "SUBMITTED" },
      {
        topicTags: [],
        deliveryMode: "IN_PERSON",
        locationCity: null,
        locationState: null,
        requiredCourseLevel: null,
      },
    );
    expect(score.reasons.some((r) => r.label.includes("not yet approved"))).toBe(true);
    expect(score.total).toBeLessThan(0);
  });

  it("rewards a matching teaching permission level", () => {
    const score = scoreInstructorMatch(
      { ...baseInstructor, teachingLevels: ["LEVEL_201"] },
      {
        topicTags: [],
        deliveryMode: "IN_PERSON",
        locationCity: null,
        locationState: null,
        requiredCourseLevel: "LEVEL_201",
      },
    );
    expect(score.reasons.some((r) => r.label.includes("Cleared for LEVEL_201"))).toBe(true);
  });
});

describe("rankCandidates", () => {
  it("sorts by descending score, ties alphabetical", () => {
    const make = (name: string, total: number) => ({
      name,
      score: { total, reasons: [] } as MatchScore,
    });
    const ranked = rankCandidates([make("Zed", 5), make("Alice", 5), make("Bob", 8)]);
    expect(ranked.map((c) => c.name)).toEqual(["Bob", "Alice", "Zed"]);
  });
});

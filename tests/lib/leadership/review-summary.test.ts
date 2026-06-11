import { describe, expect, it } from "vitest";

import {
  generateReviewEvidence,
  type ReviewContribution,
} from "@/lib/leadership/review-summary";

function contribution(
  overrides: Partial<ReviewContribution> = {},
): ReviewContribution {
  return {
    category: "STUDENT_ADVISOR",
    title: "Student Advisor",
    status: "ACTIVE",
    weight: 2,
    isOwnership: false,
    reviewVisible: true,
    ...overrides,
  };
}

describe("review evidence generation", () => {
  it("says the instructor needs more initiative when nothing meaningful exists", () => {
    const evidence = generateReviewEvidence([]);
    expect(evidence.suggestedLanguage).toContain("Needs more initiative beyond teaching.");
    expect(evidence.suggestedLanguage).not.toContain("Contributes beyond own classroom.");
    expect(evidence.promotionReadiness.seniorReady).toBe(false);
  });

  it("recognizes contribution beyond the classroom and advising with caseload stats", () => {
    const evidence = generateReviewEvidence([contribution()], {
      activeAdvisees: 4,
      checkInsLogged: 9,
      recommendationsMade: 3,
    });
    expect(evidence.suggestedLanguage).toContain("Contributes beyond own classroom.");
    expect(
      evidence.suggestedLanguage.some((line) =>
        line.includes("Supports 4 students through advising (9 check-ins, 3 next-step recommendations)"),
      ),
    ).toBe(true);
    expect(evidence.promotionReadiness.seniorReady).toBe(true);
    expect(evidence.promotionReadiness.leadReady).toBe(false);
  });

  it("mentions mentoring newer instructors", () => {
    const evidence = generateReviewEvidence([
      contribution({ category: "INSTRUCTOR_MENTOR", title: "Mentor to J. Doe" }),
    ]);
    expect(evidence.suggestedLanguage).toContain("Mentors newer instructors.");
  });

  it("credits curriculum/program quality ownership", () => {
    const evidence = generateReviewEvidence([
      contribution({ category: "CURRICULUM_REVIEWER", title: "Robotics curriculum review" }),
    ]);
    expect(evidence.suggestedLanguage).toContain(
      "Takes ownership of curriculum/program quality.",
    );
  });

  it("names the owned partner/program/system for ownership roles", () => {
    const evidence = generateReviewEvidence([
      contribution(),
      contribution({
        category: "PARTNER_RELATIONSHIP_LEAD",
        title: "Lincoln Center partnership",
        weight: 3,
        isOwnership: true,
      }),
    ]);
    expect(
      evidence.suggestedLanguage.some((line) =>
        line.includes("Owns a meaningful partner/program/system (Lincoln Center partnership)"),
      ),
    ).toBe(true);
    expect(evidence.promotionReadiness.leadReady).toBe(true);
    expect(evidence.promotionReadiness.label).toBe(
      "Meets Lead Instructor leadership expectations",
    );
  });

  it("splits current and completed roles and excludes review-hidden ones", () => {
    const evidence = generateReviewEvidence([
      contribution({ title: "Student Advisor" }),
      contribution({ category: "INTERVIEWER", title: "Spring interviews", status: "COMPLETED" }),
      contribution({ title: "Hidden role", reviewVisible: false }),
    ]);
    expect(evidence.currentRoles).toEqual(["Student Advisor"]);
    expect(evidence.completedRoles).toEqual(["Spring interviews"]);
  });
});

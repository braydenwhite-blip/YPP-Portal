import { describe, expect, it } from "vitest";

import {
  computeExpectationProgress,
  isCountable,
  isMeaningful,
  type ContributionLike,
} from "@/lib/leadership/expectations";

function contribution(overrides: Partial<ContributionLike> = {}): ContributionLike {
  return {
    category: "STUDENT_ADVISOR",
    status: "ACTIVE",
    weight: 2,
    isOwnership: false,
    reviewVisible: true,
    ...overrides,
  };
}

describe("contribution counting rules", () => {
  it("counts active, assigned, needs-attention, and completed contributions", () => {
    for (const status of ["ACTIVE", "ASSIGNED", "NEEDS_ATTENTION", "COMPLETED"] as const) {
      expect(isCountable(contribution({ status }))).toBe(true);
    }
  });

  it("never counts suggested or paused contributions", () => {
    expect(isCountable(contribution({ status: "SUGGESTED" }))).toBe(false);
    expect(isCountable(contribution({ status: "PAUSED" }))).toBe(false);
  });

  it("never counts review-hidden contributions", () => {
    expect(isCountable(contribution({ reviewVisible: false }))).toBe(false);
  });

  it("requires weight >= 2 to be meaningful", () => {
    expect(isMeaningful(contribution({ weight: 1 }))).toBe(false);
    expect(isMeaningful(contribution({ weight: 2 }))).toBe(true);
    expect(isMeaningful(contribution({ weight: 3 }))).toBe(true);
  });
});

describe("Senior Instructor expectation progress", () => {
  it("is unmet with no contributions", () => {
    const progress = computeExpectationProgress([]);
    expect(progress.senior.met).toBe(false);
    expect(progress.senior.percent).toBe(0);
    expect(progress.standing).toBe("NO_CONTRIBUTIONS");
  });

  it("is met with one meaningful contribution and exceeded with two", () => {
    const one = computeExpectationProgress([contribution()]);
    expect(one.senior.met).toBe(true);
    expect(one.senior.exceeded).toBe(false);
    expect(one.senior.percent).toBe(50);

    const two = computeExpectationProgress([
      contribution(),
      contribution({ category: "INSTRUCTOR_MENTOR" }),
    ]);
    expect(two.senior.met).toBe(true);
    expect(two.senior.exceeded).toBe(true);
    expect(two.senior.percent).toBe(100);
  });

  it("ignores light-weight and suggested contributions", () => {
    const progress = computeExpectationProgress([
      contribution({ weight: 1 }),
      contribution({ status: "SUGGESTED" }),
    ]);
    expect(progress.senior.met).toBe(false);
    expect(progress.standing).toBe("BELOW_EXPECTATIONS");
  });
});

describe("Lead Instructor expectation progress", () => {
  it("requires both 2 meaningful contributions and 1 ownership role", () => {
    // Two meaningful but no ownership → not met.
    const noOwnership = computeExpectationProgress([
      contribution(),
      contribution({ category: "CURRICULUM_REVIEWER" }),
    ]);
    expect(noOwnership.lead.met).toBe(false);

    // One ownership only → not met (needs 2 meaningful total).
    const oneOwnership = computeExpectationProgress([
      contribution({ category: "INSTRUCTION_COMMITTEE", weight: 3, isOwnership: true }),
    ]);
    expect(oneOwnership.lead.met).toBe(false);

    // Two meaningful incl. one ownership → met.
    const met = computeExpectationProgress([
      contribution(),
      contribution({ category: "INSTRUCTION_COMMITTEE", weight: 3, isOwnership: true }),
    ]);
    expect(met.lead.met).toBe(true);
    expect(met.lead.exceeded).toBe(false);
    expect(met.standing).toBe("LEAD_READY");
  });

  it("is exceeded at three meaningful contributions with ownership", () => {
    const progress = computeExpectationProgress([
      contribution(),
      contribution({ category: "INTERVIEWER" }),
      contribution({ category: "PARTNER_RELATIONSHIP_LEAD", weight: 3, isOwnership: true }),
    ]);
    expect(progress.lead.met).toBe(true);
    expect(progress.lead.exceeded).toBe(true);
    expect(progress.lead.percent).toBe(100);
  });

  it("counts completed contributions toward both levels", () => {
    const progress = computeExpectationProgress([
      contribution({ status: "COMPLETED" }),
      contribution({ category: "CURRICULUM_LEAD", status: "COMPLETED", weight: 3, isOwnership: true }),
    ]);
    expect(progress.senior.met).toBe(true);
    expect(progress.lead.met).toBe(true);
    expect(progress.completedCount).toBe(2);
  });

  it("reports SENIOR_READY when senior is met but lead is not", () => {
    const progress = computeExpectationProgress([contribution()]);
    expect(progress.standing).toBe("SENIOR_READY");
  });
});

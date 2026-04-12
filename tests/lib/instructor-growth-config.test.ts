import { describe, expect, it } from "vitest";

import {
  deriveSemesterLabel,
  getInstructorGrowthTier,
  getInstructorGrowthTierForXp,
  getNextInstructorGrowthTier,
  isStrongParentFeedback,
} from "@/lib/instructor-growth-config";

describe("instructor growth config", () => {
  it("resolves tier thresholds across the seven-tier ladder", () => {
    expect(getInstructorGrowthTierForXp(0).key).toBe("SPARK");
    expect(getInstructorGrowthTierForXp(300).key).toBe("PRACTITIONER");
    expect(getInstructorGrowthTierForXp(800).key).toBe("CATALYST");
    expect(getInstructorGrowthTierForXp(1600).key).toBe("PATHMAKER");
    expect(getInstructorGrowthTierForXp(2800).key).toBe("LEADER");
    expect(getInstructorGrowthTierForXp(4500).key).toBe("LUMINARY");
    expect(getInstructorGrowthTierForXp(7000).key).toBe("FELLOW");
  });

  it("finds the next tier cleanly from a current XP total", () => {
    expect(getNextInstructorGrowthTier(0)?.key).toBe("PRACTITIONER");
    expect(getNextInstructorGrowthTier(1599)?.key).toBe("PATHMAKER");
    expect(getNextInstructorGrowthTier(7000)).toBeNull();
  });

  it("falls back to Spark when a stored tier key is missing", () => {
    expect(getInstructorGrowthTier(null).key).toBe("SPARK");
    expect(getInstructorGrowthTier("NOT_A_REAL_TIER").key).toBe("SPARK");
  });

  it("derives semester labels from the event date", () => {
    expect(deriveSemesterLabel(new Date("2026-02-15T12:00:00Z"))).toBe("Spring 2026");
    expect(deriveSemesterLabel(new Date("2026-07-04T12:00:00Z"))).toBe("Summer 2026");
    expect(deriveSemesterLabel(new Date("2026-10-01T12:00:00Z"))).toBe("Fall 2026");
  });

  it("treats strong parent feedback as either excellent ratings or recommend-backed solid ratings", () => {
    expect(isStrongParentFeedback({ rating: 5, wouldRecommend: false })).toBe(true);
    expect(isStrongParentFeedback({ rating: 4, wouldRecommend: true })).toBe(true);
    expect(isStrongParentFeedback({ rating: 4, wouldRecommend: false })).toBe(false);
    expect(isStrongParentFeedback({ rating: 3, wouldRecommend: true })).toBe(false);
  });
});

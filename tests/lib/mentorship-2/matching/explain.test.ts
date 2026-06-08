import { describe, expect, it } from "vitest";

import {
  explainRecommendation,
  matchTierLabel,
  recommendationRisks,
  recommendationStrengths,
  scoreTier,
} from "@/lib/mentorship-2/matching/explain";
import { scoreMentor } from "@/lib/mentorship-2/matching/score";
import type {
  ApplicationInput,
  ScoredCandidate,
} from "@/lib/mentorship-2/matching/types";

const APP: ApplicationInput = {
  requestedExpertiseSlugs: ["leadership"],
  interests: [],
  goalText: "leadership growth",
  availability: null,
};

// A mentor that matches the requested expertise but already carries load and has
// an undeclared capacity — so the explanation should cite both a strength and a risk.
const SCORED = scoreMentor(APP, {
  userId: "m1",
  name: "Dana Mentor",
  expertise: [
    { slug: "leadership", name: "Leadership", category: "Life", proficiencyWeight: 3 },
  ],
  capacity: null,
  activeLoad: 2,
  availability: null,
});

describe("scoreTier / matchTierLabel", () => {
  it("buckets scores into tiers", () => {
    expect(scoreTier(80)).toBe("strong");
    expect(scoreTier(50)).toBe("solid");
    expect(scoreTier(30)).toBe("possible");
    expect(scoreTier(10)).toBe("weak");
    expect(matchTierLabel(80)).toBe("Strong match");
  });
});

describe("recommendationStrengths", () => {
  it("names the matched expertise areas", () => {
    const strengths = recommendationStrengths(SCORED);
    expect(strengths.some((s) => s.includes("Leadership"))).toBe(true);
  });
});

describe("recommendationRisks", () => {
  it("flags existing load and an incomplete profile", () => {
    const risks = recommendationRisks(SCORED);
    expect(risks.some((r) => r.includes("already mentoring 2"))).toBe(true);
    expect(risks.some((r) => r.includes("incomplete profile"))).toBe(true);
  });
});

describe("explainRecommendation", () => {
  it("produces prose mentioning the matched expertise and the load caveat", () => {
    const prose = explainRecommendation(SCORED, { mentorName: "Dana Mentor" });
    expect(prose).toContain("Dana Mentor");
    expect(prose).toContain("Leadership");
    expect(prose.toLowerCase()).toContain("mentoring");
    expect(prose).toContain(String(SCORED.score));
  });

  it("is safe on an empty/zero breakdown and never throws", () => {
    const empty = {
      mentorUserId: "x",
      score: 0,
      matchedExpertise: [],
      openSlots: 0,
    } as unknown as ScoredCandidate;
    expect(() => explainRecommendation(empty)).not.toThrow();
    expect(typeof explainRecommendation(empty)).toBe("string");
    expect(recommendationStrengths(empty)).toEqual([]);
    expect(Array.isArray(recommendationRisks(empty))).toBe(true);
  });
});

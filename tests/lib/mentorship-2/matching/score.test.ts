import { describe, expect, it } from "vitest";

import { MATCH_WEIGHTS, scoreMentor, tokenize } from "@/lib/mentorship-2/matching/score";
import type {
  ApplicationInput,
  MentorCandidate,
  MentorExpertiseInput,
} from "@/lib/mentorship-2/matching/types";

// ---- builders -------------------------------------------------------------

function xp(
  slug: string,
  proficiencyWeight = 3,
  name?: string,
  category?: string
): MentorExpertiseInput {
  return { slug, name: name ?? slug, category: category ?? null, proficiencyWeight };
}

function mentor(overrides: Partial<MentorCandidate> = {}): MentorCandidate {
  return {
    userId: "m1",
    name: "Mentor One",
    expertise: [],
    capacity: 3,
    activeLoad: 0,
    availability: null,
    ...overrides,
  };
}

function application(overrides: Partial<ApplicationInput> = {}): ApplicationInput {
  return {
    requestedExpertiseSlugs: [],
    interests: [],
    goalText: "",
    availability: null,
    ...overrides,
  };
}

const PERFECT_APP = application({
  requestedExpertiseSlugs: ["leadership", "entrepreneurship"],
  goalText: "I want to grow leadership and entrepreneurship skills",
  availability: "weekday evenings",
});

const PERFECT_MENTOR = mentor({
  expertise: [
    xp("leadership", 3, "Leadership"),
    xp("entrepreneurship", 3, "Entrepreneurship"),
  ],
  capacity: 4,
  activeLoad: 0,
  availability: "weekday evenings and weekends",
});

describe("scoreMentor — perfect match", () => {
  it("scores high and saturates the positive factors", () => {
    const r = scoreMentor(PERFECT_APP, PERFECT_MENTOR);
    expect(r.score).toBeGreaterThanOrEqual(90);
    expect(r.breakdown.finalScore).toBe(r.score);
    expect(r.breakdown.expertiseOverlap).toBe(MATCH_WEIGHTS.expertiseOverlap); // 40
    expect(r.breakdown.confidence).toBe(MATCH_WEIGHTS.confidence); // 15
    expect(r.breakdown.capacity).toBe(MATCH_WEIGHTS.capacity); // 20
    expect(r.breakdown.loadPenalty).toBe(0);
    expect(r.breakdown.completenessPenalty).toBe(0);
    expect(r.matchedExpertise.map((e) => e.slug)).toEqual([
      "leadership",
      "entrepreneurship",
    ]);
  });
});

describe("scoreMentor — expertise", () => {
  it("scores a mentor with no expertise far lower than a matching mentor", () => {
    const matching = scoreMentor(PERFECT_APP, PERFECT_MENTOR);
    const noExpertise = scoreMentor(
      PERFECT_APP,
      mentor({ expertise: [], capacity: 4, activeLoad: 0 })
    );
    expect(noExpertise.breakdown.expertiseOverlap).toBe(0);
    expect(noExpertise.breakdown.confidence).toBe(0);
    expect(noExpertise.score).toBeLessThan(matching.score);
  });

  it("partial overlap scales linearly with the fraction of requested areas covered", () => {
    const half = scoreMentor(
      PERFECT_APP,
      mentor({ expertise: [xp("leadership", 3, "Leadership")], capacity: 4 })
    );
    // 1 of 2 requested areas covered → 50% of 40.
    expect(half.breakdown.expertiseOverlap).toBe(MATCH_WEIGHTS.expertiseOverlap / 2);
  });
});

describe("scoreMentor — confidence", () => {
  it("an EXPERT mentor scores higher than a FAMILIAR one, all else equal", () => {
    const base = { capacity: 4, activeLoad: 0, availability: null };
    const expert = scoreMentor(
      application({ requestedExpertiseSlugs: ["leadership"] }),
      mentor({ ...base, expertise: [xp("leadership", 3, "Leadership")] })
    );
    const familiar = scoreMentor(
      application({ requestedExpertiseSlugs: ["leadership"] }),
      mentor({ ...base, expertise: [xp("leadership", 1, "Leadership")] })
    );
    expect(expert.breakdown.confidence).toBe(MATCH_WEIGHTS.confidence);
    expect(familiar.breakdown.confidence).toBe(0);
    expect(expert.score).toBeGreaterThan(familiar.score);
  });
});

describe("scoreMentor — capacity & load", () => {
  it("more open capacity yields a higher capacity contribution", () => {
    const app = application({ requestedExpertiseSlugs: ["leadership"] });
    const wideOpen = scoreMentor(
      app,
      mentor({ expertise: [xp("leadership")], capacity: 4, activeLoad: 0 })
    );
    const nearlyFull = scoreMentor(
      app,
      mentor({ expertise: [xp("leadership")], capacity: 1, activeLoad: 0 })
    );
    expect(wideOpen.breakdown.capacity).toBeGreaterThan(nearlyFull.breakdown.capacity);
    expect(wideOpen.score).toBeGreaterThan(nearlyFull.score);
  });

  it("penalizes an overloaded mentor", () => {
    const app = application({ requestedExpertiseSlugs: ["leadership"] });
    const healthy = scoreMentor(
      app,
      mentor({ expertise: [xp("leadership")], capacity: 2, activeLoad: 0 })
    );
    const overloaded = scoreMentor(
      app,
      mentor({ expertise: [xp("leadership")], capacity: 2, activeLoad: 5 })
    );
    expect(overloaded.breakdown.loadPenalty).toBeLessThan(0);
    expect(overloaded.breakdown.capacity).toBe(0);
    expect(overloaded.score).toBeLessThan(healthy.score);
  });

  it("treats an undeclared capacity with existing load as overload (matches the doc example)", () => {
    const r = scoreMentor(
      application({ requestedExpertiseSlugs: ["leadership"] }),
      mentor({
        expertise: [xp("leadership", 3, "Leadership")],
        capacity: null,
        activeLoad: 2,
        availability: "weekday evenings",
      })
    );
    expect(r.breakdown.capacity).toBe(0);
    expect(r.breakdown.loadPenalty).toBe(-10); // 2 mentees over a 0 effective capacity
    expect(r.breakdown.completenessPenalty).toBe(-5); // only capacity missing
  });
});

describe("scoreMentor — goal alignment", () => {
  it("rewards goal text that overlaps the mentor's expertise vocabulary", () => {
    const m = mentor({
      expertise: [xp("robotics-engineering", 2, "Robotics & Engineering", "STEM")],
      capacity: 3,
    });
    const aligned = scoreMentor(
      application({
        requestedExpertiseSlugs: ["robotics-engineering"],
        goalText: "I love robotics and engineering competitions",
      }),
      m
    );
    const noGoals = scoreMentor(
      application({ requestedExpertiseSlugs: ["robotics-engineering"], goalText: "" }),
      m
    );
    expect(aligned.breakdown.goalAlignment).toBeGreaterThan(0);
    expect(noGoals.breakdown.goalAlignment).toBe(0);
    expect(aligned.score).toBeGreaterThan(noGoals.score);
  });
});

describe("scoreMentor — completeness penalty", () => {
  it("docks each missing mentor signal", () => {
    const thin = scoreMentor(
      application({ requestedExpertiseSlugs: ["leadership"] }),
      mentor({ expertise: [], capacity: null, availability: null })
    );
    // expertise missing + capacity missing + availability missing = 3 gaps, floored at -15.
    expect(thin.breakdown.completenessPenalty).toBe(MATCH_WEIGHTS.completenessPenaltyFloor);
  });
});

describe("scoreMentor — bounds & robustness", () => {
  it("always clamps the final score into [0, 100]", () => {
    const overloadedThin = scoreMentor(
      application({ requestedExpertiseSlugs: ["leadership"] }),
      mentor({ expertise: [], capacity: 1, activeLoad: 9, availability: null })
    );
    expect(overloadedThin.score).toBeGreaterThanOrEqual(0);
    expect(PERFECT_MENTOR && scoreMentor(PERFECT_APP, PERFECT_MENTOR).score).toBeLessThanOrEqual(100);
  });

  it("does not crash on an incomplete application", () => {
    // Intentionally partial inputs — the scorer must degrade, not throw.
    const r = scoreMentor({} as ApplicationInput, mentor({ expertise: [xp("leadership")] }));
    expect(typeof r.score).toBe("number");
    expect(r.score).toBeGreaterThanOrEqual(0);
  });

  it("is deterministic — same inputs, same score", () => {
    const a = scoreMentor(PERFECT_APP, PERFECT_MENTOR);
    const b = scoreMentor(PERFECT_APP, PERFECT_MENTOR);
    expect(a.breakdown).toEqual(b.breakdown);
  });
});

describe("tokenize", () => {
  it("lowercases, strips punctuation, and drops short/stopwords", () => {
    expect(tokenize("Leadership & Entrepreneurship!")).toEqual([
      "leadership",
      "entrepreneurship",
    ]);
    expect(tokenize("I want to be a CS mentor")).toEqual(["mentor"]);
    expect(tokenize(null)).toEqual([]);
  });
});

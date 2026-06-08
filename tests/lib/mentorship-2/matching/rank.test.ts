import { describe, expect, it } from "vitest";

import {
  compareScored,
  hasUsableMatch,
  rankMentors,
  topRecommendations,
  RECOMMENDATION_MIN_USEFUL_SCORE,
} from "@/lib/mentorship-2/matching/rank";
import { scoreMentor } from "@/lib/mentorship-2/matching/score";
import type {
  ApplicationInput,
  MentorCandidate,
  MentorExpertiseInput,
} from "@/lib/mentorship-2/matching/types";

function xp(slug: string, proficiencyWeight = 3, name?: string): MentorExpertiseInput {
  return { slug, name: name ?? slug, category: null, proficiencyWeight };
}

function mentor(overrides: Partial<MentorCandidate> = {}): MentorCandidate {
  return {
    userId: "m",
    name: "Mentor",
    expertise: [],
    capacity: 3,
    activeLoad: 0,
    availability: null,
    ...overrides,
  };
}

const APP = {
  requestedExpertiseSlugs: ["leadership"],
  interests: [],
  goalText: "leadership growth",
  availability: "weekday evenings",
} satisfies ApplicationInput;

describe("rankMentors", () => {
  it("ranks the strongest match first", () => {
    const perfect = mentor({
      userId: "perfect",
      expertise: [xp("leadership", 3, "Leadership")],
      capacity: 4,
      activeLoad: 0,
      availability: "weekday evenings",
    });
    const weak = mentor({ userId: "weak", expertise: [], capacity: null, availability: null });
    const mid = mentor({
      userId: "mid",
      expertise: [xp("leadership", 1, "Leadership")],
      capacity: 1,
      activeLoad: 0,
    });

    const ranked = rankMentors(APP, [weak, mid, perfect]);
    expect(ranked.map((r) => r.mentorUserId)).toEqual(["perfect", "mid", "weak"]);
  });

  it("ranks an overloaded mentor below an otherwise-identical healthy one", () => {
    const healthy = mentor({
      userId: "healthy",
      expertise: [xp("leadership", 3, "Leadership")],
      capacity: 3,
      activeLoad: 0,
    });
    const overloaded = mentor({
      userId: "overloaded",
      expertise: [xp("leadership", 3, "Leadership")],
      capacity: 3,
      activeLoad: 6,
    });
    const ranked = rankMentors(APP, [overloaded, healthy]);
    expect(ranked[0].mentorUserId).toBe("healthy");
    expect(ranked[1].mentorUserId).toBe("overloaded");
  });

  it("breaks ties stably and independently of input order", () => {
    // Identical scoring inputs ⇒ identical score & openSlots ⇒ tiebreak by userId.
    const common = {
      expertise: [xp("leadership", 3, "Leadership")],
      capacity: 3,
      activeLoad: 0,
      availability: "weekday evenings",
    };
    const alpha = mentor({ userId: "alpha", ...common });
    const beta = mentor({ userId: "beta", ...common });

    const forward = rankMentors(APP, [alpha, beta]).map((r) => r.mentorUserId);
    const reversed = rankMentors(APP, [beta, alpha]).map((r) => r.mentorUserId);

    expect(forward).toEqual(["alpha", "beta"]);
    expect(reversed).toEqual(["alpha", "beta"]); // stable regardless of input order
  });

  it("returns an empty array for an empty mentor pool", () => {
    expect(rankMentors(APP, [])).toEqual([]);
    expect(topRecommendations(APP, [])).toEqual([]);
  });

  it("does not crash on an incomplete application", () => {
    const ranked = rankMentors({} as ApplicationInput, [mentor({ expertise: [xp("leadership")] })]);
    expect(ranked).toHaveLength(1);
    expect(typeof ranked[0].score).toBe("number");
  });

  it("topRecommendations caps the result length", () => {
    const pool = Array.from({ length: 8 }, (_, i) =>
      mentor({ userId: `m${i}`, expertise: [xp("leadership")], capacity: 3 })
    );
    expect(topRecommendations(APP, pool, 3)).toHaveLength(3);
  });
});

describe("compareScored", () => {
  it("orders by score, then open capacity, then userId", () => {
    const hi = scoreMentor(APP, mentor({ userId: "hi", expertise: [xp("leadership")], capacity: 4 }));
    const lo = scoreMentor(APP, mentor({ userId: "lo", expertise: [], capacity: null }));
    expect(compareScored(hi, lo)).toBeLessThan(0); // hi sorts before lo
    expect(compareScored(lo, hi)).toBeGreaterThan(0);
    expect(compareScored(hi, hi)).toBe(0);
  });
});

describe("hasUsableMatch", () => {
  it("is true only when a candidate clears the usable threshold", () => {
    const strong = rankMentors(APP, [
      mentor({ userId: "s", expertise: [xp("leadership", 3, "Leadership")], capacity: 4 }),
    ]);
    expect(strong[0].score).toBeGreaterThanOrEqual(RECOMMENDATION_MIN_USEFUL_SCORE);
    expect(hasUsableMatch(strong)).toBe(true);

    const onlyWeak = rankMentors(APP, [
      mentor({ userId: "w", expertise: [], capacity: null, activeLoad: 3, availability: null }),
    ]);
    expect(hasUsableMatch(onlyWeak)).toBe(false);
  });
});

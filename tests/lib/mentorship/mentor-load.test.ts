import { describe, expect, it } from "vitest";

import {
  EMPTY_DEVELOPMENT_FACTS,
  type DevelopmentPersonFacts,
} from "@/lib/development/signals";
import { buildMentorLoad } from "@/lib/mentorship/mentor-load";

function person(
  overrides: Partial<DevelopmentPersonFacts> = {}
): DevelopmentPersonFacts {
  return {
    ...EMPTY_DEVELOPMENT_FACTS,
    id: "user-1",
    name: "Maya Chen",
    email: "maya@ypp.org",
    role: "INSTRUCTOR",
    contextLabel: null,
    population: "instructor",
    ...overrides,
  };
}

describe("buildMentorLoad", () => {
  it("surfaces over-cap mentors first, then by mentee count", () => {
    const coverage = buildMentorLoad([
      person({ id: "a", name: "Ada", activeMenteeCount: 2, mentorCap: 3 }),
      person({ id: "b", name: "Ben", activeMenteeCount: 5, mentorCap: 3 }),
      person({ id: "c", name: "Cal", activeMenteeCount: 4, mentorCap: 3 }),
      person({ id: "d", name: "Dee" }), // not a mentor
    ]);
    expect(coverage.mentors.map((m) => m.userId)).toEqual(["b", "c", "a"]);
    expect(coverage.mentors[0].overCap).toBe(true);
    expect(coverage.overCapCount).toBe(2);
  });

  it("counts mentor coverage across the mentor-eligible population", () => {
    const coverage = buildMentorLoad([
      person({ id: "a", mentorEligible: true, mentorName: "Jordan" }),
      person({ id: "b", mentorEligible: true, mentorName: null }),
      person({ id: "c", mentorEligible: false, mentorName: null }),
    ]);
    expect(coverage.mentorEligibleCount).toBe(2);
    expect(coverage.coveredCount).toBe(1);
    expect(coverage.needsMentorCount).toBe(1);
  });
});

import { describe, expect, it } from "vitest";

import {
  EMPTY_DEVELOPMENT_FACTS,
  NEW_PERSON_DAYS,
  type DevelopmentPersonFacts,
} from "@/lib/development/signals";
import { resolveCohortFromFacts } from "@/lib/mentorship/cohort";

function person(
  overrides: Partial<DevelopmentPersonFacts> = {}
): DevelopmentPersonFacts {
  return {
    ...EMPTY_DEVELOPMENT_FACTS,
    id: "user-1",
    name: "Maya Chen",
    email: "maya@ypp.org",
    role: "INSTRUCTOR",
    contextLabel: "Instructor · Scarsdale",
    population: "instructor",
    mentorName: "Jordan Lee",
    mentorEligible: true,
    daysSinceLastCheckIn: 5,
    hasCurrentMonthCheckIn: true,
    ...overrides,
  };
}

describe("resolveCohortFromFacts — role groups", () => {
  const people = [
    person({ id: "new-1", daysSinceJoined: 10 }),
    person({ id: "new-2", daysSinceJoined: NEW_PERSON_DAYS }), // boundary: still new
    person({ id: "old-1", daysSinceJoined: NEW_PERSON_DAYS + 1 }),
    person({ id: "cp-1", role: "CHAPTER_PRESIDENT", population: "officer" }),
    person({ id: "staff-1", role: "STAFF", population: "officer" }),
  ];

  it("resolves all new instructors on the NEW_PERSON_DAYS boundary", () => {
    const cohort = resolveCohortFromFacts(
      { type: "role-group", group: "new-instructors" },
      people
    );
    expect(cohort.userIds.sort()).toEqual(["new-1", "new-2"]);
    expect(cohort.label).toBe("All new instructors");
  });

  it("resolves all instructors regardless of tenure", () => {
    const cohort = resolveCohortFromFacts(
      { type: "role-group", group: "instructors" },
      people
    );
    expect(cohort.userIds.sort()).toEqual(["new-1", "new-2", "old-1"]);
  });

  it("resolves chapter presidents by role and officers by population", () => {
    expect(
      resolveCohortFromFacts({ type: "role-group", group: "chapter-presidents" }, people)
        .userIds
    ).toEqual(["cp-1"]);
    expect(
      resolveCohortFromFacts({ type: "role-group", group: "officers" }, people).userIds.sort()
    ).toEqual(["cp-1", "staff-1"]);
  });

  it("returns an empty cohort when nobody matches", () => {
    const cohort = resolveCohortFromFacts(
      { type: "role-group", group: "chapter-presidents" },
      [person({ id: "a" })]
    );
    expect(cohort.userIds).toEqual([]);
  });
});

describe("resolveCohortFromFacts — lanes", () => {
  it("matches exactly the people whose primary lane is the requested one", () => {
    const people = [
      // review-due lane
      person({ id: "due-1", reviewDue: true, hasAnyReview: false }),
      // concern outranks review-due, so this person is NOT in the review-due lane
      person({
        id: "concern-1",
        reviewDue: true,
        growthTags: ["AT_RISK_OF_DISENGAGING"],
      }),
      // steady
      person({ id: "steady-1" }),
      // right lane, wrong population
      person({
        id: "officer-due",
        population: "officer",
        role: "STAFF",
        reviewDue: true,
        hasAnyReview: false,
      }),
    ];
    const cohort = resolveCohortFromFacts(
      { type: "lane", lane: "review-due", population: "instructor" },
      people
    );
    expect(cohort.userIds).toEqual(["due-1"]);
    expect(cohort.label).toBe("Review due — instructors");
  });
});

describe("resolveCohortFromFacts — custom & chapter", () => {
  it("dedupes and trims custom ids and labels the count", () => {
    const cohort = resolveCohortFromFacts(
      { type: "custom", userIds: ["a", "a", " b ", ""] },
      []
    );
    expect(cohort.userIds).toEqual(["a", "b"]);
  });

  it("uses the provided custom label when given", () => {
    const cohort = resolveCohortFromFacts(
      { type: "custom", userIds: ["a"], label: "Maya Chen" },
      []
    );
    expect(cohort.label).toBe("Maya Chen");
  });

  it("labels a chapter scope with the chapter name", () => {
    const cohort = resolveCohortFromFacts(
      { type: "chapter", chapterId: "ch-1", chapterName: "Scarsdale" },
      [person({ id: "a" }), person({ id: "a" })]
    );
    expect(cohort.userIds).toEqual(["a"]);
    expect(cohort.label).toBe("Scarsdale chapter");
  });
});

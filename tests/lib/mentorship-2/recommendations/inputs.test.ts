import { describe, expect, it } from "vitest";

import {
  buildApplicationInput,
  toMentorCandidate,
  type ApplicationLike,
  type MentorRowLike,
  type TaxonomyEntry,
} from "@/lib/mentorship-2/recommendations/inputs";

const TAXONOMY: TaxonomyEntry[] = [
  { slug: "leadership", name: "Leadership" },
  { slug: "robotics-engineering", name: "Robotics & Engineering" },
];

describe("buildApplicationInput", () => {
  it("unions preferred-expertise slugs with interests that map onto the taxonomy", () => {
    const app: ApplicationLike = {
      goals: "Grow as a leader",
      interests: ["Robotics & Engineering", "Cooking"],
      preferredExpertise: ["leadership"],
      availability: "weekends",
      applicant: {
        profile: {
          careerGoal: "Become an engineer",
          leadershipGoal: "Lead a club",
          grade: 11,
        },
      },
    };

    const input = buildApplicationInput(app, TAXONOMY);

    expect(input.requestedExpertiseSlugs.sort()).toEqual([
      "leadership",
      "robotics-engineering",
    ]);
    // "Cooking" has no taxonomy match and is dropped from the slug set.
    expect(input.requestedExpertiseSlugs).not.toContain("cooking");
    // goal text concatenates application goals + applicant career/leadership goals.
    expect(input.goalText).toBe("Grow as a leader Become an engineer Lead a club");
    expect(input.availability).toBe("weekends");
    expect(input.menteeGrade).toBe(11);
    // interests are preserved verbatim for goal alignment.
    expect(input.interests).toEqual(["Robotics & Engineering", "Cooking"]);
  });

  it("returns safe defaults for an empty application with no profile", () => {
    const app: ApplicationLike = {
      goals: null,
      interests: [],
      preferredExpertise: [],
      availability: null,
      applicant: null,
    };
    const input = buildApplicationInput(app, TAXONOMY);
    expect(input.requestedExpertiseSlugs).toEqual([]);
    expect(input.goalText).toBe("");
    expect(input.availability).toBeNull();
    expect(input.menteeGrade).toBeNull();
  });

  it("keeps an unknown preferred-expertise slug rather than dropping it", () => {
    const input = buildApplicationInput(
      {
        goals: null,
        interests: [],
        preferredExpertise: ["college-essays"],
        availability: null,
      },
      TAXONOMY
    );
    expect(input.requestedExpertiseSlugs).toEqual(["college-essays"]);
  });
});

describe("toMentorCandidate", () => {
  const row: MentorRowLike = {
    id: "m1",
    name: "Dana",
    profile: { mentorCapacity: 3, mentorAvailability: "weekday evenings" },
    mentorExpertise: [
      {
        proficiency: "EXPERT",
        expertiseArea: {
          slug: "leadership",
          name: "Leadership",
          category: "Life",
          isActive: true,
        },
      },
      {
        proficiency: null,
        expertiseArea: { slug: "retired", name: "Retired", isActive: false },
      },
    ],
  };

  it("maps profile, proficiency weights, and the supplied active load", () => {
    const candidate = toMentorCandidate(row, 2);
    expect(candidate.userId).toBe("m1");
    expect(candidate.capacity).toBe(3);
    expect(candidate.activeLoad).toBe(2);
    expect(candidate.availability).toBe("weekday evenings");
    // inactive expertise areas are filtered out.
    expect(candidate.expertise).toHaveLength(1);
    expect(candidate.expertise[0]).toMatchObject({
      slug: "leadership",
      name: "Leadership",
      proficiencyWeight: 3, // EXPERT
    });
  });

  it("treats a missing profile as null capacity/availability", () => {
    const candidate = toMentorCandidate(
      { id: "m2", name: null, profile: null, mentorExpertise: [] },
      0
    );
    expect(candidate.capacity).toBeNull();
    expect(candidate.availability).toBeNull();
    expect(candidate.expertise).toEqual([]);
  });
});

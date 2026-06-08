import { describe, expect, it } from "vitest";

import {
  mergeSignals,
  deriveProfileSignals,
  becomingSummary,
} from "@/lib/growth/profile";

describe("mergeSignals", () => {
  it("trims, drops empties, and de-dupes case-insensitively keeping first form", () => {
    expect(
      mergeSignals(["Robotics", "robotics ", ""], [" Debate", "Robotics"])
    ).toEqual(["Robotics", "Debate"]);
  });

  it("is safe with undefined lists", () => {
    expect(mergeSignals(undefined, ["a"], undefined)).toEqual(["a"]);
  });
});

describe("deriveProfileSignals", () => {
  it("derives interests from goals + application, merging existing additively", () => {
    const signals = deriveProfileSignals({
      careerGoal: "Become a product manager",
      leadershipGoal: "Run the robotics club",
      applicationInterests: ["Debate"],
      passions: ["Robotics"],
      impactInterests: ["STEM access"],
      existing: { careerInterests: ["Public speaking"] },
    });
    expect(signals.careerInterests).toContain("Public speaking"); // preserved
    expect(signals.careerInterests).toContain("Become a product manager");
    expect(signals.careerInterests).toContain("Debate");
    expect(signals.leadershipInterests).toContain("Run the robotics club");
    expect(signals.impactInterests).toContain("STEM access");
  });

  it("confidence areas come from earned categories; growth areas are the gaps", () => {
    const signals = deriveProfileSignals({
      earnedCategories: ["TEACHING", "MENTORSHIP"],
    });
    expect(signals.confidenceAreas).toContain("Teaching");
    expect(signals.confidenceAreas).toContain("Mentorship");
    // growth areas exclude earned dimensions and are capped
    expect(signals.growthAreas).not.toContain("Teaching");
    expect(signals.growthAreas.length).toBeLessThanOrEqual(3);
  });

  it("is deterministic", () => {
    const input = { careerGoal: "X", earnedCategories: ["IMPACT" as const] };
    expect(deriveProfileSignals(input)).toEqual(deriveProfileSignals(input));
  });
});

describe("becomingSummary", () => {
  it("composes a sentence from the student's own signals", () => {
    const line = becomingSummary({
      careerInterests: ["STEM education"],
      leadershipInterests: ["chapter building"],
      impactInterests: ["digital literacy"],
    });
    expect(line).toBe(
      "Growing toward STEM education, building leadership in chapter building, and creating impact through digital literacy."
    );
  });

  it("handles a single signal", () => {
    expect(
      becomingSummary({ careerInterests: ["teaching"], leadershipInterests: [], impactInterests: [] })
    ).toBe("Growing toward teaching.");
  });

  it("falls back gracefully with no signals", () => {
    expect(
      becomingSummary({ careerInterests: [], leadershipInterests: [], impactInterests: [] })
    ).toContain("Just getting started");
    expect(
      becomingSummary({
        careerInterests: [],
        leadershipInterests: [],
        impactInterests: [],
        completedExperiences: 3,
      })
    ).toContain("3 experiences");
  });
});

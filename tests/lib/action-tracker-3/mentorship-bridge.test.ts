import { describe, expect, it } from "vitest";

import {
  createMentorshipActionSeed,
  deriveInitialMentorshipGoals,
  suggestFirstMilestones,
} from "@/lib/action-tracker-3/mentorship-bridge";

describe("deriveInitialMentorshipGoals", () => {
  it("turns application goals + profile goals + interests into starter goals", () => {
    const goals = deriveInitialMentorshipGoals({
      goals: "Improve my public speaking and confidence. Then lead a workshop.",
      careerGoal: "Become a product manager",
      leadershipGoal: "Run my school's robotics club",
      interests: ["Debate", "Robotics"],
    });

    const sources = goals.map((g) => g.source);
    expect(sources).toContain("application-goal");
    expect(sources).toContain("career-goal");
    expect(sources).toContain("leadership-goal");
    expect(sources).toContain("interest");
    // The application-goal title is the shortened first clause.
    const appGoal = goals.find((g) => g.source === "application-goal");
    expect(appGoal?.title).toBe("Improve my public speaking and confidence");
    expect(appGoal?.description).toContain("public speaking");
    // capped at a sensible number.
    expect(goals.length).toBeLessThanOrEqual(4);
  });

  it("returns a safe default goal for an empty application", () => {
    const goals = deriveInitialMentorshipGoals({});
    expect(goals).toHaveLength(1);
    expect(goals[0].source).toBe("default");
  });

  it("truncates a very long goal into a capped title", () => {
    const long = "x".repeat(200);
    const [goal] = deriveInitialMentorshipGoals({ goals: long });
    expect(goal.title.length).toBeLessThanOrEqual(60);
    expect(goal.title.endsWith("…")).toBe(true);
    expect(goal.description).toBe(long);
  });
});

describe("suggestFirstMilestones", () => {
  it("adds an orientation milestone per mentor expertise area", () => {
    const milestones = suggestFirstMilestones({ goals: "grow" }, [
      { slug: "leadership", name: "Leadership" },
      { slug: "debate-speech", name: "Debate & Speech" },
    ]);

    const titles = milestones.map((m) => m.title);
    expect(titles).toContain("Complete your kickoff meeting");
    expect(titles).toContain("Get oriented in Leadership");
    expect(titles).toContain("Get oriented in Debate & Speech");
    // expertise-derived milestones carry their slug.
    expect(milestones.find((m) => m.title.includes("Leadership"))?.expertiseSlug).toBe(
      "leadership"
    );
  });

  it("expertise changes the suggested milestones vs an empty mentor", () => {
    const withExpertise = suggestFirstMilestones({}, [
      { slug: "music", name: "Music" },
    ]);
    const withoutExpertise = suggestFirstMilestones({}, []);

    expect(withExpertise.some((m) => m.expertiseSlug === "music")).toBe(true);
    expect(withoutExpertise.some((m) => m.expertiseSlug)).toBe(false);
    // empty mentor still returns a safe generic set.
    expect(withoutExpertise.map((m) => m.title)).toEqual([
      "Complete your kickoff meeting",
      "Set your first goal",
    ]);
  });

  it("ignores malformed expertise entries", () => {
    const milestones = suggestFirstMilestones({}, [
      { slug: "", name: "" },
      { slug: "music", name: "Music" },
    ]);
    expect(milestones.filter((m) => m.expertiseSlug)).toHaveLength(1);
  });
});

describe("createMentorshipActionSeed", () => {
  it("bundles goals, milestones, and first steps (and names the mentor)", () => {
    const seed = createMentorshipActionSeed({
      application: { goals: "Build a portfolio", interests: ["Visual Arts"] },
      mentorExpertise: [{ slug: "visual-arts", name: "Visual Arts" }],
      mentorName: "Dana Mentor",
    });

    expect(seed.goals.length).toBeGreaterThan(0);
    expect(seed.milestones.some((m) => m.expertiseSlug === "visual-arts")).toBe(true);
    expect(seed.firstSteps[0]).toContain("Dana Mentor");
  });

  it("returns safe defaults with no application data and no mentor", () => {
    const seed = createMentorshipActionSeed({
      application: {},
      mentorExpertise: [],
    });
    expect(seed.goals).toHaveLength(1);
    expect(seed.goals[0].source).toBe("default");
    expect(seed.milestones.length).toBeGreaterThan(0);
    expect(seed.firstSteps[0]).toContain("your mentor");
  });
});

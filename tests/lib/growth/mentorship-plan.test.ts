import { describe, expect, it } from "vitest";

import { createMentorshipActionSeed } from "@/lib/action-tracker-3/mentorship-bridge";
import { buildMentorshipGrowthPlan } from "@/lib/growth/mentorship-plan";

describe("buildMentorshipGrowthPlan — bridge -> hierarchy", () => {
  it("maps mentorship goals -> Goals, milestones -> Milestones, first steps -> Actions", () => {
    const seed = createMentorshipActionSeed({
      application: {
        goals: "Launch first STEM course",
        careerGoal: "Become a STEM educator",
        interests: ["Robotics"],
      },
      mentorExpertise: [{ slug: "robotics", name: "Robotics" }],
      mentorName: "Dana Mentor",
    });

    const plan = buildMentorshipGrowthPlan(seed, "m-123");

    // Each mentorship goal becomes a Growth goal.
    expect(plan.goals.length).toBe(seed.goals.length);
    // The primary goal carries the milestones + first-step actions.
    const primary = plan.goals[0];
    expect(primary.milestones.length).toBe(seed.milestones.length);
    expect(primary.actions.length).toBe(seed.firstSteps.length);
    expect(primary.milestones.some((m) => m.title.includes("kickoff"))).toBe(true);
    // Secondary goals stand alone (no children).
    for (const g of plan.goals.slice(1)) {
      expect(g.milestones).toHaveLength(0);
      expect(g.actions).toHaveLength(0);
    }
  });

  it("produces deterministic, idempotent sourceRefs keyed off the mentorship", () => {
    const seed = createMentorshipActionSeed({ application: {}, mentorExpertise: [] });
    const a = buildMentorshipGrowthPlan(seed, "m-9");
    const b = buildMentorshipGrowthPlan(seed, "m-9");
    expect(a).toEqual(b);
    expect(a.goals[0].sourceRef).toBe("mentorship:m-9:g0");
    // sourceRefs are unique within a plan.
    const refs = a.goals.flatMap((g) => [
      g.sourceRef,
      ...g.milestones.map((m) => m.sourceRef),
      ...g.actions.map((ac) => ac.sourceRef),
    ]);
    expect(new Set(refs).size).toBe(refs.length);
  });

  it("always yields at least one goal (bridge guarantees a default)", () => {
    const seed = createMentorshipActionSeed({ application: {}, mentorExpertise: [] });
    const plan = buildMentorshipGrowthPlan(seed, "m-1");
    expect(plan.goals.length).toBeGreaterThan(0);
  });
});

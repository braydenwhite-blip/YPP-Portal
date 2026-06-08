import { describe, expect, it } from "vitest";

import {
  computeOpportunities,
  type OpportunityInput,
} from "@/lib/growth/opportunities";
import { isOpportunityKind } from "@/lib/growth/constants";

function baseInput(overrides: Partial<OpportunityInput> = {}): OpportunityInput {
  return {
    eventCounts: {},
    profile: { careerInterests: [], leadershipInterests: [], impactInterests: [] },
    earnedAchievementKeys: [],
    hasActiveMentorship: false,
    openMentorshipActionTitles: [],
    stalledGoals: [],
    ...overrides,
  };
}

describe("opportunity engine — invariants", () => {
  it("every recommendation carries a non-empty WHY and a valid kind", () => {
    const opps = computeOpportunities(
      baseInput({
        profile: {
          careerInterests: ["product management"],
          leadershipInterests: [],
          impactInterests: ["climate"],
        },
        eventCounts: { CLASS_PUBLISHED: 1, CHAPTER_EVENT_HOSTED: 1 },
      })
    );
    expect(opps.length).toBeGreaterThan(0);
    for (const o of opps) {
      expect(o.reason.trim().length).toBeGreaterThan(0);
      expect(isOpportunityKind(o.kind)).toBe(true);
      expect(o.key).toBeTruthy();
    }
  });

  it("is deterministic — same input yields an identical list", () => {
    const i = baseInput({
      profile: { careerInterests: ["x"], leadershipInterests: ["y"], impactInterests: ["z"] },
      eventCounts: { CLASS_PUBLISHED: 1, CLASS_COMPLETED: 1, CHAPTER_EVENT_HOSTED: 2 },
    });
    expect(computeOpportunities(i)).toEqual(computeOpportunities(i));
  });

  it("sorts by score descending", () => {
    const opps = computeOpportunities(
      baseInput({
        hasActiveMentorship: true,
        openMentorshipActionTitles: ["Schedule kickoff"],
        eventCounts: { CLASS_PUBLISHED: 1, CHAPTER_EVENT_HOSTED: 1 },
      })
    );
    const scores = opps.map((o) => o.score);
    expect(scores).toEqual([...scores].sort((a, b) => b - a));
  });
});

describe("opportunity engine — rules fire with the right WHY", () => {
  it("apply_for_mentor: interests but no mentor", () => {
    const opps = computeOpportunities(
      baseInput({
        profile: {
          careerInterests: ["STEM education"],
          leadershipInterests: [],
          impactInterests: [],
        },
      })
    );
    const o = opps.find((x) => x.key === "apply_for_mentor");
    expect(o).toBeDefined();
    expect(o!.kind).toBe("MENTORSHIP_ACTION");
    expect(o!.reason).toContain("STEM education");
    expect(o!.reason.toLowerCase()).toContain("mentor");
  });

  it("advance_mentorship_action outranks everything and names the step", () => {
    const opps = computeOpportunities(
      baseInput({
        hasActiveMentorship: true,
        openMentorshipActionTitles: ["Draft your syllabus", "Build lesson 1"],
        profile: { careerInterests: ["teaching"], leadershipInterests: [], impactInterests: [] },
      })
    );
    expect(opps[0].key).toBe("advance_mentorship_action");
    expect(opps[0].reason).toContain("Draft your syllabus");
    // with an active mentorship, apply_for_mentor must NOT appear
    expect(opps.find((o) => o.key === "apply_for_mentor")).toBeUndefined();
  });

  it("complete_instructor_training fires only until trained", () => {
    const untrained = computeOpportunities(
      baseInput({ eventCounts: { CLASS_PUBLISHED: 1 } })
    );
    expect(untrained.find((o) => o.key === "complete_instructor_training")).toBeDefined();

    const trained = computeOpportunities(
      baseInput({
        eventCounts: { CLASS_PUBLISHED: 1 },
        earnedAchievementKeys: ["instructor_trained"],
      })
    );
    expect(trained.find((o) => o.key === "complete_instructor_training")).toBeUndefined();
  });

  it("run_for_chapter_role counts hosted events and stops once a leader", () => {
    const ready = computeOpportunities(
      baseInput({ eventCounts: { CHAPTER_EVENT_HOSTED: 2 } })
    );
    const o = ready.find((x) => x.key === "run_for_chapter_role");
    expect(o).toBeDefined();
    expect(o!.kind).toBe("LEADERSHIP_ROLE");
    expect(o!.reason).toContain("2 events");

    const alreadyLeader = computeOpportunities(
      baseInput({
        eventCounts: { CHAPTER_EVENT_HOSTED: 2 },
        earnedAchievementKeys: ["emerging_leader"],
      })
    );
    expect(alreadyLeader.find((x) => x.key === "run_for_chapter_role")).toBeUndefined();
  });

  it("start_a_project fires from impact interests when no project exists", () => {
    const o = computeOpportunities(
      baseInput({
        profile: { careerInterests: [], leadershipInterests: [], impactInterests: ["literacy"] },
      })
    ).find((x) => x.key === "start_a_project");
    expect(o).toBeDefined();
    expect(o!.kind).toBe("PROJECT");
    expect(o!.reason).toContain("literacy");
  });

  it("near_achievement surfaces an almost-complete badge with its percent", () => {
    // 4 / 5 recruits = 80% toward chapter_recruiter
    const o = computeOpportunities(
      baseInput({ eventCounts: { CHAPTER_MEMBER_RECRUITED: 4 } })
    ).find((x) => x.key === "near_chapter_recruiter");
    expect(o).toBeDefined();
    expect(o!.reason).toContain("80%");
    expect(o!.kind).toBe("CHAPTER_RESPONSIBILITY");
  });

  it("does not surface near_achievement once earned or far away", () => {
    const earnedAlready = computeOpportunities(
      baseInput({ eventCounts: { CHAPTER_MEMBER_RECRUITED: 5 } })
    );
    expect(earnedAlready.find((o) => o.key === "near_chapter_recruiter")).toBeUndefined();

    const farAway = computeOpportunities(
      baseInput({ eventCounts: { CHAPTER_MEMBER_RECRUITED: 1 } })
    ); // 20% < 60% threshold
    expect(farAway.find((o) => o.key === "near_chapter_recruiter")).toBeUndefined();
  });

  it("finish_stalled_goal nudges a past-due goal by track", () => {
    const o = computeOpportunities(
      baseInput({
        stalledGoals: [
          { id: "g1", title: "Launch first STEM course", ratio: 0.25, track: "INSTRUCTOR" },
        ],
      })
    ).find((x) => x.key === "finish_goal_g1");
    expect(o).toBeDefined();
    expect(o!.kind).toBe("INSTRUCTOR_MILESTONE");
    expect(o!.reason).toContain("Launch first STEM course");
    expect(o!.reason).toContain("25%");
  });
});

describe("opportunity engine — dismissal", () => {
  it("never re-suggests a dismissed key", () => {
    const opps = computeOpportunities(
      baseInput({
        profile: { careerInterests: ["x"], leadershipInterests: [], impactInterests: [] },
        dismissedKeys: ["apply_for_mentor"],
      })
    );
    expect(opps.find((o) => o.key === "apply_for_mentor")).toBeUndefined();
  });
});

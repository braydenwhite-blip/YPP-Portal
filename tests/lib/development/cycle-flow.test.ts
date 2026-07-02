import { describe, expect, it } from "vitest";

import {
  buildCycleSteps,
  deriveCycleDisplayState,
  deriveCycleNextStep,
  feedbackTopicsForType,
  isValidFeedbackTopic,
  type CycleFlowFacts,
} from "@/lib/development/cycle-flow";
import {
  canSubmitCycleFeedback,
  canSubmitSelfInput,
  isCycleManager,
  revieweeReleasedSummary,
} from "@/lib/development/cycle-access";

const NOW = new Date("2026-07-02T12:00:00Z");

function facts(overrides: Partial<CycleFlowFacts> = {}): CycleFlowFacts {
  return {
    state: "COLLECTING",
    dueDate: null,
    selfInputSubmittedAt: null,
    synthesisSubmittedAt: null,
    followUpDueAt: null,
    releasedToRevieweeAt: null,
    completedAt: null,
    feedbackRequested: 0,
    feedbackSubmitted: 0,
    ...overrides,
  };
}

describe("deriveCycleDisplayState", () => {
  it("is draft before input collection opens", () => {
    expect(deriveCycleDisplayState(facts({ state: "DRAFT" }), NOW)).toBe("draft");
  });

  it("waits on both when self-input and feedback are outstanding", () => {
    expect(
      deriveCycleDisplayState(facts({ feedbackRequested: 2 }), NOW)
    ).toBe("waiting-input");
  });

  it("waits on self-input only once all feedback replies are in", () => {
    expect(
      deriveCycleDisplayState(
        facts({ feedbackRequested: 2, feedbackSubmitted: 2 }),
        NOW
      )
    ).toBe("waiting-self-input");
  });

  it("waits on feedback only once the self-input is in", () => {
    expect(
      deriveCycleDisplayState(
        facts({
          selfInputSubmittedAt: NOW,
          feedbackRequested: 3,
          feedbackSubmitted: 1,
        }),
        NOW
      )
    ).toBe("waiting-feedback");
  });

  it("is ready for synthesis when self-input is in and no feedback is pending", () => {
    expect(
      deriveCycleDisplayState(
        facts({
          selfInputSubmittedAt: NOW,
          feedbackRequested: 2,
          feedbackSubmitted: 2,
        }),
        NOW
      )
    ).toBe("ready-for-synthesis");

    // No contributors asked at all also counts as nothing-being-waited-on.
    expect(
      deriveCycleDisplayState(facts({ selfInputSubmittedAt: NOW }), NOW)
    ).toBe("ready-for-synthesis");
  });

  it("needs an action plan after synthesis", () => {
    expect(deriveCycleDisplayState(facts({ state: "ACTION_PLAN" }), NOW)).toBe(
      "action-plan-needed"
    );
  });

  it("tracks scheduled vs overdue follow-ups", () => {
    const future = new Date("2026-07-10T12:00:00Z");
    const past = new Date("2026-06-20T12:00:00Z");
    expect(
      deriveCycleDisplayState(
        facts({ state: "FOLLOW_UP", followUpDueAt: future }),
        NOW
      )
    ).toBe("follow-up-scheduled");
    expect(
      deriveCycleDisplayState(
        facts({ state: "FOLLOW_UP", followUpDueAt: past }),
        NOW
      )
    ).toBe("follow-up-overdue");
  });

  it("is completed when closed", () => {
    expect(deriveCycleDisplayState(facts({ state: "COMPLETED" }), NOW)).toBe(
      "completed"
    );
  });
});

describe("deriveCycleNextStep", () => {
  it("puts the ball with the reviewee while self-input is missing", () => {
    const step = deriveCycleNextStep(
      facts({ feedbackRequested: 1, feedbackSubmitted: 1 }),
      NOW
    );
    expect(step.who).toBe("reviewee");
    expect(step.label).toBe("Waiting on the reviewee's self-reflection");
  });

  it("hands the reviewer the synthesis when everything is in", () => {
    const step = deriveCycleNextStep(
      facts({ selfInputSubmittedAt: NOW }),
      NOW
    );
    expect(step).toEqual({ label: "Write the synthesis", who: "reviewer" });
  });

  it("asks for the action plan after synthesis", () => {
    const step = deriveCycleNextStep(facts({ state: "ACTION_PLAN" }), NOW);
    expect(step.label).toBe("Create actions and schedule the follow-up");
  });
});

describe("buildCycleSteps", () => {
  it("marks the spine correctly mid-collection", () => {
    const steps = buildCycleSteps(
      facts({ feedbackRequested: 3, feedbackSubmitted: 1 }),
      NOW
    );
    const byKey = Object.fromEntries(steps.map((s) => [s.key, s]));
    expect(byKey.prepare.status).toBe("done");
    expect(byKey["collect-feedback"].status).toBe("current");
    expect(byKey["collect-feedback"].detail).toBe("1 of 3 replies in");
    expect(byKey["self-input"].status).toBe("current");
    expect(byKey.synthesis.status).toBe("todo");
  });

  it("marks synthesis current when ready and action plan current after it", () => {
    const ready = buildCycleSteps(facts({ selfInputSubmittedAt: NOW }), NOW);
    expect(ready.find((s) => s.key === "synthesis")?.status).toBe("current");

    const planning = buildCycleSteps(
      facts({ state: "ACTION_PLAN", synthesisSubmittedAt: NOW }),
      NOW
    );
    expect(planning.find((s) => s.key === "action-plan")?.status).toBe("current");
    expect(planning.find((s) => s.key === "synthesis")?.status).toBe("done");
  });

  it("completes every step when the cycle closes", () => {
    const steps = buildCycleSteps(
      facts({
        state: "COMPLETED",
        selfInputSubmittedAt: NOW,
        synthesisSubmittedAt: NOW,
        followUpDueAt: NOW,
      }),
      NOW
    );
    expect(steps.every((s) => s.status === "done")).toBe(true);
  });
});

describe("feedback topics", () => {
  it("keeps instructor and officer vocabularies distinct", () => {
    expect(isValidFeedbackTopic("INSTRUCTOR", "class-delivery")).toBe(true);
    expect(isValidFeedbackTopic("OFFICER", "class-delivery")).toBe(false);
    expect(isValidFeedbackTopic("OFFICER", "chapter-execution")).toBe(true);
    expect(feedbackTopicsForType("INSTRUCTOR").length).toBeGreaterThan(4);
  });
});

describe("cycle access", () => {
  const cycle = {
    revieweeId: "reviewee",
    reviewerId: "reviewer",
    createdById: "creator",
    state: "COLLECTING" as const,
    releasedToRevieweeAt: null,
  };

  it("managers are the reviewer, the creator, and leadership — nobody else", () => {
    expect(isCycleManager({ id: "reviewer", isLeadership: false }, cycle)).toBe(true);
    expect(isCycleManager({ id: "creator", isLeadership: false }, cycle)).toBe(true);
    expect(isCycleManager({ id: "anyone", isLeadership: true }, cycle)).toBe(true);
    expect(isCycleManager({ id: "reviewee", isLeadership: false }, cycle)).toBe(false);
    expect(isCycleManager({ id: "stranger", isLeadership: false }, cycle)).toBe(false);
  });

  it("only the reviewee may submit self-input, and only while collecting", () => {
    expect(canSubmitSelfInput("reviewee", cycle)).toBe(true);
    expect(canSubmitSelfInput("reviewer", cycle)).toBe(false);
    expect(
      canSubmitSelfInput("reviewee", { ...cycle, state: "ACTION_PLAN" })
    ).toBe(false);
  });

  it("only the named contributor may submit feedback, and only while collecting", () => {
    const feedback = { contributorId: "carol" };
    expect(canSubmitCycleFeedback("carol", feedback, "COLLECTING")).toBe(true);
    expect(canSubmitCycleFeedback("mallory", feedback, "COLLECTING")).toBe(false);
    expect(canSubmitCycleFeedback("carol", feedback, "COMPLETED")).toBe(false);
  });

  it("the released summary never carries concerns or coaching notes", () => {
    const released = revieweeReleasedSummary({
      revieweeId: "reviewee",
      releasedToRevieweeAt: NOW,
      strengths: "Clear communicator",
      growthAreas: "Delegation",
      recommendedNextStep: "Co-lead the fall training",
      followUpDueAt: null,
    });
    expect(released).not.toBeNull();
    expect(released && "concerns" in released).toBe(false);
    expect(released && "coachingNotes" in released).toBe(false);
    expect(released?.strengths).toBe("Clear communicator");
  });

  it("returns nothing to the reviewee before release", () => {
    expect(
      revieweeReleasedSummary({
        revieweeId: "reviewee",
        releasedToRevieweeAt: null,
        strengths: "x",
        growthAreas: "y",
        recommendedNextStep: "z",
        followUpDueAt: null,
      })
    ).toBeNull();
  });
});

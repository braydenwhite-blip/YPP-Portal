import { describe, expect, it } from "vitest";

import { nextActionForInstructorMentee } from "@/lib/instructor-mentee-next-action";

describe("nextActionForInstructorMentee", () => {
  it("tells unmatched instructors to wait for a mentor pairing", () => {
    const action = nextActionForInstructorMentee({
      hasMentor: false,
      cycleStage: null,
      kickoffCompletedAt: null,
      hasGoals: false,
      hasReleasedReview: false,
    });
    expect(action.label).toMatch(/wait for mentor/i);
    expect(action.href).toBeNull();
  });

  it("prompts kickoff when stage is KICKOFF_PENDING and not complete", () => {
    const action = nextActionForInstructorMentee({
      hasMentor: true,
      cycleStage: "KICKOFF_PENDING",
      kickoffCompletedAt: null,
      hasGoals: false,
      hasReleasedReview: false,
    });
    expect(action.label).toMatch(/kickoff/i);
    expect(action.href).toBe("/mentorship");
  });

  it("prompts reflection submit when stage is REFLECTION_DUE", () => {
    const action = nextActionForInstructorMentee({
      hasMentor: true,
      cycleStage: "REFLECTION_DUE",
      kickoffCompletedAt: new Date(),
      hasGoals: true,
      hasReleasedReview: false,
    });
    expect(action.label).toMatch(/reflection/i);
    expect(action.href).toBe("/my-program/reflect");
  });

  it("acknowledges submitted reflection awaiting mentor review", () => {
    const action = nextActionForInstructorMentee({
      hasMentor: true,
      cycleStage: "REFLECTION_SUBMITTED",
      kickoffCompletedAt: new Date(),
      hasGoals: true,
      hasReleasedReview: false,
    });
    expect(action.label).toMatch(/mentor is reviewing/i);
    expect(action.href).toBeNull();
  });

  it("asks for re-edits when changes are requested", () => {
    const action = nextActionForInstructorMentee({
      hasMentor: true,
      cycleStage: "CHANGES_REQUESTED",
      kickoffCompletedAt: new Date(),
      hasGoals: true,
      hasReleasedReview: false,
    });
    expect(action.label).toMatch(/changes requested/i);
    expect(action.href).toBe("/my-program/reflect");
  });

  it("calls out the released review after approval", () => {
    const action = nextActionForInstructorMentee({
      hasMentor: true,
      cycleStage: "APPROVED",
      kickoffCompletedAt: new Date(),
      hasGoals: true,
      hasReleasedReview: true,
    });
    expect(action.label).toMatch(/latest review/i);
  });

  it("falls back to goals-pending state when there are no goals yet", () => {
    const action = nextActionForInstructorMentee({
      hasMentor: true,
      cycleStage: null,
      kickoffCompletedAt: new Date(),
      hasGoals: false,
      hasReleasedReview: false,
    });
    expect(action.label).toMatch(/set this month's goals/i);
  });
});

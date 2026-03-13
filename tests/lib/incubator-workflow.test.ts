import { describe, expect, it } from "vitest";
import {
  buildLaunchSlug,
  canAdvancePhase,
  getDefaultMilestonesForCohort,
  getNextPendingMilestone,
  getPhaseProgress,
  INCUBATOR_PHASES,
} from "@/lib/incubator-workflow";

describe("incubator workflow helpers", () => {
  it("builds a stable public launch slug", () => {
    expect(buildLaunchSlug("My Big Launch!", "Ava Johnson")).toBe("my-big-launch-ava-johnson");
    expect(buildLaunchSlug("   ", null)).toBe("incubator-launch");
  });

  it("seeds a full cohort milestone set with explicit mentor flags", () => {
    const milestones = getDefaultMilestonesForCohort();

    expect(milestones.length).toBeGreaterThanOrEqual(INCUBATOR_PHASES.length);
    expect(milestones.every((milestone) => typeof milestone.requiresMentorApproval === "boolean")).toBe(true);
    expect(milestones.some((milestone) => milestone.requiresMentorApproval)).toBe(true);
  });

  it("only allows phase advancement when every required milestone is approved", () => {
    const phaseMilestones = [
      { phase: "IDEATION", status: "APPROVED", requiredForPhase: true },
      { phase: "IDEATION", status: "APPROVED", requiredForPhase: true },
      { phase: "IDEATION", status: "SUBMITTED", requiredForPhase: true },
      { phase: "PLANNING", status: "NOT_STARTED", requiredForPhase: true },
    ] as const;

    expect(canAdvancePhase("IDEATION", phaseMilestones)).toBe(false);
    expect(
      canAdvancePhase("IDEATION", [
        { phase: "IDEATION", status: "APPROVED", requiredForPhase: true },
        { phase: "IDEATION", status: "APPROVED", requiredForPhase: true },
      ])
    ).toBe(true);
  });

  it("finds the next pending milestone in cohort order", () => {
    const next = getNextPendingMilestone([
      { id: "3", phase: "BUILDING", status: "NOT_STARTED", order: 2 },
      { id: "1", phase: "IDEATION", status: "APPROVED", order: 1 },
      { id: "2", phase: "PLANNING", status: "SUBMITTED", order: 1 },
      { id: "4", phase: "BUILDING", status: "NOT_STARTED", order: 1 },
    ]);

    expect(next?.id).toBe("2");
  });

  it("calculates required milestone progress by phase", () => {
    const progress = getPhaseProgress("BUILDING", [
      { phase: "BUILDING", status: "APPROVED", requiredForPhase: true },
      { phase: "BUILDING", status: "SUBMITTED", requiredForPhase: true },
      { phase: "BUILDING", status: "NOT_STARTED", requiredForPhase: false },
      { phase: "IDEATION", status: "APPROVED", requiredForPhase: true },
    ]);

    expect(progress).toEqual({
      completed: 1,
      total: 2,
      percent: 50,
    });
  });
});

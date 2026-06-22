import { describe, expect, it } from "vitest";

import {
  cpMissingRequirements,
  cpNextAction,
  cpPipelineLaneId,
  cpStatusLabel,
  isAcceptedCPStatus,
} from "@/lib/chapter-president-lifecycle";

describe("chapter-president-lifecycle", () => {
  it("places CP applicants in the requested cockpit lanes", () => {
    expect(cpPipelineLaneId("SUBMITTED")).toBe("new_application");
    expect(cpPipelineLaneId("INITIAL_REVIEW")).toBe("initial_review");
    expect(cpPipelineLaneId("INTERVIEW_NEEDED")).toBe("interview");
    expect(cpPipelineLaneId("DECISION_NEEDED")).toBe("final_decision");
    expect(cpPipelineLaneId("ONBOARDING")).toBe("accepted_onboarding");
    expect(cpPipelineLaneId("DECLINED")).toBe("declined_archived");
  });

  it("keeps old CP statuses readable while the new flow rolls out", () => {
    expect(cpStatusLabel("UNDER_REVIEW")).toBe("Initial review");
    expect(cpStatusLabel("RECOMMENDATION_SUBMITTED")).toBe("Ready for decision");
    expect(cpStatusLabel("APPROVED")).toBe("Accepted");
    expect(cpStatusLabel("REJECTED")).toBe("Declined");
  });

  it("shows deterministic missing requirements for decision and onboarding", () => {
    expect(
      cpMissingRequirements({
        status: "DECISION_NEEDED",
        reviewerId: "reviewer-1",
      })
    ).toEqual(["Needs interview notes", "Needs final decision"]);

    expect(
      cpMissingRequirements({
        status: "ONBOARDING",
        reviewerId: "reviewer-1",
        decisionAt: new Date(),
        decisionMakerId: "leader-1",
      })
    ).toEqual([
      "Needs onboarding",
      "Needs linked person record",
      "Needs first chapter launch actions",
    ]);
  });

  it("returns clear next actions for the CP lifecycle", () => {
    expect(cpNextAction({ status: "SUBMITTED" })).toBe("Begin initial review");
    expect(
      cpNextAction({
        status: "INTERVIEW_SCHEDULED",
        reviewerId: "reviewer-1",
        interviewScheduledAt: new Date(),
      })
    ).toBe("Complete interview notes");
    expect(
      cpNextAction({
        status: "ACTIVE_CP",
        reviewerId: "reviewer-1",
        linkedPersonId: "user-1",
        starterActionsCreatedAt: new Date(),
        onboardingCompletedAt: new Date(),
      })
    ).toBe("Active Chapter President");
  });

  it("treats accepted and onboarding statuses as accepted CPs", () => {
    expect(isAcceptedCPStatus("ACCEPTED")).toBe(true);
    expect(isAcceptedCPStatus("ONBOARDING")).toBe(true);
    expect(isAcceptedCPStatus("ACTIVE_CP")).toBe(true);
    expect(isAcceptedCPStatus("DECLINED")).toBe(false);
  });
});

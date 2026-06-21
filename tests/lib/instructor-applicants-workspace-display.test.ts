import { describe, expect, it } from "vitest";

import {
  averageReviewScore,
  buildInterviewSteps,
  recommendedNextStep,
  sortWorkspaceApplicants,
  workspaceStageLabel,
} from "@/lib/instructor-applicants/workspace-display";

describe("workspace-display", () => {
  it("labels chair review as Final review", () => {
    expect(workspaceStageLabel("CHAIR_REVIEW")).toBe("Final review");
  });

  it("sorts applicants with more reviews first", () => {
    const sorted = sortWorkspaceApplicants([
      { status: "INTERVIEW_SCHEDULED", interviewReviews: [], createdAt: "2026-01-01" },
      { status: "CHAIR_REVIEW", interviewReviews: [{ id: "1" }, { id: "2" }], createdAt: "2026-02-01" },
    ]);
    expect(sorted[0].status).toBe("CHAIR_REVIEW");
  });

  it("computes average review score on five-star scale", () => {
    expect(
      averageReviewScore([
        { overallRating: "ON_TRACK" },
        { overallRating: "ABOVE_AND_BEYOND" },
      ])
    ).toBe(4.3);
  });

  it("recommends advance when consensus is accept", () => {
    const step = recommendedNextStep([
      { recommendation: "ACCEPT" },
      { recommendation: "ACCEPT" },
    ]);
    expect(step.label).toBe("Advance to offer");
    expect(step.tone).toBe("success");
  });

  it("builds interview timeline steps for chair review", () => {
    const steps = buildInterviewSteps({
      status: "CHAIR_REVIEW",
      interviewScheduledAt: "2026-04-14",
      submittedReviewCount: 3,
      assignmentCount: 3,
    });
    expect(steps.every((s) => s.state === "done")).toBe(true);
  });
});

import { describe, expect, it } from "vitest";

import {
  buildDecisionReadinessChecks,
  readinessPercentFromChecks,
  readinessSignalsFromChecks,
  readinessSummary,
} from "@/lib/applications/decision-readiness";

function baseRecord(
  overrides: Partial<Parameters<typeof buildDecisionReadinessChecks>[0]> = {}
) {
  return {
    status: "CHAIR_REVIEW",
    materialsReadyAtISO: "2026-05-01T00:00:00.000Z",
    materials: { courseOutline: true, firstClassPlan: true, workshopOutline: false, motivation: true },
    infoRequest: null,
    applicantResponse: null,
    reviewer: { id: "reviewer-1", name: "Casey Park" },
    applicationReviews: [
      {
        reviewerName: "Casey Park",
        isLeadReview: true,
        status: "SUBMITTED",
        nextStep: "MOVE_TO_INTERVIEW",
        summary: "Strong candidate.",
        submittedAtISO: "2026-05-02T00:00:00.000Z",
      },
    ],
    interviewReviews: [],
    interviewerAssignments: [
      { id: "a1", role: "LEAD", round: 1, interviewer: { id: "i1", name: "Alex Kim" } },
    ],
    ...overrides,
  };
}

describe("buildDecisionReadinessChecks", () => {
  const opts = { applicationId: "app-1" };

  it("links incomplete checks to the review and interview forms", () => {
    const checks = buildDecisionReadinessChecks(
      baseRecord({
        interviewReviews: [],
        applicationReviews: [
          {
            reviewerName: "Casey Park",
            isLeadReview: true,
            status: "DRAFT",
            nextStep: null,
            summary: "Draft notes",
            submittedAtISO: null,
          },
        ],
      }),
      opts
    );
    const interview = checks.find((c) => c.label === "Interview feedback");
    const initial = checks.find((c) => c.label === "Initial review");
    expect(interview?.done).toBe(false);
    expect(interview?.href).toBe("/applications/instructor/app-1/interview");
    expect(interview?.linkLabel).toBe("Open interview form");
    expect(initial?.done).toBe(false);
    expect(initial?.href).toBe("/applications/instructor/app-1#section-review");
    expect(initial?.linkLabel).toBe("Open review form");
  });

  it("marks interview complete when every assigned interviewer submitted", () => {
    const checks = buildDecisionReadinessChecks(
      baseRecord({
        interviewReviews: [
          {
            id: "r1",
            reviewerName: "Alex Kim",
            round: 1,
            status: "SUBMITTED",
            recommendation: "ACCEPT",
            overallRating: null,
            submittedAtISO: "2026-05-03T00:00:00.000Z",
          },
        ],
      })
    );
    expect(checks.find((c) => c.label === "Interview feedback")?.done).toBe(true);
    expect(readinessSummary(checks).headline).toBe("Ready for chair decision");
  });

  it("requires the lead review, not any draft review", () => {
    const checks = buildDecisionReadinessChecks(
      baseRecord({
        applicationReviews: [
          {
            reviewerName: "Casey Park",
            isLeadReview: true,
            status: "DRAFT",
            nextStep: null,
            summary: "Draft notes",
            submittedAtISO: null,
          },
        ],
      })
    );
    const initial = checks.find((c) => c.label === "Initial review");
    expect(initial?.done).toBe(false);
    expect(initial?.detail).toContain("form below");
  });

  it("omits interview feedback when no reviewer is assigned yet", () => {
    const checks = buildDecisionReadinessChecks(
      baseRecord({
        status: "UNDER_REVIEW",
        reviewer: null,
        interviewerAssignments: [],
        interviewReviews: [],
      })
    );
    expect(checks.some((c) => c.label === "Interview feedback")).toBe(false);
    expect(checks).toHaveLength(2);
  });

  it("shows interview feedback as soon as a reviewer is assigned", () => {
    const checks = buildDecisionReadinessChecks(
      baseRecord({
        status: "UNDER_REVIEW",
        interviewerAssignments: [],
        interviewReviews: [],
        applicationReviews: [],
      }),
      { applicationId: "app-1", inlineForms: true }
    );
    const interview = checks.find((c) => c.label === "Interview feedback");
    expect(interview).toBeDefined();
    expect(interview?.done).toBe(false);
    expect(interview?.href).toBe("#inline-interview-review");
    expect(interview?.detail).toContain("After the interview");
    expect(checks).toHaveLength(3);
  });

  it("shows info request only when one is open", () => {
    const checks = buildDecisionReadinessChecks(
      baseRecord({
        status: "INFO_REQUESTED",
        infoRequest: "Please send your transcript.",
        applicantResponse: null,
      })
    );
    expect(checks.some((c) => c.label === "Info request")).toBe(true);
  });

  it("maps checklist rows to legacy warning signals", () => {
    const checks = buildDecisionReadinessChecks(
      baseRecord({
        interviewReviews: [],
      })
    );
    const signals = readinessSignalsFromChecks(checks);
    expect(signals.hasMaterialsComplete).toBe(true);
    expect(signals.hasReviewerRecommendation).toBe(true);
    expect(signals.hasSubmittedInterviewReviews).toBe(false);
    expect(readinessPercentFromChecks(checks)).toBe(67);
    expect(readinessSummary(checks).headline).toBe("2 of 3 complete");
  });
});

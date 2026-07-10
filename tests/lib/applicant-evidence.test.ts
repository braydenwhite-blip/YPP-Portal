import { describe, expect, it } from "vitest";

import {
  averageCategoryScore,
  computeApplicantOverview,
  type EvidenceInitialReview,
  type EvidenceInterviewReview,
} from "@/lib/applicant-evidence";

function initial(overrides: Partial<EvidenceInitialReview> = {}): EvidenceInitialReview {
  return {
    reviewerId: "r1",
    reviewerName: "Reviewer One",
    isLead: false,
    reviewDate: null,
    nextStep: "MOVE_TO_INTERVIEW",
    overallRating: "ON_TRACK",
    summary: null,
    notes: null,
    concerns: null,
    categories: [],
    ...overrides,
  };
}

function interview(
  overrides: Partial<EvidenceInterviewReview> = {}
): EvidenceInterviewReview {
  return {
    reviewerId: "i1",
    reviewerName: "Interviewer One",
    round: 1,
    recommendation: "ACCEPT",
    overallRating: "ON_TRACK",
    revisionRequirements: null,
    applicantMessage: null,
    categories: [],
    ...overrides,
  };
}

describe("averageCategoryScore", () => {
  it("averages category ratings on a 0–3 scale", () => {
    const avg = averageCategoryScore([
      { categories: [{ category: "A", rating: "ON_TRACK", notes: null }] }, // 2
      { categories: [{ category: "B", rating: "GETTING_STARTED", notes: null }] }, // 1
    ]);
    expect(avg).toBe(1.5);
  });

  it("falls back to the overall rating when no categories are present", () => {
    const avg = averageCategoryScore([
      { overallRating: "ABOVE_AND_BEYOND", categories: [] }, // 3
    ]);
    expect(avg).toBe(3);
  });

  it("returns null when there is nothing to average", () => {
    expect(averageCategoryScore([])).toBeNull();
  });
});

describe("computeApplicantOverview", () => {
  it("counts reviews and computes grounded averages and delta", () => {
    const overview = computeApplicantOverview({
      initialReviews: [
        initial({ categories: [{ category: "A", rating: "GETTING_STARTED", notes: null }] }), // 1
      ],
      interviewReviews: [
        interview({ categories: [{ category: "A", rating: "ABOVE_AND_BEYOND", notes: null }] }), // 3
      ],
      assignedInterviewerCount: 1,
    });

    expect(overview.initialReviewCount).toBe(1);
    expect(overview.completedInterviewCount).toBe(1);
    expect(overview.initialAverage).toBe(1);
    expect(overview.interviewAverage).toBe(3);
    expect(overview.averageDelta).toBe(2);
    expect(overview.consensusStatements).toContain(
      "Interview average is 2.0 points higher than the initial review average"
    );
  });

  it("detects a split recommendation as disagreement", () => {
    const overview = computeApplicantOverview({
      initialReviews: [],
      interviewReviews: [
        interview({ reviewerId: "i1", recommendation: "ACCEPT" }),
        interview({ reviewerId: "i2", recommendation: "REJECT" }),
      ],
      assignedInterviewerCount: 2,
    });
    expect(overview.hasDisagreement).toBe(true);
    expect(overview.disagreementStatement).toMatch(/split/i);
  });

  it("flags missing live interview notes when assigned > submitted", () => {
    const overview = computeApplicantOverview({
      initialReviews: [initial()],
      interviewReviews: [interview()],
      assignedInterviewerCount: 2,
    });
    expect(overview.missingInterviewCount).toBe(1);
    expect(overview.missingInformation.join(" ")).toMatch(/not submitted live interview notes/);
  });

  it("surfaces a majority approval recommendation", () => {
    const overview = computeApplicantOverview({
      initialReviews: [],
      interviewReviews: [
        interview({ reviewerId: "i1", recommendation: "ACCEPT" }),
        interview({ reviewerId: "i2", recommendation: "ACCEPT_WITH_SUPPORT" }),
        interview({ reviewerId: "i3", recommendation: "HOLD" }),
      ],
      assignedInterviewerCount: 3,
    });
    expect(overview.majorityRecommendation).toBe("ACCEPT");
    expect(overview.consensusStatements).toContain("2 interviewers recommended approval");
  });
});

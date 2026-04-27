import { describe, expect, it } from "vitest";
import {
  computeReadinessSignals,
  readinessPercentage,
  readinessSignalLabel,
  type ReadinessSignals,
} from "@/lib/readiness-signals";

describe("computeReadinessSignals", () => {
  it("returns all-false when nothing is ready", () => {
    expect(
      computeReadinessSignals({
        interviewReviews: [],
        applicationReviews: [],
        materialsReadyAt: null,
        infoRequest: null,
      })
    ).toEqual({
      hasSubmittedInterviewReviews: false,
      hasMaterialsComplete: false,
      hasReviewerRecommendation: false,
      hasNoOpenInfoRequest: true, // null infoRequest means none open
    });
  });

  it("flags interviews submitted as soon as one review exists", () => {
    const result = computeReadinessSignals({
      interviewReviews: [{ id: "r1" }],
      applicationReviews: [],
      materialsReadyAt: null,
      infoRequest: null,
    });
    expect(result.hasSubmittedInterviewReviews).toBe(true);
  });

  it("flags reviewer recommendation only when summary or nextStep is non-empty", () => {
    expect(
      computeReadinessSignals({
        interviewReviews: [],
        applicationReviews: [{ summary: "", nextStep: "   " }],
        materialsReadyAt: null,
        infoRequest: null,
      }).hasReviewerRecommendation
    ).toBe(false);
    expect(
      computeReadinessSignals({
        interviewReviews: [],
        applicationReviews: [{ summary: "Strong candidate.", nextStep: null }],
        materialsReadyAt: null,
        infoRequest: null,
      }).hasReviewerRecommendation
    ).toBe(true);
    expect(
      computeReadinessSignals({
        interviewReviews: [],
        applicationReviews: [{ summary: null, nextStep: "Hire." }],
        materialsReadyAt: null,
        infoRequest: null,
      }).hasReviewerRecommendation
    ).toBe(true);
  });

  it("treats whitespace-only infoRequest as no open request", () => {
    const result = computeReadinessSignals({
      interviewReviews: [],
      applicationReviews: [],
      materialsReadyAt: null,
      infoRequest: "   ",
    });
    expect(result.hasNoOpenInfoRequest).toBe(true);
  });

  it("flags materials complete on a Date or ISO string", () => {
    expect(
      computeReadinessSignals({
        interviewReviews: [],
        applicationReviews: [],
        materialsReadyAt: new Date(),
        infoRequest: null,
      }).hasMaterialsComplete
    ).toBe(true);
    expect(
      computeReadinessSignals({
        interviewReviews: [],
        applicationReviews: [],
        materialsReadyAt: "2026-04-01T00:00:00Z",
        infoRequest: null,
      }).hasMaterialsComplete
    ).toBe(true);
  });
});

describe("readinessPercentage", () => {
  it("returns 0 when nothing is met", () => {
    const signals: ReadinessSignals = {
      hasSubmittedInterviewReviews: false,
      hasMaterialsComplete: false,
      hasReviewerRecommendation: false,
      hasNoOpenInfoRequest: false,
    };
    expect(readinessPercentage(signals)).toBe(0);
  });

  it("returns 100 when all four are met", () => {
    const signals: ReadinessSignals = {
      hasSubmittedInterviewReviews: true,
      hasMaterialsComplete: true,
      hasReviewerRecommendation: true,
      hasNoOpenInfoRequest: true,
    };
    expect(readinessPercentage(signals)).toBe(100);
  });

  it("rounds intermediate values", () => {
    const signals: ReadinessSignals = {
      hasSubmittedInterviewReviews: true,
      hasMaterialsComplete: false,
      hasReviewerRecommendation: true,
      hasNoOpenInfoRequest: false,
    };
    expect(readinessPercentage(signals)).toBe(50);
  });
});

describe("readinessSignalLabel", () => {
  it("returns title/complete/gap copy for each signal key", () => {
    for (const key of [
      "hasSubmittedInterviewReviews",
      "hasMaterialsComplete",
      "hasReviewerRecommendation",
      "hasNoOpenInfoRequest",
    ] as const) {
      const label = readinessSignalLabel(key);
      expect(label.title.length).toBeGreaterThan(0);
      expect(label.complete.length).toBeGreaterThan(0);
      expect(label.gap.length).toBeGreaterThan(0);
    }
  });
});

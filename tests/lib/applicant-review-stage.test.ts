import { describe, expect, it } from "vitest";

import {
  isInitialReviewStage,
  isInitialReviewLocked,
} from "@/lib/applicant-review-stage";

describe("applicant-review-stage", () => {
  it("allows editing only during the initial-review stage", () => {
    expect(isInitialReviewStage("SUBMITTED")).toBe(true);
    expect(isInitialReviewStage("UNDER_REVIEW")).toBe(true);
    expect(isInitialReviewStage("INFO_REQUESTED")).toBe(true);
  });

  it("locks once the applicant advances to interview or any later stage", () => {
    for (const status of [
      "PRE_APPROVED",
      "INTERVIEW_SCHEDULED",
      "INTERVIEW_COMPLETED",
      "CHAIR_REVIEW",
      "APPROVED",
      "REJECTED",
      "ON_HOLD",
      "WAITLISTED",
      "WITHDRAWN",
    ]) {
      expect(isInitialReviewStage(status)).toBe(false);
      expect(isInitialReviewLocked(status)).toBe(true);
    }
  });

  it("treats null/undefined as locked (fail closed)", () => {
    expect(isInitialReviewStage(null)).toBe(false);
    expect(isInitialReviewStage(undefined)).toBe(false);
    expect(isInitialReviewLocked(null)).toBe(true);
  });
});

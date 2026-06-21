import { describe, expect, it } from "vitest";

import {
  buildCheckInReadiness,
  summarizeCheckInGaps,
} from "@/lib/people-strategy/check-in-readiness";

describe("buildCheckInReadiness", () => {
  it("lists gaps for a missing month with no sources", () => {
    const r = buildCheckInReadiness({
      state: "missing",
      hasSelfReflection: false,
      hasMentorReview: false,
      goalRatingCount: 0,
      feedbackRequested: 0,
      feedbackReceived: 0,
      newFeedbackSinceCompile: false,
    });
    expect(r.missingLabels).toContain("Self-reflection not submitted");
    expect(r.missingLabels).toContain("No collaborator feedback requested");
    expect(r.missingLabels).toContain("Check-in not compiled");
    expect(r.actionHint).toMatch(/Request feedback/i);
  });

  it("flags pending feedback on a missing month", () => {
    const r = buildCheckInReadiness({
      state: "missing",
      hasSelfReflection: true,
      hasMentorReview: true,
      goalRatingCount: 2,
      feedbackRequested: 3,
      feedbackReceived: 1,
      newFeedbackSinceCompile: false,
    });
    expect(r.missingLabels.some((l) => l.includes("2 of 3"))).toBe(true);
    expect(r.actionHint).toMatch(/1 feedback response/);
  });

  it("suggests recompile when new feedback arrived after compile", () => {
    const r = buildCheckInReadiness({
      state: "rated",
      hasSelfReflection: true,
      hasMentorReview: true,
      goalRatingCount: 2,
      feedbackRequested: 2,
      feedbackReceived: 2,
      newFeedbackSinceCompile: true,
    });
    expect(r.suggestRecompile).toBe(true);
    expect(r.actionHint).toMatch(/recompile/i);
  });
});

describe("summarizeCheckInGaps", () => {
  it("returns null when everything is current", () => {
    expect(
      summarizeCheckInGaps([
        {
          state: "rated",
          readiness: buildCheckInReadiness({
            state: "rated",
            hasSelfReflection: true,
            hasMentorReview: true,
            goalRatingCount: 1,
            feedbackRequested: 1,
            feedbackReceived: 1,
            newFeedbackSinceCompile: false,
          }),
        },
      ])
    ).toBeNull();
  });

  it("summarizes missing and recompile counts", () => {
    const summary = summarizeCheckInGaps([
      {
        state: "missing",
        readiness: buildCheckInReadiness({
          state: "missing",
          hasSelfReflection: false,
          hasMentorReview: false,
          goalRatingCount: 0,
          feedbackRequested: 0,
          feedbackReceived: 0,
          newFeedbackSinceCompile: false,
        }),
      },
      {
        state: "rated",
        readiness: buildCheckInReadiness({
          state: "rated",
          hasSelfReflection: true,
          hasMentorReview: true,
          goalRatingCount: 1,
          feedbackRequested: 2,
          feedbackReceived: 2,
          newFeedbackSinceCompile: true,
        }),
      },
    ]);
    expect(summary).toMatch(/1 month not compiled/);
    expect(summary).toMatch(/new feedback/);
  });
});

import { describe, expect, it } from "vitest";

import {
  parseInterviewQuestionResponses,
  validateSubmittedQuestionResponses,
} from "@/lib/instructor-interview-live";

describe("instructor interview live response parsing", () => {
  it("parses live response state, score, tags, and custom metadata", () => {
    const parsed = parseInterviewQuestionResponses(
      JSON.stringify([
        {
          id: "response-1",
          questionBankId: "bank-1",
          source: "DEFAULT",
          status: "ASKED",
          prompt: "Why YPP?",
          followUpPrompt: "Why now?",
          competency: "Motivation & Fit",
          whyAsked: "Core motivation check",
          notes: "Student-centered answer.",
          rating: "ON_TRACK",
          tags: ["STRONG_ANSWER", "FOLLOW_UP_NEEDED", "STRONG_ANSWER"],
          askedAt: "2026-04-20T12:00:00.000Z",
          sortOrder: 0,
        },
      ])
    );

    expect(parsed).toMatchObject([
      {
        id: "response-1",
        questionBankId: "bank-1",
        source: "DEFAULT",
        status: "ASKED",
        prompt: "Why YPP?",
        followUpPrompt: "Why now?",
        competency: "Motivation & Fit",
        whyAsked: "Core motivation check",
        notes: "Student-centered answer.",
        rating: "ON_TRACK",
        tags: ["STRONG_ANSWER", "FOLLOW_UP_NEEDED"],
        sortOrder: 0,
      },
    ]);
    expect(parsed[0].askedAt?.toISOString()).toBe("2026-04-20T12:00:00.000Z");
  });

  it("requires notes and score only for questions marked asked", () => {
    const parsed = parseInterviewQuestionResponses(
      JSON.stringify([
        {
          source: "DEFAULT",
          status: "SKIPPED",
          prompt: "Skipped question",
          notes: "",
          rating: "",
        },
        {
          source: "DEFAULT",
          status: "ASKED",
          prompt: "Asked question",
          notes: "Clear example.",
          rating: "ABOVE_AND_BEYOND",
        },
      ])
    );

    expect(() => validateSubmittedQuestionResponses(parsed)).not.toThrow();
  });

  it("rejects asked questions without a live score", () => {
    const parsed = parseInterviewQuestionResponses(
      JSON.stringify([
        {
          source: "DEFAULT",
          status: "ASKED",
          prompt: "Asked question",
          notes: "Good answer, no score yet.",
          rating: "",
        },
      ])
    );

    expect(() => validateSubmittedQuestionResponses(parsed)).toThrow(
      "Every asked interview question must include a live score before submission."
    );
  });

  it("rejects invalid answer tags", () => {
    expect(() =>
      parseInterviewQuestionResponses(
        JSON.stringify([
          {
            source: "DEFAULT",
            status: "ASKED",
            prompt: "Question",
            tags: ["NOT_A_REAL_TAG"],
          },
        ])
      )
    ).toThrow("Invalid interview answer tag: NOT_A_REAL_TAG");
  });
});

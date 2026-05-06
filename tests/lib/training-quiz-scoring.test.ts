import { describe, it, expect } from "vitest";
import {
  computeQuizAttemptResult,
  parseQuizAnswers,
  QuizSubmissionError,
} from "@/lib/training-quiz-scoring";

const fourQuestions = [
  { id: "q1", correctAnswer: "A" },
  { id: "q2", correctAnswer: "B" },
  { id: "q3", correctAnswer: "C" },
  { id: "q4", correctAnswer: "D" },
];

// ---------------------------------------------------------------------------
// parseQuizAnswers — input validation
// ---------------------------------------------------------------------------

describe("parseQuizAnswers", () => {
  it("rejects null, undefined, and empty payloads as MISSING_ANSWERS", () => {
    for (const raw of [null, undefined, "", "   "]) {
      try {
        parseQuizAnswers(raw);
        throw new Error("expected throw");
      } catch (err) {
        expect(err).toBeInstanceOf(QuizSubmissionError);
        expect((err as QuizSubmissionError).code).toBe("MISSING_ANSWERS");
      }
    }
  });

  it("rejects non-JSON strings as MALFORMED_ANSWERS", () => {
    for (const raw of ["not-json", "{", "{q1:'A'}"]) {
      try {
        parseQuizAnswers(raw);
        throw new Error("expected throw");
      } catch (err) {
        expect(err).toBeInstanceOf(QuizSubmissionError);
        expect((err as QuizSubmissionError).code).toBe("MALFORMED_ANSWERS");
      }
    }
  });

  it("rejects non-object JSON payloads as MALFORMED_ANSWERS", () => {
    for (const raw of ["[]", '"a"', "123", "null", "true"]) {
      try {
        parseQuizAnswers(raw);
        throw new Error("expected throw");
      } catch (err) {
        expect(err).toBeInstanceOf(QuizSubmissionError);
        expect((err as QuizSubmissionError).code).toBe("MALFORMED_ANSWERS");
      }
    }
  });

  it("rejects payloads containing non-string values as MALFORMED_ANSWERS", () => {
    for (const payload of [
      { q1: 1 },
      { q1: null },
      { q1: true },
      { q1: ["A"] },
      { q1: { value: "A" } },
    ]) {
      try {
        parseQuizAnswers(JSON.stringify(payload));
        throw new Error("expected throw");
      } catch (err) {
        expect(err).toBeInstanceOf(QuizSubmissionError);
        expect((err as QuizSubmissionError).code).toBe("MALFORMED_ANSWERS");
      }
    }
  });

  it("returns a sanitized record for a valid payload", () => {
    const result = parseQuizAnswers(JSON.stringify({ q1: "A", q2: "B" }));
    expect(result).toEqual({ q1: "A", q2: "B" });
  });

  it("accepts an empty object payload (treated as no per-question answers)", () => {
    expect(parseQuizAnswers("{}")).toEqual({});
  });
});

// ---------------------------------------------------------------------------
// computeQuizAttemptResult — server-side scoring
// ---------------------------------------------------------------------------

describe("computeQuizAttemptResult", () => {
  it("scores all-correct as 100%", () => {
    const r = computeQuizAttemptResult(fourQuestions, {
      q1: "A",
      q2: "B",
      q3: "C",
      q4: "D",
    });
    expect(r.scorePct).toBe(100);
    expect(r.results.every((row) => row.correct)).toBe(true);
  });

  it("scores all-wrong as 0% regardless of any client-asserted score", () => {
    const r = computeQuizAttemptResult(fourQuestions, {
      q1: "WRONG",
      q2: "WRONG",
      q3: "WRONG",
      q4: "WRONG",
    });
    expect(r.scorePct).toBe(0);
    expect(r.results.every((row) => !row.correct)).toBe(true);
  });

  it("scores partial correctness purely from server-side comparison", () => {
    const r = computeQuizAttemptResult(fourQuestions, {
      q1: "A",
      q2: "B",
      q3: "WRONG",
      q4: "WRONG",
    });
    expect(r.scorePct).toBe(50);
  });

  it("treats a missing per-question answer as wrong, not as null pass", () => {
    const r = computeQuizAttemptResult(fourQuestions, { q1: "A" });
    expect(r.scorePct).toBe(25);
    const q4Row = r.results.find((row) => row.questionId === "q4");
    expect(q4Row?.userAnswer).toBeNull();
    expect(q4Row?.correct).toBe(false);
  });

  it("returns 0% with an empty questions array", () => {
    expect(computeQuizAttemptResult([], {}).scorePct).toBe(0);
  });

  it("rounds the score to the nearest integer", () => {
    const threeQuestions = [
      { id: "q1", correctAnswer: "A" },
      { id: "q2", correctAnswer: "B" },
      { id: "q3", correctAnswer: "C" },
    ];
    // 1/3 correct ≈ 33.33% → 33
    expect(
      computeQuizAttemptResult(threeQuestions, {
        q1: "A",
        q2: "WRONG",
        q3: "WRONG",
      }).scorePct
    ).toBe(33);
    // 2/3 correct ≈ 66.67% → 67
    expect(
      computeQuizAttemptResult(threeQuestions, {
        q1: "A",
        q2: "B",
        q3: "WRONG",
      }).scorePct
    ).toBe(67);
  });
});

// ---------------------------------------------------------------------------
// Anti-spoofing semantics — pass/fail is purely server-derived
// ---------------------------------------------------------------------------

describe("quiz pass/fail is computed server-side and cannot be spoofed", () => {
  it("a learner submitting all-wrong answers cannot reach the pass threshold", () => {
    const passScorePct = 80;
    const r = computeQuizAttemptResult(fourQuestions, {
      q1: "WRONG",
      q2: "WRONG",
      q3: "WRONG",
      q4: "WRONG",
    });
    // Even if a malicious client claimed scorePct=100, the server-derived
    // value is what drives the pass decision in submitTrainingQuizAttempt.
    expect(r.scorePct).toBe(0);
    expect(r.scorePct >= passScorePct).toBe(false);
  });

  it("an honest passing submission yields the expected result", () => {
    const passScorePct = 75;
    const r = computeQuizAttemptResult(fourQuestions, {
      q1: "A",
      q2: "B",
      q3: "C",
      q4: "WRONG",
    });
    expect(r.scorePct).toBe(75);
    expect(r.scorePct >= passScorePct).toBe(true);
  });
});

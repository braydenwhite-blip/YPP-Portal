import { describe, expect, it } from "vitest";
import { MULTI_SELECT_MODULE } from "@/lib/training-journey/kinds/multi-select";
import type { ScoredBeat } from "@/lib/training-journey/types";

const CORRECT_FEEDBACK = {
  tone: "correct" as const,
  headline: "All correct!",
  body: "You selected exactly the right options.",
};

const DEFAULT_INCORRECT = {
  tone: "incorrect" as const,
  headline: "Not quite right",
  body: "Some selections were off.",
};

const makeOptions = () => [
  { id: "a", label: "Option A", correct: true },
  { id: "b", label: "Option B", correct: true },
  { id: "c", label: "Option C", correct: false },
  { id: "d", label: "Option D", correct: false },
];

const makeBeat = (
  configOverrides: Record<string, unknown> = {}
): ScoredBeat => ({
  kind: "MULTI_SELECT",
  sourceKey: "test/multi-select-01",
  scoringWeight: 10,
  scoringRule: null,
  config: {
    options: makeOptions(),
    scoringMode: "all-or-nothing",
    correctFeedback: CORRECT_FEEDBACK,
    incorrectFeedback: { default: DEFAULT_INCORRECT },
    ...configOverrides,
  },
});

describe("MULTI_SELECT_MODULE", () => {
  it("all-or-nothing: correct when all correct options selected and no false positives", () => {
    const beat = makeBeat();
    const result = MULTI_SELECT_MODULE.scorer(beat as never, {
      selectedOptionIds: ["a", "b"],
    });
    expect(result.correct).toBe(true);
    expect(result.score).toBe(10);
    expect(result.feedback).toEqual(CORRECT_FEEDBACK);
  });

  it("all-or-nothing: incorrect when correct options selected but also a false positive", () => {
    const beat = makeBeat();
    const result = MULTI_SELECT_MODULE.scorer(beat as never, {
      selectedOptionIds: ["a", "b", "c"],
    });
    expect(result.correct).toBe(false);
    expect(result.score).toBe(0);
    expect(result.feedback.callouts).toBeDefined();
    // c is the false positive
    expect(result.feedback.callouts!.some((co) => co.target === "c")).toBe(true);
  });

  it("all-or-nothing: incorrect when only one of two correct options selected", () => {
    const beat = makeBeat();
    const result = MULTI_SELECT_MODULE.scorer(beat as never, {
      selectedOptionIds: ["a"],
    });
    expect(result.correct).toBe(false);
    expect(result.score).toBe(0);
    // b should appear in callouts as missed
    expect(result.feedback.callouts!.some((co) => co.target === "b")).toBe(true);
  });

  it("threshold: correct when minimumCorrect hits met with no false positives", () => {
    const beat = makeBeat({
      scoringMode: "threshold",
      minimumCorrect: 1,
    });
    const result = MULTI_SELECT_MODULE.scorer(beat as never, {
      selectedOptionIds: ["a"],
    });
    expect(result.correct).toBe(true);
    expect(result.score).toBe(10);
  });

  it("threshold: partial credit when some hits but below minimumCorrect", () => {
    const beat = {
      ...makeBeat({
        scoringMode: "threshold",
        minimumCorrect: 2,
      }),
      scoringWeight: 10,
    };
    // 4 correct options to get meaningful partial
    beat.config = {
      ...beat.config,
      options: [
        { id: "a", label: "A", correct: true },
        { id: "b", label: "B", correct: true },
        { id: "c", label: "C", correct: true },
        { id: "d", label: "D", correct: true },
      ],
      minimumCorrect: 3,
    };
    const result = MULTI_SELECT_MODULE.scorer(beat as never, {
      selectedOptionIds: ["a", "b"], // 2 of 4 correct, below threshold of 3
    });
    expect(result.correct).toBe(false);
    // partial credit: 2/4 * 10 = 5
    expect(result.score).toBe(5);
  });

  it("threshold: false positives force score to 0 regardless of hits", () => {
    const beat = makeBeat({
      scoringMode: "threshold",
      minimumCorrect: 1,
    });
    const result = MULTI_SELECT_MODULE.scorer(beat as never, {
      selectedOptionIds: ["a", "c"], // a is correct hit, c is false positive
    });
    expect(result.correct).toBe(false);
    expect(result.score).toBe(0);
  });

  it("configSchema rejects fewer than 4 options", () => {
    const result = MULTI_SELECT_MODULE.configSchema.safeParse({
      options: [
        { id: "a", label: "A", correct: true },
        { id: "b", label: "B", correct: false },
        { id: "c", label: "C", correct: false },
      ],
      correctFeedback: CORRECT_FEEDBACK,
      incorrectFeedback: { default: DEFAULT_INCORRECT },
    });
    expect(result.success).toBe(false);
  });

  it("configSchema rejects more than 7 options", () => {
    const options = Array.from({ length: 8 }, (_, i) => ({
      id: String(i),
      label: `Opt ${i}`,
      correct: i === 0,
    }));
    const result = MULTI_SELECT_MODULE.configSchema.safeParse({
      options,
      correctFeedback: CORRECT_FEEDBACK,
      incorrectFeedback: { default: DEFAULT_INCORRECT },
    });
    expect(result.success).toBe(false);
  });

  it("configSchema rejects when incorrectFeedback missing default key", () => {
    const result = MULTI_SELECT_MODULE.configSchema.safeParse({
      options: makeOptions(),
      correctFeedback: CORRECT_FEEDBACK,
      incorrectFeedback: { x: DEFAULT_INCORRECT },
    });
    expect(result.success).toBe(false);
  });

  it("responseSchema rejects missing selectedOptionIds", () => {
    const result = MULTI_SELECT_MODULE.responseSchema.safeParse({});
    expect(result.success).toBe(false);
  });

  it("deduplicates repeated option ids in response", () => {
    // Sending "a" twice should still count as one hit
    const beat = makeBeat();
    const result = MULTI_SELECT_MODULE.scorer(beat as never, {
      selectedOptionIds: ["a", "a", "b"],
    });
    expect(result.correct).toBe(true);
    expect(result.score).toBe(10);
  });
});

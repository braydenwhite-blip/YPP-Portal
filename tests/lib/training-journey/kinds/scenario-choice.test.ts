import { describe, expect, it } from "vitest";
import { SCENARIO_CHOICE_MODULE } from "@/lib/training-journey/kinds/scenario-choice";
import type { ScoredBeat } from "@/lib/training-journey/types";

const CORRECT_FEEDBACK = {
  tone: "correct" as const,
  headline: "That's the right move!",
  body: "You identified the correct option.",
};

const DEFAULT_INCORRECT = {
  tone: "incorrect" as const,
  headline: "Not quite",
  body: "That was not the right choice.",
};

const SPECIFIC_INCORRECT_B = {
  tone: "incorrect" as const,
  headline: "Option B isn't right",
  body: "Option B is a common misconception.",
};

const makeBeat = (
  configOverrides: Record<string, unknown> = {}
): ScoredBeat => ({
  kind: "SCENARIO_CHOICE",
  sourceKey: "test/scenario-choice-01",
  scoringWeight: 10,
  scoringRule: null,
  config: {
    options: [
      { id: "a", label: "Option A" },
      { id: "b", label: "Option B" },
      { id: "c", label: "Option C" },
    ],
    correctOptionId: "a",
    correctFeedback: CORRECT_FEEDBACK,
    incorrectFeedback: {
      b: SPECIFIC_INCORRECT_B,
      default: DEFAULT_INCORRECT,
    },
    ...configOverrides,
  },
});

describe("SCENARIO_CHOICE_MODULE", () => {
  it("marks the correct choice as correct with full score", () => {
    const beat = makeBeat();
    const result = SCENARIO_CHOICE_MODULE.scorer(beat as never, {
      selectedOptionId: "a",
    });
    expect(result.correct).toBe(true);
    expect(result.score).toBe(10);
    expect(result.feedback).toEqual(CORRECT_FEEDBACK);
  });

  it("returns a specific incorrect feedback for a known wrong choice", () => {
    const beat = makeBeat();
    const result = SCENARIO_CHOICE_MODULE.scorer(beat as never, {
      selectedOptionId: "b",
    });
    expect(result.correct).toBe(false);
    expect(result.score).toBe(0);
    expect(result.feedback).toEqual(SPECIFIC_INCORRECT_B);
  });

  it("falls back to default incorrect feedback for an unknown wrong choice", () => {
    const beat = makeBeat();
    const result = SCENARIO_CHOICE_MODULE.scorer(beat as never, {
      selectedOptionId: "c",
    });
    expect(result.correct).toBe(false);
    expect(result.score).toBe(0);
    expect(result.feedback).toEqual(DEFAULT_INCORRECT);
  });

  it("respects the scoringWeight when correct", () => {
    const beat = { ...makeBeat(), scoringWeight: 25 };
    const result = SCENARIO_CHOICE_MODULE.scorer(beat as never, {
      selectedOptionId: "a",
    });
    expect(result.score).toBe(25);
  });

  it("returns score 0 when incorrect regardless of scoringWeight", () => {
    const beat = { ...makeBeat(), scoringWeight: 25 };
    const result = SCENARIO_CHOICE_MODULE.scorer(beat as never, {
      selectedOptionId: "c",
    });
    expect(result.score).toBe(0);
    expect(result.correct).toBe(false);
  });

  it("configSchema rejects correctOptionId not in options", () => {
    const result = SCENARIO_CHOICE_MODULE.configSchema.safeParse({
      options: [
        { id: "a", label: "A" },
        { id: "b", label: "B" },
        { id: "c", label: "C" },
      ],
      correctOptionId: "z",
      correctFeedback: CORRECT_FEEDBACK,
      incorrectFeedback: { default: DEFAULT_INCORRECT },
    });
    expect(result.success).toBe(false);
  });

  it("configSchema rejects when incorrectFeedback has no default key", () => {
    const result = SCENARIO_CHOICE_MODULE.configSchema.safeParse({
      options: [
        { id: "a", label: "A" },
        { id: "b", label: "B" },
        { id: "c", label: "C" },
      ],
      correctOptionId: "a",
      correctFeedback: CORRECT_FEEDBACK,
      incorrectFeedback: { b: DEFAULT_INCORRECT },
    });
    expect(result.success).toBe(false);
  });

  it("configSchema rejects fewer than 3 options", () => {
    const result = SCENARIO_CHOICE_MODULE.configSchema.safeParse({
      options: [
        { id: "a", label: "A" },
        { id: "b", label: "B" },
      ],
      correctOptionId: "a",
      correctFeedback: CORRECT_FEEDBACK,
      incorrectFeedback: { default: DEFAULT_INCORRECT },
    });
    expect(result.success).toBe(false);
  });

  it("configSchema rejects more than 5 options", () => {
    const options = Array.from({ length: 6 }, (_, i) => ({
      id: String(i),
      label: `Option ${i}`,
    }));
    const result = SCENARIO_CHOICE_MODULE.configSchema.safeParse({
      options,
      correctOptionId: "0",
      correctFeedback: CORRECT_FEEDBACK,
      incorrectFeedback: { default: DEFAULT_INCORRECT },
    });
    expect(result.success).toBe(false);
  });

  it("responseSchema rejects missing selectedOptionId", () => {
    const result = SCENARIO_CHOICE_MODULE.responseSchema.safeParse({});
    expect(result.success).toBe(false);
  });
});

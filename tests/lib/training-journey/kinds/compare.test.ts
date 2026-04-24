import { describe, expect, it } from "vitest";
import { COMPARE_MODULE } from "@/lib/training-journey/kinds/compare";
import type { ScoredBeat } from "@/lib/training-journey/types";

const CORRECT_FEEDBACK = {
  tone: "correct" as const,
  headline: "Exactly right.",
  body: "Option A is the professional standard — specific, actionable, empathetic.",
};

const DEFAULT_INCORRECT = {
  tone: "incorrect" as const,
  headline: "Not the better example",
  body: "Look at the specificity and empathy in each option.",
};

const INCORRECT_B = {
  tone: "incorrect" as const,
  headline: "Option B is too vague",
  body: "Vague feedback doesn't help the student improve.",
};

const makeBeat = (configOverrides: Record<string, unknown> = {}): ScoredBeat => ({
  kind: "COMPARE",
  sourceKey: "test/compare-01",
  scoringWeight: 10,
  scoringRule: null,
  config: {
    optionA: {
      id: "option-a",
      label: "Response A",
      body: "I noticed your submission was late. Let's talk about what happened and how we can prevent this.",
    },
    optionB: {
      id: "option-b",
      label: "Response B",
      body: "You need to be more responsible.",
    },
    correctOptionId: "A",
    correctFeedback: CORRECT_FEEDBACK,
    incorrectFeedback: {
      B: INCORRECT_B,
      default: DEFAULT_INCORRECT,
    },
    ...configOverrides,
  },
});

describe("COMPARE_MODULE", () => {
  it("marks the correct option as correct with full score", () => {
    const beat = makeBeat();
    const result = COMPARE_MODULE.scorer(beat as never, { selectedOptionId: "A" });
    expect(result.correct).toBe(true);
    expect(result.score).toBe(10);
    expect(result.feedback).toEqual(CORRECT_FEEDBACK);
  });

  it("returns specific incorrect feedback when wrong option is chosen", () => {
    const beat = makeBeat();
    const result = COMPARE_MODULE.scorer(beat as never, { selectedOptionId: "B" });
    expect(result.correct).toBe(false);
    expect(result.score).toBe(0);
    expect(result.feedback).toEqual(INCORRECT_B);
  });

  it("falls back to default incorrect feedback when no specific key matches", () => {
    // Override so the "B" key is not present
    const beat = makeBeat({
      incorrectFeedback: { default: DEFAULT_INCORRECT },
    });
    const result = COMPARE_MODULE.scorer(beat as never, { selectedOptionId: "B" });
    expect(result.correct).toBe(false);
    expect(result.score).toBe(0);
    expect(result.feedback).toEqual(DEFAULT_INCORRECT);
  });

  it("partial credit: correct option but wrong rationaleTag gives 50% score", () => {
    const beat = makeBeat({ requiredRationaleTag: "empathy" });
    const result = COMPARE_MODULE.scorer(beat as never, {
      selectedOptionId: "A",
      rationaleTag: "specificity", // wrong tag
    });
    expect(result.correct).toBe(false);
    expect(result.score).toBe(5); // 50% of 10
    expect(result.feedback.tone).toBe("partial");
    expect(result.feedback.hint).toContain("rationale");
  });

  it("partial credit: wrong option AND wrong rationaleTag gives score 0", () => {
    const beat = makeBeat({ requiredRationaleTag: "empathy" });
    const result = COMPARE_MODULE.scorer(beat as never, {
      selectedOptionId: "B",
      rationaleTag: "specificity",
    });
    expect(result.correct).toBe(false);
    expect(result.score).toBe(0);
    expect(result.feedback).toEqual(DEFAULT_INCORRECT);
  });

  it("correct option AND correct rationaleTag gives full score", () => {
    const beat = makeBeat({ requiredRationaleTag: "empathy" });
    const result = COMPARE_MODULE.scorer(beat as never, {
      selectedOptionId: "A",
      rationaleTag: "empathy",
    });
    expect(result.correct).toBe(true);
    expect(result.score).toBe(10);
    expect(result.feedback).toEqual(CORRECT_FEEDBACK);
  });

  it("respects scoringWeight for partial credit calculation", () => {
    const beat = { ...makeBeat({ requiredRationaleTag: "empathy" }), scoringWeight: 20 };
    const result = COMPARE_MODULE.scorer(beat as never, {
      selectedOptionId: "A",
      rationaleTag: "wrong-tag",
    });
    expect(result.score).toBe(10); // 50% of 20
  });

  it("configSchema rejects missing incorrectFeedback default key", () => {
    const result = COMPARE_MODULE.configSchema.safeParse({
      optionA: { id: "a", label: "A", body: "Body A" },
      optionB: { id: "b", label: "B", body: "Body B" },
      correctOptionId: "A",
      correctFeedback: CORRECT_FEEDBACK,
      incorrectFeedback: { B: INCORRECT_B }, // no "default"
    });
    expect(result.success).toBe(false);
  });

  it("configSchema rejects correctOptionId not A or B", () => {
    const result = COMPARE_MODULE.configSchema.safeParse({
      optionA: { id: "a", label: "A", body: "Body A" },
      optionB: { id: "b", label: "B", body: "Body B" },
      correctOptionId: "C",
      correctFeedback: CORRECT_FEEDBACK,
      incorrectFeedback: { default: DEFAULT_INCORRECT },
    });
    expect(result.success).toBe(false);
  });

  it("responseSchema rejects selectedOptionId not A or B", () => {
    const result = COMPARE_MODULE.responseSchema.safeParse({ selectedOptionId: "C" });
    expect(result.success).toBe(false);
  });

  it("responseSchema rejects missing selectedOptionId", () => {
    const result = COMPARE_MODULE.responseSchema.safeParse({});
    expect(result.success).toBe(false);
  });
});

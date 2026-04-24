import { describe, expect, it } from "vitest";
import { SORT_ORDER_MODULE } from "@/lib/training-journey/kinds/sort-order";
import type { ScoredBeat } from "@/lib/training-journey/types";

const CORRECT_FEEDBACK = {
  tone: "correct" as const,
  headline: "Perfect order!",
  body: "You arranged all items correctly.",
};

const DEFAULT_INCORRECT = {
  tone: "incorrect" as const,
  headline: "Not the right order",
  body: "Try arranging the steps again.",
};

const makeBeat = (
  configOverrides: Record<string, unknown> = {}
): ScoredBeat => ({
  kind: "SORT_ORDER",
  sourceKey: "test/sort-order-01",
  scoringWeight: 10,
  scoringRule: null,
  config: {
    items: [
      { id: "s1", label: "Step 1" },
      { id: "s2", label: "Step 2" },
      { id: "s3", label: "Step 3" },
      { id: "s4", label: "Step 4" },
    ],
    correctOrder: ["s1", "s2", "s3", "s4"],
    partialCredit: false,
    correctFeedback: CORRECT_FEEDBACK,
    incorrectFeedback: { default: DEFAULT_INCORRECT },
    ...configOverrides,
  },
});

describe("SORT_ORDER_MODULE", () => {
  it("marks exact correct order as correct with full score", () => {
    const beat = makeBeat();
    const result = SORT_ORDER_MODULE.scorer(beat as never, {
      orderedIds: ["s1", "s2", "s3", "s4"],
    });
    expect(result.correct).toBe(true);
    expect(result.score).toBe(10);
    expect(result.feedback).toEqual(CORRECT_FEEDBACK);
  });

  it("marks completely wrong order as incorrect with score 0 (no partial credit)", () => {
    const beat = makeBeat();
    const result = SORT_ORDER_MODULE.scorer(beat as never, {
      orderedIds: ["s4", "s3", "s2", "s1"],
    });
    expect(result.correct).toBe(false);
    expect(result.score).toBe(0);
    expect(result.feedback.tone).toBe("incorrect");
  });

  it("marks partially correct order as incorrect with score 0 when partialCredit is false", () => {
    const beat = makeBeat({ partialCredit: false });
    const result = SORT_ORDER_MODULE.scorer(beat as never, {
      orderedIds: ["s1", "s2", "s4", "s3"],
    });
    expect(result.correct).toBe(false);
    expect(result.score).toBe(0);
  });

  it("partial credit: gives proportional score for correct adjacent pairs", () => {
    // correctOrder: s1->s2->s3->s4  (3 adjacent pairs)
    // response: s1->s2->s4->s3 => s1->s2 is correct (1 of 3 pairs)
    const beat = makeBeat({ partialCredit: true });
    const result = SORT_ORDER_MODULE.scorer(beat as never, {
      orderedIds: ["s1", "s2", "s4", "s3"],
    });
    expect(result.correct).toBe(false);
    // 1 correct pair out of 3 = Math.round((1/3)*10) = 3
    expect(result.score).toBe(3);
    expect(result.feedback.tone).toBe("partial");
  });

  it("partial credit: gives full score for exact match even with partialCredit=true", () => {
    const beat = makeBeat({ partialCredit: true });
    const result = SORT_ORDER_MODULE.scorer(beat as never, {
      orderedIds: ["s1", "s2", "s3", "s4"],
    });
    expect(result.correct).toBe(true);
    expect(result.score).toBe(10);
  });

  it("partial credit: all wrong pairs gives score 0 and tone incorrect", () => {
    const beat = makeBeat({ partialCredit: true });
    // Completely reversed
    const result = SORT_ORDER_MODULE.scorer(beat as never, {
      orderedIds: ["s4", "s3", "s2", "s1"],
    });
    expect(result.correct).toBe(false);
    expect(result.score).toBe(0);
    expect(result.feedback.tone).toBe("incorrect");
  });

  it("partial credit: 2 out of 3 correct adjacent pairs", () => {
    // correctOrder: s1->s2->s3->s4
    // response: s1->s2->s3->s4? No, let's do s2->s3->s4->s1 => pairs: s2->s3, s3->s4, s4->s1
    // correct pairs: s1->s2, s2->s3, s3->s4
    // matching: s2->s3 (yes), s3->s4 (yes), s4->s1 (no) => 2 of 3
    const beat = makeBeat({ partialCredit: true });
    const result = SORT_ORDER_MODULE.scorer(beat as never, {
      orderedIds: ["s2", "s3", "s4", "s1"],
    });
    expect(result.correct).toBe(false);
    // Math.round((2/3)*10) = Math.round(6.67) = 7
    expect(result.score).toBe(7);
    expect(result.feedback.tone).toBe("partial");
  });

  it("configSchema rejects fewer than 3 items", () => {
    const result = SORT_ORDER_MODULE.configSchema.safeParse({
      items: [
        { id: "a", label: "A" },
        { id: "b", label: "B" },
      ],
      correctOrder: ["a", "b"],
      correctFeedback: CORRECT_FEEDBACK,
      incorrectFeedback: { default: DEFAULT_INCORRECT },
    });
    expect(result.success).toBe(false);
  });

  it("configSchema rejects correctOrder that is not a permutation of items ids", () => {
    const result = SORT_ORDER_MODULE.configSchema.safeParse({
      items: [
        { id: "a", label: "A" },
        { id: "b", label: "B" },
        { id: "c", label: "C" },
      ],
      correctOrder: ["a", "b", "z"], // z not in items
      correctFeedback: CORRECT_FEEDBACK,
      incorrectFeedback: { default: DEFAULT_INCORRECT },
    });
    expect(result.success).toBe(false);
  });

  it("configSchema rejects when incorrectFeedback missing default key", () => {
    const result = SORT_ORDER_MODULE.configSchema.safeParse({
      items: [
        { id: "a", label: "A" },
        { id: "b", label: "B" },
        { id: "c", label: "C" },
      ],
      correctOrder: ["a", "b", "c"],
      correctFeedback: CORRECT_FEEDBACK,
      incorrectFeedback: { x: DEFAULT_INCORRECT },
    });
    expect(result.success).toBe(false);
  });

  it("responseSchema rejects missing orderedIds", () => {
    const result = SORT_ORDER_MODULE.responseSchema.safeParse({});
    expect(result.success).toBe(false);
  });
});

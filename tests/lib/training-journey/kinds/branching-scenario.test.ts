import { describe, expect, it } from "vitest";
import { BRANCHING_SCENARIO_MODULE } from "@/lib/training-journey/kinds/branching-scenario";
import type { ScoredBeat } from "@/lib/training-journey/types";

const CORRECT_FEEDBACK = {
  tone: "correct" as const,
  headline: "Good choice!",
  body: "You identified the best path forward.",
};

const DEFAULT_INCORRECT = {
  tone: "incorrect" as const,
  headline: "Not the right path",
  body: "That approach has some issues.",
};

const SPECIFIC_INCORRECT_B = {
  tone: "incorrect" as const,
  headline: "Option B leads to trouble",
  body: "That path tends to escalate the situation.",
};

const PER_OPTION_A = {
  tone: "noted" as const,
  headline: "You chose Path A",
  body: "This leads to a difficult but honest conversation.",
};

const makeBeat = (configOverrides: Record<string, unknown> = {}): ScoredBeat => ({
  kind: "BRANCHING_SCENARIO",
  sourceKey: "test/branching-01",
  scoringWeight: 10,
  scoringRule: null,
  config: {
    rootPrompt: "What do you do next?",
    options: [
      { id: "a", label: "Confront directly", leadsToChildSourceKey: "child-a" },
      { id: "b", label: "Ignore the issue", leadsToChildSourceKey: "child-b" },
      { id: "c", label: "Escalate to manager", leadsToChildSourceKey: null },
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

describe("BRANCHING_SCENARIO_MODULE", () => {
  it("marks the correct option as correct with full score", () => {
    const beat = makeBeat();
    const result = BRANCHING_SCENARIO_MODULE.scorer(beat as never, { selectedOptionId: "a" });
    expect(result.correct).toBe(true);
    expect(result.score).toBe(10);
    expect(result.feedback).toEqual(CORRECT_FEEDBACK);
  });

  it("returns specific incorrect feedback for a known wrong choice", () => {
    const beat = makeBeat();
    const result = BRANCHING_SCENARIO_MODULE.scorer(beat as never, { selectedOptionId: "b" });
    expect(result.correct).toBe(false);
    expect(result.score).toBe(0);
    expect(result.feedback).toEqual(SPECIFIC_INCORRECT_B);
  });

  it("falls back to default incorrect feedback for an unkeyed wrong choice", () => {
    const beat = makeBeat();
    const result = BRANCHING_SCENARIO_MODULE.scorer(beat as never, { selectedOptionId: "c" });
    expect(result.correct).toBe(false);
    expect(result.score).toBe(0);
    expect(result.feedback).toEqual(DEFAULT_INCORRECT);
  });

  it("respects scoringWeight when correct", () => {
    const beat = { ...makeBeat(), scoringWeight: 20 };
    const result = BRANCHING_SCENARIO_MODULE.scorer(beat as never, { selectedOptionId: "a" });
    expect(result.score).toBe(20);
  });

  it("correctOptionId === null: every pick is correct with full score and tone=noted", () => {
    const beat = makeBeat({
      correctOptionId: null,
      incorrectFeedback: {
        a: PER_OPTION_A,
        default: DEFAULT_INCORRECT,
      },
    });
    const resultA = BRANCHING_SCENARIO_MODULE.scorer(beat as never, { selectedOptionId: "a" });
    expect(resultA.correct).toBe(true);
    expect(resultA.score).toBe(10);
    expect(resultA.feedback.tone).toBe("noted");
    // Uses per-option feedback body
    expect(resultA.feedback.body).toBe(PER_OPTION_A.body);

    // An option not in the map falls back to default (tone forced to "noted")
    const resultC = BRANCHING_SCENARIO_MODULE.scorer(beat as never, { selectedOptionId: "c" });
    expect(resultC.correct).toBe(true);
    expect(resultC.score).toBe(10);
    expect(resultC.feedback.tone).toBe("noted");
    expect(resultC.feedback.body).toBe(DEFAULT_INCORRECT.body);
  });

  it("configSchema rejects options fewer than 2", () => {
    const result = BRANCHING_SCENARIO_MODULE.configSchema.safeParse({
      rootPrompt: "What do you do?",
      options: [{ id: "a", label: "Only option", leadsToChildSourceKey: null }],
      correctOptionId: "a",
      correctFeedback: CORRECT_FEEDBACK,
      incorrectFeedback: { default: DEFAULT_INCORRECT },
    });
    expect(result.success).toBe(false);
  });

  it("configSchema rejects correctOptionId not in options", () => {
    const result = BRANCHING_SCENARIO_MODULE.configSchema.safeParse({
      rootPrompt: "What do you do?",
      options: [
        { id: "a", label: "A", leadsToChildSourceKey: null },
        { id: "b", label: "B", leadsToChildSourceKey: null },
      ],
      correctOptionId: "z",
      correctFeedback: CORRECT_FEEDBACK,
      incorrectFeedback: { default: DEFAULT_INCORRECT },
    });
    expect(result.success).toBe(false);
  });

  it("configSchema rejects missing incorrectFeedback default key", () => {
    const result = BRANCHING_SCENARIO_MODULE.configSchema.safeParse({
      rootPrompt: "What do you do?",
      options: [
        { id: "a", label: "A", leadsToChildSourceKey: null },
        { id: "b", label: "B", leadsToChildSourceKey: null },
      ],
      correctOptionId: "a",
      correctFeedback: CORRECT_FEEDBACK,
      incorrectFeedback: { b: SPECIFIC_INCORRECT_B },
    });
    expect(result.success).toBe(false);
  });

  it("responseSchema rejects missing selectedOptionId", () => {
    const result = BRANCHING_SCENARIO_MODULE.responseSchema.safeParse({});
    expect(result.success).toBe(false);
  });

  it("configSchema accepts correctOptionId=null (no-wrong-answer scenario)", () => {
    const result = BRANCHING_SCENARIO_MODULE.configSchema.safeParse({
      rootPrompt: "Which path resonates with you?",
      options: [
        { id: "a", label: "A", leadsToChildSourceKey: "child-a" },
        { id: "b", label: "B", leadsToChildSourceKey: "child-b" },
      ],
      correctOptionId: null,
      correctFeedback: CORRECT_FEEDBACK,
      incorrectFeedback: { default: DEFAULT_INCORRECT },
    });
    expect(result.success).toBe(true);
  });
});

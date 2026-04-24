import { describe, expect, it } from "vitest";
import { REFLECTION_MODULE } from "@/lib/training-journey/kinds/reflection";
import type { ScoredBeat } from "@/lib/training-journey/types";

const CORRECT_FEEDBACK = {
  tone: "correct" as const,
  headline: "Thoughtful reflection!",
  body: "Great — that kind of self-awareness is exactly what we're looking for.",
};

const makeBeat = (configOverrides: Record<string, unknown> = {}): ScoredBeat => ({
  kind: "REFLECTION",
  sourceKey: "test/reflection-01",
  scoringWeight: 0,
  scoringRule: null,
  config: {
    prompt: "Describe a time you had a difficult conversation with a student.",
    minLength: 20,
    maxLength: 200,
    correctFeedback: CORRECT_FEEDBACK,
    ...configOverrides,
  },
});

describe("REFLECTION_MODULE", () => {
  it("accepts text meeting the length floor and returns correct:true, score:0", () => {
    const beat = makeBeat();
    const text = "I once had to tell a student their work was not meeting the expected standard.";
    const result = REFLECTION_MODULE.scorer(beat as never, { text });
    expect(result.correct).toBe(true);
    expect(result.score).toBe(0);
    expect(result.feedback.tone).toBe("noted");
  });

  it("always returns score:0 even when scoringWeight is non-zero", () => {
    const beat = { ...makeBeat(), scoringWeight: 10 };
    const text = "I once had to tell a student their work was not meeting the expected standard.";
    const result = REFLECTION_MODULE.scorer(beat as never, { text });
    expect(result.score).toBe(0);
  });

  it("returns tone=noted and preserves author body on valid response", () => {
    const beat = makeBeat();
    const text = "I once had to tell a student their work was not meeting the expected standard.";
    const result = REFLECTION_MODULE.scorer(beat as never, { text });
    expect(result.feedback.tone).toBe("noted");
    expect(result.feedback.body).toBe(CORRECT_FEEDBACK.body);
  });

  it("rejects text shorter than minLength with correct:false and helpful hint", () => {
    const beat = makeBeat();
    const result = REFLECTION_MODULE.scorer(beat as never, { text: "Too short." });
    expect(result.correct).toBe(false);
    expect(result.score).toBe(0);
    expect(result.feedback.tone).toBe("noted");
    expect(result.feedback.headline).toBe("A little more?");
    expect(result.feedback.hint).toContain("20");
  });

  it("rejects text longer than maxLength with correct:false and trim hint", () => {
    const beat = makeBeat();
    const longText = "a".repeat(201);
    const result = REFLECTION_MODULE.scorer(beat as never, { text: longText });
    expect(result.correct).toBe(false);
    expect(result.score).toBe(0);
    expect(result.feedback.tone).toBe("noted");
    expect(result.feedback.headline).toBe("Too long");
    expect(result.feedback.hint).toContain("200");
  });

  it("trims whitespace before length check", () => {
    const beat = makeBeat({ minLength: 20 });
    // 15 real chars padded with spaces to 25 total — should still be too short after trim
    const result = REFLECTION_MODULE.scorer(beat as never, { text: "   Short text.   " });
    // "Short text." is 11 chars after trim, < 20
    expect(result.correct).toBe(false);
    expect(result.feedback.headline).toBe("A little more?");
  });

  it("configSchema uses defaults for minLength and maxLength", () => {
    const parsed = REFLECTION_MODULE.configSchema.safeParse({
      prompt: "Reflect on this.",
      correctFeedback: CORRECT_FEEDBACK,
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.minLength).toBe(20);
      expect(parsed.data.maxLength).toBe(600);
    }
  });

  it("responseSchema rejects missing text field", () => {
    const result = REFLECTION_MODULE.responseSchema.safeParse({});
    expect(result.success).toBe(false);
  });
});

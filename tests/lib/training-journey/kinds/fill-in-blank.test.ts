import { describe, expect, it } from "vitest";
import { FILL_IN_BLANK_MODULE } from "@/lib/training-journey/kinds/fill-in-blank";
import type { ScoredBeat } from "@/lib/training-journey/types";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const correctFeedback = {
  tone: "correct" as const,
  headline: "That's right!",
  body: "Exactly what we were looking for.",
};

const incorrectFeedback = {
  default: {
    tone: "incorrect" as const,
    headline: "Not quite",
    body: "Check the lesson and try again.",
  },
};

const BASE_CONFIG = {
  prompt: "Complete the sentence: A YPP instructor must always ___.",
  acceptedAnswers: ["be present", "Be Present", "stay present"],
  caseSensitive: false,
  correctFeedback,
  incorrectFeedback,
};

const makeBeat = (overrides: Record<string, unknown> = {}): ScoredBeat<typeof BASE_CONFIG> => ({
  kind: "FILL_IN_BLANK" as const,
  sourceKey: "test/fill-1",
  scoringWeight: 10,
  scoringRule: null,
  config: { ...BASE_CONFIG, ...overrides },
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("FILL_IN_BLANK_MODULE", () => {
  it("(a) exact match accepted answer returns correct", () => {
    const beat = makeBeat();
    const result = FILL_IN_BLANK_MODULE.scorer(beat, { text: "be present" });
    expect(result.correct).toBe(true);
    expect(result.score).toBe(10);
    expect(result.feedback.tone).toBe("correct");
  });

  it("(b) wrong answer returns incorrect", () => {
    const beat = makeBeat();
    const result = FILL_IN_BLANK_MODULE.scorer(beat, { text: "arrive late" });
    expect(result.correct).toBe(false);
    expect(result.score).toBe(0);
    expect(result.feedback.tone).toBe("incorrect");
    expect(result.feedback.headline).toBe("Not quite");
  });

  it("(c) another wrong answer also returns incorrect", () => {
    const beat = makeBeat();
    const result = FILL_IN_BLANK_MODULE.scorer(beat, { text: "ignore the rules" });
    expect(result.correct).toBe(false);
    expect(result.score).toBe(0);
  });

  it("(d) config safeParse rejects empty acceptedAnswers array", () => {
    const badConfig = { ...BASE_CONFIG, acceptedAnswers: [] };
    const parsed = FILL_IN_BLANK_MODULE.configSchema.safeParse(badConfig);
    expect(parsed.success).toBe(false);
  });

  it("(e) whitespace and case normalization — extra spaces + wrong case still match", () => {
    const beat = makeBeat();
    // "  Be  Present  " → normalize → "be present"
    const result = FILL_IN_BLANK_MODULE.scorer(beat, { text: "  Be  Present  " });
    expect(result.correct).toBe(true);
    expect(result.score).toBe(10);
  });

  it("(e2) regex pattern fallback matches", () => {
    const beat = makeBeat({
      acceptedAnswers: ["be present"],
      acceptedPatterns: ["^stay\\s+present$"],
    });
    const result = FILL_IN_BLANK_MODULE.scorer(beat, { text: "Stay  Present" });
    // After normalization: "stay  present" → collapse whitespace → "stay present"
    // Pattern ^stay\s+present$ with "i" flag → should match
    expect(result.correct).toBe(true);
    expect(result.score).toBe(10);
  });

  it("(e3) malformed regex pattern is treated as non-match, not thrown error", () => {
    const beat = makeBeat({
      acceptedAnswers: ["be present"],
      acceptedPatterns: ["[[[invalid regex"],
    });
    // Should not throw — malformed pattern is silently ignored
    expect(() => FILL_IN_BLANK_MODULE.scorer(beat, { text: "anything" })).not.toThrow();
    const result = FILL_IN_BLANK_MODULE.scorer(beat, { text: "anything" });
    expect(result.correct).toBe(false);
  });

  it("(e4) case-sensitive mode distinguishes capitalization", () => {
    const beat = makeBeat({ caseSensitive: true, acceptedAnswers: ["Be Present"] });
    const lower = FILL_IN_BLANK_MODULE.scorer(beat, { text: "be present" });
    expect(lower.correct).toBe(false);
    const exact = FILL_IN_BLANK_MODULE.scorer(beat, { text: "Be Present" });
    expect(exact.correct).toBe(true);
  });
});

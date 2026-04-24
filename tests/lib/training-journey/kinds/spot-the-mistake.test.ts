import { describe, expect, it } from "vitest";
import { SPOT_THE_MISTAKE_MODULE } from "@/lib/training-journey/kinds/spot-the-mistake";
import type { ScoredBeat } from "@/lib/training-journey/types";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const PASSAGE = "The instructor should always blame students for late submissions.";

const correctFeedback = {
  tone: "correct" as const,
  headline: "You found the mistake!",
  body: "Blaming students is against YPP policy.",
};

const incorrectFeedback = {
  t1: {
    tone: "incorrect" as const,
    headline: "Not that one",
    body: "The instructor part is fine.",
  },
  default: {
    tone: "incorrect" as const,
    headline: "Missed it",
    body: "Try clicking the problematic phrase.",
  },
};

const BASE_CONFIG = {
  passage: PASSAGE,
  targets: [
    { id: "t1", start: 4, end: 14, label: "instructor" },
    { id: "t2", start: 22, end: 33, label: "blame students" },
    { id: "t3", start: 38, end: 43, label: "late" },
  ],
  correctTargetId: "t2",
  correctFeedback,
  incorrectFeedback,
};

const makeBeat = (overrides: Record<string, unknown> = {}): ScoredBeat<typeof BASE_CONFIG> => ({
  kind: "SPOT_THE_MISTAKE" as const,
  sourceKey: "test/spot-1",
  scoringWeight: 10,
  scoringRule: null,
  config: { ...BASE_CONFIG, ...overrides },
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("SPOT_THE_MISTAKE_MODULE", () => {
  it("(a) correct target click returns full score", () => {
    const beat = makeBeat();
    const result = SPOT_THE_MISTAKE_MODULE.scorer(beat, { clickedTargetId: "t2" });
    expect(result.correct).toBe(true);
    expect(result.score).toBe(10);
    expect(result.feedback.tone).toBe("correct");
    expect(result.feedback.headline).toBe("You found the mistake!");
  });

  it("(b) wrong target with specific feedback key uses per-target feedback", () => {
    const beat = makeBeat();
    const result = SPOT_THE_MISTAKE_MODULE.scorer(beat, { clickedTargetId: "t1" });
    expect(result.correct).toBe(false);
    expect(result.score).toBe(0);
    expect(result.feedback.tone).toBe("incorrect");
    expect(result.feedback.headline).toBe("Not that one");
  });

  it("(c) another wrong target falls back to default feedback", () => {
    const beat = makeBeat();
    const result = SPOT_THE_MISTAKE_MODULE.scorer(beat, { clickedTargetId: "t3" });
    expect(result.correct).toBe(false);
    expect(result.score).toBe(0);
    expect(result.feedback.headline).toBe("Missed it");
  });

  it("(d) config safeParse rejects end > passage.length", () => {
    const badConfig = {
      ...BASE_CONFIG,
      targets: [
        { id: "t1", start: 0, end: 9999, label: "too far" }, // end > passage.length
      ],
    };
    const parsed = SPOT_THE_MISTAKE_MODULE.configSchema.safeParse(badConfig);
    expect(parsed.success).toBe(false);
  });

  it("(e) __none__ miss falls back to default feedback", () => {
    const beat = makeBeat();
    const result = SPOT_THE_MISTAKE_MODULE.scorer(beat, { clickedTargetId: "__none__" });
    expect(result.correct).toBe(false);
    expect(result.score).toBe(0);
    expect(result.feedback.headline).toBe("Missed it");
  });

  it("(e2) config safeParse rejects start >= end", () => {
    const badConfig = {
      ...BASE_CONFIG,
      targets: [
        { id: "t1", start: 10, end: 5, label: "invalid range" },
      ],
    };
    const parsed = SPOT_THE_MISTAKE_MODULE.configSchema.safeParse(badConfig);
    expect(parsed.success).toBe(false);
  });

  it("(e3) config safeParse rejects missing correctTargetId in targets", () => {
    const badConfig = {
      ...BASE_CONFIG,
      correctTargetId: "nonexistent",
    };
    const parsed = SPOT_THE_MISTAKE_MODULE.configSchema.safeParse(badConfig);
    expect(parsed.success).toBe(false);
  });
});

import { describe, expect, it } from "vitest";
import { MATCH_PAIRS_MODULE } from "@/lib/training-journey/kinds/match-pairs";
import type { ScoredBeat } from "@/lib/training-journey/types";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const correctFeedback = {
  tone: "correct" as const,
  headline: "Perfect match!",
  body: "You paired every item correctly.",
};

const incorrectFeedback = {
  default: {
    tone: "incorrect" as const,
    headline: "Not quite",
    body: "Some pairs were wrong.",
  },
};

const BASE_CONFIG = {
  leftItems: [
    { id: "l1", label: "Apple" },
    { id: "l2", label: "Banana" },
    { id: "l3", label: "Cherry" },
  ],
  rightItems: [
    { id: "r1", label: "Red" },
    { id: "r2", label: "Yellow" },
    { id: "r3", label: "Dark Red" },
  ],
  correctPairs: [
    { leftId: "l1", rightId: "r1" },
    { leftId: "l2", rightId: "r2" },
    { leftId: "l3", rightId: "r3" },
  ],
  partialCredit: true,
  correctFeedback,
  incorrectFeedback,
};

const makeBeat = (overrides: Record<string, unknown> = {}): ScoredBeat<typeof BASE_CONFIG> => ({
  kind: "MATCH_PAIRS" as const,
  sourceKey: "test/match-pairs-1",
  scoringWeight: 10,
  scoringRule: null,
  config: { ...BASE_CONFIG, ...overrides },
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("MATCH_PAIRS_MODULE", () => {
  it("(a) scores fully correct response", () => {
    const beat = makeBeat();
    const response = {
      pairs: [
        { leftId: "l1", rightId: "r1" },
        { leftId: "l2", rightId: "r2" },
        { leftId: "l3", rightId: "r3" },
      ],
    };
    const result = MATCH_PAIRS_MODULE.scorer(beat, response);
    expect(result.correct).toBe(true);
    expect(result.score).toBe(10);
    expect(result.feedback.tone).toBe("correct");
  });

  it("(b) scores one wrong pair — partial credit", () => {
    const beat = makeBeat();
    const response = {
      pairs: [
        { leftId: "l1", rightId: "r1" },
        { leftId: "l2", rightId: "r3" }, // wrong
        { leftId: "l3", rightId: "r2" }, // wrong
      ],
    };
    const result = MATCH_PAIRS_MODULE.scorer(beat, response);
    expect(result.correct).toBe(false);
    // 1 hit out of 3 → Math.round(1/3 * 10) = 3
    expect(result.score).toBe(3);
    expect(result.feedback.tone).toBe("partial");
  });

  it("(c) scores all wrong — partial credit → score 0, tone incorrect", () => {
    const beat = makeBeat();
    const response = {
      pairs: [
        { leftId: "l1", rightId: "r3" },
        { leftId: "l2", rightId: "r1" },
        { leftId: "l3", rightId: "r2" },
      ],
    };
    const result = MATCH_PAIRS_MODULE.scorer(beat, response);
    expect(result.correct).toBe(false);
    expect(result.score).toBe(0);
    expect(result.feedback.tone).toBe("incorrect");
  });

  it("(d) config safeParse rejects missing 'default' in incorrectFeedback", () => {
    const badConfig = {
      ...BASE_CONFIG,
      incorrectFeedback: {}, // missing "default"
    };
    const parsed = MATCH_PAIRS_MODULE.configSchema.safeParse(badConfig);
    expect(parsed.success).toBe(false);
  });

  it("(e) no partial credit — all-or-nothing scoring", () => {
    const beat = makeBeat({ partialCredit: false });
    const partialResponse = {
      pairs: [
        { leftId: "l1", rightId: "r1" }, // correct
        { leftId: "l2", rightId: "r3" }, // wrong
        { leftId: "l3", rightId: "r2" }, // wrong
      ],
    };
    const result = MATCH_PAIRS_MODULE.scorer(beat, partialResponse);
    expect(result.correct).toBe(false);
    expect(result.score).toBe(0);
  });

  it("(e2) duplicate leftId in response — first occurrence wins", () => {
    const beat = makeBeat();
    const response = {
      pairs: [
        { leftId: "l1", rightId: "r1" }, // correct
        { leftId: "l1", rightId: "r2" }, // duplicate — ignored
        { leftId: "l2", rightId: "r2" }, // correct
        { leftId: "l3", rightId: "r3" }, // correct
      ],
    };
    const result = MATCH_PAIRS_MODULE.scorer(beat, response);
    expect(result.correct).toBe(true);
    expect(result.score).toBe(10);
  });

  it("(e3) config safeParse rejects mismatched leftItems/rightItems count", () => {
    const badConfig = {
      ...BASE_CONFIG,
      rightItems: [
        { id: "r1", label: "Red" },
        { id: "r2", label: "Yellow" },
        // missing r3 — count mismatch
      ],
    };
    const parsed = MATCH_PAIRS_MODULE.configSchema.safeParse(badConfig);
    expect(parsed.success).toBe(false);
  });

  it("(e4) callouts list wrong pairings in feedback", () => {
    const beat = makeBeat();
    const response = {
      pairs: [
        { leftId: "l1", rightId: "r2" }, // wrong: Apple → Yellow
        { leftId: "l2", rightId: "r2" }, // correct: Banana → Yellow
        { leftId: "l3", rightId: "r3" }, // correct
      ],
    };
    const result = MATCH_PAIRS_MODULE.scorer(beat, response);
    expect(result.correct).toBe(false);
    // callouts should reference l1's wrong pairing
    expect(result.feedback.callouts).toBeDefined();
    const calloutTargets = result.feedback.callouts!.map((c) => c.target);
    expect(calloutTargets).toContain("l1");
  });
});

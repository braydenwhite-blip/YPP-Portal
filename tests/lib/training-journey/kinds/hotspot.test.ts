import { describe, expect, it } from "vitest";
import { HOTSPOT_MODULE } from "@/lib/training-journey/kinds/hotspot";
import type { ScoredBeat } from "@/lib/training-journey/types";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const correctFeedback = {
  tone: "correct" as const,
  headline: "Correct region!",
  body: "You clicked the right area.",
};

const incorrectFeedback = {
  "region-b": {
    tone: "incorrect" as const,
    headline: "Wrong zone",
    body: "That area is not the answer.",
  },
  default: {
    tone: "incorrect" as const,
    headline: "Missed",
    body: "You didn't click a valid region.",
  },
};

const BASE_CONFIG = {
  imageUrl: "https://example.com/diagram.png",
  regions: [
    { id: "region-a", label: "Top Left", shape: "rect" as const, x: 0, y: 0, width: 0.3, height: 0.3 },
    { id: "region-b", label: "Center", shape: "rect" as const, x: 0.35, y: 0.35, width: 0.3, height: 0.3 },
    { id: "region-c", label: "Bottom Right", shape: "rect" as const, x: 0.7, y: 0.7, width: 0.3, height: 0.3 },
  ],
  correctRegionId: "region-a",
  correctFeedback,
  incorrectFeedback,
};

const makeBeat = (overrides: Record<string, unknown> = {}): ScoredBeat<typeof BASE_CONFIG> => ({
  kind: "HOTSPOT" as const,
  sourceKey: "test/hotspot-1",
  scoringWeight: 10,
  scoringRule: null,
  config: { ...BASE_CONFIG, ...overrides },
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("HOTSPOT_MODULE", () => {
  it("(a) click inside correct region returns correct", () => {
    const beat = makeBeat();
    // Click at (0.1, 0.1) — inside region-a (0,0 → 0.3,0.3)
    const result = HOTSPOT_MODULE.scorer(beat, { x: 0.1, y: 0.1 });
    expect(result.correct).toBe(true);
    expect(result.score).toBe(10);
    expect(result.feedback.tone).toBe("correct");
  });

  it("(b) click inside wrong region with specific feedback key", () => {
    const beat = makeBeat();
    // Click at (0.5, 0.5) — inside region-b
    const result = HOTSPOT_MODULE.scorer(beat, { x: 0.5, y: 0.5 });
    expect(result.correct).toBe(false);
    expect(result.score).toBe(0);
    expect(result.feedback.headline).toBe("Wrong zone");
  });

  it("(c) click inside region-c falls back to default feedback", () => {
    const beat = makeBeat();
    // Click at (0.85, 0.85) — inside region-c, no specific feedback key
    const result = HOTSPOT_MODULE.scorer(beat, { x: 0.85, y: 0.85 });
    expect(result.correct).toBe(false);
    expect(result.score).toBe(0);
    expect(result.feedback.headline).toBe("Missed");
  });

  it("(d) config safeParse rejects out-of-bounds region (x + width > 1)", () => {
    const badConfig = {
      ...BASE_CONFIG,
      regions: [
        { id: "r1", label: "Overflow", shape: "rect" as const, x: 0.8, y: 0, width: 0.5, height: 0.5 },
      ],
      correctRegionId: "r1",
    };
    const parsed = HOTSPOT_MODULE.configSchema.safeParse(badConfig);
    expect(parsed.success).toBe(false);
  });

  it("(e) __none__ miss when click is outside all regions", () => {
    const beat = makeBeat();
    // Click at (0.5, 0.1) — not inside region-a (0–0.3 x 0–0.3), not in b or c either
    const result = HOTSPOT_MODULE.scorer(beat, { x: 0.5, y: 0.1 });
    expect(result.correct).toBe(false);
    expect(result.score).toBe(0);
    // Falls back to default
    expect(result.feedback.headline).toBe("Missed");
  });

  it("(e2) config safeParse rejects missing correctRegionId in regions", () => {
    const badConfig = {
      ...BASE_CONFIG,
      correctRegionId: "nonexistent",
    };
    const parsed = HOTSPOT_MODULE.configSchema.safeParse(badConfig);
    expect(parsed.success).toBe(false);
  });

  it("(e3) click exactly on boundary edge is considered a hit (inclusive)", () => {
    const beat = makeBeat();
    // Click at (0.3, 0.3) — on the exact right/bottom edge of region-a
    const result = HOTSPOT_MODULE.scorer(beat, { x: 0.3, y: 0.3 });
    expect(result.correct).toBe(true);
    expect(result.score).toBe(10);
  });

  it("(e4) config safeParse rejects missing 'default' in incorrectFeedback", () => {
    const badConfig = {
      ...BASE_CONFIG,
      incorrectFeedback: {
        "region-b": incorrectFeedback["region-b"],
        // missing "default"
      },
    };
    const parsed = HOTSPOT_MODULE.configSchema.safeParse(badConfig);
    expect(parsed.success).toBe(false);
  });
});

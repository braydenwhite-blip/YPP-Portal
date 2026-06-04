import { describe, expect, it } from "vitest";
import { CONTENT_BLOCK_MODULE } from "@/lib/training-journey/kinds/content-block";
import type { ScoredBeat } from "@/lib/training-journey/types";

const CORRECT_FEEDBACK = {
  tone: "noted" as const,
  headline: "Got it.",
  body: "On to the next thing.",
};

const makeBeat = (configOverrides: Record<string, unknown> = {}): ScoredBeat => ({
  kind: "CONTENT_BLOCK",
  sourceKey: "test/content-block-01",
  scoringWeight: 0,
  scoringRule: null,
  config: {
    sections: [
      { id: "s1", heading: "Heading", body: "Some teaching prose." },
      { id: "s2", body: "More prose without a heading." },
    ],
    correctFeedback: CORRECT_FEEDBACK,
    ...configOverrides,
  },
});

describe("CONTENT_BLOCK_MODULE", () => {
  it("marks acknowledged as correct, always score 0", () => {
    const result = CONTENT_BLOCK_MODULE.scorer(makeBeat() as never, {
      acknowledged: true,
    });
    expect(result.correct).toBe(true);
    expect(result.score).toBe(0);
    expect(result.feedback.headline).toBe("Got it.");
  });

  it("never scores points even when scoringWeight > 0", () => {
    const beat = { ...makeBeat(), scoringWeight: 10 };
    const result = CONTENT_BLOCK_MODULE.scorer(beat as never, { acknowledged: true });
    expect(result.score).toBe(0);
  });

  it("configSchema accepts an optional media block", () => {
    const result = CONTENT_BLOCK_MODULE.configSchema.safeParse({
      sections: [{ id: "s1", body: "Body" }],
      media: { url: "https://example.com/diagram.png", alt: "diagram" },
      correctFeedback: CORRECT_FEEDBACK,
    });
    expect(result.success).toBe(true);
  });

  it("configSchema rejects zero sections", () => {
    const result = CONTENT_BLOCK_MODULE.configSchema.safeParse({
      sections: [],
      correctFeedback: CORRECT_FEEDBACK,
    });
    expect(result.success).toBe(false);
  });

  it("responseSchema rejects acknowledged !== true", () => {
    expect(
      CONTENT_BLOCK_MODULE.responseSchema.safeParse({ acknowledged: false }).success
    ).toBe(false);
    expect(CONTENT_BLOCK_MODULE.responseSchema.safeParse({}).success).toBe(false);
  });
});

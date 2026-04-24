import { describe, expect, it } from "vitest";
import { CONCEPT_REVEAL_MODULE } from "@/lib/training-journey/kinds/concept-reveal";
import type { ScoredBeat } from "@/lib/training-journey/types";

const CORRECT_FEEDBACK = {
  tone: "noted" as const,
  headline: "All done!",
  body: "You have reviewed all panels.",
};

const makeBeat = (
  configOverrides: Record<string, unknown> = {}
): ScoredBeat => ({
  kind: "CONCEPT_REVEAL",
  sourceKey: "test/concept-reveal-01",
  scoringWeight: 0,
  scoringRule: null,
  config: {
    panels: [
      { id: "p1", title: "Panel 1", body: "Content 1" },
      { id: "p2", title: "Panel 2", body: "Content 2" },
      { id: "p3", title: "Panel 3", body: "Content 3" },
    ],
    correctFeedback: CORRECT_FEEDBACK,
    ...configOverrides,
  },
});

describe("CONCEPT_REVEAL_MODULE", () => {
  it("marks correct when all panels have been visited", () => {
    const beat = makeBeat();
    const result = CONCEPT_REVEAL_MODULE.scorer(beat as never, {
      visitedPanelIds: ["p1", "p2", "p3"],
    });
    expect(result.correct).toBe(true);
    expect(result.score).toBe(0);
    expect(result.feedback.tone).toBe("noted");
    expect(result.feedback.headline).toBe("All done!");
  });

  it("returns score 0 always even when correct (unscored kind)", () => {
    const beat = { ...makeBeat(), scoringWeight: 10 };
    const result = CONCEPT_REVEAL_MODULE.scorer(beat as never, {
      visitedPanelIds: ["p1", "p2", "p3"],
    });
    // score is always 0 per spec; scorer returns 0 regardless of scoringWeight
    expect(result.score).toBe(0);
  });

  it("marks incorrect when no panels have been visited", () => {
    const beat = makeBeat();
    const result = CONCEPT_REVEAL_MODULE.scorer(beat as never, {
      visitedPanelIds: [],
    });
    expect(result.correct).toBe(false);
    expect(result.score).toBe(0);
    expect(result.feedback.tone).toBe("noted");
    expect(result.feedback.body).toContain("3 panels remaining");
  });

  it("marks incorrect when only some panels visited", () => {
    const beat = makeBeat();
    const result = CONCEPT_REVEAL_MODULE.scorer(beat as never, {
      visitedPanelIds: ["p1"],
    });
    expect(result.correct).toBe(false);
    expect(result.feedback.body).toContain("2 panels remaining");
  });

  it("marks correct when only 2 panels exist and both are visited", () => {
    const beat = makeBeat({
      panels: [
        { id: "a", title: "A", body: "Body A" },
        { id: "b", title: "B", body: "Body B" },
      ],
    });
    const result = CONCEPT_REVEAL_MODULE.scorer(beat as never, {
      visitedPanelIds: ["a", "b"],
    });
    expect(result.correct).toBe(true);
    expect(result.score).toBe(0);
  });

  it("ignores extra visited ids not in panel list", () => {
    const beat = makeBeat();
    // visiting all real panels + a ghost panel id => still correct
    const result = CONCEPT_REVEAL_MODULE.scorer(beat as never, {
      visitedPanelIds: ["p1", "p2", "p3", "ghost"],
    });
    expect(result.correct).toBe(true);
  });

  it("configSchema rejects fewer than 2 panels", () => {
    const result = CONCEPT_REVEAL_MODULE.configSchema.safeParse({
      panels: [{ id: "p1", title: "Only one", body: "body" }],
      correctFeedback: CORRECT_FEEDBACK,
    });
    expect(result.success).toBe(false);
  });

  it("configSchema rejects more than 6 panels", () => {
    const panels = Array.from({ length: 7 }, (_, i) => ({
      id: `p${i}`,
      title: `Panel ${i}`,
      body: `Body ${i}`,
    }));
    const result = CONCEPT_REVEAL_MODULE.configSchema.safeParse({
      panels,
      correctFeedback: CORRECT_FEEDBACK,
    });
    expect(result.success).toBe(false);
  });

  it("responseSchema rejects missing visitedPanelIds", () => {
    const result = CONCEPT_REVEAL_MODULE.responseSchema.safeParse({});
    expect(result.success).toBe(false);
  });
});

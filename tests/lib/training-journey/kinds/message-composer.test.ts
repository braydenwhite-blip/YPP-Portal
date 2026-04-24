import { describe, expect, it } from "vitest";
import { MESSAGE_COMPOSER_MODULE } from "@/lib/training-journey/kinds/message-composer";
import type { ScoredBeat } from "@/lib/training-journey/types";

const CORRECT_FEEDBACK = {
  tone: "correct" as const,
  headline: "Well-crafted message!",
  body: "Your message is professional, specific, and empathetic.",
};

const DEFAULT_INCORRECT = {
  tone: "incorrect" as const,
  headline: "This message has issues",
  body: "Review the tone and content of your selected snippets.",
};

const makeBeat = (configOverrides: Record<string, unknown> = {}): ScoredBeat => ({
  kind: "MESSAGE_COMPOSER",
  sourceKey: "test/message-composer-01",
  scoringWeight: 10,
  scoringRule: null,
  config: {
    snippetPools: [
      {
        poolId: "opening",
        label: "Opening",
        minSelections: 1,
        maxSelections: 1,
        snippets: [
          { id: "open-a", label: "Thank you for reaching out", tags: ["polite", "professional"] },
          { id: "open-b", label: "I told you already", tags: ["rude", "dismissive"] },
        ],
      },
      {
        poolId: "closing",
        label: "Closing",
        minSelections: 1,
        maxSelections: 1,
        snippets: [
          { id: "close-a", label: "Let me know if you need more help", tags: ["supportive", "professional"] },
          { id: "close-b", label: "Don't ask again", tags: ["rude", "dismissive"] },
        ],
      },
    ],
    rubric: {
      requiredTags: ["professional", "supportive"],
      bannedTags: ["rude", "dismissive"],
    },
    correctFeedback: CORRECT_FEEDBACK,
    incorrectFeedback: {
      default: DEFAULT_INCORRECT,
    },
    ...configOverrides,
  },
});

describe("MESSAGE_COMPOSER_MODULE", () => {
  it("returns correct:true, full score when all required tags present and no banned tags", () => {
    const beat = makeBeat();
    const result = MESSAGE_COMPOSER_MODULE.scorer(beat as never, {
      selections: [
        { poolId: "opening", snippetIds: ["open-a"] },  // tags: polite, professional
        { poolId: "closing", snippetIds: ["close-a"] }, // tags: supportive, professional
      ],
    });
    expect(result.correct).toBe(true);
    expect(result.score).toBe(10);
    expect(result.feedback.tone).toBe("correct");
  });

  it("returns score 0 when banned tags are present", () => {
    const beat = makeBeat();
    const result = MESSAGE_COMPOSER_MODULE.scorer(beat as never, {
      selections: [
        { poolId: "opening", snippetIds: ["open-b"] },  // tags: rude, dismissive (BANNED)
        { poolId: "closing", snippetIds: ["close-a"] },
      ],
    });
    expect(result.correct).toBe(false);
    expect(result.score).toBe(0);
    expect(result.feedback.callouts).toBeDefined();
    // Should call out the banned tags
    const bannedLabels = result.feedback.callouts!.map((c) => c.target);
    expect(bannedLabels).toContain("rude");
  });

  it("returns partial credit when some required tags are missing but no banned tags", () => {
    // Only "professional" tag present, "supportive" is missing
    const beat = makeBeat();
    const result = MESSAGE_COMPOSER_MODULE.scorer(beat as never, {
      selections: [
        { poolId: "opening", snippetIds: ["open-a"] },  // tags: polite, professional (no supportive)
        { poolId: "closing", snippetIds: ["close-a"] }, // wait — close-a has supportive
      ],
    });
    // close-a has supportive so this is actually correct — use a custom beat
    const beatNoSupportive = makeBeat({
      snippetPools: [
        {
          poolId: "opening",
          label: "Opening",
          minSelections: 1,
          maxSelections: 1,
          snippets: [
            { id: "open-a", label: "Thank you", tags: ["polite", "professional"] },
          ],
        },
        {
          poolId: "closing",
          label: "Closing",
          minSelections: 1,
          maxSelections: 1,
          snippets: [
            { id: "close-no-supportive", label: "Best regards", tags: ["professional"] },
          ],
        },
      ],
    });
    const partialResult = MESSAGE_COMPOSER_MODULE.scorer(beatNoSupportive as never, {
      selections: [
        { poolId: "opening", snippetIds: ["open-a"] },
        { poolId: "closing", snippetIds: ["close-no-supportive"] },
      ],
    });
    expect(partialResult.correct).toBe(false);
    // 1 of 2 required tags present → 50% = 5
    expect(partialResult.score).toBe(5);
    expect(partialResult.feedback.tone).toBe("partial");
    expect(partialResult.feedback.callouts).toBeDefined();
    const missingTargets = partialResult.feedback.callouts!.map((c) => c.target);
    expect(missingTargets).toContain("supportive");
  });

  it("returns correct:false, score:0 when pool selection count is violated", () => {
    const beat = makeBeat({
      snippetPools: [
        {
          poolId: "opening",
          label: "Opening",
          minSelections: 1,
          maxSelections: 1,
          snippets: [
            { id: "open-a", label: "Thank you", tags: ["professional"] },
            { id: "open-b", label: "Also fine", tags: ["professional"] },
          ],
        },
        {
          poolId: "closing",
          label: "Closing",
          minSelections: 1,
          maxSelections: 1,
          snippets: [
            { id: "close-a", label: "Let me know", tags: ["supportive", "professional"] },
          ],
        },
      ],
    });
    // Selecting 2 snippets from a pool that allows only 1
    const result = MESSAGE_COMPOSER_MODULE.scorer(beat as never, {
      selections: [
        { poolId: "opening", snippetIds: ["open-a", "open-b"] }, // violates maxSelections=1
        { poolId: "closing", snippetIds: ["close-a"] },
      ],
    });
    expect(result.correct).toBe(false);
    expect(result.score).toBe(0);
    expect(result.feedback.tone).toBe("incorrect");
    expect(result.feedback.headline).toBe("Pick the right number of pieces");
  });

  it("pool with no matching selection entry violates minSelections and returns incorrect", () => {
    const beat = makeBeat();
    // Missing the closing pool selection entirely
    const result = MESSAGE_COMPOSER_MODULE.scorer(beat as never, {
      selections: [
        { poolId: "opening", snippetIds: ["open-a"] },
        // closing not provided — defaults to 0 snippetIds, violates min=1
      ],
    });
    expect(result.correct).toBe(false);
    expect(result.score).toBe(0);
    expect(result.feedback.tone).toBe("incorrect");
  });

  it("configSchema rejects duplicate snippet ids across pools", () => {
    const result = MESSAGE_COMPOSER_MODULE.configSchema.safeParse({
      snippetPools: [
        {
          poolId: "opening",
          label: "Opening",
          snippets: [{ id: "duplicate-id", label: "A", tags: [] }],
        },
        {
          poolId: "closing",
          label: "Closing",
          snippets: [{ id: "duplicate-id", label: "B", tags: [] }], // duplicate
        },
      ],
      rubric: { requiredTags: ["professional"], bannedTags: [] },
      correctFeedback: CORRECT_FEEDBACK,
      incorrectFeedback: { default: DEFAULT_INCORRECT },
    });
    expect(result.success).toBe(false);
  });

  it("configSchema rejects overlapping requiredTags and bannedTags", () => {
    const result = MESSAGE_COMPOSER_MODULE.configSchema.safeParse({
      snippetPools: [
        {
          poolId: "opening",
          label: "Opening",
          snippets: [{ id: "s1", label: "A", tags: ["professional"] }],
        },
      ],
      rubric: {
        requiredTags: ["professional"],
        bannedTags: ["professional"], // overlap
      },
      correctFeedback: CORRECT_FEEDBACK,
      incorrectFeedback: { default: DEFAULT_INCORRECT },
    });
    expect(result.success).toBe(false);
  });

  it("configSchema rejects duplicate pool ids", () => {
    const result = MESSAGE_COMPOSER_MODULE.configSchema.safeParse({
      snippetPools: [
        {
          poolId: "opening",
          label: "Opening",
          snippets: [{ id: "s1", label: "A", tags: [] }],
        },
        {
          poolId: "opening", // duplicate pool id
          label: "Also Opening",
          snippets: [{ id: "s2", label: "B", tags: [] }],
        },
      ],
      rubric: { requiredTags: [], bannedTags: [] },
      correctFeedback: CORRECT_FEEDBACK,
      incorrectFeedback: { default: DEFAULT_INCORRECT },
    });
    expect(result.success).toBe(false);
  });

  it("responseSchema rejects missing selections field", () => {
    const result = MESSAGE_COMPOSER_MODULE.responseSchema.safeParse({});
    expect(result.success).toBe(false);
  });
});

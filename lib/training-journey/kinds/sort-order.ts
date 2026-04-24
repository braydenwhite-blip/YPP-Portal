import { z } from "zod";
import type { BeatKindModule, BeatFeedback } from "../types";

// ---------------------------------------------------------------------------
// Local Zod schema for BeatFeedback
// ---------------------------------------------------------------------------

const FEEDBACK_SCHEMA: z.ZodType<BeatFeedback> = z.object({
  tone: z.enum(["correct", "partial", "incorrect", "noted"]),
  headline: z.string(),
  body: z.string(),
  hint: z.string().optional(),
  callouts: z
    .array(
      z.object({
        label: z.string(),
        target: z.union([z.string(), z.number()]),
      })
    )
    .optional(),
});

// ---------------------------------------------------------------------------
// Config + Response schemas
// ---------------------------------------------------------------------------

const itemSchema = z.object({
  id: z.string(),
  label: z.string(),
});

const configSchema = z
  .object({
    items: z.array(itemSchema).min(3).max(7),
    correctOrder: z.array(z.string()),
    partialCredit: z.boolean().default(false),
    correctFeedback: FEEDBACK_SCHEMA,
    incorrectFeedback: z.record(z.string(), FEEDBACK_SCHEMA),
  })
  .superRefine((val, ctx) => {
    const itemIds = val.items.map((i) => i.id).sort();
    const orderIds = [...val.correctOrder].sort();

    if (
      itemIds.length !== orderIds.length ||
      itemIds.some((id, idx) => id !== orderIds[idx])
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "correctOrder must be a permutation of items[].id",
        path: ["correctOrder"],
      });
    }

    if (!("default" in val.incorrectFeedback)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'incorrectFeedback must include a "default" key',
        path: ["incorrectFeedback"],
      });
    }
  });

const responseSchema = z.object({
  orderedIds: z.array(z.string()),
});

type SortOrderConfig = z.infer<typeof configSchema>;
type SortOrderResponse = z.infer<typeof responseSchema>;

// ---------------------------------------------------------------------------
// Scorer
// ---------------------------------------------------------------------------

const scorer: BeatKindModule<SortOrderConfig, SortOrderResponse>["scorer"] = (
  beat,
  response
) => {
  const { correctOrder, partialCredit } = beat.config;
  const { orderedIds } = response;

  // Check for exact match
  const isExact =
    orderedIds.length === correctOrder.length &&
    orderedIds.every((id, idx) => id === correctOrder[idx]);

  if (isExact) {
    return {
      correct: true,
      score: beat.scoringWeight,
      feedback: beat.config.correctFeedback,
    };
  }

  let score = 0;

  if (partialCredit && correctOrder.length > 1) {
    // Build set of correct adjacent pairs in correctOrder
    const correctPairs = new Set<string>();
    for (let i = 0; i < correctOrder.length - 1; i++) {
      correctPairs.add(`${correctOrder[i]}|${correctOrder[i + 1]}`);
    }

    // Count how many adjacent pairs in response match
    let pairsRight = 0;
    for (let i = 0; i < orderedIds.length - 1; i++) {
      const pairKey = `${orderedIds[i]}|${orderedIds[i + 1]}`;
      if (correctPairs.has(pairKey)) {
        pairsRight++;
      }
    }

    const totalPairs = correctOrder.length - 1;
    score = Math.round((pairsRight / totalPairs) * beat.scoringWeight);
  }

  const tone: BeatFeedback["tone"] = score > 0 ? "partial" : "incorrect";

  const baseFeedback =
    beat.config.incorrectFeedback["default"];

  return {
    correct: false,
    score,
    feedback: {
      ...baseFeedback,
      tone,
    },
  };
};

// ---------------------------------------------------------------------------
// Module export
// ---------------------------------------------------------------------------

export const SORT_ORDER_MODULE: BeatKindModule<SortOrderConfig, SortOrderResponse> = {
  kind: "SORT_ORDER",
  schemaVersion: 1,
  configSchema: configSchema as z.ZodType<SortOrderConfig>,
  responseSchema,
  scorer,
};

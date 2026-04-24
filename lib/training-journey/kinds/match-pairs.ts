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

const pairSchema = z.object({
  leftId: z.string(),
  rightId: z.string(),
});

const configSchema = z
  .object({
    leftItems: z.array(itemSchema).min(3).max(6),
    rightItems: z.array(itemSchema),
    correctPairs: z.array(pairSchema),
    partialCredit: z.boolean().default(true),
    correctFeedback: FEEDBACK_SCHEMA,
    incorrectFeedback: z.record(z.string(), FEEDBACK_SCHEMA),
    hint: z.string().optional(),
  })
  .superRefine((val, ctx) => {
    // rightItems must be same length as leftItems
    if (val.rightItems.length !== val.leftItems.length) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "rightItems must have the same count as leftItems",
        path: ["rightItems"],
      });
    }

    // correctPairs.length must equal leftItems.length
    if (val.correctPairs.length !== val.leftItems.length) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "correctPairs.length must equal leftItems.length",
        path: ["correctPairs"],
      });
    }

    const leftIds = new Set(val.leftItems.map((i) => i.id));
    const rightIds = new Set(val.rightItems.map((i) => i.id));

    // each leftId appears exactly once in correctPairs
    const seenLeft = new Set<string>();
    for (const pair of val.correctPairs) {
      if (!leftIds.has(pair.leftId)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `correctPairs leftId "${pair.leftId}" not found in leftItems`,
          path: ["correctPairs"],
        });
      }
      if (seenLeft.has(pair.leftId)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `leftId "${pair.leftId}" appears more than once in correctPairs`,
          path: ["correctPairs"],
        });
      }
      seenLeft.add(pair.leftId);

      if (!rightIds.has(pair.rightId)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `correctPairs rightId "${pair.rightId}" not found in rightItems`,
          path: ["correctPairs"],
        });
      }
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
  pairs: z.array(pairSchema),
});

type MatchPairsConfig = z.infer<typeof configSchema>;
type MatchPairsResponse = z.infer<typeof responseSchema>;

// ---------------------------------------------------------------------------
// Scorer
// ---------------------------------------------------------------------------

const scorer: BeatKindModule<MatchPairsConfig, MatchPairsResponse>["scorer"] = (
  beat,
  response
) => {
  const { config } = beat;
  const correctMap = new Map<string, string>(
    config.correctPairs.map((p) => [p.leftId, p.rightId])
  );

  // Build a label map for callouts
  const leftLabelMap = new Map<string, string>(
    config.leftItems.map((i) => [i.id, i.label])
  );
  const rightLabelMap = new Map<string, string>(
    config.rightItems.map((i) => [i.id, i.label])
  );

  let hits = 0;
  const seenLeft = new Set<string>();
  const callouts: BeatFeedback["callouts"] = [];

  for (const pair of response.pairs) {
    // First occurrence of leftId wins (ignore duplicates)
    if (seenLeft.has(pair.leftId)) continue;
    seenLeft.add(pair.leftId);

    if (correctMap.get(pair.leftId) === pair.rightId) {
      hits++;
    } else {
      const leftLabel = leftLabelMap.get(pair.leftId) ?? pair.leftId;
      const rightLabel = rightLabelMap.get(pair.rightId) ?? pair.rightId;
      callouts.push({
        label: `${leftLabel} → ${rightLabel} (wrong)`,
        target: pair.leftId,
      });
    }
  }

  const total = config.correctPairs.length;
  const correct = hits === total;
  const score = config.partialCredit
    ? Math.round((hits / total) * beat.scoringWeight)
    : correct
    ? beat.scoringWeight
    : 0;

  const tone = correct ? "correct" : score > 0 ? "partial" : "incorrect";

  if (correct) {
    return {
      correct: true,
      score,
      feedback: { ...config.correctFeedback, callouts: undefined },
    };
  }

  const baseFeedback =
    config.incorrectFeedback["default"];

  return {
    correct: false,
    score,
    feedback: {
      ...baseFeedback,
      tone,
      callouts: callouts.length > 0 ? callouts : baseFeedback.callouts,
    },
  };
};

// ---------------------------------------------------------------------------
// Module export
// ---------------------------------------------------------------------------

export const MATCH_PAIRS_MODULE: BeatKindModule<MatchPairsConfig, MatchPairsResponse> = {
  kind: "MATCH_PAIRS",
  schemaVersion: 1,
  configSchema: configSchema as z.ZodType<MatchPairsConfig>,
  responseSchema,
  scorer,
};

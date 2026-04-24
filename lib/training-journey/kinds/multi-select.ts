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

const optionSchema = z.object({
  id: z.string(),
  label: z.string(),
  correct: z.boolean(),
});

const configSchema = z
  .object({
    options: z.array(optionSchema).min(4).max(7),
    scoringMode: z
      .enum(["all-or-nothing", "threshold"])
      .default("all-or-nothing"),
    minimumCorrect: z.number().int().positive().optional(),
    correctFeedback: FEEDBACK_SCHEMA,
    incorrectFeedback: z.record(z.string(), FEEDBACK_SCHEMA),
  })
  .superRefine((val, ctx) => {
    if (!("default" in val.incorrectFeedback)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'incorrectFeedback must include a "default" key',
        path: ["incorrectFeedback"],
      });
    }
  });

const responseSchema = z.object({
  selectedOptionIds: z.array(z.string()),
});

type MultiSelectConfig = z.infer<typeof configSchema>;
type MultiSelectResponse = z.infer<typeof responseSchema>;

// ---------------------------------------------------------------------------
// Scorer
// ---------------------------------------------------------------------------

const scorer: BeatKindModule<MultiSelectConfig, MultiSelectResponse>["scorer"] = (
  beat,
  response
) => {
  const correctSet = new Set(
    beat.config.options.filter((o) => o.correct).map((o) => o.id)
  );
  const selected = new Set(response.selectedOptionIds);

  const hits = new Set([...selected].filter((id) => correctSet.has(id)));
  const falsePositives = new Set([...selected].filter((id) => !correctSet.has(id)));

  let correct: boolean;
  let score: number;

  if (beat.config.scoringMode === "threshold") {
    const minCorrect = beat.config.minimumCorrect ?? correctSet.size;
    if (falsePositives.size > 0) {
      correct = false;
      score = 0;
    } else {
      correct = hits.size >= minCorrect;
      if (correct) {
        score = beat.scoringWeight;
      } else {
        // Partial credit: proportional to hits
        score =
          correctSet.size > 0
            ? Math.round((hits.size / correctSet.size) * beat.scoringWeight)
            : 0;
      }
    }
  } else {
    // all-or-nothing
    correct = hits.size === correctSet.size && falsePositives.size === 0;
    score = correct ? beat.scoringWeight : 0;
  }

  if (correct) {
    return {
      correct: true,
      score,
      feedback: beat.config.correctFeedback,
    };
  }

  // Build callouts for wrong items (false positives + missed correct)
  const callouts: BeatFeedback["callouts"] = [];
  for (const id of falsePositives) {
    const option = beat.config.options.find((o) => o.id === id);
    callouts.push({ label: option?.label ?? id, target: id });
  }
  for (const id of correctSet) {
    if (!hits.has(id)) {
      const option = beat.config.options.find((o) => o.id === id);
      callouts.push({ label: option?.label ?? id, target: id });
    }
  }

  const feedback = {
    ...(beat.config.incorrectFeedback["default"]),
    callouts: callouts.length > 0 ? callouts : undefined,
  };

  return {
    correct: false,
    score,
    feedback,
  };
};

// ---------------------------------------------------------------------------
// Module export
// ---------------------------------------------------------------------------

export const MULTI_SELECT_MODULE: BeatKindModule<
  MultiSelectConfig,
  MultiSelectResponse
> = {
  kind: "MULTI_SELECT",
  schemaVersion: 1,
  configSchema: configSchema as z.ZodType<MultiSelectConfig>,
  responseSchema,
  scorer,
};

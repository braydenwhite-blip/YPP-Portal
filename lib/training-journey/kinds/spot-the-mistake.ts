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

const targetSchema = z.object({
  id: z.string(),
  start: z.number().int().nonnegative(),
  end: z.number().int().positive(),
  label: z.string(),
});

const configSchema = z
  .object({
    passage: z.string(),
    targets: z.array(targetSchema).min(1).max(5),
    correctTargetId: z.string(),
    correctFeedback: FEEDBACK_SCHEMA,
    incorrectFeedback: z.record(z.string(), FEEDBACK_SCHEMA),
    hint: z.string().optional(),
  })
  .superRefine((val, ctx) => {
    const targetIds = new Set(val.targets.map((t) => t.id));

    if (!targetIds.has(val.correctTargetId)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `correctTargetId "${val.correctTargetId}" must be one of the target ids`,
        path: ["correctTargetId"],
      });
    }

    for (let i = 0; i < val.targets.length; i++) {
      const t = val.targets[i];
      if (t.start >= t.end) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `targets[${i}]: start must be less than end`,
          path: ["targets", i, "start"],
        });
      }
      if (t.end > val.passage.length) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `targets[${i}]: end (${t.end}) exceeds passage length (${val.passage.length})`,
          path: ["targets", i, "end"],
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
  clickedTargetId: z.string(),
});

type SpotTheMistakeConfig = z.infer<typeof configSchema>;
type SpotTheMistakeResponse = z.infer<typeof responseSchema>;

// ---------------------------------------------------------------------------
// Scorer
// ---------------------------------------------------------------------------

const scorer: BeatKindModule<SpotTheMistakeConfig, SpotTheMistakeResponse>["scorer"] = (
  beat,
  response
) => {
  const { config } = beat;
  const { clickedTargetId } = response;

  const correct = clickedTargetId === config.correctTargetId;
  const score = correct ? beat.scoringWeight : 0;

  if (correct) {
    return {
      correct: true,
      score,
      feedback: config.correctFeedback,
    };
  }

  const feedback =
    config.incorrectFeedback[clickedTargetId] ??
    config.incorrectFeedback["default"];

  return {
    correct: false,
    score: 0,
    feedback,
  };
};

// ---------------------------------------------------------------------------
// Module export
// ---------------------------------------------------------------------------

export const SPOT_THE_MISTAKE_MODULE: BeatKindModule<
  SpotTheMistakeConfig,
  SpotTheMistakeResponse
> = {
  kind: "SPOT_THE_MISTAKE",
  schemaVersion: 1,
  configSchema,
  responseSchema,
  scorer,
};

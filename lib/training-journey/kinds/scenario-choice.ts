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
});

const configSchema = z
  .object({
    options: z.array(optionSchema).min(3).max(5),
    correctOptionId: z.string(),
    correctFeedback: FEEDBACK_SCHEMA,
    incorrectFeedback: z.record(z.string(), FEEDBACK_SCHEMA),
  })
  .superRefine((val, ctx) => {
    const optionIds = new Set(val.options.map((o) => o.id));
    if (!optionIds.has(val.correctOptionId)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `correctOptionId "${val.correctOptionId}" must be one of the option ids`,
        path: ["correctOptionId"],
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
  selectedOptionId: z.string(),
});

type ScenarioChoiceConfig = z.infer<typeof configSchema>;
type ScenarioChoiceResponse = z.infer<typeof responseSchema>;

// ---------------------------------------------------------------------------
// Scorer
// ---------------------------------------------------------------------------

const scorer: BeatKindModule<ScenarioChoiceConfig, ScenarioChoiceResponse>["scorer"] = (
  beat,
  response
) => {
  const correct = response.selectedOptionId === beat.config.correctOptionId;

  if (correct) {
    return {
      correct: true,
      score: beat.scoringWeight,
      feedback: beat.config.correctFeedback,
    };
  }

  const feedback =
    beat.config.incorrectFeedback[response.selectedOptionId] ??
    beat.config.incorrectFeedback["default"];

  return {
    correct: false,
    score: 0,
    feedback,
  };
};

// ---------------------------------------------------------------------------
// Module export
// ---------------------------------------------------------------------------

export const SCENARIO_CHOICE_MODULE: BeatKindModule<
  ScenarioChoiceConfig,
  ScenarioChoiceResponse
> = {
  kind: "SCENARIO_CHOICE",
  schemaVersion: 1,
  configSchema,
  responseSchema,
  scorer,
};

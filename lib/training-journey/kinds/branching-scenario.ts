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

const rootOptionSchema = z.object({
  id: z.string(),
  label: z.string(),
  leadsToChildSourceKey: z.string().nullable(),
});

const configSchema = z
  .object({
    rootPrompt: z.string(),
    options: z.array(rootOptionSchema).min(2).max(5),
    correctOptionId: z.string().nullable(),
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
    if (val.correctOptionId !== null) {
      const optionIds = new Set(val.options.map((o) => o.id));
      if (!optionIds.has(val.correctOptionId)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `correctOptionId "${val.correctOptionId}" must be one of the option ids`,
          path: ["correctOptionId"],
        });
      }
    }
  });

const responseSchema = z.object({
  selectedOptionId: z.string(),
});

type BranchingScenarioConfig = z.infer<typeof configSchema>;
type BranchingScenarioResponse = z.infer<typeof responseSchema>;

// ---------------------------------------------------------------------------
// Scorer
// ---------------------------------------------------------------------------

const scorer: BeatKindModule<BranchingScenarioConfig, BranchingScenarioResponse>["scorer"] = (
  beat,
  response
) => {
  const { config } = beat;
  const { selectedOptionId } = response;

  // No-wrong-answer branching scenario: every pick is "correct"
  if (config.correctOptionId === null) {
    const feedback: BeatFeedback = {
      ...(config.incorrectFeedback[selectedOptionId] ?? config.incorrectFeedback["default"]),
      tone: "noted",
    };
    return {
      correct: true,
      score: beat.scoringWeight,
      feedback,
    };
  }

  const correct = selectedOptionId === config.correctOptionId;

  if (correct) {
    return {
      correct: true,
      score: beat.scoringWeight,
      feedback: config.correctFeedback,
    };
  }

  const feedback =
    config.incorrectFeedback[selectedOptionId] ?? config.incorrectFeedback["default"];

  return {
    correct: false,
    score: 0,
    feedback,
  };
};

// ---------------------------------------------------------------------------
// Module export
// ---------------------------------------------------------------------------

export const BRANCHING_SCENARIO_MODULE: BeatKindModule<
  BranchingScenarioConfig,
  BranchingScenarioResponse
> = {
  kind: "BRANCHING_SCENARIO",
  schemaVersion: 1,
  configSchema,
  responseSchema,
  scorer,
};

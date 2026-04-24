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

const compareOptionSchema = z.object({
  id: z.string(),
  label: z.string(),
  body: z.string(),
});

const configSchema = z
  .object({
    optionA: compareOptionSchema,
    optionB: compareOptionSchema,
    correctOptionId: z.enum(["A", "B"]),
    requiredRationaleTag: z.string().optional(),
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
  selectedOptionId: z.enum(["A", "B"]),
  rationaleTag: z.string().optional(),
});

type CompareConfig = z.infer<typeof configSchema>;
type CompareResponse = z.infer<typeof responseSchema>;

// ---------------------------------------------------------------------------
// Scorer
// ---------------------------------------------------------------------------

const scorer: BeatKindModule<CompareConfig, CompareResponse>["scorer"] = (beat, response) => {
  const { config } = beat;
  const pickedCorrectOption = response.selectedOptionId === config.correctOptionId;

  // Check required rationale tag if configured
  if (
    config.requiredRationaleTag !== undefined &&
    response.rationaleTag !== config.requiredRationaleTag
  ) {
    // Partial credit: right option but wrong rationale
    if (pickedCorrectOption) {
      return {
        correct: false,
        score: Math.round(beat.scoringWeight * 0.5),
        feedback: {
          tone: "partial",
          headline: "Right choice — but the reason matters.",
          body: "You picked the right option, but the rationale needs another look.",
          hint: "Right choice — but the reason matters. Try the rationale again.",
        },
      };
    }
    // Wrong option and wrong rationale
    return {
      correct: false,
      score: 0,
      feedback: config.incorrectFeedback["default"],
    };
  }

  if (pickedCorrectOption) {
    return {
      correct: true,
      score: beat.scoringWeight,
      feedback: config.correctFeedback,
    };
  }

  const feedback =
    config.incorrectFeedback[response.selectedOptionId] ?? config.incorrectFeedback["default"];

  return {
    correct: false,
    score: 0,
    feedback,
  };
};

// ---------------------------------------------------------------------------
// Module export
// ---------------------------------------------------------------------------

export const COMPARE_MODULE: BeatKindModule<CompareConfig, CompareResponse> = {
  kind: "COMPARE",
  schemaVersion: 1,
  configSchema,
  responseSchema,
  scorer,
};

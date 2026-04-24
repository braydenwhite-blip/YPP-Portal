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

const configSchema = z
  .object({
    prompt: z.string(),
    acceptedAnswers: z.array(z.string()).min(1),
    acceptedPatterns: z.array(z.string()).optional(),
    caseSensitive: z.boolean().default(false),
    correctFeedback: FEEDBACK_SCHEMA,
    incorrectFeedback: z.record(z.string(), FEEDBACK_SCHEMA),
    hint: z.string().optional(),
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
  text: z.string(),
});

type FillInBlankConfig = z.infer<typeof configSchema>;
type FillInBlankResponse = z.infer<typeof responseSchema>;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function normalize(text: string, caseSensitive: boolean): string {
  let result = text.trim().replace(/\s+/g, " ");
  if (!caseSensitive) {
    result = result.toLowerCase();
  }
  return result;
}

// ---------------------------------------------------------------------------
// Scorer
// ---------------------------------------------------------------------------

const scorer: BeatKindModule<FillInBlankConfig, FillInBlankResponse>["scorer"] = (
  beat,
  response
) => {
  const { config } = beat;
  const normalized = normalize(response.text, config.caseSensitive);

  // Check accepted answers
  const matchesAnswer = config.acceptedAnswers.some(
    (answer) => normalize(answer, config.caseSensitive) === normalized
  );

  // Check accepted patterns (defensive — malformed regex is a non-match)
  let matchesPattern = false;
  if (!matchesAnswer && config.acceptedPatterns && config.acceptedPatterns.length > 0) {
    for (const patternSource of config.acceptedPatterns) {
      try {
        const flags = config.caseSensitive ? "" : "i";
        const re = new RegExp(patternSource, flags);
        if (re.test(normalized)) {
          matchesPattern = true;
          break;
        }
      } catch {
        // Malformed pattern — treat as non-match, don't crash
      }
    }
  }

  const correct = matchesAnswer || matchesPattern;
  const score = correct ? beat.scoringWeight : 0;

  if (correct) {
    return {
      correct: true,
      score,
      feedback: config.correctFeedback,
    };
  }

  return {
    correct: false,
    score: 0,
    feedback: config.incorrectFeedback["default"],
  };
};

// ---------------------------------------------------------------------------
// Module export
// ---------------------------------------------------------------------------

export const FILL_IN_BLANK_MODULE: BeatKindModule<FillInBlankConfig, FillInBlankResponse> = {
  kind: "FILL_IN_BLANK",
  schemaVersion: 1,
  configSchema: configSchema as z.ZodType<FillInBlankConfig>,
  responseSchema,
  scorer,
};

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

const configSchemaRaw = z.object({
  prompt: z.string(),
  minLength: z.number().int().positive().default(20),
  maxLength: z.number().int().positive().default(600),
  sampleAnswers: z.array(z.string()).optional(),
  correctFeedback: FEEDBACK_SCHEMA,
});

// Cast to ZodType<ReflectionConfig> so the BeatKindModule generic assignment
// is satisfied despite ZodDefault widening the input type.
const configSchema = configSchemaRaw as z.ZodType<z.infer<typeof configSchemaRaw>>;

const responseSchema = z.object({
  text: z.string(),
});

type ReflectionConfig = z.infer<typeof configSchema>;
type ReflectionResponse = z.infer<typeof responseSchema>;

// ---------------------------------------------------------------------------
// Scorer
// ---------------------------------------------------------------------------

const scorer: BeatKindModule<ReflectionConfig, ReflectionResponse>["scorer"] = (beat, response) => {
  const { config } = beat;
  const text = response.text.trim();
  const minLength = config.minLength;
  const maxLength = config.maxLength;

  if (text.length < minLength) {
    return {
      correct: false,
      score: 0,
      feedback: {
        tone: "noted",
        headline: "A little more?",
        body: "Give it one or two more sentences — this is for you.",
        hint: `Aim for at least ${minLength} characters.`,
      },
    };
  }

  if (text.length > maxLength) {
    return {
      correct: false,
      score: 0,
      feedback: {
        tone: "noted",
        headline: "Too long",
        body: "Keep it to a few sentences — less is more here.",
        hint: `Trim to ${maxLength} characters.`,
      },
    };
  }

  // Reflections are acknowledged, not graded — always tone "noted"
  return {
    correct: true,
    score: 0,
    feedback: {
      ...config.correctFeedback,
      tone: "noted",
    },
  };
};

// ---------------------------------------------------------------------------
// Module export
// ---------------------------------------------------------------------------

export const REFLECTION_MODULE: BeatKindModule<ReflectionConfig, ReflectionResponse> = {
  kind: "REFLECTION",
  schemaVersion: 1,
  configSchema,
  responseSchema,
  scorer,
};

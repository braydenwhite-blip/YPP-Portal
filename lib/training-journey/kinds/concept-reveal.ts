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

const panelSchema = z.object({
  id: z.string(),
  title: z.string(),
  body: z.string(),
});

const configSchema = z.object({
  panels: z.array(panelSchema).min(2).max(6),
  correctFeedback: FEEDBACK_SCHEMA,
});

const responseSchema = z.object({
  visitedPanelIds: z.array(z.string()),
});

type ConceptRevealConfig = z.infer<typeof configSchema>;
type ConceptRevealResponse = z.infer<typeof responseSchema>;

// ---------------------------------------------------------------------------
// Scorer
// ---------------------------------------------------------------------------

const scorer: BeatKindModule<ConceptRevealConfig, ConceptRevealResponse>["scorer"] = (
  beat,
  response
) => {
  const allPanelIds = new Set(beat.config.panels.map((p) => p.id));
  const visited = new Set(response.visitedPanelIds);

  const allVisited = [...allPanelIds].every((id) => visited.has(id));

  if (allVisited) {
    return {
      correct: true,
      score: 0,
      feedback: beat.config.correctFeedback,
    };
  }

  const remaining = [...allPanelIds].filter((id) => !visited.has(id)).length;

  return {
    correct: false,
    score: 0,
    feedback: {
      tone: "noted",
      headline: "Not done yet",
      body: `Visit every panel to continue. ${remaining} panel${remaining !== 1 ? "s" : ""} remaining.`,
    },
  };
};

// ---------------------------------------------------------------------------
// Module export
// ---------------------------------------------------------------------------

export const CONCEPT_REVEAL_MODULE: BeatKindModule<
  ConceptRevealConfig,
  ConceptRevealResponse
> = {
  kind: "CONCEPT_REVEAL",
  schemaVersion: 1,
  configSchema,
  responseSchema,
  scorer,
};

import { z } from "zod";
import type { BeatKindModule } from "../types";
import { FEEDBACK_SCHEMA } from "../feedback-schema";

// ---------------------------------------------------------------------------
// CONTENT_BLOCK
//
// A purely instructional beat — teaching content that is NOT a game. The
// learner reads one or more sections (and an optional image/diagram), then
// continues. There is no answer key and no score: it is the "blocks of
// content that teach" companion to the interactive kinds.
//
// Distinct from CONCEPT_REVEAL: CONCEPT_REVEAL requires the learner to tap
// every panel to progress (light interaction), whereas CONTENT_BLOCK simply
// presents prose. The validator caps CONCEPT_REVEAL at 1 per 4 beats;
// CONTENT_BLOCK is intentionally NOT capped so authors can intersperse
// teaching content freely (subject to the "≤2 consecutive unscored" rule).
//
// Always unscored (scoringWeight: 0). The response is a single acknowledgement
// flag the client emits once the block has been shown, so the player's
// "continue" affordance unlocks.
// ---------------------------------------------------------------------------

const sectionSchema = z.object({
  id: z.string(),
  /** Optional sub-heading shown above the section body. */
  heading: z.string().optional(),
  /** The teaching prose for this section. */
  body: z.string(),
});

const mediaSchema = z.object({
  url: z.string(),
  alt: z.string().optional(),
  caption: z.string().optional(),
});

const configSchema = z.object({
  sections: z.array(sectionSchema).min(1).max(8),
  /** Optional supporting image / diagram shown after the sections. */
  media: mediaSchema.nullable().optional(),
  /** Shown after the learner marks the block read — the takeaway. */
  correctFeedback: FEEDBACK_SCHEMA,
});

const responseSchema = z.object({
  acknowledged: z.literal(true),
});

type ContentBlockConfig = z.infer<typeof configSchema>;
type ContentBlockResponse = z.infer<typeof responseSchema>;

// ---------------------------------------------------------------------------
// Scorer — never grades; an acknowledged block is always "correct" with 0 pts.
// ---------------------------------------------------------------------------

const scorer: BeatKindModule<ContentBlockConfig, ContentBlockResponse>["scorer"] = (
  beat,
  response
) => {
  if (response.acknowledged === true) {
    return {
      correct: true,
      score: 0,
      feedback: beat.config.correctFeedback,
    };
  }

  // Should be unreachable — the response schema requires `acknowledged: true`.
  return {
    correct: false,
    score: 0,
    feedback: {
      tone: "noted",
      headline: "Keep reading",
      body: "Finish the section to continue.",
    },
  };
};

// ---------------------------------------------------------------------------
// Module export
// ---------------------------------------------------------------------------

export const CONTENT_BLOCK_MODULE: BeatKindModule<
  ContentBlockConfig,
  ContentBlockResponse
> = {
  kind: "CONTENT_BLOCK",
  schemaVersion: 1,
  configSchema,
  responseSchema,
  scorer,
};

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

const regionSchema = z.object({
  id: z.string(),
  label: z.string(),
  shape: z.literal("rect"),
  x: z.number(),
  y: z.number(),
  width: z.number(),
  height: z.number(),
});

const configSchema = z
  .object({
    imageUrl: z.string(),
    regions: z.array(regionSchema).min(1).max(6),
    correctRegionId: z.string(),
    correctFeedback: FEEDBACK_SCHEMA,
    incorrectFeedback: z.record(z.string(), FEEDBACK_SCHEMA),
    hint: z.string().optional(),
  })
  .superRefine((val, ctx) => {
    const regionIds = new Set(val.regions.map((r) => r.id));

    if (!regionIds.has(val.correctRegionId)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `correctRegionId "${val.correctRegionId}" must be one of the region ids`,
        path: ["correctRegionId"],
      });
    }

    for (let i = 0; i < val.regions.length; i++) {
      const r = val.regions[i];
      // Validate coordinates in normalized [0, 1] space
      if (r.x < 0 || r.x > 1) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `regions[${i}]: x must be in [0, 1]`,
          path: ["regions", i, "x"],
        });
      }
      if (r.y < 0 || r.y > 1) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `regions[${i}]: y must be in [0, 1]`,
          path: ["regions", i, "y"],
        });
      }
      if (r.x + r.width < 0 || r.x + r.width > 1) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `regions[${i}]: x + width must be in [0, 1]`,
          path: ["regions", i, "width"],
        });
      }
      if (r.y + r.height < 0 || r.y + r.height > 1) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `regions[${i}]: y + height must be in [0, 1]`,
          path: ["regions", i, "height"],
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
  x: z.number(),
  y: z.number(),
});

type HotspotConfig = z.infer<typeof configSchema>;
type HotspotResponse = z.infer<typeof responseSchema>;

// ---------------------------------------------------------------------------
// Scorer
// ---------------------------------------------------------------------------

const scorer: BeatKindModule<HotspotConfig, HotspotResponse>["scorer"] = (beat, response) => {
  const { config } = beat;
  const { x, y } = response;

  // Find first region whose bounding box contains the click
  let clickedRegionId = "__none__";
  for (const region of config.regions) {
    if (
      x >= region.x &&
      x <= region.x + region.width &&
      y >= region.y &&
      y <= region.y + region.height
    ) {
      clickedRegionId = region.id;
      break;
    }
  }

  const correct = clickedRegionId === config.correctRegionId;
  const score = correct ? beat.scoringWeight : 0;

  if (correct) {
    return {
      correct: true,
      score,
      feedback: config.correctFeedback,
    };
  }

  const feedback =
    config.incorrectFeedback[clickedRegionId] ??
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

export const HOTSPOT_MODULE: BeatKindModule<HotspotConfig, HotspotResponse> = {
  kind: "HOTSPOT",
  schemaVersion: 1,
  configSchema,
  responseSchema,
  scorer,
};

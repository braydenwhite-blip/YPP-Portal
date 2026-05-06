/**
 * Shared Zod schema for `BeatFeedback`.
 *
 * Centralised so adding a new optional simulation field (peerRipple,
 * mentorAside, ambientLine, recoveryPrompt, …) only touches ONE schema —
 * each kind module re-uses this constant rather than duplicating the
 * Zod literal inside its own file.
 */

import { z } from "zod";
import type { BeatFeedback } from "./types";

const studentReactionSchema = z.object({
  studentName: z.string(),
  archetype: z
    .enum([
      "shy",
      "overconfident",
      "distracted",
      "nervous",
      "curious",
      "resistant",
    ])
    .optional(),
  quote: z.string().optional(),
  bodyLanguage: z.string().optional(),
  mood: z
    .enum([
      "shutdown",
      "engaged",
      "confused",
      "checked-out",
      "energized",
      "frustrated",
    ])
    .optional(),
});

const roomDeltaSchema = z.object({
  engagement: z.number().optional(),
  clarity: z.number().optional(),
  energy: z.number().optional(),
});

const recoveryPromptSchema = z.object({
  question: z.string(),
  options: z
    .array(
      z.object({
        id: z.string(),
        label: z.string(),
        reaction: z.string(),
        roomDelta: roomDeltaSchema.optional(),
      })
    )
    .min(2)
    .max(3),
});

export const FEEDBACK_SCHEMA: z.ZodType<BeatFeedback> = z.object({
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
  studentReaction: studentReactionSchema.optional(),
  consequence: z.string().optional(),
  roomDelta: roomDeltaSchema.optional(),

  // Immersion fields (Wave 2 simulation upgrade)
  peerRipple: z.string().optional(),
  mentorAside: z.string().optional(),
  ambientLine: z.string().optional(),
  recoveryPrompt: recoveryPromptSchema.optional(),
});

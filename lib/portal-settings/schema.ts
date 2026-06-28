// Portal-wide settings — VALIDATION (zod).
//
// Mirrors the groups in ./defaults. Every field is optional + coerced so the
// schema validates both (a) a partial patch submitted by the admin form and
// (b) a stored JSON blob (which may hold only a subset of keys). Unknown keys
// are stripped. Numeric bounds keep an edited value sane (e.g. a row cap can
// never be 0 and blank every table).

import { z } from "zod";

const statusOrderSchema = z.record(z.string(), z.coerce.number().int());

export const chapterOsSchema = z
  .object({
    deliberableRowCap: z.coerce.number().int().min(1).max(100),
    partnerFollowUpOverdueStuckDays: z.coerce.number().int().min(0).max(365),
    partnerSinceContactStuckDays: z.coerce.number().int().min(0).max(365),
    instructorDecisionSlaHours: z.coerce.number().int().min(0).max(2160),
    instructorTriageStaleDays: z.coerce.number().int().min(0).max(365),
    partnerStatusOrder: statusOrderSchema,
    instructorStatusOrder: statusOrderSchema,
    curriculumStatusOrder: statusOrderSchema,
    classStatusOrder: statusOrderSchema,
  })
  .partial();

export const peopleStrategySchema = z
  .object({
    staleActivityDays: z.coerce.number().int().min(0).max(365),
    overloadedOpenItems: z.coerce.number().int().min(0).max(1000),
    defaultActionDeadlineDays: z.coerce.number().int().min(0).max(365),
    actionDueSoonDays: z.coerce.number().int().min(0).max(365),
  })
  .partial();

export const classFeedbackSchema = z
  .object({
    goodFeedbackMinRating: z.coerce.number().min(0).max(5),
    goodFeedbackMinResponses: z.coerce.number().int().min(0).max(1000),
  })
  .partial();

export const instructorMentorshipSchema = z
  .object({
    staleSessionDays: z.coerce.number().int().min(0).max(365),
  })
  .partial();

/** Per-group schema, keyed by the stored row key. */
export const PORTAL_SETTINGS_GROUP_SCHEMAS = {
  chapterOs: chapterOsSchema,
  peopleStrategy: peopleStrategySchema,
  classFeedback: classFeedbackSchema,
  instructorMentorship: instructorMentorshipSchema,
} as const;

/** The full patch accepted by the update action — each group optional. */
export const PortalSettingsPatchSchema = z.object({
  chapterOs: chapterOsSchema.optional(),
  peopleStrategy: peopleStrategySchema.optional(),
  classFeedback: classFeedbackSchema.optional(),
  instructorMentorship: instructorMentorshipSchema.optional(),
});

export type PortalSettingsPatch = z.infer<typeof PortalSettingsPatchSchema>;

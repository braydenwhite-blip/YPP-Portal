/**
 * Zod schemas for the Chapter Partner CRM server actions (Partner Automation).
 * Mirrors the weekly-meetings schema conventions (trimmed text, enums from the
 * shared vocabularies, optional→null transforms, strict date coercion).
 */

import { z } from "zod";

import { PARTNER_STAGES, PARTNER_TYPES } from "@/lib/partners-constants";
import { MEETING_OUTCOMES, CLOSE_REASONS } from "@/lib/partners/transitions";
import { LOGISTICS_KEYS } from "@/lib/partners/logistics";

const Id = z.string().trim().min(1);
const Name = z.string().trim().min(1).max(200);
const ShortText = z.string().trim().max(300);
const LongText = z.string().trim().max(20_000);
const OptionalShort = ShortText.optional().transform((v) => (v && v.length > 0 ? v : null));
const OptionalLong = LongText.optional().transform((v) => (v && v.length > 0 ? v : null));

/** Accepts an ISO datetime / date string, coerces to a Date, rejects garbage. */
const DateInput = z
  .string()
  .trim()
  .min(1)
  .transform((v, ctx) => {
    const d = new Date(v);
    if (Number.isNaN(d.getTime())) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Invalid date" });
      return z.NEVER;
    }
    return d;
  });

const PartnerTypeEnum = z.enum(PARTNER_TYPES);
const StageEnum = z.enum(PARTNER_STAGES);

/** Editable partner contact + identity fields (shared by create + update). */
const PartnerFields = {
  name: Name,
  partnerType: PartnerTypeEnum.optional().nullable(),
  location: OptionalShort,
  website: OptionalShort,
  contactName: OptionalShort,
  contactTitle: OptionalShort,
  contactEmail: OptionalShort,
  contactPhone: OptionalShort,
  notes: OptionalLong,
};

export const CreatePartnerSchema = z.object({
  ...PartnerFields,
  // The chapter this partner belongs to. A CP must pass their own chapter; the
  // action re-verifies via requireChapterPartnerAccess.
  chapterId: Id.nullable().optional(),
  stage: StageEnum.optional(),
});
export type CreatePartnerInput = z.infer<typeof CreatePartnerSchema>;

export const UpdatePartnerSchema = z.object({
  partnerId: Id,
  name: Name.optional(),
  partnerType: PartnerTypeEnum.optional().nullable(),
  location: OptionalShort,
  website: OptionalShort,
  contactName: OptionalShort,
  contactTitle: OptionalShort,
  contactEmail: OptionalShort,
  contactPhone: OptionalShort,
  notes: OptionalLong,
});

export const PartnerIdSchema = z.object({ partnerId: Id });

export const MarkEmailSentSchema = z.object({
  partnerId: Id,
  /** A follow-up email (re-arm clock) vs. the initial outreach (advance stage). */
  followUp: z.boolean().optional(),
});

export const LogResponseSchema = z.object({ partnerId: Id, body: OptionalLong });

export const ScheduleMeetingSchema = z.object({
  partnerId: Id,
  meetingDate: DateInput,
  note: OptionalLong,
});

export const LogMeetingOutcomeSchema = z.object({
  partnerId: Id,
  outcome: z.enum(MEETING_OUTCOMES),
  body: OptionalLong,
});

export const ScheduleFollowUpSchema = z.object({
  partnerId: Id,
  nextFollowUpAt: DateInput,
  note: OptionalLong,
});

export const ClosePartnerSchema = z.object({
  partnerId: Id,
  reason: z.enum(CLOSE_REASONS),
  body: OptionalLong,
});

export const UpdateStageSchema = z.object({ partnerId: Id, stage: StageEnum });

export const ToggleLogisticsSchema = z.object({
  partnerId: Id,
  key: z.enum(LOGISTICS_KEYS),
  done: z.boolean(),
});

export const AddNoteSchema = z.object({
  partnerId: Id,
  body: LongText.min(1),
});

export const RaiseIssueSchema = z.object({
  partnerId: Id,
  body: LongText.min(1),
  severity: z.enum(["LOW", "MEDIUM", "HIGH"]).optional(),
  escalate: z.boolean().optional(),
});

export const ResolveIssueSchema = z.object({
  partnerId: Id,
  issueNoteId: Id,
  body: OptionalLong,
});

export const LogCheckInSchema = z.object({ partnerId: Id, body: OptionalLong });

const ImportRow = z.object({
  name: Name,
  type: OptionalShort,
  location: OptionalShort,
  website: OptionalShort,
  contactName: OptionalShort,
  contactTitle: OptionalShort,
  contactEmail: OptionalShort,
  contactPhone: OptionalShort,
  notes: OptionalShort,
});
export type ImportRowInput = z.infer<typeof ImportRow>;

export const ImportPartnersSchema = z.object({
  chapterId: Id,
  rows: z.array(ImportRow).min(1).max(200),
});

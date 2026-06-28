/**
 * Zod input schemas for every Weekly Meetings server action.
 */
import { z } from "zod";

const Id = z.string().trim().min(1);
const ShortText = z.string().trim().max(300);
const LongText = z.string().trim().max(20_000);
const OptionalLong = LongText.optional().transform((v) => (v && v.length > 0 ? v : null));
const OptionalShort = ShortText.optional().transform((v) => (v && v.length > 0 ? v : null));

/** `YYYY-MM-DD` → Date at UTC midnight, or null. */
const OptionalDate = z
  .string()
  .trim()
  .optional()
  .transform((v) =>
    v && /^\d{4}-\d{2}-\d{2}$/.test(v) ? new Date(`${v}T00:00:00.000Z`) : null,
  );

export const MEETING_TYPES = ["OFFICER", "WEEKLY_TEAM_IMPACT", "CHAPTER_IMPACT", "GENERIC"] as const;
export const MEETING_STATUSES = ["SCHEDULED", "IN_PROGRESS", "COMPLETED", "CANCELLED"] as const;
export const ROW_STATUSES = ["NOT_STARTED", "IN_PROGRESS", "BLOCKED", "DONE"] as const;
export const TOPIC_STATUSES = ["OPEN", "DISCUSSED", "DECIDED", "DEFERRED"] as const;
export const FOLLOWUP_STATUSES = ["OPEN", "IN_PROGRESS", "COMPLETED"] as const;

// --- Teams ------------------------------------------------------------------
export const CreateTeamSchema = z.object({
  name: ShortText.min(1),
  slug: ShortText.min(1)
    .regex(/^[a-z0-9-]+$/, "Slug must be lowercase letters, numbers, and dashes")
    .optional(),
  description: OptionalLong,
});

export const UpdateTeamSchema = z.object({
  teamId: Id,
  name: ShortText.min(1).optional(),
  description: OptionalLong,
  status: z.enum(["ACTIVE", "ARCHIVED"]).optional(),
  sortOrder: z.number().int().optional(),
});

export const TeamMemberSchema = z.object({
  teamId: Id,
  userId: Id,
  isLead: z.boolean().optional(),
  role: OptionalShort,
});

export const RemoveMemberSchema = z.object({ teamId: Id, userId: Id });

// --- Weekly Impact ----------------------------------------------------------
export const StartImpactSchema = z.object({
  weekStart: z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/),
  teamId: Id.optional(),
  chapterId: Id.optional(),
});

export const SaveEntrySchema = z.object({
  entryId: Id,
  inputNeeded: OptionalLong,
});

export const AddRowSchema = z.object({ entryId: Id });

export const UpdateRowSchema = z.object({
  rowId: Id,
  type: OptionalShort,
  whatGoal: OptionalLong,
  evidenceNext: OptionalLong,
  due: OptionalDate,
  rowStatus: z.enum(ROW_STATUSES).optional(),
  presentToMeeting: z.boolean().optional(),
  decisionNeeded: z.boolean().optional(),
  sendToBoard: z.boolean().optional(),
});

export const RowIdSchema = z.object({ rowId: Id });
export const EntryIdSchema = z.object({ entryId: Id });

/** Add a pre-filled "Done" row from a mentorship/review contribution. */
export const AddRowFromContributionSchema = z.object({
  entryId: Id,
  type: ShortText.min(1),
  whatGoal: LongText.min(1),
  evidenceNext: OptionalLong,
});

// --- Meetings ---------------------------------------------------------------
export const CreateMeetingSchema = z
  .object({
    type: z.enum(MEETING_TYPES),
    title: ShortText.min(1),
    purpose: OptionalLong,
    scheduledAt: z.string().trim().min(1),
    teamId: Id.optional(),
    chapterId: Id.optional(),
    weekStart: z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    facilitatorId: Id.optional(),
    partnerId: Id.optional(),
    proposal: OptionalLong,
    attendeeIds: z.array(Id).max(200).optional(),
  })
  .superRefine((val, ctx) => {
    if (val.type === "CHAPTER_IMPACT" && !val.chapterId) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["chapterId"], message: "Chapter is required for a Chapter Impact meeting" });
    }
  });

export const UpdateMeetingSchema = z.object({
  meetingId: Id,
  title: ShortText.min(1).optional(),
  purpose: OptionalLong,
  scheduledAt: z.string().trim().optional(),
  facilitatorId: Id.nullable().optional(),
  partnerId: Id.nullable().optional(),
  notes: OptionalLong,
  agenda: OptionalLong,
  proposal: OptionalLong,
  nextSteps: OptionalLong,
  outcome: OptionalLong,
});

export const SetMeetingStatusSchema = z.object({
  meetingId: Id,
  status: z.enum(MEETING_STATUSES),
});

export const MeetingIdSchema = z.object({ meetingId: Id });

export const AttendeeSchema = z.object({
  meetingId: Id,
  userId: Id,
  isOptional: z.boolean().optional(),
});

export const BulkAttendeesSchema = z.object({
  meetingId: Id,
  userIds: z.array(Id).max(200),
});
export const SetPresentSchema = z.object({ attendeeId: Id, present: z.boolean() });
export const AttendeeIdSchema = z.object({ attendeeId: Id });

// --- Officer Topics ---------------------------------------------------------
export const AddTopicSchema = z.object({ meetingId: Id, title: ShortText.min(1) });
export const UpdateTopicSchema = z.object({
  topicId: Id,
  title: ShortText.min(1).optional(),
  detail: OptionalLong,
  status: z.enum(TOPIC_STATUSES).optional(),
  decisionNeeded: z.boolean().optional(),
  sendToBoard: z.boolean().optional(),
  decision: OptionalLong,
  nextSteps: OptionalLong,
});
export const TopicIdSchema = z.object({ topicId: Id });
export const SetTopicOwnersSchema = z.object({
  topicId: Id,
  userIds: z.array(Id).max(20),
});

// --- Decisions & follow-ups -------------------------------------------------
export const AddDecisionSchema = z.object({
  meetingId: Id,
  decision: LongText.min(1),
  rationale: OptionalLong,
  decidedById: Id.optional(),
});
export const DecisionIdSchema = z.object({ decisionId: Id });

export const AddFollowUpSchema = z.object({
  meetingId: Id,
  title: ShortText.min(1),
  detail: OptionalLong,
  ownerId: Id.optional(),
  dueDate: OptionalDate,
});
export const UpdateFollowUpSchema = z.object({
  followUpId: Id,
  status: z.enum(FOLLOWUP_STATUSES),
});
export const FollowUpIdSchema = z.object({ followUpId: Id });

// --- Presentation curation (inline on the runner) ---------------------------
export const SetRowFlagSchema = z.object({
  rowId: Id,
  /** The runner meeting whose page should refresh (rows match by week + scope). */
  meetingId: Id.optional(),
  decisionNeeded: z.boolean().optional(),
  sendToBoard: z.boolean().optional(),
});

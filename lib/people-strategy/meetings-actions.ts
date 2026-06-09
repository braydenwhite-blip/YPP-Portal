"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { prisma } from "@/lib/prisma";
import { requireOfficer } from "@/lib/authorization";
import { isActionTrackerEnabled } from "@/lib/feature-flags";
import { toDateInputValue } from "@/lib/leadership-action-center/dates";
import { parseMeetingCategory } from "./meeting-categories";
import {
  parseRelatedEntityRef,
  parseRelatedEntityUpdate,
  type RelatedEntityRef,
} from "./constants";
import { createActionItem } from "./action-items-actions";

/**
 * People Strategy — Meetings Tracker server actions.
 *
 * Follows the existing `lib/*-actions.ts` convention: `"use server"`, a guard
 * first (`requireOfficer()` — throws "Unauthorized" below officer-tier), zod
 * validation, a prisma write, then `revalidatePath`. Every action is gated by
 * ENABLE_ACTION_TRACKER.
 *
 * The Action-Tracker bridge lives here: `convertFollowUpToAction` /
 * `convertAgendaItemToAction` create a real `ActionItem` (via the shared
 * `createActionItem`) linked to this meeting (`officerMeetingId`), then store the
 * new action's id back on the follow-up / agenda item so the two stay in sync.
 */

const MEETINGS_PATH = "/actions/meetings";

function revalidate(meetingId?: string) {
  revalidatePath(MEETINGS_PATH);
  if (meetingId) revalidatePath(`${MEETINGS_PATH}/${meetingId}`);
}

function ensureEnabled() {
  if (!isActionTrackerEnabled()) {
    throw new Error("Action Tracker is not enabled");
  }
}

const PRIORITY_VALUES = ["LOW", "MEDIUM", "HIGH", "URGENT"] as const;
const MEETING_STATUS_VALUES = ["SCHEDULED", "COMPLETED", "CANCELLED"] as const;
const AGENDA_STATUS_VALUES = ["OPEN", "DISCUSSED", "DEFERRED", "CONVERTED"] as const;
const FOLLOWUP_STATUS_VALUES = ["OPEN", "IN_PROGRESS", "COMPLETED"] as const;
const RECURRENCE_VALUES = ["NONE", "WEEKLY", "BIWEEKLY", "MONTHLY"] as const;

const NonEmptyString = z.string().trim().min(1);
const OptionalText = z
  .string()
  .trim()
  .max(10_000)
  .optional()
  .transform((v) => (v && v.length > 0 ? v : null));
const OptionalId = z
  .string()
  .optional()
  .transform((v) => (v && v.trim() ? v.trim() : null));

/** Combine a date (YYYY-MM-DD) and an optional time (HH:mm) into a Date. */
function combineDateTime(date: string, time?: string | null): Date {
  const t = time && /^\d{2}:\d{2}$/.test(time) ? time : "00:00";
  const parsed = new Date(`${date}T${t}:00`);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error("A valid meeting date and time is required");
  }
  return parsed;
}

function parseCategoryOrThrow(value: string | null | undefined): string | null {
  const parsed = parseMeetingCategory(value);
  if (!parsed.ok) throw new Error(parsed.error);
  return parsed.value;
}

/** Validate the optional meeting → YPP entity link (both-or-neither, known type). */
function parseRelatedRefOrThrow(
  type: string | null | undefined,
  id: string | null | undefined
): RelatedEntityRef | null {
  const parsed = parseRelatedEntityRef({ relatedEntityType: type, relatedEntityId: id });
  if (!parsed.ok) throw new Error(parsed.error);
  return parsed.ref;
}

// --- create meeting ----------------------------------------------------------

const CreateMeetingSchema = z.object({
  title: NonEmptyString.max(300),
  purpose: OptionalText,
  category: z.string().trim().optional(),
  priority: z.enum(PRIORITY_VALUES).default("MEDIUM"),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "A valid date is required"),
  startTime: z.string().optional(),
  endTime: z.string().optional(),
  location: OptionalText,
  recurrence: z.enum(RECURRENCE_VALUES).default("NONE"),
  facilitatorId: OptionalId,
  relatedEntityType: z.string().trim().optional(),
  relatedEntityId: z.string().trim().optional(),
  attendeeIds: z.array(z.string().trim().min(1)).optional().default([]),
  agendaTitles: z.array(z.string().trim().min(1)).optional().default([]),
});

export type CreateMeetingInput = z.input<typeof CreateMeetingSchema>;

export async function createMeeting(input: CreateMeetingInput) {
  ensureEnabled();
  await requireOfficer();
  const data = CreateMeetingSchema.parse(input);

  const start = combineDateTime(data.date, data.startTime);
  const end = data.endTime ? combineDateTime(data.date, data.endTime) : null;
  const category = parseCategoryOrThrow(data.category);
  const relatedRef = parseRelatedRefOrThrow(data.relatedEntityType, data.relatedEntityId);

  const created = await prisma.officerMeeting.create({
    data: {
      title: data.title,
      purpose: data.purpose,
      category,
      priority: data.priority,
      date: start,
      endTime: end,
      location: data.location,
      recurrence: data.recurrence === "NONE" ? null : data.recurrence,
      facilitatorId: data.facilitatorId,
      relatedEntityType: relatedRef?.type ?? null,
      relatedEntityId: relatedRef?.id ?? null,
      attendees: data.attendeeIds.length
        ? {
            create: [...new Set(data.attendeeIds)].map((userId) => ({ userId })),
          }
        : undefined,
      agendaItems: data.agendaTitles.length
        ? {
            create: data.agendaTitles.map((title, i) => ({ title, sortOrder: i })),
          }
        : undefined,
    },
    select: { id: true },
  });

  revalidate(created.id);
  return { id: created.id };
}

// --- update meeting ----------------------------------------------------------

const UpdateMeetingSchema = z.object({
  id: NonEmptyString,
  title: NonEmptyString.max(300).optional(),
  purpose: OptionalText,
  category: z.string().trim().optional(),
  priority: z.enum(PRIORITY_VALUES).optional(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  startTime: z.string().optional(),
  endTime: z.string().optional(),
  location: OptionalText,
  recurrence: z.enum(RECURRENCE_VALUES).optional(),
  facilitatorId: OptionalId,
  relatedEntityType: z.string().trim().optional(),
  relatedEntityId: z.string().trim().optional(),
  status: z.enum(MEETING_STATUS_VALUES).optional(),
});

/** Map the related-entity update interpretation to a Prisma data fragment. */
function relatedEntityUpdateData(input: {
  relatedEntityType?: string;
  relatedEntityId?: string;
}): { relatedEntityType?: string | null; relatedEntityId?: string | null } {
  const update = parseRelatedEntityUpdate(input);
  if (update.kind === "error") throw new Error(update.error);
  if (update.kind === "unchanged") return {};
  if (update.kind === "clear") return { relatedEntityType: null, relatedEntityId: null };
  return { relatedEntityType: update.ref.type, relatedEntityId: update.ref.id };
}

export async function updateMeeting(input: z.input<typeof UpdateMeetingSchema>) {
  ensureEnabled();
  await requireOfficer();
  const data = UpdateMeetingSchema.parse(input);

  const start = data.date ? combineDateTime(data.date, data.startTime) : undefined;
  const end =
    data.date && data.endTime ? combineDateTime(data.date, data.endTime) : undefined;

  await prisma.officerMeeting.update({
    where: { id: data.id },
    data: {
      title: data.title,
      purpose: data.purpose ?? undefined,
      category:
        data.category !== undefined ? parseCategoryOrThrow(data.category) : undefined,
      priority: data.priority,
      date: start,
      endTime: end,
      location: data.location ?? undefined,
      recurrence:
        data.recurrence !== undefined
          ? data.recurrence === "NONE"
            ? null
            : data.recurrence
          : undefined,
      facilitatorId: data.facilitatorId ?? undefined,
      ...relatedEntityUpdateData({
        relatedEntityType: data.relatedEntityType,
        relatedEntityId: data.relatedEntityId,
      }),
      status: data.status,
    },
  });

  revalidate(data.id);
}

export async function setMeetingStatus(
  id: string,
  status: (typeof MEETING_STATUS_VALUES)[number]
) {
  return updateMeeting({ id, status });
}

const SaveNotesSchema = z.object({
  meetingId: NonEmptyString,
  notes: z.string().trim().max(20_000),
});

export async function saveMeetingNotes(input: z.input<typeof SaveNotesSchema>) {
  ensureEnabled();
  await requireOfficer();
  const data = SaveNotesSchema.parse(input);
  await prisma.officerMeeting.update({
    where: { id: data.meetingId },
    data: { notesText: data.notes.length ? data.notes : null },
  });
  revalidate(data.meetingId);
}

// --- agenda ------------------------------------------------------------------

const AddAgendaSchema = z.object({
  meetingId: NonEmptyString,
  title: NonEmptyString.max(300),
  description: OptionalText,
  ownerId: OptionalId,
});

export async function addAgendaItem(input: z.input<typeof AddAgendaSchema>) {
  ensureEnabled();
  await requireOfficer();
  const data = AddAgendaSchema.parse(input);

  const max = await prisma.meetingAgendaItem.aggregate({
    where: { officerMeetingId: data.meetingId },
    _max: { sortOrder: true },
  });

  await prisma.meetingAgendaItem.create({
    data: {
      officerMeetingId: data.meetingId,
      title: data.title,
      description: data.description,
      ownerId: data.ownerId,
      sortOrder: (max._max.sortOrder ?? -1) + 1,
    },
  });
  revalidate(data.meetingId);
}

const SetAgendaStatusSchema = z.object({
  id: NonEmptyString,
  status: z.enum(AGENDA_STATUS_VALUES),
});

export async function setAgendaItemStatus(
  input: z.input<typeof SetAgendaStatusSchema>
) {
  ensureEnabled();
  await requireOfficer();
  const data = SetAgendaStatusSchema.parse(input);
  const item = await prisma.meetingAgendaItem.update({
    where: { id: data.id },
    data: { status: data.status },
    select: { officerMeetingId: true },
  });
  revalidate(item.officerMeetingId);
}

export async function deleteAgendaItem(id: string) {
  ensureEnabled();
  await requireOfficer();
  if (!id) throw new Error("id required");
  const item = await prisma.meetingAgendaItem.delete({
    where: { id },
    select: { officerMeetingId: true },
  });
  revalidate(item.officerMeetingId);
}

// --- decisions ---------------------------------------------------------------

const AddDecisionSchema = z.object({
  meetingId: NonEmptyString,
  decision: NonEmptyString.max(2000),
  rationale: OptionalText,
  decidedById: OptionalId,
});

export async function addDecision(input: z.input<typeof AddDecisionSchema>) {
  ensureEnabled();
  const session = await requireOfficer();
  const data = AddDecisionSchema.parse(input);
  await prisma.meetingDecision.create({
    data: {
      officerMeetingId: data.meetingId,
      decision: data.decision,
      rationale: data.rationale,
      decidedById: data.decidedById ?? session.id,
    },
  });
  revalidate(data.meetingId);
}

export async function deleteDecision(id: string) {
  ensureEnabled();
  await requireOfficer();
  if (!id) throw new Error("id required");
  const dec = await prisma.meetingDecision.delete({
    where: { id },
    select: { officerMeetingId: true },
  });
  revalidate(dec.officerMeetingId);
}

// --- follow-ups --------------------------------------------------------------

const AddFollowUpSchema = z.object({
  meetingId: NonEmptyString,
  title: NonEmptyString.max(300),
  description: OptionalText,
  ownerId: OptionalId,
  dueDate: z.string().optional(),
  priority: z.enum(PRIORITY_VALUES).default("MEDIUM"),
  area: z.string().trim().optional(),
  createAction: z.boolean().optional().default(false),
});

export type AddFollowUpInput = z.input<typeof AddFollowUpSchema>;

export async function addFollowUp(input: AddFollowUpInput) {
  ensureEnabled();
  await requireOfficer();
  const data = AddFollowUpSchema.parse(input);
  const area = parseCategoryOrThrow(data.area);
  const dueDate =
    data.dueDate && /^\d{4}-\d{2}-\d{2}$/.test(data.dueDate)
      ? combineDateTime(data.dueDate, "00:00")
      : null;

  const created = await prisma.meetingFollowUp.create({
    data: {
      officerMeetingId: data.meetingId,
      title: data.title,
      description: data.description,
      ownerId: data.ownerId,
      dueDate,
      priority: data.priority,
      area,
    },
    select: { id: true },
  });

  if (data.createAction) {
    await convertFollowUpToAction(created.id);
  }

  revalidate(data.meetingId);
  return { id: created.id };
}

const SetFollowUpStatusSchema = z.object({
  id: NonEmptyString,
  status: z.enum(FOLLOWUP_STATUS_VALUES),
});

export async function setFollowUpStatus(
  input: z.input<typeof SetFollowUpStatusSchema>
) {
  ensureEnabled();
  await requireOfficer();
  const data = SetFollowUpStatusSchema.parse(input);
  const fu = await prisma.meetingFollowUp.update({
    where: { id: data.id },
    data: {
      status: data.status,
      completedAt: data.status === "COMPLETED" ? new Date() : null,
    },
    select: { officerMeetingId: true },
  });
  revalidate(fu.officerMeetingId);
}

export async function deleteFollowUp(id: string) {
  ensureEnabled();
  await requireOfficer();
  if (!id) throw new Error("id required");
  const fu = await prisma.meetingFollowUp.delete({
    where: { id },
    select: { officerMeetingId: true },
  });
  revalidate(fu.officerMeetingId);
}

// --- Action Tracker bridge ---------------------------------------------------

/**
 * Turn a meeting follow-up into a tracked Action Item. Creates a real
 * `ActionItem` linked to this meeting (so it appears in the meeting's Linked
 * Actions and on the Action Tracker with a "Source: Meeting" badge), then stores
 * the new action's id on the follow-up. Idempotent: if the follow-up is already
 * linked it returns the existing action id.
 */
export async function convertFollowUpToAction(followUpId: string) {
  ensureEnabled();
  const session = await requireOfficer();
  if (!followUpId) throw new Error("followUpId required");

  const fu = await prisma.meetingFollowUp.findUnique({
    where: { id: followUpId },
    include: {
      officerMeeting: { select: { id: true, date: true, category: true, facilitatorId: true } },
    },
  });
  if (!fu) throw new Error("Follow-up not found");
  if (fu.linkedActionId) return { id: fu.linkedActionId };

  const leadId = fu.ownerId ?? fu.officerMeeting.facilitatorId ?? session.id;
  const deadline = fu.dueDate ?? fu.officerMeeting.date ?? new Date();

  const action = await createActionItem({
    title: fu.title,
    description: fu.description ?? undefined,
    leadId,
    priority: fu.priority,
    deadlineStart: toDateInputValue(deadline),
    officerMeetingId: fu.officerMeeting.id,
    actionType: "FOLLOW_UP",
    goalCategory: fu.area ?? fu.officerMeeting.category ?? undefined,
  });

  await prisma.meetingFollowUp.update({
    where: { id: followUpId },
    data: { linkedActionId: action.id },
  });

  revalidate(fu.officerMeeting.id);
  return { id: action.id };
}

/**
 * Convert an agenda item into a tracked Action Item and mark it CONVERTED.
 * Mirrors {@link convertFollowUpToAction} but for agenda lines.
 */
export async function convertAgendaItemToAction(agendaItemId: string) {
  ensureEnabled();
  const session = await requireOfficer();
  if (!agendaItemId) throw new Error("agendaItemId required");

  const item = await prisma.meetingAgendaItem.findUnique({
    where: { id: agendaItemId },
    include: {
      officerMeeting: { select: { id: true, date: true, category: true, facilitatorId: true } },
    },
  });
  if (!item) throw new Error("Agenda item not found");
  if (item.convertedActionId) return { id: item.convertedActionId };

  const leadId = item.ownerId ?? item.officerMeeting.facilitatorId ?? session.id;

  const action = await createActionItem({
    title: item.title,
    description: item.description ?? undefined,
    leadId,
    priority: "MEDIUM",
    deadlineStart: toDateInputValue(item.officerMeeting.date ?? new Date()),
    officerMeetingId: item.officerMeeting.id,
    actionType: "MEETING_RECAP",
    goalCategory: item.officerMeeting.category ?? undefined,
  });

  await prisma.meetingAgendaItem.update({
    where: { id: agendaItemId },
    data: { status: "CONVERTED", convertedActionId: action.id },
  });

  revalidate(item.officerMeeting.id);
  return { id: action.id };
}

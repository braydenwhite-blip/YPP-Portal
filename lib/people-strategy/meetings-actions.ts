"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { prisma } from "@/lib/prisma";
import { requireOfficer } from "@/lib/authorization";
import { isActionTrackerEnabled } from "@/lib/feature-flags";
import { syncMeetingSearchDocument } from "@/lib/help-agent/search-indexing";
import { addDays, toDateInputValue } from "@/lib/leadership-action-center/dates";
import { parseMeetingCategory } from "./meeting-categories";
import {
  DEFAULT_ACTION_DEADLINE_DAYS,
  parseRelatedEntityRef,
  parseRelatedEntityUpdate,
  type RelatedEntityRef,
} from "./constants";
import {
  isMeetingAttendanceStatus,
} from "./meeting-attendance";
import { normalizeMeetingType } from "./meeting-operating-model";
import { buildActionPrefillFromDecision } from "./action-prefill";
import { createActionItem } from "./action-items-actions";
import { deriveStrategicContextForMeeting } from "./strategic-context";

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

const MEETINGS_PATH = "/meetings";

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

function deriveMeetingStrategicLink(meeting: {
  title?: string | null;
  purpose?: string | null;
  category?: string | null;
  relatedEntityType?: string | null;
  relatedEntityId?: string | null;
}) {
  const context = deriveStrategicContextForMeeting({
    title: meeting.title ?? "Meeting",
    purpose: meeting.purpose,
    category: meeting.category,
    relatedEntityType: meeting.relatedEntityType,
    relatedEntityId: meeting.relatedEntityId,
  });
  const project = context.projects[0];
  return {
    strategicInitiativeId: project?.initiativeId ?? context.primaryInitiative?.id,
    strategicProjectId: project?.id,
  };
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
  meetingType: z.string().trim().optional(),
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
  relatedTeam: OptionalText,
  relatedChapter: OptionalText,
  strategicPriority: OptionalText,
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
      meetingType: normalizeMeetingType(data.meetingType),
      category,
      priority: data.priority,
      date: start,
      endTime: end,
      location: data.location,
      recurrence: data.recurrence === "NONE" ? null : data.recurrence,
      facilitatorId: data.facilitatorId,
      relatedEntityType: relatedRef?.type ?? null,
      relatedEntityId: relatedRef?.id ?? null,
      relatedTeam: data.relatedTeam,
      relatedChapter: data.relatedChapter,
      strategicPriority: data.strategicPriority,
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

  await syncMeetingSearchDocument(created.id);
  revalidate(created.id);
  return { id: created.id };
}

// --- update meeting ----------------------------------------------------------

const UpdateMeetingSchema = z.object({
  id: NonEmptyString,
  title: NonEmptyString.max(300).optional(),
  purpose: OptionalText,
  meetingType: z.string().trim().optional(),
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
  relatedTeam: OptionalText,
  relatedChapter: OptionalText,
  strategicPriority: OptionalText,
  summaryStatus: OptionalText,
  rescheduleStatus: OptionalText,
  escalationStatus: OptionalText,
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
      meetingType:
        data.meetingType !== undefined ? normalizeMeetingType(data.meetingType) : undefined,
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
      relatedTeam: data.relatedTeam ?? undefined,
      relatedChapter: data.relatedChapter ?? undefined,
      strategicPriority: data.strategicPriority ?? undefined,
      summaryStatus: data.summaryStatus ?? undefined,
      rescheduleStatus: data.rescheduleStatus ?? undefined,
      escalationStatus: data.escalationStatus ?? undefined,
      status: data.status,
    },
  });

  await syncMeetingSearchDocument(data.id);
  revalidate(data.id);
}

export async function setMeetingStatus(
  id: string,
  status: (typeof MEETING_STATUS_VALUES)[number]
) {
  return updateMeeting({ id, status });
}

const SetAttendeeStatusSchema = z.object({
  id: NonEmptyString,
  status: z.string().trim(),
});

export async function setMeetingAttendeeStatus(input: z.input<typeof SetAttendeeStatusSchema>) {
  ensureEnabled();
  await requireOfficer();
  const data = SetAttendeeStatusSchema.parse(input);
  const status = data.status.trim().toUpperCase();
  if (!isMeetingAttendanceStatus(status)) {
    throw new Error("Unknown attendance status");
  }

  const attendee = await prisma.meetingAttendee.update({
    where: { id: data.id },
    data: {
      attendanceStatus: status,
      attendanceRecordedAt: new Date(),
    },
    select: { officerMeetingId: true },
  });
  revalidate(attendee.officerMeetingId);
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

const SaveMeetingDraftsSchema = z.object({
  meetingId: NonEmptyString,
  agendaText: z.string().trim().max(50_000).optional(),
  summaryText: z.string().trim().max(50_000).optional(),
});

export async function saveGeneratedMeetingDrafts(
  input: z.input<typeof SaveMeetingDraftsSchema>
) {
  ensureEnabled();
  await requireOfficer();
  const data = SaveMeetingDraftsSchema.parse(input);
  const update: {
    agendaText?: string | null;
    summaryEmailText?: string | null;
    summaryStatus?: string;
  } = {};

  if (data.agendaText !== undefined) {
    update.agendaText = data.agendaText.length ? data.agendaText : null;
  }
  if (data.summaryText !== undefined) {
    update.summaryEmailText = data.summaryText.length ? data.summaryText : null;
    update.summaryStatus = data.summaryText.length ? "DRAFT_READY" : "NOT_STARTED";
  }
  if (Object.keys(update).length === 0) return;

  await prisma.officerMeeting.update({
    where: { id: data.meetingId },
    data: update,
  });
  await syncMeetingSearchDocument(data.meetingId);
  revalidate(data.meetingId);
}

const MarkSummarySentSchema = z.object({
  meetingId: NonEmptyString,
  summaryText: z.string().trim().max(50_000),
});

export async function markMeetingSummarySent(input: z.input<typeof MarkSummarySentSchema>) {
  ensureEnabled();
  await requireOfficer();
  const data = MarkSummarySentSchema.parse(input);
  await prisma.officerMeeting.update({
    where: { id: data.meetingId },
    data: {
      summaryEmailText: data.summaryText.length ? data.summaryText : null,
      summaryStatus: "SENT",
    },
  });
  await syncMeetingSearchDocument(data.meetingId);
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

const SaveAgendaItemNotesSchema = z.object({
  id: NonEmptyString,
  notes: z.string().trim().max(20_000),
});

export async function saveAgendaItemNotes(
  input: z.input<typeof SaveAgendaItemNotesSchema>
) {
  ensureEnabled();
  await requireOfficer();
  const data = SaveAgendaItemNotesSchema.parse(input);
  const item = await prisma.meetingAgendaItem.update({
    where: { id: data.id },
    data: { notes: data.notes.length ? data.notes : null },
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

/**
 * Turn a meeting decision into a tracked Action Item — the decision → execution
 * bridge so calls made in a meeting don't die. Mirrors
 * {@link convertFollowUpToAction}: creates a real `ActionItem` (via the shared
 * `createActionItem`) linked to this meeting AND, when the meeting points at a
 * YPP entity, to that entity, prefilled from the decision text/rationale; then
 * stores the new action's id back on the decision. Idempotent — a decision that
 * already has a linked action returns it unchanged.
 */
export async function convertDecisionToAction(decisionId: string) {
  ensureEnabled();
  const session = await requireOfficer();
  if (!decisionId) throw new Error("decisionId required");

  const dec = await prisma.meetingDecision.findUnique({
    where: { id: decisionId },
    include: {
      officerMeeting: {
        select: {
          id: true,
          title: true,
          purpose: true,
          date: true,
          category: true,
          facilitatorId: true,
          relatedEntityType: true,
          relatedEntityId: true,
        },
      },
    },
  });
  if (!dec) throw new Error("Decision not found");
  if (dec.linkedActionId) return { id: dec.linkedActionId };

  // The owner the meeting actually chose (the decider, else the facilitator) —
  // never invented. Used both as the lead and as the prefill's suggestion.
  const suggestedOwnerId = dec.decidedById ?? dec.officerMeeting.facilitatorId ?? null;

  const prefill = buildActionPrefillFromDecision({
    decision: dec.decision,
    rationale: dec.rationale,
    meetingId: dec.officerMeeting.id,
    decisionId: dec.id,
    meetingTitle: dec.officerMeeting.title,
    meetingCategory: dec.officerMeeting.category,
    relatedEntityType: dec.officerMeeting.relatedEntityType,
    relatedEntityId: dec.officerMeeting.relatedEntityId,
    suggestedOwnerId,
  });

  const leadId = suggestedOwnerId ?? session.id;
  const deadline = addDays(new Date(), prefill.dueInDays ?? DEFAULT_ACTION_DEADLINE_DAYS);
  const strategicLink = deriveMeetingStrategicLink(dec.officerMeeting);

  const action = await createActionItem({
    title: prefill.title ?? dec.decision,
    description: prefill.description ?? undefined,
    leadId,
    priority: prefill.priority ?? "MEDIUM",
    deadlineStart: toDateInputValue(deadline),
    officerMeetingId: dec.officerMeeting.id,
    actionType: prefill.actionType,
    goalCategory: prefill.area,
    relatedEntityType: prefill.relatedType,
    relatedEntityId: prefill.relatedId,
    // Action 4.0: record honest provenance — this action carries out a specific
    // meeting decision — plus the seeded definition of done.
    sourceType: prefill.sourceType,
    sourceId: prefill.sourceId,
    strategicInitiativeId: strategicLink.strategicInitiativeId,
    strategicProjectId: strategicLink.strategicProjectId,
    successDefinition: prefill.successDefinition,
  });

  await prisma.meetingDecision.update({
    where: { id: decisionId },
    data: { linkedActionId: action.id },
  });

  revalidate(dec.officerMeeting.id);
  return { id: action.id };
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
  initiativeId: OptionalId,
  workstreamId: OptionalId,
  sourceActionId: OptionalId,
  briefId: OptionalId,
  presentationExpectationId: OptionalId,
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
      initiativeId: data.initiativeId,
      workstreamId: data.workstreamId,
      sourceActionId: data.sourceActionId,
      briefId: data.briefId,
      presentationExpectationId: data.presentationExpectationId,
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
      officerMeeting: {
        select: {
          id: true,
          title: true,
          purpose: true,
          date: true,
          category: true,
          facilitatorId: true,
          relatedEntityType: true,
          relatedEntityId: true,
        },
      },
    },
  });
  if (!fu) throw new Error("Follow-up not found");
  if (fu.linkedActionId) return { id: fu.linkedActionId };

  const leadId = fu.ownerId ?? fu.officerMeeting.facilitatorId ?? session.id;
  const deadline = fu.dueDate ?? fu.officerMeeting.date ?? new Date();
  const strategicLink = deriveMeetingStrategicLink(fu.officerMeeting);

  const action = await createActionItem({
    title: fu.title,
    description: fu.description ?? undefined,
    leadId,
    priority: fu.priority,
    deadlineStart: toDateInputValue(deadline),
    officerMeetingId: fu.officerMeeting.id,
    actionType: "FOLLOW_UP",
    goalCategory: fu.area ?? fu.officerMeeting.category ?? undefined,
    relatedEntityType: fu.officerMeeting.relatedEntityType ?? undefined,
    relatedEntityId: fu.officerMeeting.relatedEntityId ?? undefined,
    sourceType: "FOLLOW_UP",
    sourceId: fu.id,
    sourceActionId: fu.sourceActionId ?? undefined,
    strategicInitiativeId: fu.initiativeId ?? strategicLink.strategicInitiativeId,
    strategicProjectId: strategicLink.strategicProjectId,
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
      officerMeeting: {
        select: {
          id: true,
          title: true,
          purpose: true,
          date: true,
          category: true,
          facilitatorId: true,
          relatedEntityType: true,
          relatedEntityId: true,
        },
      },
    },
  });
  if (!item) throw new Error("Agenda item not found");
  if (item.convertedActionId) return { id: item.convertedActionId };

  const leadId = item.ownerId ?? item.officerMeeting.facilitatorId ?? session.id;
  const strategicLink = deriveMeetingStrategicLink(item.officerMeeting);

  const action = await createActionItem({
    title: item.title,
    description: item.description ?? undefined,
    leadId,
    priority: "MEDIUM",
    deadlineStart: toDateInputValue(item.officerMeeting.date ?? new Date()),
    officerMeetingId: item.officerMeeting.id,
    actionType: "MEETING_RECAP",
    goalCategory: item.officerMeeting.category ?? undefined,
    relatedEntityType: item.officerMeeting.relatedEntityType ?? undefined,
    relatedEntityId: item.officerMeeting.relatedEntityId ?? undefined,
    sourceType: "MEETING",
    sourceId: item.id,
    strategicInitiativeId: strategicLink.strategicInitiativeId,
    strategicProjectId: strategicLink.strategicProjectId,
  });

  await prisma.meetingAgendaItem.update({
    where: { id: agendaItemId },
    data: { status: "CONVERTED", convertedActionId: action.id },
  });

  revalidate(item.officerMeeting.id);
  return { id: action.id };
}

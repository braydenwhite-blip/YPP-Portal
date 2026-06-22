"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { OfficerMeetingStatus } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { requireOfficer } from "@/lib/authorization";
import { isActionTrackerEnabled } from "@/lib/feature-flags";
import { getOfficerMeetingById } from "./officer-meetings-queries";
import {
  buildOfficerMeetingAgendaFallback,
  buildOfficerMeetingSummaryFallback,
  canGenerateSummaryEmail,
  missingDiscussionNotes,
  toGenerationInput,
} from "./officer-meeting-generation";

/**
 * People Strategy — Officer Meetings server actions (Prompt 06A / 06B).
 *
 * Follows the existing `lib/*-actions.ts` convention: `"use server"`, a guard
 * first (`requireOfficer()` — throws "Unauthorized" for anyone below officer-
 * tier), zod validation, prisma write, then `revalidatePath`. Every action is
 * gated by ENABLE_ACTION_TRACKER.
 *
 * Prompt 06B adds deterministic, server-side agenda + summary-email generation
 * (`generateOfficerMeetingAgenda` / `generateOfficerMeetingSummaryEmail`). The
 * text is composed by the reusable fallback builders in
 * `officer-meeting-generation.ts`; no Anthropic API is involved yet.
 */

const MEETINGS_PATH = "/meetings";

function revalidate() {
  revalidatePath(MEETINGS_PATH);
}

function ensureEnabled() {
  if (!isActionTrackerEnabled()) {
    throw new Error("Action Tracker is not enabled");
  }
}

const MEETING_STATUS_VALUES = ["SCHEDULED", "COMPLETED", "CANCELLED"] as const;

const NonEmptyString = z.string().trim().min(1);
const OptionalText = z
  .string()
  .trim()
  .max(10_000)
  .optional()
  .transform((v) => (v && v.length > 0 ? v : null));

/** Parse a datetime-local (or any Date-parseable) string; throws if invalid. */
function parseMeetingDate(value: string): Date {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error("A valid meeting date and time is required");
  }
  return parsed;
}

// --- create / schedule a meeting --------------------------------------------

const CreateMeetingSchema = z.object({
  date: NonEmptyString,
  agendaText: OptionalText,
});

export async function createOfficerMeeting(
  input: z.input<typeof CreateMeetingSchema>
) {
  ensureEnabled();
  await requireOfficer();
  const data = CreateMeetingSchema.parse(input);

  const created = await prisma.officerMeeting.create({
    data: {
      date: parseMeetingDate(data.date),
      agendaText: data.agendaText,
    },
    select: { id: true },
  });

  revalidate();
  return { id: created.id };
}

// --- update meeting (date / status) -----------------------------------------

const UpdateMeetingSchema = z.object({
  id: NonEmptyString,
  date: NonEmptyString.optional(),
  status: z.enum(MEETING_STATUS_VALUES).optional(),
});

export async function updateOfficerMeeting(
  input: z.input<typeof UpdateMeetingSchema>
) {
  ensureEnabled();
  await requireOfficer();
  const data = UpdateMeetingSchema.parse(input);

  await prisma.officerMeeting.update({
    where: { id: data.id },
    data: {
      date: data.date ? parseMeetingDate(data.date) : undefined,
      status: data.status as OfficerMeetingStatus | undefined,
    },
  });

  revalidate();
}

export async function setOfficerMeetingStatus(
  id: string,
  status: (typeof MEETING_STATUS_VALUES)[number]
) {
  return updateOfficerMeeting({ id, status });
}

// --- link / unlink an action item to a meeting ------------------------------

const LinkSchema = z.object({
  meetingId: NonEmptyString,
  actionItemId: NonEmptyString,
});

/**
 * Link an action item to a meeting. Sets the denormalized
 * `ActionItem.officerMeetingId` and seeds an (empty) MeetingNote so the item
 * immediately gets an editable discussion-notes box. Idempotent.
 */
export async function assignActionItemToMeeting(
  input: z.input<typeof LinkSchema>
) {
  ensureEnabled();
  await requireOfficer();
  const data = LinkSchema.parse(input);

  // Validate both exist before writing.
  const [meeting, item] = await Promise.all([
    prisma.officerMeeting.findUnique({
      where: { id: data.meetingId },
      select: { id: true },
    }),
    prisma.actionItem.findUnique({
      where: { id: data.actionItemId },
      select: { id: true, officerMeetingId: true },
    }),
  ]);
  if (!meeting) throw new Error("Meeting not found");
  if (!item) throw new Error("Action item not found");
  if (item.officerMeetingId && item.officerMeetingId !== data.meetingId) {
    throw new Error("Action item is already assigned to a meeting. Unassign it first.");
  }

  await prisma.$transaction(async (tx) => {
    await tx.actionItem.update({
      where: { id: data.actionItemId },
      data: { officerMeetingId: data.meetingId },
    });
    await tx.meetingNote.upsert({
      where: {
        officerMeetingId_actionItemId: {
          officerMeetingId: data.meetingId,
          actionItemId: data.actionItemId,
        },
      },
      create: {
        officerMeetingId: data.meetingId,
        actionItemId: data.actionItemId,
        discussionNotes: "",
      },
      update: {},
    });
  });

  revalidate();
}

/**
 * Unlink an action item from its meeting — returns it to the Unassigned tray.
 * Clears `officerMeetingId` and removes the MeetingNote for that pairing.
 */
export async function unassignActionItemFromMeeting(actionItemId: string) {
  ensureEnabled();
  await requireOfficer();
  if (!actionItemId) throw new Error("actionItemId required");

  const item = await prisma.actionItem.findUnique({
    where: { id: actionItemId },
    select: { id: true, officerMeetingId: true },
  });
  if (!item) throw new Error("Action item not found");

  await prisma.$transaction(async (tx) => {
    if (item.officerMeetingId) {
      await tx.meetingNote.deleteMany({
        where: {
          actionItemId,
          officerMeetingId: item.officerMeetingId,
        },
      });
    }
    await tx.actionItem.update({
      where: { id: actionItemId },
      data: { officerMeetingId: null },
    });
  });

  revalidate();
}

// --- editable discussion notes per linked action item -----------------------

const NoteSchema = z.object({
  meetingId: NonEmptyString,
  actionItemId: NonEmptyString,
  discussionNotes: z.string().trim().max(10_000),
});

export async function saveMeetingNote(input: z.input<typeof NoteSchema>) {
  ensureEnabled();
  await requireOfficer();
  const data = NoteSchema.parse(input);

  const linkedItem = await prisma.actionItem.findFirst({
    where: { id: data.actionItemId, officerMeetingId: data.meetingId },
    select: { id: true },
  });
  if (!linkedItem) {
    throw new Error("Action item is not assigned to this meeting");
  }

  await prisma.meetingNote.upsert({
    where: {
      officerMeetingId_actionItemId: {
        officerMeetingId: data.meetingId,
        actionItemId: data.actionItemId,
      },
    },
    create: {
      officerMeetingId: data.meetingId,
      actionItemId: data.actionItemId,
      discussionNotes: data.discussionNotes,
    },
    update: { discussionNotes: data.discussionNotes },
  });

  revalidate();
}

// --- miscellaneous updates ---------------------------------------------------

const MiscSchema = z.object({
  meetingId: NonEmptyString,
  body: NonEmptyString.max(5000),
});

export async function addMiscUpdate(input: z.input<typeof MiscSchema>) {
  ensureEnabled();
  const session = await requireOfficer();
  const data = MiscSchema.parse(input);

  const meeting = await prisma.officerMeeting.findUnique({
    where: { id: data.meetingId },
    select: { id: true },
  });
  if (!meeting) throw new Error("Meeting not found");

  await prisma.miscUpdate.create({
    data: {
      officerMeetingId: data.meetingId,
      body: data.body,
      addedById: session.id,
    },
  });

  revalidate();
}

const UpdateMiscSchema = z.object({
  id: NonEmptyString,
  body: NonEmptyString.max(5000),
});

export async function updateMiscUpdate(input: z.input<typeof UpdateMiscSchema>) {
  ensureEnabled();
  await requireOfficer();
  const data = UpdateMiscSchema.parse(input);

  await prisma.miscUpdate.update({
    where: { id: data.id },
    data: { body: data.body },
  });

  revalidate();
}

export async function deleteMiscUpdate(id: string) {
  ensureEnabled();
  await requireOfficer();
  if (!id) throw new Error("id required");

  await prisma.miscUpdate.delete({ where: { id } });

  revalidate();
}

// --- deterministic agenda / summary-email generation (Prompt 06B) -----------

async function loadMeetingForGeneration(meetingId: string) {
  const meeting = await getOfficerMeetingById(meetingId);
  if (!meeting) throw new Error("Meeting not found");
  return meeting;
}

/**
 * Compose and store the meeting agenda from its linked action items, statuses,
 * deadlines, assignees, discussion notes and miscellaneous updates. Always
 * available (the agenda is generated before/while notes are still being
 * filled). Returns the generated text so the caller can surface it immediately.
 */
export async function generateOfficerMeetingAgenda(meetingId: string) {
  ensureEnabled();
  await requireOfficer();
  if (!meetingId) throw new Error("meetingId required");

  const meeting = await loadMeetingForGeneration(meetingId);
  const agendaText = buildOfficerMeetingAgendaFallback(toGenerationInput(meeting));

  await prisma.officerMeeting.update({
    where: { id: meetingId },
    data: { agendaText },
  });

  revalidate();
  return { agendaText };
}

/**
 * Compose and store the post-meeting summary email. Disabled until EVERY linked
 * action item has discussion notes — `buildOfficerMeetingSummaryFallback` is the
 * single source of truth for that rule, and this re-checks it explicitly so the
 * server enforces the same gate the UI shows.
 */
export async function generateOfficerMeetingSummaryEmail(meetingId: string) {
  ensureEnabled();
  await requireOfficer();
  if (!meetingId) throw new Error("meetingId required");

  const meeting = await loadMeetingForGeneration(meetingId);
  const input = toGenerationInput(meeting);

  if (!canGenerateSummaryEmail(input)) {
    throw new Error(
      `Cannot generate the summary email until every action item has discussion notes. Missing: ${missingDiscussionNotes(
        input
      ).join(", ")}`
    );
  }

  const summaryEmailText = buildOfficerMeetingSummaryFallback(input);

  await prisma.officerMeeting.update({
    where: { id: meetingId },
    data: { summaryEmailText },
  });

  revalidate();
  return { summaryEmailText };
}

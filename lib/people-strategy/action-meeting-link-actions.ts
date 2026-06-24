"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { prisma } from "@/lib/prisma";
import { requireOfficer } from "@/lib/authorization";
import { isActionTrackerEnabled } from "@/lib/feature-flags";
import { MEETING_TYPE_LABELS, type MeetingType } from "@/lib/weekly-meetings/meeting-types";
import type { MeetingPickerOption } from "./action-meeting-link";

/**
 * People Strategy — link an Action Item to a Meeting from the Actions hub
 * "+ Add to meeting" picker. Rewired onto the new weekly-meetings `Meeting`
 * model (the old OfficerMeeting subsystem was removed): the link is the
 * dedicated `ActionItem.meetingId` FK, independent of sourceType provenance.
 *
 * Follows the `lib/*-actions.ts` convention: guard first (`requireOfficer()`),
 * gated by ENABLE_ACTION_TRACKER, zod-validated, prisma write, then revalidate.
 */

function ensureEnabled() {
  if (!isActionTrackerEnabled()) {
    throw new Error("Action Tracker is not enabled");
  }
}

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Meetings an officer can link an action to from the Actions hub picker — all
 * upcoming (and recently-past) non-cancelled meetings of any type, soonest first.
 */
export async function listMeetingsForActionAssignmentPicker(): Promise<MeetingPickerOption[]> {
  ensureEnabled();
  await requireOfficer();

  const now = new Date();
  const start = new Date(now.getTime() - 21 * DAY_MS);
  const end = new Date(now.getTime() + 120 * DAY_MS);

  const rows = await prisma.meeting.findMany({
    where: {
      status: { not: "CANCELLED" },
      scheduledAt: { gte: start, lte: end },
    },
    select: { id: true, title: true, scheduledAt: true, type: true, status: true },
    orderBy: [{ scheduledAt: "asc" }],
    take: 40,
  });

  return rows.map((row) => ({
    id: row.id,
    title: row.title,
    dateISO: row.scheduledAt.toISOString(),
    kindLabel: MEETING_TYPE_LABELS[row.type as MeetingType] ?? "Meeting",
    status: row.status,
  }));
}

const LinkSchema = z.object({
  actionItemId: z.string().trim().min(1),
  meetingId: z.string().trim().min(1),
});

/**
 * Assign an action to a meeting — sets the dedicated `ActionItem.meetingId` FK.
 * Leaves sourceType/sourceId provenance untouched.
 */
export async function assignActionItemToMeeting(input: z.input<typeof LinkSchema>) {
  ensureEnabled();
  await requireOfficer();
  const data = LinkSchema.parse(input);

  const [meeting, item] = await Promise.all([
    prisma.meeting.findUnique({ where: { id: data.meetingId }, select: { id: true } }),
    prisma.actionItem.findUnique({ where: { id: data.actionItemId }, select: { id: true } }),
  ]);
  if (!meeting) throw new Error("Meeting not found");
  if (!item) throw new Error("Action item not found");

  await prisma.actionItem.update({
    where: { id: data.actionItemId },
    data: { meetingId: data.meetingId },
  });

  revalidatePath("/actions");
  revalidatePath(`/actions/${data.actionItemId}`);
  revalidatePath(`/meetings/${data.meetingId}`);
  return { ok: true };
}

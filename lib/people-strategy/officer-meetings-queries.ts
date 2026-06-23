import type { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { isActionTrackerEnabled } from "@/lib/feature-flags";

import { startOfDay, addDays } from "@/lib/leadership-action-center/dates";
import { meetingCategoryLabel, isMeetingCategory } from "./meeting-categories";
import { inferMeetingType, meetingTypeLabel } from "./meeting-operating-model";
import { meetingDetailHref } from "./meetings-home";

/**
 * People Strategy — Officer Meetings read queries (Prompt 06A).
 *
 * Plain (non-"use server") functions, mirroring `action-queries.ts`. Callers
 * are page guards that have already confirmed officer-tier access, so these do
 * not re-check the session — they only honour the ENABLE_ACTION_TRACKER flag
 * (returning empty results when it is off).
 */

const MEETING_INCLUDE = {
  actionItems: {
    include: {
      department: { select: { id: true, name: true } },
      lead: { select: { id: true, name: true, email: true } },
      meetingNotes: {
        select: { id: true, officerMeetingId: true, discussionNotes: true },
      },
      assignments: {
        select: {
          role: true,
          user: { select: { id: true, name: true, email: true } },
        },
        orderBy: [{ role: "asc" }, { createdAt: "asc" }],
      },
    },
    orderBy: [{ deadlineStart: "asc" }, { createdAt: "asc" }],
  },
  miscUpdates: {
    include: {
      addedBy: { select: { id: true, name: true, email: true } },
    },
    orderBy: [{ createdAt: "asc" }],
  },
  _count: { select: { actionItems: true, miscUpdates: true } },
} satisfies Prisma.OfficerMeetingInclude;

export type OfficerMeetingWithRelations = Prisma.OfficerMeetingGetPayload<{
  include: typeof MEETING_INCLUDE;
}>;

export type UnassignedActionItem = Prisma.ActionItemGetPayload<{
  include: {
    department: { select: { id: true; name: true } };
    lead: { select: { id: true; name: true; email: true } };
  };
}>;

/**
 * Upcoming meetings: SCHEDULED and dated today or later, soonest first. These
 * render as the grouped "upcoming blocks" at the top of /officer-meetings.
 */
export async function listUpcomingMeetings(
  now: Date = new Date()
): Promise<OfficerMeetingWithRelations[]> {
  if (!isActionTrackerEnabled()) return [];

  return prisma.officerMeeting.findMany({
    where: { status: "SCHEDULED", date: { gte: startOfDay(now) } },
    include: MEETING_INCLUDE,
    orderBy: [{ date: "asc" }],
  });
}

/**
 * Past meetings: anything COMPLETED / CANCELLED, plus SCHEDULED meetings whose
 * date has already passed (not yet marked complete). Most recent first.
 */
export async function listPastMeetings(
  now: Date = new Date()
): Promise<OfficerMeetingWithRelations[]> {
  if (!isActionTrackerEnabled()) return [];

  return prisma.officerMeeting.findMany({
    where: {
      OR: [
        { status: { in: ["COMPLETED", "CANCELLED"] } },
        { status: "SCHEDULED", date: { lt: startOfDay(now) } },
      ],
    },
    include: MEETING_INCLUDE,
    orderBy: [{ date: "desc" }],
  });
}

/** Single meeting by id with all relations. Null when missing / flag off. */
export async function getOfficerMeetingById(
  id: string
): Promise<OfficerMeetingWithRelations | null> {
  if (!isActionTrackerEnabled()) return null;

  return prisma.officerMeeting.findUnique({
    where: { id },
    include: MEETING_INCLUDE,
  });
}

/**
 * Action items not yet linked to any officer meeting — the "Unassigned tray".
 * Completed items are excluded (nothing left to discuss). Officer-only items
 * are included because this surface is officer-tier-gated already.
 */
export async function listUnassignedActionItems(): Promise<UnassignedActionItem[]> {
  if (!isActionTrackerEnabled()) return [];

  return prisma.actionItem.findMany({
    where: { officerMeetingId: null, status: { not: "COMPLETE" } },
    include: {
      department: { select: { id: true, name: true } },
      lead: { select: { id: true, name: true, email: true } },
    },
    orderBy: [{ deadlineStart: "asc" }, { createdAt: "desc" }],
    take: 200,
  });
}

export type MeetingPickerOption = {
  id: string;
  title: string;
  dateISO: string;
  kindLabel: string;
  status: string;
  href: string;
};

/**
 * Lightweight meeting list for linking an action from the Actions hub — upcoming
 * scheduled meetings plus recent active ones officers may still attach work to.
 */
export async function listMeetingsForActionPicker(
  now: Date = new Date()
): Promise<MeetingPickerOption[]> {
  if (!isActionTrackerEnabled()) return [];

  const start = addDays(startOfDay(now), -21);
  const end = addDays(startOfDay(now), 120);

  const rows = await prisma.officerMeeting.findMany({
    where: {
      status: { not: "CANCELLED" },
      date: { gte: start, lte: end },
    },
    select: {
      id: true,
      title: true,
      date: true,
      category: true,
      meetingType: true,
      status: true,
    },
    orderBy: [{ date: "asc" }],
    take: 40,
  });

  return rows.map((row) => {
    const meetingType = inferMeetingType({
      meetingType: row.meetingType,
      category: row.category,
      title: row.title,
    });
    const kindLabel =
      meetingTypeLabel(meetingType) ??
      (row.category && isMeetingCategory(row.category)
        ? meetingCategoryLabel(row.category)
        : "Meeting");

    return {
      id: row.id,
      title: row.title,
      dateISO: row.date.toISOString(),
      kindLabel,
      status: row.status,
      href: meetingDetailHref(meetingType, row.id),
    };
  });
}

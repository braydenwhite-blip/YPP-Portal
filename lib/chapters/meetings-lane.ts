// The MEETINGS lane — upcoming, current, and recent meetings for this
// chapter, each showing its decisions, follow-ups (with owner + due date +
// status), and attendees. This is genuinely new: no chapter-scoped meeting
// list with decision/follow-up bodies existed anywhere in the portal before
// this — `loadChapterWorkspace` fetched the counts but never rendered them.
//
// Deliberately NOT built on `lib/weekly-meetings/meetings.ts`'s `listMeetings`
// (portal-wide, unscoped, other callers depend on that shape) — this is its
// own chapter-scoped loader.

import "server-only";

import { prisma } from "@/lib/prisma";
import type { MeetingStatus, MeetingType } from "@prisma/client";

export type MeetingDecisionItem = { id: string; decision: string; decidedByName: string | null; createdAtISO: string };
export type MeetingFollowUpItem = {
  id: string;
  title: string;
  status: "OPEN" | "IN_PROGRESS" | "COMPLETED";
  ownerName: string | null;
  dueDateISO: string | null;
};

export type MeetingLaneItem = {
  id: string;
  title: string;
  type: MeetingType;
  status: MeetingStatus;
  scheduledAtISO: string;
  endAtISO: string | null;
  facilitatorName: string | null;
  partner: { id: string; name: string } | null;
  attendees: { id: string; name: string; present: boolean }[];
  decisions: MeetingDecisionItem[];
  followUps: MeetingFollowUpItem[];
  href: string;
};

export type MeetingsLaneView = {
  headline: string;
  current: MeetingLaneItem[];
  upcoming: MeetingLaneItem[];
  recent: MeetingLaneItem[];
};

const RECENT_CAP = 10;

/**
 * Load this chapter's meetings (up to the most recent 40), bucketed into
 * current / upcoming / recent, each with real decisions, follow-ups, and
 * attendees. Optional `partnerId` narrows to one partner's meetings (the only
 * entity `Meeting` links to directly, via `Meeting.partnerId`).
 */
export async function loadChapterMeetingsLane(chapterId: string, opts?: { partnerId?: string }): Promise<MeetingsLaneView> {
  const rows = await prisma.meeting.findMany({
    where: { chapterId, ...(opts?.partnerId ? { partnerId: opts.partnerId } : {}) },
    orderBy: { scheduledAt: "desc" },
    take: 40,
    select: {
      id: true,
      title: true,
      type: true,
      status: true,
      scheduledAt: true,
      endAt: true,
      facilitator: { select: { name: true } },
      partner: { select: { id: true, name: true } },
      attendees: { select: { user: { select: { id: true, name: true } }, present: true } },
      decisions: { select: { id: true, decision: true, decidedBy: { select: { name: true } }, createdAt: true }, orderBy: { createdAt: "desc" } },
      followUps: {
        select: { id: true, title: true, status: true, dueDate: true, owner: { select: { name: true } } },
        orderBy: { createdAt: "desc" },
      },
    },
  });

  const now = Date.now();
  const items: MeetingLaneItem[] = rows.map((m) => ({
    id: m.id,
    title: m.title,
    type: m.type,
    status: m.status,
    scheduledAtISO: m.scheduledAt.toISOString(),
    endAtISO: m.endAt?.toISOString() ?? null,
    facilitatorName: m.facilitator?.name ?? null,
    partner: m.partner ? { id: m.partner.id, name: m.partner.name } : null,
    attendees: m.attendees.map((a) => ({ id: a.user.id, name: a.user.name ?? "Member", present: a.present })),
    decisions: m.decisions.map((d) => ({ id: d.id, decision: d.decision, decidedByName: d.decidedBy?.name ?? null, createdAtISO: d.createdAt.toISOString() })),
    followUps: m.followUps.map((f) => ({ id: f.id, title: f.title, status: f.status, ownerName: f.owner?.name ?? null, dueDateISO: f.dueDate?.toISOString() ?? null })),
    href: `/meetings/${m.id}`,
  }));

  const current: MeetingLaneItem[] = [];
  const upcoming: MeetingLaneItem[] = [];
  const past: MeetingLaneItem[] = [];

  for (const m of items) {
    const start = new Date(m.scheduledAtISO).getTime();
    const end = m.endAtISO ? new Date(m.endAtISO).getTime() : start;
    if (m.status === "IN_PROGRESS" || (start <= now && end >= now)) current.push(m);
    else if (m.status !== "CANCELLED" && m.status !== "COMPLETED" && start > now) upcoming.push(m);
    else past.push(m);
  }
  upcoming.sort((a, b) => new Date(a.scheduledAtISO).getTime() - new Date(b.scheduledAtISO).getTime());
  const recent = past.slice(0, RECENT_CAP);

  const openFollowUps = items.reduce((n, m) => n + m.followUps.filter((f) => f.status !== "COMPLETED").length, 0);

  return {
    headline: `${upcoming.length} upcoming · ${current.length} in progress · ${openFollowUps} open follow-ups`,
    current,
    upcoming,
    recent,
  };
}

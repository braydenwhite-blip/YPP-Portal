/**
 * Meeting loaders (read side). One generic Meeting entity powers all types;
 * `type` decides which sections the runner shows. The Impact Presentations table
 * auto-populates from people's curated, submitted Weekly Impact rows.
 */
import "server-only";

import { prisma } from "@/lib/prisma";
import { getMeetingActionLinks } from "@/lib/people-strategy/action-queries";
import { weekKey, weekLabel } from "./week";
import {
  MEETING_TYPE_LABELS,
  type MeetingType,
  type MeetingStatus,
  type OfficerTopicDTO,
  type PresentationDTO,
  type MeetingListItem,
  type MeetingDetail,
} from "./meeting-types";

// Client-safe types + labels live in ./meeting-types; re-export so existing
// server-side importers of "@/lib/weekly-meetings/meetings" keep working.
export * from "./meeting-types";

function scopeLabelFor(m: {
  type: string;
  team?: { name: string } | null;
  chapter?: { name: string } | null;
}): string | null {
  if (m.chapter) return m.chapter.name;
  if (m.team) return m.team.name;
  if (m.type === "WEEKLY_TEAM_IMPACT") return "All teams";
  return null;
}

export async function listMeetings(): Promise<MeetingListItem[]> {
  const meetings = await prisma.meeting.findMany({
    orderBy: { scheduledAt: "desc" },
    take: 100,
    include: {
      facilitator: { select: { id: true, name: true } },
      team: { select: { name: true } },
      chapter: { select: { name: true } },
    },
  });
  return meetings.map((m) => ({
    id: m.id,
    type: m.type as MeetingType,
    typeLabel: MEETING_TYPE_LABELS[m.type as MeetingType],
    status: m.status as MeetingStatus,
    title: m.title,
    scheduledISO: m.scheduledAt.toISOString(),
    facilitator: m.facilitator ? { id: m.facilitator.id, name: m.facilitator.name } : null,
    scopeLabel: scopeLabelFor(m),
  }));
}

/** The Impact Presentations rows for a meeting (curated + submitted, in-scope). */
export async function loadImpactPresentations(meeting: {
  id: string;
  type: string;
  teamId: string | null;
  chapterId: string | null;
  weekStart: Date | null;
}): Promise<PresentationDTO[]> {
  if (meeting.type !== "WEEKLY_TEAM_IMPACT" && meeting.type !== "CHAPTER_IMPACT") return [];
  if (!meeting.weekStart) return [];

  const rows = await prisma.weeklyImpactRow.findMany({
    where: {
      presentToMeeting: true,
      entry: {
        weekStart: meeting.weekStart,
        status: "SUBMITTED",
        ...(meeting.type === "CHAPTER_IMPACT"
          ? { chapterId: meeting.chapterId ?? undefined }
          : meeting.teamId
            ? { teamId: meeting.teamId }
            : { NOT: { teamId: null } }),
      },
    },
    include: {
      entry: {
        include: {
          user: { select: { name: true } },
          team: { select: { name: true, sortOrder: true } },
          chapter: { select: { name: true } },
        },
      },
    },
    orderBy: { sortOrder: "asc" },
  });

  return rows
    .map((r) => ({
      rowId: r.id,
      scopeLabel: r.entry.team?.name ?? r.entry.chapter?.name ?? "—",
      scopeOrder: r.entry.team?.sortOrder ?? 0,
      person: r.entry.user.name,
      item: r.whatGoal ?? r.type ?? "(untitled item)",
      evidenceNext: r.evidenceNext,
      decisionNeeded: r.decisionNeeded,
      sendToBoard: r.sendToBoard,
    }))
    .sort((a, b) => a.scopeOrder - b.scopeOrder || a.person.localeCompare(b.person))
    .map(({ scopeOrder: _drop, ...rest }) => rest);
}

export async function getMeeting(id: string): Promise<MeetingDetail | null> {
  const m = await prisma.meeting.findUnique({
    where: { id },
    include: {
      facilitator: { select: { id: true, name: true } },
      team: { select: { name: true } },
      chapter: { select: { name: true } },
      attendees: {
        include: { user: { select: { id: true, name: true } } },
        orderBy: { createdAt: "asc" },
      },
      officerTopics: {
        include: { owners: { include: { user: { select: { id: true, name: true } } } } },
        orderBy: { sortOrder: "asc" },
      },
      decisions: {
        include: { decidedBy: { select: { id: true, name: true } } },
        orderBy: { createdAt: "desc" },
      },
      followUps: {
        include: { owner: { select: { id: true, name: true } } },
        orderBy: { createdAt: "asc" },
      },
    },
  });
  if (!m) return null;

  const presentations = await loadImpactPresentations({
    id: m.id,
    type: m.type,
    teamId: m.teamId,
    chapterId: m.chapterId,
    weekStart: m.weekStart,
  });

  const actionLinks = await getMeetingActionLinks(m.id);

  const officerTopics: OfficerTopicDTO[] = m.officerTopics.map((t) => ({
    id: t.id,
    sortOrder: t.sortOrder,
    title: t.title,
    detail: t.detail,
    status: t.status,
    decisionNeeded: t.decisionNeeded,
    sendToBoard: t.sendToBoard,
    decision: t.decision,
    nextSteps: t.nextSteps,
    owners: t.owners.map((o) => ({ id: o.user.id, name: o.user.name })),
  }));

  return {
    id: m.id,
    type: m.type as MeetingType,
    typeLabel: MEETING_TYPE_LABELS[m.type as MeetingType],
    status: m.status as MeetingStatus,
    title: m.title,
    purpose: m.purpose,
    scheduledISO: m.scheduledAt.toISOString(),
    notes: m.notes,
    facilitator: m.facilitator ? { id: m.facilitator.id, name: m.facilitator.name } : null,
    scopeLabel: scopeLabelFor(m),
    weekKey: m.weekStart ? weekKey(m.weekStart) : null,
    weekLabel: m.weekStart ? weekLabel(m.weekStart) : null,
    attendees: m.attendees.map((a) => ({
      id: a.id,
      userId: a.user.id,
      name: a.user.name,
      present: a.present,
      isOptional: a.isOptional,
    })),
    presentations,
    officerTopics,
    decisions: m.decisions.map((d) => ({
      id: d.id,
      decision: d.decision,
      rationale: d.rationale,
      decidedBy: d.decidedBy ? { id: d.decidedBy.id, name: d.decidedBy.name } : null,
      createdISO: d.createdAt.toISOString(),
      linkedActionId: actionLinks.decisionActionId.get(d.id) ?? null,
    })),
    followUps: m.followUps.map((f) => ({
      id: f.id,
      title: f.title,
      detail: f.detail,
      status: f.status,
      dueISO: f.dueDate ? f.dueDate.toISOString() : null,
      owner: f.owner ? { id: f.owner.id, name: f.owner.name } : null,
      linkedActionId: actionLinks.followUpActionId.get(f.id) ?? null,
    })),
    boardRows: presentations.filter((p) => p.sendToBoard),
    boardTopics: officerTopics.filter((t) => t.sendToBoard),
    linkedActions: actionLinks.actions,
  };
}

/**
 * Meeting loaders (read side). One generic Meeting entity powers all types;
 * `type` decides which sections the runner shows. The Impact Presentations table
 * auto-populates from people's curated, submitted Weekly Impact rows.
 */
import "server-only";

import { prisma } from "@/lib/prisma";
import { getMeetingActionLinks } from "@/lib/people-strategy/action-queries";
import { loadChapterMeetingContext } from "@/lib/chapters/meeting-context";
import { buildImpactCoverage, type ImpactCoverage } from "./impact-link";
import { weekKey, weekLabel } from "./week";
import { partnerPlaybookStatus, PARTNER_PLAYBOOK_STATUS_LABELS } from "@/lib/chapters/pipeline";
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
      _count: {
        select: {
          attendees: true,
          decisions: true,
          followUps: true,
          officerTopics: true,
        },
      },
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
    counts: {
      attendees: m._count.attendees,
      decisions: m._count.decisions,
      followUps: m._count.followUps,
      topics: m._count.officerTopics,
    },
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

/**
 * Coverage for an impact meeting: who in scope has reported for the week. The
 * runner uses this to show "3 of 8 submitted" and nudge the people still out.
 * Team scope yields a full roster (so we can name who's missing); chapter scope
 * has no membership table, so we report only the people who submitted.
 */
export async function loadImpactCoverage(meeting: {
  type: string;
  teamId: string | null;
  chapterId: string | null;
  weekStart: Date | null;
  scopeLabel: string | null;
}): Promise<ImpactCoverage | null> {
  if (meeting.type !== "WEEKLY_TEAM_IMPACT" && meeting.type !== "CHAPTER_IMPACT") return null;
  if (!meeting.weekStart) return null;

  const isChapter = meeting.type === "CHAPTER_IMPACT";

  // Expected roster — only knowable for team-scoped meetings.
  let roster: Array<{ userId: string; name: string }> | null = null;
  if (!isChapter) {
    const memberships = await prisma.teamMembership.findMany({
      where: meeting.teamId
        ? { teamId: meeting.teamId }
        : { team: { status: "ACTIVE" } },
      include: { user: { select: { id: true, name: true } } },
    });
    const byId = new Map<string, { userId: string; name: string }>();
    for (const m of memberships) byId.set(m.user.id, { userId: m.user.id, name: m.user.name });
    roster = Array.from(byId.values());
  }

  const scopeWhere = isChapter
    ? { chapterId: meeting.chapterId ?? undefined }
    : meeting.teamId
      ? { teamId: meeting.teamId }
      : { NOT: { teamId: null } };

  const entries = await prisma.weeklyImpactEntry.findMany({
    where: { weekStart: meeting.weekStart, ...scopeWhere },
    select: {
      userId: true,
      status: true,
      user: { select: { name: true } },
      rows: { where: { presentToMeeting: true }, select: { id: true } },
    },
  });

  return buildImpactCoverage({
    scopeLabel: meeting.scopeLabel ?? (isChapter ? "Chapter" : "All teams"),
    weekLabel: weekLabel(meeting.weekStart),
    roster,
    entries: entries.map((e) => ({
      userId: e.userId,
      name: e.user.name,
      status: e.status,
      presentingCount: e.rows.length,
    })),
  });
}

export async function getMeeting(id: string): Promise<MeetingDetail | null> {
  const m = await prisma.meeting.findUnique({
    where: { id },
    include: {
      facilitator: { select: { id: true, name: true } },
      partner: {
        select: {
          id: true,
          name: true,
          type: true,
          partnerType: true,
          stage: true,
          contactName: true,
          contactTitle: true,
          nextFollowUpAt: true,
          notes: true,
          relationshipLead: { select: { name: true } },
        },
      },
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

  const impactCoverage = await loadImpactCoverage({
    type: m.type,
    teamId: m.teamId,
    chapterId: m.chapterId,
    weekStart: m.weekStart,
    scopeLabel: scopeLabelFor(m),
  });

  const actionLinks = await getMeetingActionLinks(m.id);

  const chapterContext = m.chapterId
    ? await loadChapterMeetingContext(m.chapterId)
    : null;

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
    agenda: m.agenda,
    proposal: m.proposal,
    nextSteps: m.nextSteps,
    outcome: m.outcome,
    facilitator: m.facilitator ? { id: m.facilitator.id, name: m.facilitator.name } : null,
    partner: m.partner ? { id: m.partner.id, name: m.partner.name } : null,
    partnerDetail: m.partner
      ? {
          id: m.partner.id,
          name: m.partner.name,
          type: m.partner.partnerType ?? m.partner.type,
          statusLabel:
            PARTNER_PLAYBOOK_STATUS_LABELS[partnerPlaybookStatus(m.partner.stage)],
          contactName: m.partner.contactName,
          contactTitle: m.partner.contactTitle,
          nextFollowUpAt: m.partner.nextFollowUpAt?.toISOString() ?? null,
          relationshipLeadName: m.partner.relationshipLead?.name ?? null,
          notes: m.partner.notes,
        }
      : null,
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
    impactCoverage,
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
    chapterContext,
  };
}

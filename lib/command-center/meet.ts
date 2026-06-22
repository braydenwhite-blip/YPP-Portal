import type {
  MeetingCardDTO,
  MeetingDetailDTO,
} from "@/lib/people-strategy/meetings-queries";
import type { EffectiveMeetingStatus } from "@/lib/people-strategy/meetings-status";
import type { QueueEngine } from "@/lib/queue/engine";
import { selectDecisionQueue } from "@/lib/queue/selectors";
import type { QueueItem } from "@/lib/queue/types";

import {
  type CcMeeting,
  type CcMeetingStatus,
  dueLabel,
  joinClauses,
  pluralize,
  sentence,
} from "./shared";

/**
 * Meet — meetings as live operating rooms (before / during / after), not a
 * calendar list. The center room is the real meeting record; the rail and
 * counters are the Queue Engine loops connected to it.
 */

export type CcAgendaItem = {
  id: string;
  title: string;
  status: "OPEN" | "DISCUSSED" | "DEFERRED" | "CONVERTED";
  statusLabel: string;
  ownerName: string | null;
};

export type CcMeetingDecision = {
  id: string;
  decision: string;
  decidedByName: string | null;
  pending: boolean;
};

export type CcMeetingAction = {
  id: string;
  title: string;
  ownerName: string | null;
  statusLabel: string;
  dueLabel: string | null;
  href: string;
};

export type CcRoomFollowUp = {
  id: string;
  title: string;
  ownerName: string | null;
  dueLabel: string | null;
  overdue: boolean;
};

export type CcMeetingRoom = Omit<CcMeeting, "attendees"> & {
  notes: string | null;
  agenda: CcAgendaItem[];
  decisions: CcMeetingDecision[];
  actions: CcMeetingAction[];
  attendees: Array<{ id: string; name: string; initials: string; role: string | null }>;
  followUps: CcRoomFollowUp[];
};

export type MeetWorkspaceVM = {
  brief: string;
  counts: { current: number; upcoming: number; followUpsOpen: number; decisionsToConfirm: number };
  rail: { current: CcMeeting[]; upcoming: CcMeeting[]; recent: CcMeeting[] };
  room: CcMeetingRoom | null;
  relatedActions: QueueItem[];
  decisionsNeeded: QueueItem[];
  openLoops: QueueItem[];
};

const STATUS_LABEL: Record<CcMeetingStatus, string> = {
  in_progress: "Live now",
  today: "Today",
  upcoming: "Upcoming",
  needs_follow_up: "Needs follow-up",
  completed: "Completed",
  canceled: "Canceled",
};

const AGENDA_STATUS_LABEL: Record<CcAgendaItem["status"], string> = {
  OPEN: "Open",
  DISCUSSED: "Discussed",
  DEFERRED: "Deferred",
  CONVERTED: "Action created",
};

function mapStatus(status: EffectiveMeetingStatus): CcMeetingStatus {
  return status as CcMeetingStatus;
}

function timeRange(startISO: string, endISO: string | null): string {
  const start = new Date(startISO);
  if (Number.isNaN(start.getTime())) return "";
  const fmt = new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit" });
  if (!endISO) return fmt.format(start);
  const end = new Date(endISO);
  if (Number.isNaN(end.getTime())) return fmt.format(start);
  return `${fmt.format(start)} – ${fmt.format(end)}`;
}

export function toCcMeeting(dto: MeetingCardDTO): CcMeeting {
  const status = mapStatus(dto.effectiveStatus);
  return {
    id: dto.id,
    title: dto.title,
    purpose: dto.purpose,
    location: dto.location,
    categoryLabel: dto.categoryLabel,
    startISO: dto.startISO,
    endISO: dto.endISO,
    timeLabel: timeRange(dto.startISO, dto.endISO),
    status,
    statusLabel: STATUS_LABEL[status],
    live: status === "in_progress",
    attendees: dto.facilitator ? [dto.facilitator] : [],
    attendeeCount: dto.attendeeCount,
    agendaCount: dto.agendaCount,
    agendaDoneCount: dto.agendaDoneCount,
    decisionCount: dto.decisionCount,
    openFollowUps: dto.openFollowUps,
    overdueFollowUps: dto.overdueFollowUps,
    openActions: dto.openLinkedActions,
    href: `/meetings/${dto.id}`,
  };
}

export function toCcMeetingRoom(dto: MeetingDetailDTO, now: Date): CcMeetingRoom {
  const base = toCcMeeting(dto);
  const facilitatorId = dto.facilitator?.id ?? null;
  return {
    ...base,
    notes: dto.notesText,
    agenda: dto.agenda.map((a) => ({
      id: a.id,
      title: a.title,
      status: a.status,
      statusLabel: AGENDA_STATUS_LABEL[a.status],
      ownerName: a.owner?.name ?? null,
    })),
    decisions: dto.decisions.map((d) => ({
      id: d.id,
      decision: d.decision,
      decidedByName: d.decidedBy?.name ?? null,
      pending: d.linkedActionId === null,
    })),
    actions: dto.linkedActions.map((action) => ({
      id: action.id,
      title: action.title,
      ownerName: action.owner?.name ?? null,
      statusLabel: action.status,
      dueLabel: dueLabel(action.deadlineISO, now),
      href: `/actions/${action.id}`,
    })),
    attendees: dto.attendees.map((person) => ({
      id: person.id,
      name: person.name,
      initials: person.initials,
      role: person.id === facilitatorId ? "Facilitator" : null,
    })),
    followUps: dto.followUps
      .filter((f) => f.effectiveStatus !== "completed")
      .map((f) => ({
        id: f.id,
        title: f.title,
        ownerName: f.owner?.name ?? null,
        dueLabel: dueLabel(f.dueISO, now),
        overdue: f.effectiveStatus === "overdue",
      })),
  };
}

function relatedToMeeting(items: QueueItem[], meetingId: string | null): QueueItem[] {
  if (!meetingId) return [];
  return items.filter((item) => item.relatedMeeting?.id === meetingId);
}

function buildBrief(current: CcMeeting[], upcoming: CcMeeting[], followUpsOpen: number): string {
  const clauses: string[] = [];
  const live = current[0];
  if (live) clauses.push(`run ${live.title}`);
  const nextUp = upcoming[0];
  if (nextUp) clauses.push(`prep ${nextUp.title}`);
  if (followUpsOpen > 0) clauses.push(`close ${pluralize(followUpsOpen, "follow-up")} before end of day`);

  const assembled = joinClauses(clauses);
  if (!assembled) return "No meetings need attention right now. Plan the next rhythm when you're ready.";
  return `Today's meeting rhythm: ${sentence(assembled)}.`;
}

export function buildMeetWorkspace(input: {
  meetings: CcMeeting[];
  room: CcMeetingRoom | null;
  engine: QueueEngine;
  now: Date;
}): MeetWorkspaceVM {
  const { meetings, room, engine } = input;

  const current = meetings.filter((m) => m.live || m.status === "in_progress" || m.status === "today");
  const upcoming = meetings.filter((m) => m.status === "upcoming");
  const recent = meetings.filter((m) => m.status === "completed" || m.status === "needs_follow_up");

  const followUpsOpen = meetings.reduce((sum, m) => sum + m.openFollowUps, 0);
  const decisionsConnected = selectDecisionQueue(engine.items).filter((i) => i.signals.connectedToMeeting);

  const relatedActions = relatedToMeeting(engine.items, room?.id ?? null).filter(
    (i) => i.type === "action" || i.type === "follow_up"
  );
  const decisionsNeeded = room
    ? selectDecisionQueue(engine.items).filter((i) => i.relatedMeeting?.id === room.id)
    : decisionsConnected.slice(0, 4);
  const openLoops = relatedToMeeting(engine.items, room?.id ?? null).filter(
    (i) => i.signals.waitingOn || i.signals.blocking || i.signals.overdue
  );

  return {
    brief: buildBrief(current, upcoming, followUpsOpen),
    counts: {
      current: current.length,
      upcoming: upcoming.length,
      followUpsOpen,
      decisionsToConfirm: decisionsConnected.length,
    },
    rail: {
      current: current.slice(0, 4),
      upcoming: upcoming.slice(0, 6),
      recent: recent.slice(0, 4),
    },
    room,
    relatedActions: relatedActions.slice(0, 6),
    decisionsNeeded: decisionsNeeded.slice(0, 4),
    openLoops: openLoops.slice(0, 6),
  };
}

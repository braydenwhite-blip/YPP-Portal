/**
 * Meeting query adapter.
 *
 * The legacy OfficerMeeting query layer was retired in the Weekly Meetings
 * rebuild. This module keeps the small read API that non-meeting surfaces still
 * depend on (Entity/People-360, operational digests, partners, the help agent),
 * but backs it with the NEW `Meeting` model so those features keep working and
 * show current meeting data instead of being gutted.
 *
 * New meetings link to a chapter or team (not the old polymorphic entity
 * vocabulary), so entity lookups resolve where there is a real link — a USER's
 * meetings (facilitated or attended) — and otherwise return an empty list.
 */
import "server-only";

import type { Prisma } from "@prisma/client";

import { isActionTrackerEnabled } from "@/lib/feature-flags";
import { prisma } from "@/lib/prisma";
import {
  getMeetingActionLinksForMeetings,
  type MeetingActionLinks,
} from "./action-queries";
import { isRelatedEntityType, type RelatedEntityRef } from "./constants";
import type { MeetingAttendanceStatus } from "./meeting-attendance";
import { meetingCategoryLabel } from "./meeting-categories";
import type { MeetingType } from "./meeting-operating-model";
import type { EffectiveFollowUpStatus, EffectiveMeetingStatus } from "./meetings-status";

/** Display labels for the NEW Meeting model's types. */
const NEW_MEETING_TYPE_LABELS: Record<string, string> = {
  OFFICER: "Officer Meeting",
  WEEKLY_TEAM_IMPACT: "Operations Impact",
  CHAPTER_IMPACT: "Chapter Impact",
  GENERIC: "General Meeting",
};

const PERSON_SELECT = { id: true, name: true, email: true } as const;

const MEETING_INCLUDE = {
  facilitator: { select: PERSON_SELECT },
  team: { select: { name: true } },
  chapter: { select: { name: true } },
  attendees: { include: { user: { select: PERSON_SELECT } } },
  decisions: { include: { decidedBy: { select: PERSON_SELECT } } },
  followUps: { include: { owner: { select: PERSON_SELECT } } },
  officerTopics: { select: { id: true } },
  presentations: { select: { id: true } },
} satisfies Prisma.MeetingInclude;

export type MeetingWithCommandCenter = Prisma.MeetingGetPayload<{
  include: typeof MEETING_INCLUDE;
}>;

// --- serializable DTOs (compatible with the legacy shape consumers read) ----

export interface PersonDTO {
  id: string;
  name: string;
  initials: string;
}

export interface DecisionDTO {
  id: string;
  decision: string;
  rationale: string | null;
  decidedBy: PersonDTO | null;
  createdISO: string;
  linkedActionId: string | null;
}

export interface FollowUpDTO {
  id: string;
  title: string;
  description: string | null;
  owner: PersonDTO | null;
  dueISO: string | null;
  effectiveStatus: EffectiveFollowUpStatus;
  priority: "LOW" | "MEDIUM" | "HIGH" | "URGENT";
  area: string | null;
  areaLabel: string;
  linkedActionId: string | null;
  initiativeId: string | null;
  workstreamId: string | null;
  sourceActionId: string | null;
  sourceActionTitle: string | null;
  briefId: string | null;
  presentationExpectationId: string | null;
  presentationExpectationPrompt: string | null;
}

export interface LinkedActionDTO {
  id: string;
  title: string;
  owner: PersonDTO | null;
  status: string;
  priority: "LOW" | "MEDIUM" | "HIGH" | "URGENT";
  deadlineISO: string;
  departmentName: string | null;
}

export interface MeetingCardDTO {
  id: string;
  title: string;
  purpose: string | null;
  meetingType?: MeetingType;
  meetingTypeLabel?: string;
  category: string | null;
  categoryLabel: string;
  priority: "LOW" | "MEDIUM" | "HIGH" | "URGENT";
  startISO: string;
  endISO: string | null;
  durationLabel: string | null;
  recurrence: string | null;
  location: string | null;
  relatedTeam?: string | null;
  relatedChapter?: string | null;
  strategicPriority?: string | null;
  summaryStatus?: string;
  rescheduleStatus?: string | null;
  escalationStatus?: string | null;
  facilitator: PersonDTO | null;
  attendeeCount: number;
  requiredAttendeeCount?: number;
  attendanceRecordedCount?: number;
  attendanceConcernCount?: number;
  participantIds: string[];
  effectiveStatus: EffectiveMeetingStatus;
  storedStatus: "SCHEDULED" | "COMPLETED" | "CANCELLED";
  agendaCount: number;
  agendaDoneCount: number;
  decisionCount: number;
  openFollowUps: number;
  overdueFollowUps: number;
  openLinkedActions: number;
  linkedActionCount: number;
  hasNotes?: boolean;
  followUpCount?: number;
  followUpsNeedingOwner?: number;
  followUpsNeedingDueDate?: number;
  decisionsPreview?: DecisionDTO[];
  unconvertedFollowUps?: FollowUpDTO[];
  linkedActionsPreview?: LinkedActionDTO[];
  relatedEntityType: string | null;
  relatedEntityId: string | null;
}

export interface MeetingAttendeeDTO extends PersonDTO {
  attendeeId: string;
  attendanceRole: string;
  attendanceStatus: MeetingAttendanceStatus;
  attendanceStatusLabel: string;
  responsivenessStatus: string | null;
  attendanceNotes: string | null;
  attendanceRecordedISO: string | null;
}

export interface AgendaItemDTO {
  id: string;
  title: string;
  description: string | null;
  status: "OPEN" | "DISCUSSED" | "DEFERRED" | "CONVERTED";
  notes: string | null;
  owner: PersonDTO | null;
  presenter: PersonDTO | null;
  convertedActionId: string | null;
  itemKind: string | null;
  sourceActionId: string | null;
  sourceActionTitle: string | null;
  deliverables: Array<{ id: string; label: string; url: string }>;
  requestedDecision: string | null;
}

export interface MeetingDetailDTO extends MeetingCardDTO {
  notesText: string | null;
  attendees: MeetingAttendeeDTO[];
  agenda: AgendaItemDTO[];
  decisions: DecisionDTO[];
  followUps: FollowUpDTO[];
  linkedActions: LinkedActionDTO[];
}

// --- mappers ----------------------------------------------------------------

function initialsOf(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}

function personDTO(p: { id: string; name: string } | null | undefined): PersonDTO | null {
  return p ? { id: p.id, name: p.name, initials: initialsOf(p.name) } : null;
}

export function meetingDisplayTitle(m: { title: string | null; date?: Date; scheduledAt?: Date }): string {
  if (m.title && m.title.trim()) return m.title;
  const when = m.scheduledAt ?? m.date;
  return when ? `Meeting · ${when.toLocaleDateString("en-US", { month: "short", day: "numeric" })}` : "Meeting";
}

function effectiveMeetingStatus(m: MeetingWithCommandCenter, now: Date): EffectiveMeetingStatus {
  if (m.status === "CANCELLED") return "canceled";
  if (m.status === "COMPLETED") return "completed";
  if (m.status === "IN_PROGRESS") return "in_progress";
  const start = m.scheduledAt;
  const sameDay =
    start.getUTCFullYear() === now.getUTCFullYear() &&
    start.getUTCMonth() === now.getUTCMonth() &&
    start.getUTCDate() === now.getUTCDate();
  if (sameDay) return "today";
  return start.getTime() < now.getTime() ? "needs_follow_up" : "upcoming";
}

function followUpStatus(f: { status: string; dueDate: Date | null }, now: Date): EffectiveFollowUpStatus {
  if (f.status === "COMPLETED") return "completed";
  if (f.dueDate && f.dueDate.getTime() < now.getTime()) return "overdue";
  if (f.status === "IN_PROGRESS") return "in_progress";
  return "open";
}

const OPEN_ACTION = (status: string) => status !== "COMPLETE" && status !== "DROPPED";

function linkedActionToDTO(a: MeetingActionLinks["actions"][number]): LinkedActionDTO {
  return {
    id: a.id,
    title: a.title,
    owner: a.owner ? { id: a.owner.id, name: a.owner.name ?? a.owner.email, initials: initialsOf(a.owner.name ?? a.owner.email) } : null,
    status: a.status,
    priority: a.priority,
    deadlineISO: a.deadlineISO ?? "",
    departmentName: null,
  };
}

/**
 * Map a meeting to its card DTO. Pass `links` (from
 * {@link getMeetingActionLinksForMeetings}) to populate the action-linkage
 * fields — `linkedActionId` on decisions/follow-ups, the linked-action counts,
 * and the preview. Omitting `links` keeps the safe empty defaults.
 */
export function mapMeetingToCardDTO(
  m: MeetingWithCommandCenter,
  now: Date = new Date(),
  links?: MeetingActionLinks,
): MeetingCardDTO {
  const openFollowUps = m.followUps.filter((f) => f.status !== "COMPLETED");
  const linkedActions = links?.actions ?? [];
  const decisionActionId = links?.decisionActionId;
  const followUpActionId = links?.followUpActionId;
  // Follow-ups that are still open AND have not yet become a tracked action.
  const unconverted = openFollowUps.filter((f) => !followUpActionId?.has(f.id));
  return {
    id: m.id,
    title: meetingDisplayTitle(m),
    purpose: m.purpose,
    meetingType: undefined,
    meetingTypeLabel: NEW_MEETING_TYPE_LABELS[m.type] ?? "Meeting",
    category: null,
    categoryLabel: meetingCategoryLabel(null),
    priority: "MEDIUM",
    startISO: m.scheduledAt.toISOString(),
    endISO: m.endAt ? m.endAt.toISOString() : null,
    durationLabel: null,
    recurrence: null,
    location: m.location,
    relatedTeam: m.team?.name ?? null,
    relatedChapter: m.chapter?.name ?? null,
    facilitator: personDTO(m.facilitator),
    attendeeCount: m.attendees.length,
    participantIds: [
      ...(m.facilitatorId ? [m.facilitatorId] : []),
      ...m.attendees.map((a) => a.userId),
    ],
    effectiveStatus: effectiveMeetingStatus(m, now),
    storedStatus: m.status === "CANCELLED" ? "CANCELLED" : m.status === "COMPLETED" ? "COMPLETED" : "SCHEDULED",
    agendaCount: m.officerTopics.length + m.presentations.length,
    agendaDoneCount: 0,
    decisionCount: m.decisions.length,
    openFollowUps: openFollowUps.length,
    overdueFollowUps: openFollowUps.filter((f) => f.dueDate && f.dueDate.getTime() < now.getTime()).length,
    openLinkedActions: linkedActions.filter((a) => OPEN_ACTION(a.status)).length,
    linkedActionCount: linkedActions.length,
    decisionsPreview: m.decisions.slice(0, 3).map((d) => ({
      id: d.id,
      decision: d.decision,
      rationale: d.rationale,
      decidedBy: personDTO(d.decidedBy),
      createdISO: d.createdAt.toISOString(),
      linkedActionId: decisionActionId?.get(d.id) ?? null,
    })),
    unconvertedFollowUps: unconverted.slice(0, 3).map((f) => ({
      id: f.id,
      title: f.title,
      description: f.detail,
      owner: personDTO(f.owner),
      dueISO: f.dueDate ? f.dueDate.toISOString() : null,
      effectiveStatus: followUpStatus(f, now),
      priority: "MEDIUM",
      area: null,
      areaLabel: "",
      linkedActionId: null,
      initiativeId: null,
      workstreamId: null,
      sourceActionId: null,
      sourceActionTitle: null,
      briefId: null,
      presentationExpectationId: null,
      presentationExpectationPrompt: null,
    })),
    linkedActionsPreview: linkedActions.slice(0, 3).map(linkedActionToDTO),
    relatedEntityType: null,
    relatedEntityId: null,
  };
}

/**
 * Map a list of meetings to card DTOs with action linkage resolved in a fixed
 * number of queries (batched), so list surfaces show real linked-action counts
 * without an N+1. Prefer this over `meetings.map(mapMeetingToCardDTO)`.
 */
export async function mapMeetingsToCardDTOs(
  meetings: MeetingWithCommandCenter[],
  now: Date = new Date(),
): Promise<MeetingCardDTO[]> {
  const links = await getMeetingActionLinksForMeetings(meetings.map((m) => m.id));
  return meetings.map((m) => mapMeetingToCardDTO(m, now, links.get(m.id)));
}

// --- queries (new Meeting model) --------------------------------------------

export async function listMeetingsInRange(start: Date, end: Date): Promise<MeetingWithCommandCenter[]> {
  if (!isActionTrackerEnabled()) return [];
  return prisma.meeting.findMany({
    where: { scheduledAt: { gte: start, lte: end } },
    include: MEETING_INCLUDE,
    orderBy: { scheduledAt: "desc" },
  });
}

export async function getMeetingById(id: string): Promise<MeetingWithCommandCenter | null> {
  if (!isActionTrackerEnabled()) return null;
  return prisma.meeting.findUnique({ where: { id }, include: MEETING_INCLUDE });
}

/**
 * Meetings tied to a YPP entity. USER matches the facilitator or an attendee;
 * PARTNER matches the meeting's dedicated `partnerId` scope FK. The other
 * related-entity types (CLASS_OFFERING, MENTORSHIP, INSTRUCTOR_APPLICATION)
 * have no modeled meeting link yet and resolve to [].
 */
export async function getMeetingsForEntity(
  type: string,
  id: string,
  limit = 50,
): Promise<MeetingWithCommandCenter[]> {
  if (!isActionTrackerEnabled()) return [];
  if (!isRelatedEntityType(type)) return [];
  const trimmedId = (id ?? "").trim();
  if (!trimmedId) return [];
  if (type === "USER") {
    return prisma.meeting.findMany({
      where: {
        OR: [{ facilitatorId: trimmedId }, { attendees: { some: { userId: trimmedId } } }],
      },
      include: MEETING_INCLUDE,
      orderBy: { scheduledAt: "desc" },
      take: limit,
    });
  }
  if (type === "PARTNER") {
    return prisma.meeting.findMany({
      where: { partnerId: trimmedId },
      include: MEETING_INCLUDE,
      orderBy: { scheduledAt: "desc" },
      take: limit,
    });
  }
  return [];
}

/**
 * Meetings scoped to a chapter via the dedicated `chapterId` FK (chapter-impact
 * and chapter-scoped meetings). Chapter is not a polymorphic related-entity
 * type, so this lives beside {@link getMeetingsForEntity} rather than inside it.
 */
export async function getMeetingsForChapter(
  chapterId: string,
  limit = 50,
): Promise<MeetingWithCommandCenter[]> {
  if (!isActionTrackerEnabled()) return [];
  const trimmedId = (chapterId ?? "").trim();
  if (!trimmedId) return [];
  return prisma.meeting.findMany({
    where: { chapterId: trimmedId },
    include: MEETING_INCLUDE,
    orderBy: { scheduledAt: "desc" },
    take: limit,
  });
}

export async function getMeetingsForEntities(
  refs: RelatedEntityRef[],
): Promise<Map<string, MeetingWithCommandCenter[]>> {
  const result = new Map<string, MeetingWithCommandCenter[]>();
  if (!isActionTrackerEnabled()) return result;
  for (const ref of refs) {
    const key = `${ref.type}:${ref.id}`;
    if (!result.has(key)) {
      result.set(key, await getMeetingsForEntity(ref.type, ref.id));
    }
  }
  return result;
}

export async function countMeetingsByRelatedEntity(
  type: string,
  ids: string[],
): Promise<Map<string, number>> {
  const result = new Map<string, number>();
  if (!isActionTrackerEnabled()) return result;
  for (const id of Array.from(new Set(ids))) {
    const meetings = await getMeetingsForEntity(type, id);
    result.set(id, meetings.length);
  }
  return result;
}

/** Area-scoped meetings are not modeled on the new Meeting; resolves to []. */
export async function listMeetingsForArea(
  _area?: string,
  _opts?: unknown,
): Promise<MeetingWithCommandCenter[]> {
  return [];
}

export async function listRecentDecisions(limit = 8) {
  if (!isActionTrackerEnabled()) return [];
  return prisma.meetingDecision.findMany({
    orderBy: { createdAt: "desc" },
    take: limit,
    include: {
      decidedBy: { select: { id: true, name: true } },
      meeting: { select: { id: true, title: true, scheduledAt: true } },
    },
  });
}

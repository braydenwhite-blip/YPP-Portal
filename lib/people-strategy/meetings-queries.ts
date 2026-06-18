import type { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { isActionTrackerEnabled } from "@/lib/feature-flags";
import { relatedEntityRefKey } from "./action-queries";
import {
  isRelatedEntityType,
  type RelatedEntityRef,
  type RelatedEntityType,
} from "./constants";
import { meetingCategoryLabel, isMeetingCategory } from "./meeting-categories";
import {
  computeFollowUpStatus,
  computeMeetingStatus,
  type EffectiveFollowUpStatus,
  type EffectiveMeetingStatus,
  type MeetingView,
} from "./meetings-status";

/**
 * People Strategy — Meetings Tracker read queries.
 *
 * Plain (non-"use server") functions mirroring `officer-meetings-queries.ts`.
 * Callers are page guards that have already confirmed officer-tier access, so
 * these don't re-check the session — they only honour ENABLE_ACTION_TRACKER
 * (returning empty results when off).
 *
 * Two output shapes:
 *  - `mapMeetingToView` → the light {@link MeetingView} the pure selectors in
 *    `meetings-status.ts` consume (server-side metric/grouping math).
 *  - `mapMeetingToCardDTO` / `mapMeetingToDetailDTO` → fully serializable DTOs
 *    (ISO strings, pre-computed effective statuses + counts) handed to the
 *    client components, so the React tree never touches a Date or Prisma type.
 */

const PERSON_SELECT = { id: true, name: true, email: true } as const;

const MEETING_INCLUDE = {
  facilitator: { select: PERSON_SELECT },
  attendees: {
    include: { user: { select: PERSON_SELECT } },
    orderBy: { createdAt: "asc" },
  },
  agendaItems: {
    include: {
      owner: { select: PERSON_SELECT },
      presenter: { select: PERSON_SELECT },
      convertedAction: { select: { id: true, status: true } },
      sourceAction: {
        select: {
          id: true,
          title: true,
          status: true,
          fileLinks: {
            select: { id: true, label: true, url: true },
            orderBy: [{ addedAt: "desc" }, { id: "desc" }],
          },
        },
      },
      brief: { select: { id: true, initiativeId: true, workstreamId: true, weekStart: true } },
      teamMeeting: { select: { id: true, title: true, status: true } },
      presentationExpectation: { select: { id: true, kind: true, prompt: true } },
      preparedPresentationItem: {
        select: {
          id: true,
          reasonForOfficerReview: true,
          statusSummary: true,
          requestedDecision: true,
          readiness: true,
          deliverableLinkIds: true,
        },
      },
    },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
  },
  decisions: {
    include: {
      decidedBy: { select: PERSON_SELECT },
      linkedAction: { select: { id: true, status: true } },
    },
    orderBy: { createdAt: "desc" },
  },
  followUps: {
    include: {
      owner: { select: PERSON_SELECT },
      linkedAction: { select: { id: true, status: true } },
      sourceAction: { select: { id: true, title: true } },
      brief: { select: { id: true, initiativeId: true, workstreamId: true, weekStart: true } },
      presentationExpectation: { select: { id: true, kind: true, prompt: true } },
    },
    orderBy: [{ dueDate: "asc" }, { createdAt: "asc" }],
  },
  actionItems: {
    include: {
      lead: { select: PERSON_SELECT },
      department: { select: { id: true, name: true } },
    },
    orderBy: [{ deadlineStart: "asc" }, { createdAt: "asc" }],
  },
} satisfies Prisma.OfficerMeetingInclude;

export type MeetingWithCommandCenter = Prisma.OfficerMeetingGetPayload<{
  include: typeof MEETING_INCLUDE;
}>;

// --- serializable DTOs ------------------------------------------------------

export interface PersonDTO {
  id: string;
  name: string;
  initials: string;
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
  sourceInitiativeId: string | null;
  sourceWorkstreamId: string | null;
  briefId: string | null;
  briefWeekStartISO: string | null;
  teamMeetingId: string | null;
  preparedPresentationItemId: string | null;
  sourceActionId: string | null;
  sourceActionTitle: string | null;
  deliverables: Array<{ id: string; label: string; url: string }>;
  presentationExpectationId: string | null;
  presentationExpectationPrompt: string | null;
  requestedDecision: string | null;
  readinessState: string | null;
  preparedPresentation: {
    reasonForOfficerReview: string;
    statusSummary: string | null;
    requestedDecision: string | null;
    readiness: string;
    deliverableLinkIds: string[];
  } | null;
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
  category: string | null;
  categoryLabel: string;
  priority: "LOW" | "MEDIUM" | "HIGH" | "URGENT";
  startISO: string;
  endISO: string | null;
  durationLabel: string | null;
  recurrence: string | null;
  location: string | null;
  facilitator: PersonDTO | null;
  attendeeCount: number;
  /** Facilitator + attendee user ids, for the dashboard's owner filter. */
  participantIds: string[];
  effectiveStatus: EffectiveMeetingStatus;
  agendaCount: number;
  agendaDoneCount: number;
  decisionCount: number;
  openFollowUps: number;
  overdueFollowUps: number;
  openLinkedActions: number;
  linkedActionCount: number;
  /**
   * Workflow signals the Meeting Command Center selectors read (next-action,
   * wrap-up state). Optional on the type so older unit-test fixtures can stay
   * light; the real query mappers always populate them.
   */
  hasNotes?: boolean;
  /** Total follow-up commitments (any status) captured at the meeting. */
  followUpCount?: number;
  /** Open follow-ups still missing an owner. */
  followUpsNeedingOwner?: number;
  /** Open follow-ups still missing a due date. */
  followUpsNeedingDueDate?: number;
  /**
   * Small inline previews for command-center cards. These are optional on the
   * type so older unit-test fixtures can stay light, but real query mappers
   * always populate them.
   */
  decisionsPreview?: DecisionDTO[];
  unconvertedFollowUps?: FollowUpDTO[];
  linkedActionsPreview?: LinkedActionDTO[];
  /**
   * Polymorphic link to the YPP entity this meeting is about (a class, a
   * mentorship, …), mirroring `ActionItem.relatedEntityType`. Null for a meeting
   * that is only tied to an area (its category) or to nothing in particular.
   */
  relatedEntityType: string | null;
  relatedEntityId: string | null;
}

export interface MeetingDetailDTO extends MeetingCardDTO {
  notesText: string | null;
  attendees: PersonDTO[];
  agenda: AgendaItemDTO[];
  decisions: DecisionDTO[];
  followUps: FollowUpDTO[];
  linkedActions: LinkedActionDTO[];
}

// --- mappers ----------------------------------------------------------------

function initialsFor(name: string): string {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((s) => s[0]?.toUpperCase() ?? "")
    .join("");
}

function personDTO(
  p: { id: string; name: string | null; email: string | null } | null | undefined
): PersonDTO | null {
  if (!p) return null;
  const name = p.name ?? p.email ?? "Unknown";
  return { id: p.id, name, initials: initialsFor(name) || "?" };
}

/** Title fallback so legacy Officer Meetings (no title) still render a label. */
export function meetingDisplayTitle(m: { title: string | null; date: Date }): string {
  if (m.title && m.title.trim()) return m.title.trim();
  return "Officer Meeting";
}

function durationLabel(start: Date, end: Date | null): string | null {
  if (!end) return null;
  const mins = Math.round((end.getTime() - start.getTime()) / 60_000);
  if (mins <= 0) return null;
  // Short meetings read more naturally in minutes (matches the design: "60 min",
  // "45 min", "30 min"); only roll up to hours past 90 minutes.
  if (mins <= 90) return `${mins} min`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m === 0 ? `${h} hr` : `${h} hr ${m} min`;
}

/** Map to the light view the pure selectors consume (Date objects retained). */
export function mapMeetingToView(m: MeetingWithCommandCenter): MeetingView {
  return {
    id: m.id,
    storedStatus: m.status,
    start: m.date,
    end: m.endTime,
    category: m.category,
    followUps: m.followUps.map((f) => ({
      id: f.id,
      status: f.status,
      dueDate: f.dueDate,
      area: f.area,
      priority: f.priority,
    })),
    decisionCount: m.decisions.length,
    agendaCount: m.agendaItems.length,
    agendaDoneCount: m.agendaItems.filter((a) => a.status !== "OPEN").length,
    openLinkedActionCount: m.actionItems.filter((a) => a.status !== "COMPLETE").length,
  };
}

function cardCounts(m: MeetingWithCommandCenter, now: Date) {
  const openFollowUps = m.followUps.filter((f) => f.status !== "COMPLETED").length;
  const overdueFollowUps = m.followUps.filter(
    (f) => computeFollowUpStatus({ status: f.status, dueDate: f.dueDate }, now) === "overdue"
  ).length;
  const openLinkedActions = m.actionItems.filter((a) => a.status !== "COMPLETE").length;
  // Open follow-ups (the loose commitments) missing an owner / a due date — the
  // gaps the wrap-up checklist names exactly.
  const openFollowUpList = m.followUps.filter((f) => f.status !== "COMPLETED");
  const followUpsNeedingOwner = openFollowUpList.filter((f) => !f.ownerId).length;
  const followUpsNeedingDueDate = openFollowUpList.filter((f) => !f.dueDate).length;
  return {
    openFollowUps,
    overdueFollowUps,
    openLinkedActions,
    followUpsNeedingOwner,
    followUpsNeedingDueDate,
  };
}

export function mapMeetingToCardDTO(
  m: MeetingWithCommandCenter,
  now: Date = new Date()
): MeetingCardDTO {
  const view = mapMeetingToView(m);
  const counts = cardCounts(m, now);
  const decisionsPreview = m.decisions.slice(0, 3).map((d) => ({
    id: d.id,
    decision: d.decision,
    rationale: d.rationale,
    decidedBy: personDTO(d.decidedBy),
    createdISO: d.createdAt.toISOString(),
    linkedActionId: d.linkedActionId,
  }));
  const unconvertedFollowUps = m.followUps
    .filter((f) => f.status !== "COMPLETED" && !f.linkedActionId)
    .slice(0, 4)
    .map((f) => ({
      id: f.id,
      title: f.title,
      description: f.description,
      owner: personDTO(f.owner),
      dueISO: f.dueDate ? f.dueDate.toISOString() : null,
      effectiveStatus: computeFollowUpStatus({ status: f.status, dueDate: f.dueDate }, now),
      priority: f.priority,
      area: f.area,
      areaLabel: meetingCategoryLabel(f.area),
      linkedActionId: f.linkedActionId,
      initiativeId: f.initiativeId,
      workstreamId: f.workstreamId,
      sourceActionId: f.sourceActionId,
      sourceActionTitle: f.sourceAction?.title ?? null,
      briefId: f.briefId,
      presentationExpectationId: f.presentationExpectationId,
      presentationExpectationPrompt: f.presentationExpectation?.prompt ?? null,
    }));
  const linkedActionsPreview = m.actionItems.slice(0, 3).map((a) => ({
    id: a.id,
    title: a.title,
    owner: personDTO(a.lead),
    status: a.status,
    priority: a.priority,
    deadlineISO: a.deadlineStart.toISOString(),
    departmentName: a.department?.name ?? null,
  }));
  return {
    id: m.id,
    title: meetingDisplayTitle(m),
    purpose: m.purpose,
    category: m.category,
    categoryLabel: meetingCategoryLabel(m.category),
    priority: m.priority,
    startISO: m.date.toISOString(),
    endISO: m.endTime ? m.endTime.toISOString() : null,
    durationLabel: durationLabel(m.date, m.endTime),
    recurrence: m.recurrence,
    location: m.location,
    facilitator: personDTO(m.facilitator),
    attendeeCount: m.attendees.length,
    participantIds: [
      ...(m.facilitatorId ? [m.facilitatorId] : []),
      ...m.attendees.map((a) => a.userId),
    ],
    effectiveStatus: computeMeetingStatus(view, now),
    agendaCount: m.agendaItems.length,
    agendaDoneCount: m.agendaItems.filter((a) => a.status !== "OPEN").length,
    decisionCount: m.decisions.length,
    openFollowUps: counts.openFollowUps,
    overdueFollowUps: counts.overdueFollowUps,
    openLinkedActions: counts.openLinkedActions,
    linkedActionCount: m.actionItems.length,
    hasNotes: !!m.notesText && m.notesText.trim().length > 0,
    followUpCount: m.followUps.length,
    followUpsNeedingOwner: counts.followUpsNeedingOwner,
    followUpsNeedingDueDate: counts.followUpsNeedingDueDate,
    decisionsPreview,
    unconvertedFollowUps,
    linkedActionsPreview,
    relatedEntityType: m.relatedEntityType,
    relatedEntityId: m.relatedEntityId,
  };
}

export function mapMeetingToDetailDTO(
  m: MeetingWithCommandCenter,
  now: Date = new Date()
): MeetingDetailDTO {
  return {
    ...mapMeetingToCardDTO(m, now),
    notesText: m.notesText,
    attendees: m.attendees.map((a) => personDTO(a.user)).filter((p): p is PersonDTO => !!p),
    agenda: m.agendaItems.map((a) => ({
      id: a.id,
      title: a.title,
      description: a.description,
      status: a.status,
      notes: a.notes,
      owner: personDTO(a.owner),
      presenter: personDTO(a.presenter),
      convertedActionId: a.convertedActionId,
      itemKind: a.itemKind,
      sourceInitiativeId: a.sourceInitiativeId,
      sourceWorkstreamId: a.sourceWorkstreamId,
      briefId: a.briefId,
      briefWeekStartISO: a.brief?.weekStart.toISOString() ?? null,
      teamMeetingId: a.teamMeetingId,
      preparedPresentationItemId: a.preparedPresentationItemId,
      sourceActionId: a.sourceActionId,
      sourceActionTitle: a.sourceAction?.title ?? null,
      deliverables: (a.sourceAction?.fileLinks ?? [])
        .filter((link) => {
          const ids = a.preparedPresentationItem?.deliverableLinkIds ?? [];
          return ids.length === 0 || ids.includes(link.id);
        })
        .map((link) => ({ id: link.id, label: link.label, url: link.url })),
      presentationExpectationId: a.presentationExpectationId,
      presentationExpectationPrompt: a.presentationExpectation?.prompt ?? null,
      requestedDecision: a.requestedDecision,
      readinessState: a.readinessState,
      preparedPresentation: a.preparedPresentationItem
        ? {
            reasonForOfficerReview: a.preparedPresentationItem.reasonForOfficerReview,
            statusSummary: a.preparedPresentationItem.statusSummary,
            requestedDecision: a.preparedPresentationItem.requestedDecision,
            readiness: a.preparedPresentationItem.readiness,
            deliverableLinkIds: a.preparedPresentationItem.deliverableLinkIds,
          }
        : null,
    })),
    decisions: m.decisions.map((d) => ({
      id: d.id,
      decision: d.decision,
      rationale: d.rationale,
      decidedBy: personDTO(d.decidedBy),
      createdISO: d.createdAt.toISOString(),
      linkedActionId: d.linkedActionId,
    })),
    followUps: m.followUps.map((f) => ({
      id: f.id,
      title: f.title,
      description: f.description,
      owner: personDTO(f.owner),
      dueISO: f.dueDate ? f.dueDate.toISOString() : null,
      effectiveStatus: computeFollowUpStatus({ status: f.status, dueDate: f.dueDate }, now),
      priority: f.priority,
      area: f.area,
      areaLabel: meetingCategoryLabel(f.area),
      linkedActionId: f.linkedActionId,
      initiativeId: f.initiativeId,
      workstreamId: f.workstreamId,
      sourceActionId: f.sourceActionId,
      sourceActionTitle: f.sourceAction?.title ?? null,
      briefId: f.briefId,
      presentationExpectationId: f.presentationExpectationId,
      presentationExpectationPrompt: f.presentationExpectation?.prompt ?? null,
    })),
    linkedActions: m.actionItems.map((a) => ({
      id: a.id,
      title: a.title,
      owner: personDTO(a.lead),
      status: a.status,
      priority: a.priority,
      deadlineISO: a.deadlineStart.toISOString(),
      departmentName: a.department?.name ?? null,
    })),
  };
}

// --- queries ----------------------------------------------------------------

/** Meetings whose START falls within [start, end], soonest first. */
export async function listMeetingsInRange(
  start: Date,
  end: Date
): Promise<MeetingWithCommandCenter[]> {
  if (!isActionTrackerEnabled()) return [];
  return prisma.officerMeeting.findMany({
    where: { date: { gte: start, lte: end } },
    include: MEETING_INCLUDE,
    orderBy: [{ date: "asc" }],
  });
}

/** Single meeting by id with all command-center relations. */
export async function getMeetingById(
  id: string
): Promise<MeetingWithCommandCenter | null> {
  if (!isActionTrackerEnabled()) return null;
  return prisma.officerMeeting.findUnique({
    where: { id },
    include: MEETING_INCLUDE,
  });
}

// --- related-entity reads (cross-portal nervous system) ---------------------

/**
 * Meetings linked to a single YPP entity (every meeting about one class, one
 * mentorship, …), most recent first. The meeting equivalent of
 * `getActionsForEntity` — it reads the polymorphic `relatedEntityType` /
 * `relatedEntityId` columns so an entity page can show "this was discussed in
 * these meetings". Fails safe (returns []) on a bad type, a blank id, or the
 * tracker flag being off, so a stale link can never break a page. Callers are
 * officer-gated page guards, so there is no per-viewer visibility model (mirrors
 * the rest of this module).
 */
export async function getMeetingsForEntity(
  type: RelatedEntityType,
  id: string,
  limit = 50
): Promise<MeetingWithCommandCenter[]> {
  if (!isActionTrackerEnabled()) return [];
  if (!isRelatedEntityType(type)) return [];
  const trimmedId = id.trim();
  if (!trimmedId) return [];

  return prisma.officerMeeting.findMany({
    where: { relatedEntityType: type, relatedEntityId: trimmedId },
    include: MEETING_INCLUDE,
    orderBy: [{ date: "desc" }],
    take: limit,
  });
}

/**
 * Batch variant of {@link getMeetingsForEntity}: loads meetings for many entities
 * in ONE query and groups them by ref (avoids N+1 on a hub listing many classes
 * or mentorships). Every valid ref is present in the returned Map — with an empty
 * array when it has no meetings — so callers can render an empty state without a
 * follow-up lookup. Invalid / blank / duplicate refs are skipped. Use
 * {@link relatedEntityRefKey} to read entries back.
 */
export async function getMeetingsForEntities(
  refs: RelatedEntityRef[]
): Promise<Map<string, MeetingWithCommandCenter[]>> {
  const result = new Map<string, MeetingWithCommandCenter[]>();
  if (!isActionTrackerEnabled()) return result;

  const validRefs: Array<{ type: RelatedEntityType; id: string }> = [];
  for (const ref of refs) {
    if (!ref || !isRelatedEntityType(ref.type)) continue;
    const id = ref.id?.trim();
    if (!id) continue;
    const key = relatedEntityRefKey(ref.type, id);
    if (result.has(key)) continue;
    result.set(key, []);
    validRefs.push({ type: ref.type, id });
  }
  if (validRefs.length === 0) return result;

  const meetings = await prisma.officerMeeting.findMany({
    where: {
      OR: validRefs.map((ref) => ({
        relatedEntityType: ref.type,
        relatedEntityId: ref.id,
      })),
    },
    include: MEETING_INCLUDE,
    orderBy: [{ date: "desc" }],
  });

  for (const meeting of meetings) {
    if (!meeting.relatedEntityType || !meeting.relatedEntityId) continue;
    const list = result.get(
      relatedEntityRefKey(meeting.relatedEntityType, meeting.relatedEntityId)
    );
    if (list) list.push(meeting);
  }

  return result;
}

/**
 * Count meetings linked to each of the given entities of one type, in a single
 * grouped query — so a list page can show an "N meetings" hint per row without an
 * N+1. Returns empty when the tracker flag is off.
 */
export async function countMeetingsByRelatedEntity(
  type: RelatedEntityType,
  ids: string[]
): Promise<Map<string, number>> {
  const result = new Map<string, number>();
  if (!isActionTrackerEnabled()) return result;
  if (!isRelatedEntityType(type)) return result;
  const uniqueIds = Array.from(new Set(ids.filter(Boolean)));
  if (uniqueIds.length === 0) return result;

  const groups = await prisma.officerMeeting.groupBy({
    by: ["relatedEntityId"],
    where: { relatedEntityType: type, relatedEntityId: { in: uniqueIds } },
    _count: { _all: true },
  });
  for (const group of groups) {
    if (group.relatedEntityId) result.set(group.relatedEntityId, group._count._all);
  }
  return result;
}

/**
 * Meetings tagged with one YPP operating area (their `category`), most recent
 * first. Powers an area pulse / department rollup. Optionally bounded to a date
 * range. Returns [] for an unknown area or with the tracker off.
 */
export async function listMeetingsForArea(
  area: string,
  opts: { since?: Date; until?: Date; limit?: number } = {}
): Promise<MeetingWithCommandCenter[]> {
  if (!isActionTrackerEnabled()) return [];
  if (!isMeetingCategory(area)) return [];
  const where: Prisma.OfficerMeetingWhereInput = { category: area };
  if (opts.since || opts.until) {
    where.date = {
      ...(opts.since ? { gte: opts.since } : {}),
      ...(opts.until ? { lte: opts.until } : {}),
    };
  }
  return prisma.officerMeeting.findMany({
    where,
    include: MEETING_INCLUDE,
    orderBy: [{ date: "desc" }],
    take: opts.limit ?? 100,
  });
}

/**
 * Recent decisions across meetings (for the dashboard's "Recent Decisions"
 * widget), newest first.
 */
export async function listRecentDecisions(limit = 8) {
  if (!isActionTrackerEnabled()) return [];
  return prisma.meetingDecision.findMany({
    include: {
      decidedBy: { select: PERSON_SELECT },
      officerMeeting: { select: { id: true, title: true, date: true, category: true } },
    },
    orderBy: { createdAt: "desc" },
    take: limit,
  });
}

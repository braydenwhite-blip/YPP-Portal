import type { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { isActionTrackerEnabled } from "@/lib/feature-flags";
import { whereActiveMember } from "@/lib/user-role-where";

import {
  ensureStandingActionDepartments,
  sortActionDepartmentOptions,
  type ActionDepartmentOption,
} from "./action-departments";
export type { ActionDepartmentOption } from "./action-departments";
export {
  ensureStandingActionDepartments,
  groupActionDepartments,
  sortActionDepartmentOptions,
} from "./action-departments";
import { hydrateActionItemDepartmentLinks } from "./action-item-departments";

import {
  canViewAction,
  isUserInvolvedInAction,
  type ActionAccessShape,
  type ActionViewer,
} from "./action-permissions";
import {
  isRelatedEntityType,
  type RelatedEntityRef,
  type RelatedEntityType,
} from "./constants";

/**
 * People Strategy — Action Item read queries.
 *
 * These are plain (non-"use server") functions, mirroring the existing
 * `lib/leadership-action-center/queries.ts` convention. They take a trusted,
 * server-resolved `viewer` (e.g. from a page guard) and ENFORCE visibility —
 * never returning an action the viewer is not allowed to see. With the
 * ENABLE_ACTION_TRACKER flag off they return the empty / not-found result.
 */

const ACTION_ITEM_INCLUDE = {
  lead: {
    select: {
      id: true,
      name: true,
      email: true,
      primaryRole: true,
      title: true,
      internalLevel: true,
      ladder: true,
      canonicalTitle: true,
      adminSubtypes: { select: { subtype: true } },
      profile: { select: { avatarUrl: true } },
    },
  },
  createdBy: {
    select: {
      id: true,
      name: true,
      email: true,
      primaryRole: true,
      title: true,
      internalLevel: true,
      ladder: true,
      canonicalTitle: true,
      adminSubtypes: { select: { subtype: true } },
      profile: { select: { avatarUrl: true } },
    },
  },
  approvedBy: {
    select: {
      id: true,
      name: true,
      email: true,
      primaryRole: true,
      title: true,
      adminSubtypes: { select: { subtype: true } },
      profile: { select: { avatarUrl: true } },
    },
  },
  department: { select: { id: true, name: true, slug: true } },
  mentorshipSession: {
    select: {
      id: true,
      mentorshipId: true,
      title: true,
      scheduledAt: true,
      completedAt: true,
    },
  },
  assignments: {
    select: {
      id: true,
      role: true,
      createdAt: true,
      user: {
        select: {
          id: true,
          name: true,
          email: true,
          primaryRole: true,
          title: true,
          adminSubtypes: { select: { subtype: true } },
          profile: { select: { avatarUrl: true } },
        },
      },
    },
  },
  comments: {
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    include: {
      author: {
        select: {
          id: true,
          name: true,
          email: true,
          primaryRole: true,
          title: true,
          adminSubtypes: { select: { subtype: true } },
          profile: { select: { avatarUrl: true } },
        },
      },
    },
  },
  fileLinks: {
    orderBy: [{ addedAt: "desc" }, { id: "desc" }],
    include: {
      addedBy: {
        select: {
          id: true,
          name: true,
          email: true,
          primaryRole: true,
          title: true,
          adminSubtypes: { select: { subtype: true } },
          profile: { select: { avatarUrl: true } },
        },
      },
    },
  },
  // Meeting this action is explicitly assigned to (dedicated meetingId FK), used
  // to render the "Meeting: …" link on the hub card and detail page.
  meeting: {
    select: { id: true, title: true, scheduledAt: true, type: true, status: true },
  },
  // Chapter this action belongs to (chapter "next steps" are real actions), used
  // to render the "Chapter: …" link and to drive the chapter filter on the hub.
  chapter: {
    select: { id: true, name: true, lifecycleStatus: true },
  },
} satisfies Prisma.ActionItemInclude;

export type ActionItemWithRelations = Prisma.ActionItemGetPayload<{
  include: typeof ACTION_ITEM_INCLUDE;
}> & {
  departmentLinks: Array<{ department: { id: string; name: string; slug: string | null } }>;
};

async function withDepartmentLinks(
  items: Prisma.ActionItemGetPayload<{ include: typeof ACTION_ITEM_INCLUDE }>[]
): Promise<ActionItemWithRelations[]> {
  return hydrateActionItemDepartmentLinks(items);
}

/** Reduce a loaded action to the shape the access policy needs. */
function toAccessShape(item: {
  leadId: string | null;
  createdById: string | null;
  visibility: ActionAccessShape["visibility"];
  assignments: Array<{
    role: ActionAccessShape["assignments"][number]["role"];
    user?: { id: string } | null;
    userId?: string;
  }>;
}): ActionAccessShape {
  return {
    leadId: item.leadId,
    createdById: item.createdById,
    visibility: item.visibility,
    assignments: item.assignments.map((a) => ({
      userId: a.userId ?? a.user?.id ?? "",
      role: a.role,
    })),
  };
}

/**
 * Actions where `userId` is LEAD, EXECUTING, or INPUT ("My Actions").
 * Creating an action for someone else does not include it here — only
 * involvement as lead or assignee counts. Results are filtered to what
 * `viewer` is allowed to see.
 */
export async function getMyActionItems(
  userId: string,
  viewer: ActionViewer
): Promise<ActionItemWithRelations[]> {
  if (!isActionTrackerEnabled()) return [];

  const items = await prisma.actionItem.findMany({
    where: {
      OR: [
        { leadId: userId },
        { assignments: { some: { userId } } },
      ],
    },
    include: ACTION_ITEM_INCLUDE,
    orderBy: [
      { status: "asc" },
      { deadlineStart: "asc" },
      { createdAt: "desc" },
    ],
  });

  const hydrated = await withDepartmentLinks(items);
  return hydrated.filter((item) => {
    const shape = toAccessShape(item);
    return canViewAction(viewer, shape) && isUserInvolvedInAction(userId, shape);
  });
}

/**
 * All actions the `viewer` is allowed to see, newest first. Officers see every
 * item (subject to OFFICERS_ONLY visibility); members see only their own. Used
 * by the lightweight Actions index that hosts the create/edit form routes.
 */
export async function listVisibleActionItems(
  viewer: ActionViewer
): Promise<ActionItemWithRelations[]> {
  if (!isActionTrackerEnabled()) return [];

  const items = await prisma.actionItem.findMany({
    include: ACTION_ITEM_INCLUDE,
    orderBy: [{ createdAt: "desc" }],
    take: 200,
  });

  const hydrated = await withDepartmentLinks(items);
  return hydrated.filter((item) => canViewAction(viewer, toAccessShape(item)));
}

const ARCHIVED_WHERE = {
  OR: [
    { status: "DROPPED" as const },
    { status: "COMPLETE" as const, approvedAt: { not: null } },
  ],
};

/**
 * Archived actions the viewer may see: approved completions and dropped items.
 */
export async function listVisibleArchivedActionItems(
  viewer: ActionViewer,
): Promise<ActionItemWithRelations[]> {
  if (!isActionTrackerEnabled()) return [];

  const items = await prisma.actionItem.findMany({
    where: ARCHIVED_WHERE,
    include: ACTION_ITEM_INCLUDE,
    orderBy: [{ updatedAt: "desc" }],
    take: 500,
  });

  const hydrated = await withDepartmentLinks(items);
  return hydrated.filter((item) => canViewAction(viewer, toAccessShape(item)));
}

/** Archived actions the user was involved in (lead or assignee). */
export async function getMyArchivedActionItems(
  userId: string,
  viewer: ActionViewer,
): Promise<ActionItemWithRelations[]> {
  if (!isActionTrackerEnabled()) return [];

  const items = await prisma.actionItem.findMany({
    where: {
      AND: [
        ARCHIVED_WHERE,
        {
          OR: [
            { leadId: userId },
            { assignments: { some: { userId } } },
          ],
        },
      ],
    },
    include: ACTION_ITEM_INCLUDE,
    orderBy: [{ updatedAt: "desc" }],
    take: 500,
  });

  const hydrated = await withDepartmentLinks(items);
  return hydrated.filter((item) => {
    const shape = toAccessShape(item);
    return canViewAction(viewer, shape) && isUserInvolvedInAction(userId, shape);
  });
}

/**
 * Every action item with relations, leadership-wide (no per-viewer scoping).
 * For trusted server-side leadership summaries — specifically the weekly
 * Leadership Briefing cron — where the audience (Leadership / Board) can already
 * see everything, so visibility filtering would be a no-op. Returns [] when the
 * tracker flag is off. Never call this from a member-facing surface; use
 * `listVisibleActionItems` there.
 */
export async function listAllActionItems(): Promise<ActionItemWithRelations[]> {
  if (!isActionTrackerEnabled()) return [];

  const items = await prisma.actionItem.findMany({
    include: ACTION_ITEM_INCLUDE,
    orderBy: [{ createdAt: "desc" }],
  });
  return withDepartmentLinks(items);
}

/**
 * Single action by id, enforcing visibility for `viewer`. Returns null when the
 * action does not exist, the viewer cannot see it, or the feature flag is off —
 * the existing "not found / access denied" convention.
 */
export async function getActionItemById(
  id: string,
  viewer: ActionViewer
): Promise<ActionItemWithRelations | null> {
  if (!isActionTrackerEnabled()) return null;

  const item = await prisma.actionItem.findUnique({
    where: { id },
    include: ACTION_ITEM_INCLUDE,
  });
  if (!item) return null;
  const [hydrated] = await withDepartmentLinks([item]);
  if (!canViewAction(viewer, toAccessShape(hydrated))) return null;
  return hydrated;
}

// ---------------------------------------------------------------------------
// Meeting ↔ action linkage
// ---------------------------------------------------------------------------

/** A tracked action that originated from a meeting (lean shape for previews). */
export type MeetingLinkedAction = {
  id: string;
  title: string;
  status: string;
  priority: "LOW" | "MEDIUM" | "HIGH" | "URGENT";
  deadlineISO: string | null;
  owner: { id: string; name: string | null; email: string } | null;
  sourceType: string | null;
  sourceId: string | null;
};

export type MeetingActionLinks = {
  /** Decision id → the action that carries it out (first match). */
  decisionActionId: Map<string, string>;
  /** Follow-up id → the action that carries it out (first match). */
  followUpActionId: Map<string, string>;
  /** Every action sourced from this meeting (decision / follow-up / meeting-level). */
  actions: MeetingLinkedAction[];
};

function emptyMeetingActionLinks(): MeetingActionLinks {
  return { decisionActionId: new Map(), followUpActionId: new Map(), actions: [] };
}

/**
 * Resolve which of a meeting's decisions / follow-ups have become tracked
 * actions (and any meeting-level actions), using the honest source provenance
 * stored on `ActionItem` (`sourceType` + `sourceId`). No schema coupling: a
 * `MEETING` action points at the meeting id, a `MEETING_DECISION` action at the
 * decision id, a `MEETING_FOLLOW_UP` action at the follow-up id. Returns empty
 * maps/list when the tracker flag is off or the meeting has no decisions/
 * follow-ups and no meeting-level actions.
 */
export async function getMeetingActionLinks(meetingId: string): Promise<MeetingActionLinks> {
  if (!isActionTrackerEnabled() || !meetingId) return emptyMeetingActionLinks();

  const meeting = await prisma.meeting.findUnique({
    where: { id: meetingId },
    select: { decisions: { select: { id: true } }, followUps: { select: { id: true } } },
  });
  if (!meeting) return emptyMeetingActionLinks();

  const decisionIds = meeting.decisions.map((d) => d.id);
  const followUpIds = meeting.followUps.map((f) => f.id);

  const or: Prisma.ActionItemWhereInput[] = [
    { sourceType: "MEETING", sourceId: meetingId },
  ];
  if (decisionIds.length) or.push({ sourceType: "MEETING_DECISION", sourceId: { in: decisionIds } });
  if (followUpIds.length) or.push({ sourceType: "MEETING_FOLLOW_UP", sourceId: { in: followUpIds } });

  const rows = await prisma.actionItem.findMany({
    where: { OR: or },
    select: {
      id: true,
      title: true,
      status: true,
      priority: true,
      deadlineStart: true,
      deadlineEnd: true,
      sourceType: true,
      sourceId: true,
      lead: { select: { id: true, name: true, email: true } },
    },
    orderBy: { createdAt: "asc" },
  });

  const decisionActionId = new Map<string, string>();
  const followUpActionId = new Map<string, string>();
  const actions: MeetingLinkedAction[] = rows.map((r) => {
    if (r.sourceType === "MEETING_DECISION" && r.sourceId && !decisionActionId.has(r.sourceId)) {
      decisionActionId.set(r.sourceId, r.id);
    }
    if (r.sourceType === "MEETING_FOLLOW_UP" && r.sourceId && !followUpActionId.has(r.sourceId)) {
      followUpActionId.set(r.sourceId, r.id);
    }
    return {
      id: r.id,
      title: r.title,
      status: r.status,
      priority: r.priority,
      deadlineISO: (r.deadlineEnd ?? r.deadlineStart)?.toISOString() ?? null,
      owner: r.lead ? { id: r.lead.id, name: r.lead.name, email: r.lead.email } : null,
      sourceType: r.sourceType,
      sourceId: r.sourceId,
    };
  });

  return { decisionActionId, followUpActionId, actions };
}

/**
 * Batch variant of {@link getMeetingActionLinks} for meeting lists — resolves
 * every meeting's action linkage in a fixed number of queries (not one per
 * meeting). Returns a map keyed by meeting id; meetings with no links get an
 * empty entry so callers can index without a null check.
 */
export async function getMeetingActionLinksForMeetings(
  meetingIds: string[]
): Promise<Map<string, MeetingActionLinks>> {
  const result = new Map<string, MeetingActionLinks>();
  const ids = Array.from(new Set(meetingIds.filter(Boolean)));
  for (const id of ids) result.set(id, emptyMeetingActionLinks());
  if (!isActionTrackerEnabled() || ids.length === 0) return result;

  const meetings = await prisma.meeting.findMany({
    where: { id: { in: ids } },
    select: {
      id: true,
      decisions: { select: { id: true } },
      followUps: { select: { id: true } },
    },
  });

  const decisionToMeeting = new Map<string, string>();
  const followUpToMeeting = new Map<string, string>();
  for (const m of meetings) {
    for (const d of m.decisions) decisionToMeeting.set(d.id, m.id);
    for (const f of m.followUps) followUpToMeeting.set(f.id, m.id);
  }

  const rows = await prisma.actionItem.findMany({
    where: {
      OR: [
        { sourceType: "MEETING", sourceId: { in: ids } },
        { sourceType: "MEETING_DECISION", sourceId: { in: [...decisionToMeeting.keys()] } },
        { sourceType: "MEETING_FOLLOW_UP", sourceId: { in: [...followUpToMeeting.keys()] } },
      ],
    },
    select: {
      id: true,
      title: true,
      status: true,
      priority: true,
      deadlineStart: true,
      deadlineEnd: true,
      sourceType: true,
      sourceId: true,
      lead: { select: { id: true, name: true, email: true } },
    },
    orderBy: { createdAt: "asc" },
  });

  for (const r of rows) {
    if (!r.sourceId) continue;
    let meetingId: string | undefined;
    if (r.sourceType === "MEETING") meetingId = ids.includes(r.sourceId) ? r.sourceId : undefined;
    else if (r.sourceType === "MEETING_DECISION") meetingId = decisionToMeeting.get(r.sourceId);
    else if (r.sourceType === "MEETING_FOLLOW_UP") meetingId = followUpToMeeting.get(r.sourceId);
    if (!meetingId) continue;

    const bucket = result.get(meetingId);
    if (!bucket) continue;
    if (r.sourceType === "MEETING_DECISION" && !bucket.decisionActionId.has(r.sourceId)) {
      bucket.decisionActionId.set(r.sourceId, r.id);
    }
    if (r.sourceType === "MEETING_FOLLOW_UP" && !bucket.followUpActionId.has(r.sourceId)) {
      bucket.followUpActionId.set(r.sourceId, r.id);
    }
    bucket.actions.push({
      id: r.id,
      title: r.title,
      status: r.status,
      priority: r.priority,
      deadlineISO: (r.deadlineEnd ?? r.deadlineStart)?.toISOString() ?? null,
      owner: r.lead ? { id: r.lead.id, name: r.lead.name, email: r.lead.email } : null,
      sourceType: r.sourceType,
      sourceId: r.sourceId,
    });
  }

  return result;
}

export type ActionPickerUser = {
  id: string;
  name: string | null;
  email: string;
  primaryRole: string | null;
  title: string | null;
  internalLevel: number | null;
  ladder: string | null;
  canonicalTitle: string | null;
  adminSubtypes: string[];
};

/**
 * Candidate users for the Lead / Executing / Input pickers on the Action form.
 * Active (non-archived) portal members, name-sorted. Kept broad on purpose: a
 * Lead/Executor is typically officer-tier, but Input can be requested from
 * anyone, so we don't pre-filter by role beyond excluding applicants. Capped
 * for payload sanity.
 *
 * Applicants are `User` rows distinguished only by role, so they must be
 * filtered out explicitly (`whereActiveMember`) — otherwise pending applicants
 * leak into the assignee pickers.
 */
export async function listActionAssignableUsers(): Promise<ActionPickerUser[]> {
  if (!isActionTrackerEnabled()) return [];

  return prisma.user
    .findMany({
      where: { archivedAt: null, ...whereActiveMember() },
      select: {
        id: true,
        name: true,
        email: true,
        primaryRole: true,
        title: true,
        internalLevel: true,
        ladder: true,
        canonicalTitle: true,
        adminSubtypes: { select: { subtype: true } },
      },
      orderBy: [{ name: "asc" }, { email: "asc" }],
      take: 500,
    })
    .then((rows) =>
      rows.map((user) => ({
        id: user.id,
        name: user.name,
        email: user.email,
        primaryRole: user.primaryRole,
        title: user.title,
        internalLevel: user.internalLevel,
        ladder: user.ladder,
        canonicalTitle: user.canonicalTitle,
        adminSubtypes: user.adminSubtypes.map((entry) => entry.subtype),
      }))
    );
}

export type ActionChapterOption = { id: string; name: string };

/**
 * Chapters that actually have at least one action attached, for the Action
 * Tracker chapter filter. Restricted to chapters with linked actions so the
 * dropdown only ever offers values that can narrow the list to something — and
 * name-sorted for a stable picker. Returns [] when the tracker flag is off.
 */
export async function listActionChapters(): Promise<ActionChapterOption[]> {
  if (!isActionTrackerEnabled()) return [];

  const chapters = await prisma.chapter.findMany({
    where: { archivedAt: null, actionItems: { some: {} } },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
    take: 500,
  });
  return chapters.map((c) => ({ id: c.id, name: c.name }));
}

/** Active standing departments for the Action Tracker picker (grouped + sorted). */
export async function listActionDepartments(): Promise<ActionDepartmentOption[]> {
  if (!isActionTrackerEnabled()) return [];

  await ensureStandingActionDepartments();

  const rows = await prisma.department.findMany({
    where: { archivedAt: null },
    select: { id: true, name: true, slug: true },
  });

  return sortActionDepartmentOptions(rows);
}

// --- related-entity reads (People Strategy Operating System) -----------------

/**
 * Stable map key for a related-entity ref, shared by the batch loader and its
 * callers so the `${type}:${id}` format never drifts between producer and
 * consumer.
 */
export function relatedEntityRefKey(type: string, id: string): string {
  return `${type}:${id}`;
}

/**
 * Actions linked to a single related entity (e.g. every action about one class
 * or one mentorship), newest first, filtered to what `viewer` may see. Returns
 * [] when the tracker flag is off, the type is not a shipped link type, or the
 * id is blank — it never throws on a bad ref, mirroring the "fail safe / empty"
 * convention of the other read helpers so a stale id can't break a page.
 */
export async function getActionsForEntity(
  type: RelatedEntityType,
  id: string,
  viewer: ActionViewer
): Promise<ActionItemWithRelations[]> {
  if (!isActionTrackerEnabled()) return [];
  if (!isRelatedEntityType(type)) return [];
  const trimmedId = id.trim();
  if (!trimmedId) return [];

  const items = await prisma.actionItem.findMany({
    where: { relatedEntityType: type, relatedEntityId: trimmedId },
    include: ACTION_ITEM_INCLUDE,
    orderBy: [{ createdAt: "desc" }],
  });

  const hydrated = await withDepartmentLinks(items);
  return hydrated.filter((item) => canViewAction(viewer, toAccessShape(item)));
}

/**
 * Actions explicitly assigned to a meeting via the dedicated `meetingId` FK.
 * Independent of sourceType provenance. Every result is visibility-filtered for `viewer`.
 */
export async function getActionsForMeeting(
  meetingId: string,
  viewer: ActionViewer
): Promise<ActionItemWithRelations[]> {
  if (!isActionTrackerEnabled()) return [];
  const id = meetingId?.trim();
  if (!id) return [];

  const items = await prisma.actionItem.findMany({
    where: { meetingId: id },
    include: ACTION_ITEM_INCLUDE,
    orderBy: [{ createdAt: "desc" }],
  });

  const hydrated = await withDepartmentLinks(items);
  return hydrated.filter((item) => canViewAction(viewer, toAccessShape(item)));
}

/**
 * Actions scoped to a chapter via the dedicated `chapterId` FK (the tracker's
 * chapter lens — distinct from the polymorphic related-entity link, which has
 * no CHAPTER type). Newest first, visibility-filtered for `viewer`, and empty
 * (never throwing) on a blank id or when the tracker flag is off — mirroring
 * {@link getActionsForMeeting}.
 */
export async function getActionsForChapter(
  chapterId: string,
  viewer: ActionViewer
): Promise<ActionItemWithRelations[]> {
  if (!isActionTrackerEnabled()) return [];
  const id = chapterId?.trim();
  if (!id) return [];

  const items = await prisma.actionItem.findMany({
    where: { chapterId: id },
    include: ACTION_ITEM_INCLUDE,
    orderBy: [{ createdAt: "desc" }],
  });

  const hydrated = await withDepartmentLinks(items);
  return hydrated.filter((item) => canViewAction(viewer, toAccessShape(item)));
}

/**
 * Count OPEN (not COMPLETE / DROPPED) actions linked to each of the given
 * related entities of one type, in a single grouped query — so a list page can
 * show an "N open actions" hint per row without an N+1. Counts only (no
 * visibility filtering), so callers must only surface it where a raw count is
 * non-sensitive (e.g. the admin Partners page). Returns [] / empty when the
 * tracker flag is off.
 */
export async function countOpenActionsByRelatedEntity(
  type: RelatedEntityType,
  ids: string[]
): Promise<Map<string, number>> {
  const result = new Map<string, number>();
  if (!isActionTrackerEnabled()) return result;
  const uniqueIds = Array.from(new Set(ids.filter(Boolean)));
  if (uniqueIds.length === 0) return result;

  const groups = await prisma.actionItem.groupBy({
    by: ["relatedEntityId"],
    where: {
      relatedEntityType: type,
      relatedEntityId: { in: uniqueIds },
      status: { notIn: ["COMPLETE", "DROPPED"] },
    },
    _count: { _all: true },
  });
  for (const group of groups) {
    if (group.relatedEntityId) result.set(group.relatedEntityId, group._count._all);
  }
  return result;
}

/**
 * Batch variant of {@link getActionsForEntity}: loads actions for many related
 * entities in ONE query and groups them by ref, so a hub listing N classes or
 * mentorships never fans out into N queries (avoids N+1). Every list is already
 * visibility-filtered for `viewer`. Each valid ref is present in the returned
 * Map — with an empty array when it has no visible actions — so callers can
 * render an empty state without a follow-up lookup. Invalid/blank/duplicate
 * refs are skipped. Use {@link relatedEntityRefKey} to read entries back.
 */
export async function getActionsForEntities(
  refs: RelatedEntityRef[],
  viewer: ActionViewer
): Promise<Map<string, ActionItemWithRelations[]>> {
  const result = new Map<string, ActionItemWithRelations[]>();
  if (!isActionTrackerEnabled()) return result;

  // Validate + de-dupe the incoming refs, seeding each with an empty list.
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

  const items = await prisma.actionItem.findMany({
    where: {
      OR: validRefs.map((ref) => ({
        relatedEntityType: ref.type,
        relatedEntityId: ref.id,
      })),
    },
    include: ACTION_ITEM_INCLUDE,
    orderBy: [{ createdAt: "desc" }],
  });

  const hydrated = await withDepartmentLinks(items);
  for (const item of hydrated) {
    if (!item.relatedEntityType || !item.relatedEntityId) continue;
    if (!canViewAction(viewer, toAccessShape(item))) continue;
    const list = result.get(
      relatedEntityRefKey(item.relatedEntityType, item.relatedEntityId)
    );
    if (list) list.push(item);
  }

  return result;
}

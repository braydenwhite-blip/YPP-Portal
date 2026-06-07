import type { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { isActionTrackerEnabled } from "@/lib/feature-flags";
import { whereActiveMember } from "@/lib/user-role-where";

import {
  canViewAction,
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
      adminSubtypes: { select: { subtype: true } },
      profile: { select: { avatarUrl: true } },
    },
  },
  department: { select: { id: true, name: true, slug: true } },
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
} satisfies Prisma.ActionItemInclude;

export type ActionItemWithRelations = Prisma.ActionItemGetPayload<{
  include: typeof ACTION_ITEM_INCLUDE;
}>;

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
 * Results are filtered to what `viewer` is allowed to see — so a member only
 * ever gets their own actions, and OFFICERS_ONLY items are hidden from
 * non-officers even if they were somehow assigned.
 */
export async function getMyActionItems(
  userId: string,
  viewer: ActionViewer
): Promise<ActionItemWithRelations[]> {
  if (!isActionTrackerEnabled()) return [];

  const items = await prisma.actionItem.findMany({
    where: {
      OR: [{ leadId: userId }, { assignments: { some: { userId } } }],
    },
    include: ACTION_ITEM_INCLUDE,
    orderBy: [
      { status: "asc" },
      { deadlineStart: "asc" },
      { createdAt: "desc" },
    ],
  });

  return items.filter((item) => canViewAction(viewer, toAccessShape(item)));
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

  return items.filter((item) => canViewAction(viewer, toAccessShape(item)));
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

  return prisma.actionItem.findMany({
    include: ACTION_ITEM_INCLUDE,
    orderBy: [{ createdAt: "desc" }],
  });
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
  if (!canViewAction(viewer, toAccessShape(item))) return null;
  return item;
}

export type ActionPickerUser = {
  id: string;
  name: string | null;
  email: string;
  primaryRole: string | null;
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

  return prisma.user.findMany({
    where: { archivedAt: null, ...whereActiveMember() },
    select: { id: true, name: true, email: true, primaryRole: true },
    orderBy: [{ name: "asc" }, { email: "asc" }],
    take: 500,
  });
}

export type ActionDepartmentOption = { id: string; name: string };

/** Active (non-archived) functional departments for the Action form picker. */
export async function listActionDepartments(): Promise<ActionDepartmentOption[]> {
  if (!isActionTrackerEnabled()) return [];

  return prisma.department.findMany({
    where: { archivedAt: null },
    select: { id: true, name: true },
    orderBy: [{ name: "asc" }],
  });
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

  return items.filter((item) => canViewAction(viewer, toAccessShape(item)));
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

  for (const item of items) {
    if (!item.relatedEntityType || !item.relatedEntityId) continue;
    if (!canViewAction(viewer, toAccessShape(item))) continue;
    const list = result.get(
      relatedEntityRefKey(item.relatedEntityType, item.relatedEntityId)
    );
    if (list) list.push(item);
  }

  return result;
}

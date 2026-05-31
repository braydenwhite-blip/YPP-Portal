import type { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { isActionTrackerEnabled } from "@/lib/feature-flags";

import {
  canViewAction,
  type ActionAccessShape,
  type ActionViewer,
} from "./action-permissions";

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
  lead: { select: { id: true, name: true, email: true } },
  createdBy: { select: { id: true, name: true, email: true } },
  department: { select: { id: true, name: true } },
  assignments: {
    select: {
      id: true,
      role: true,
      createdAt: true,
      user: { select: { id: true, name: true, email: true } },
    },
  },
  comments: {
    orderBy: { createdAt: "desc" },
    include: { author: { select: { id: true, name: true, email: true } } },
  },
  fileLinks: {
    orderBy: { addedAt: "desc" },
    include: { addedBy: { select: { id: true, name: true, email: true } } },
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
 * Active (non-archived) portal users, name-sorted. Kept broad on purpose: a
 * Lead/Executor is typically officer-tier, but Input can be requested from
 * anyone, so we don't pre-filter by role here. Capped for payload sanity.
 */
export async function listActionAssignableUsers(): Promise<ActionPickerUser[]> {
  if (!isActionTrackerEnabled()) return [];

  return prisma.user.findMany({
    where: { archivedAt: null },
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

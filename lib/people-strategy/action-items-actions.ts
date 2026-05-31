"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { ActionAssignmentRole, ActionCommentType, Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { requireSessionUser } from "@/lib/authorization";
import { isActionTrackerEnabled } from "@/lib/feature-flags";
import { parseDateInput, startOfDay } from "@/lib/leadership-action-center/dates";

import {
  ACTION_ASSIGNMENT_ROLE_VALUES,
  ACTION_COMMENT_TYPE_VALUES,
  ACTION_ITEM_PATHS,
  ACTION_STATUS_VALUES,
  ACTION_VISIBILITY_VALUES,
} from "./constants";
import {
  canAssignAction,
  canCreateAction,
  canEditAction,
  canFlagAction,
  canViewAction,
  isOfficerTier,
  type ActionAccessShape,
} from "./action-permissions";

/**
 * People Strategy — Action Item server actions (Prompt 02B).
 *
 * Follows the existing `lib/*-actions.ts` convention: `"use server"`, a guard
 * first, zod validation, prisma write, then `revalidatePath`. Every action is
 * gated by ENABLE_ACTION_TRACKER and enforces the access policy in
 * `action-permissions.ts` on the SERVER-resolved session user — UI checks are
 * never trusted.
 *
 * Role storage: the single accountable lead lives on `ActionItem.leadId`
 * (required, denormalized) and is mirrored as an `ActionAssignment` row with
 * role LEAD; EXECUTING and INPUT assignments live only in `ActionAssignment`.
 * The assignment-role API accepts "LEAD" and keeps both in sync, giving callers
 * one uniform add/remove surface.
 *
 * Note: `ActionComment.type` only has NOTE / INPUT_REQUESTED in the 02A schema,
 * so system-style events (status changes, assignment changes, flags) are
 * recorded as NOTE comments with a descriptive, prefixed body.
 */

function revalidateAll() {
  for (const path of ACTION_ITEM_PATHS) revalidatePath(path);
}

/** Throws using the existing convention when the feature flag is off. */
function ensureEnabled() {
  if (!isActionTrackerEnabled()) {
    throw new Error("Action Tracker is not enabled");
  }
}

const ACTION_ACCESS_SELECT = {
  id: true,
  leadId: true,
  createdById: true,
  visibility: true,
  assignments: { select: { userId: true, role: true } },
} satisfies Prisma.ActionItemSelect;

type LoadedAccess = ActionAccessShape & { id: string };

/** Load the access projection for an action, throwing not-found when missing. */
async function loadAccess(id: string): Promise<LoadedAccess> {
  const item = await prisma.actionItem.findUnique({
    where: { id },
    select: ACTION_ACCESS_SELECT,
  });
  if (!item) throw new Error("Action item not found");
  return {
    id: item.id,
    leadId: item.leadId,
    createdById: item.createdById,
    visibility: item.visibility,
    assignments: item.assignments.map((a) => ({ userId: a.userId, role: a.role })),
  };
}

/** Append a system-style NOTE comment (status / assignment / flag events). */
async function postSystemComment(
  tx: Prisma.TransactionClient,
  actionItemId: string,
  authorId: string,
  body: string
) {
  await tx.actionComment.create({
    data: { actionItemId, authorId, type: "NOTE", body },
  });
}

// --- shared input pieces -----------------------------------------------------

const NonEmptyString = z.string().trim().min(1);
const OptionalText = z
  .string()
  .trim()
  .max(10_000)
  .optional()
  .transform((v) => (v && v.length > 0 ? v : null));
const RequiredDateString = z.string().trim().min(1);
const OptionalDateString = z
  .string()
  .optional()
  .transform((v) => parseDateInput(v ?? ""));
const UserIdList = z
  .array(z.string().trim().min(1))
  .max(50)
  .optional()
  .transform((v) => Array.from(new Set(v ?? [])));

// --- createActionItem --------------------------------------------------------

const CreateActionItemSchema = z.object({
  title: NonEmptyString.max(300),
  description: OptionalText,
  goalCategory: z
    .string()
    .trim()
    .max(300)
    .optional()
    .transform((v) => (v && v.length > 0 ? v : null)),
  departmentId: NonEmptyString,
  leadId: NonEmptyString,
  status: z.enum(ACTION_STATUS_VALUES as [string, ...string[]]).default("NOT_STARTED"),
  visibility: z
    .enum(ACTION_VISIBILITY_VALUES as [string, ...string[]])
    .default("ALL_LEADERSHIP"),
  deadlineStart: RequiredDateString,
  deadlineEnd: OptionalDateString,
  officerMeetingId: z
    .string()
    .optional()
    .transform((v) => (v && v.trim() ? v.trim() : null)),
  executingUserIds: UserIdList,
  inputUserIds: UserIdList,
});

export type CreateActionItemInput = z.input<typeof CreateActionItemSchema>;

export async function createActionItem(input: CreateActionItemInput) {
  ensureEnabled();
  const session = await requireSessionUser();
  if (!canCreateAction(session)) throw new Error("Unauthorized");

  const data = CreateActionItemSchema.parse(input);

  const deadlineStart = parseDateInput(data.deadlineStart);
  if (!deadlineStart) throw new Error("A valid deadline start date is required");

  // Lead is also represented as a LEAD assignment row; de-dupe executing/input.
  const assignmentRows: Array<{ userId: string; role: ActionAssignmentRole }> = [
    { userId: data.leadId, role: "LEAD" },
    ...data.executingUserIds
      .filter((id) => id !== data.leadId)
      .map((userId) => ({ userId, role: "EXECUTING" as const })),
    ...data.inputUserIds.map((userId) => ({ userId, role: "INPUT" as const })),
  ];

  const created = await prisma.actionItem.create({
    data: {
      title: data.title,
      description: data.description,
      goalCategory: data.goalCategory,
      departmentId: data.departmentId,
      leadId: data.leadId,
      createdById: session.id,
      status: data.status as never,
      visibility: data.visibility as never,
      deadlineStart,
      deadlineEnd: data.deadlineEnd,
      officerMeetingId: data.officerMeetingId,
      assignments: { create: assignmentRows },
      comments: {
        create: { authorId: session.id, type: "NOTE", body: "Action created" },
      },
    },
    select: { id: true },
  });

  revalidateAll();
  return { id: created.id };
}

// --- updateActionItem --------------------------------------------------------

const UpdateActionItemSchema = z.object({
  id: NonEmptyString,
  title: NonEmptyString.max(300).optional(),
  description: OptionalText,
  goalCategory: z
    .string()
    .trim()
    .max(300)
    .optional()
    .transform((v) => (v && v.length > 0 ? v : null)),
  departmentId: NonEmptyString.optional(),
  status: z.enum(ACTION_STATUS_VALUES as [string, ...string[]]).optional(),
  visibility: z.enum(ACTION_VISIBILITY_VALUES as [string, ...string[]]).optional(),
  deadlineStart: OptionalDateString,
  deadlineEnd: OptionalDateString,
  leadId: NonEmptyString.optional(),
  officerMeetingId: z
    .string()
    .optional()
    .transform((v) => (v && v.trim() ? v.trim() : null)),
});

export type UpdateActionItemInput = z.input<typeof UpdateActionItemSchema>;

export async function updateActionItem(input: UpdateActionItemInput) {
  ensureEnabled();
  const session = await requireSessionUser();
  const data = UpdateActionItemSchema.parse(input);

  const access = await loadAccess(data.id);
  if (!canEditAction(session, access)) throw new Error("Unauthorized");

  // Visibility, department, and lead reassignment are officer-only operations.
  const officer = isOfficerTier(session);
  if (data.visibility !== undefined && !officer) throw new Error("Unauthorized");
  if (data.departmentId !== undefined && !officer) throw new Error("Unauthorized");
  if (data.leadId !== undefined && data.leadId !== access.leadId && !officer) {
    throw new Error("Unauthorized");
  }

  const existing = await prisma.actionItem.findUnique({
    where: { id: data.id },
    select: { status: true, leadId: true },
  });
  if (!existing) throw new Error("Action item not found");

  const newStatus = data.status ?? existing.status;
  const statusChanged = data.status !== undefined && data.status !== existing.status;
  const leadChanged =
    data.leadId !== undefined && data.leadId !== existing.leadId;

  await prisma.$transaction(async (tx) => {
    await tx.actionItem.update({
      where: { id: data.id },
      data: {
        title: data.title,
        description: data.description,
        goalCategory: data.goalCategory,
        departmentId: data.departmentId,
        status: newStatus as never,
        visibility: data.visibility as never,
        deadlineStart: data.deadlineStart
          ? startOfDay(data.deadlineStart)
          : undefined,
        deadlineEnd: data.deadlineEnd,
        leadId: data.leadId,
        officerMeetingId: data.officerMeetingId,
      },
    });

    // Keep the LEAD assignment row in sync with the denormalized leadId.
    if (leadChanged && data.leadId) {
      await tx.actionAssignment.deleteMany({
        where: { actionItemId: data.id, role: "LEAD" },
      });
      await tx.actionAssignment.upsert({
        where: {
          actionItemId_userId_role: {
            actionItemId: data.id,
            userId: data.leadId,
            role: "LEAD",
          },
        },
        create: { actionItemId: data.id, userId: data.leadId, role: "LEAD" },
        update: {},
      });
      await postSystemComment(tx, data.id, session.id, "Lead reassigned");
    }

    if (statusChanged) {
      await postSystemComment(
        tx,
        data.id,
        session.id,
        `Status changed from ${existing.status} to ${newStatus}`
      );
    }
  });

  revalidateAll();
}

// --- updateActionStatus ------------------------------------------------------

const UpdateStatusSchema = z.object({
  id: NonEmptyString,
  status: z.enum(ACTION_STATUS_VALUES as [string, ...string[]]),
});

export async function updateActionStatus(
  id: string,
  status: (typeof ACTION_STATUS_VALUES)[number]
) {
  ensureEnabled();
  const session = await requireSessionUser();
  const data = UpdateStatusSchema.parse({ id, status });

  const access = await loadAccess(data.id);
  if (!canEditAction(session, access)) throw new Error("Unauthorized");

  const existing = await prisma.actionItem.findUnique({
    where: { id: data.id },
    select: { status: true },
  });
  if (!existing) throw new Error("Action item not found");
  if (existing.status === data.status) return;

  await prisma.$transaction(async (tx) => {
    await tx.actionItem.update({
      where: { id: data.id },
      data: { status: data.status as never },
    });
    await postSystemComment(
      tx,
      data.id,
      session.id,
      `Status changed from ${existing.status} to ${data.status}`
    );
  });

  revalidateAll();
}

// --- assignments -------------------------------------------------------------

const AssignmentSchema = z.object({
  actionId: NonEmptyString,
  userId: NonEmptyString,
  role: z.enum(ACTION_ASSIGNMENT_ROLE_VALUES as [string, ...string[]]),
});

export async function addActionAssignment(
  actionId: string,
  userId: string,
  role: ActionAssignmentRole
) {
  ensureEnabled();
  const session = await requireSessionUser();
  const data = AssignmentSchema.parse({ actionId, userId, role });
  if (!canAssignAction(session)) throw new Error("Unauthorized");

  await loadAccess(data.actionId); // 404 if missing

  await prisma.$transaction(async (tx) => {
    if (data.role === "LEAD") {
      // Reassign the single lead: clear the prior LEAD row, point leadId at the
      // new user, and record the LEAD assignment.
      await tx.actionItem.update({
        where: { id: data.actionId },
        data: { leadId: data.userId },
      });
      await tx.actionAssignment.deleteMany({
        where: { actionItemId: data.actionId, role: "LEAD" },
      });
    }
    await tx.actionAssignment.upsert({
      where: {
        actionItemId_userId_role: {
          actionItemId: data.actionId,
          userId: data.userId,
          role: data.role as never,
        },
      },
      create: {
        actionItemId: data.actionId,
        userId: data.userId,
        role: data.role as never,
      },
      update: {},
    });
    await postSystemComment(
      tx,
      data.actionId,
      session.id,
      `Assigned ${data.role} role to user ${data.userId}`
    );
  });

  revalidateAll();
}

export async function removeActionAssignment(
  actionId: string,
  userId: string,
  role: ActionAssignmentRole
) {
  ensureEnabled();
  const session = await requireSessionUser();
  const data = AssignmentSchema.parse({ actionId, userId, role });
  if (!canAssignAction(session)) throw new Error("Unauthorized");

  const access = await loadAccess(data.actionId);

  // leadId is required, so a lead cannot simply be removed — it must be
  // replaced via addActionAssignment(..., "LEAD"). Reject to keep state valid.
  if (data.role === "LEAD") {
    if (access.leadId === data.userId) {
      throw new Error("Cannot remove the lead; assign a new lead first");
    }
    // Stale LEAD row not matching leadId — safe to drop.
  }

  await prisma.$transaction(async (tx) => {
    await tx.actionAssignment.deleteMany({
      where: {
        actionItemId: data.actionId,
        userId: data.userId,
        role: data.role as never,
      },
    });
    await postSystemComment(
      tx,
      data.actionId,
      session.id,
      `Removed ${data.role} role from user ${data.userId}`
    );
  });

  revalidateAll();
}

// --- comments ----------------------------------------------------------------

const CommentSchema = z.object({
  actionId: NonEmptyString,
  body: NonEmptyString.max(5000),
  type: z.enum(ACTION_COMMENT_TYPE_VALUES as [string, ...string[]]).default("NOTE"),
});

export async function addActionComment(
  actionId: string,
  body: string,
  type: ActionCommentType = "NOTE"
) {
  ensureEnabled();
  const session = await requireSessionUser();
  const data = CommentSchema.parse({ actionId, body, type });

  const access = await loadAccess(data.actionId);
  if (!canViewAction(session, access)) throw new Error("Unauthorized");

  await prisma.actionComment.create({
    data: {
      actionItemId: data.actionId,
      authorId: session.id,
      type: data.type as never,
      body: data.body,
    },
  });

  revalidateAll();
}

// --- file links --------------------------------------------------------------

const FileLinkSchema = z.object({
  actionId: NonEmptyString,
  label: NonEmptyString.max(300),
  url: z
    .string()
    .trim()
    .url()
    .refine((u) => /^https?:\/\//i.test(u), "URL must start with http(s)://"),
});

export async function addActionFileLink(actionId: string, label: string, url: string) {
  ensureEnabled();
  const session = await requireSessionUser();
  const data = FileLinkSchema.parse({ actionId, label, url });

  const access = await loadAccess(data.actionId);
  if (!canEditAction(session, access)) throw new Error("Unauthorized");

  await prisma.$transaction(async (tx) => {
    await tx.actionFileLink.create({
      data: {
        actionItemId: data.actionId,
        label: data.label,
        url: data.url,
        addedById: session.id,
      },
    });
    await postSystemComment(
      tx,
      data.actionId,
      session.id,
      `Added file link: ${data.label}`
    );
  });

  revalidateAll();
  return { ok: true };
}

// --- flag to CPO -------------------------------------------------------------

export async function flagActionToCPO(actionId: string) {
  ensureEnabled();
  const session = await requireSessionUser();
  if (!actionId) throw new Error("actionId required");

  const access = await loadAccess(actionId);
  if (!canFlagAction(session, access)) throw new Error("Unauthorized");

  const now = new Date();
  await prisma.$transaction(async (tx) => {
    await tx.actionItem.update({
      where: { id: actionId },
      data: { flaggedAt: now },
    });
    await postSystemComment(
      tx,
      actionId,
      session.id,
      "⚑ Flagged to CPO for escalation"
    );
  });

  revalidateAll();
  return { flaggedAt: now };
}

"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { ActionItemAssignmentRole, Prisma } from "@prisma/client";

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
 * Role storage decision: a single LEAD is stored on `ActionItem.leadId`
 * (canonical, indexed); EXECUTING and INPUT assignments live in
 * `ActionItemAssignment`. The assignment-role API still accepts "LEAD" and
 * routes it to `leadId`, so callers have one uniform add/remove surface.
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
  archivedAt: true,
  assignments: { select: { userId: true, role: true } },
} satisfies Prisma.ActionItemSelect;

type LoadedAccess = ActionAccessShape & { id: string; archivedAt: Date | null };

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
    archivedAt: item.archivedAt,
    assignments: item.assignments.map((a) => ({ userId: a.userId, role: a.role })),
  };
}

/** Append a system-style comment (used by status / assignment / flag events). */
async function postSystemComment(
  tx: Prisma.TransactionClient,
  actionItemId: string,
  authorId: string,
  type: "SYSTEM" | "STATUS_CHANGE" | "FLAG",
  body: string
) {
  await tx.actionItemComment.create({
    data: { actionItemId, authorId, type, body },
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
const OptionalDateString = z
  .string()
  .optional()
  .transform((v) => parseDateInput(v ?? ""));
const OptionalUserId = z
  .string()
  .optional()
  .transform((v) => (v && v.trim() ? v.trim() : null));
const UserIdList = z
  .array(z.string().trim().min(1))
  .max(50)
  .optional()
  .transform((v) => Array.from(new Set(v ?? [])));

// --- createActionItem --------------------------------------------------------

const CreateActionItemSchema = z.object({
  title: NonEmptyString.max(300),
  description: OptionalText,
  status: z.enum(ACTION_STATUS_VALUES as [string, ...string[]]).default("NOT_STARTED"),
  priority: z.enum(["LOW", "NORMAL", "HIGH", "URGENT"]).default("NORMAL"),
  category: z
    .enum(["INSTRUCTION", "TECHNOLOGY", "COMMUNICATION", "STAFF_MANAGEMENT"])
    .default("INSTRUCTION"),
  visibility: z.enum(ACTION_VISIBILITY_VALUES as [string, ...string[]]).default("LEADERSHIP"),
  dueDate: OptionalDateString,
  weekStart: OptionalDateString,
  leadId: OptionalUserId,
  executingUserIds: UserIdList,
  inputUserIds: UserIdList,
});

export type CreateActionItemInput = z.input<typeof CreateActionItemSchema>;

export async function createActionItem(input: CreateActionItemInput) {
  ensureEnabled();
  const session = await requireSessionUser();
  if (!canCreateAction(session)) throw new Error("Unauthorized");

  const data = CreateActionItemSchema.parse(input);

  const assignmentRows: Array<{ userId: string; role: ActionItemAssignmentRole }> = [
    ...data.executingUserIds.map((userId) => ({ userId, role: "EXECUTING" as const })),
    ...data.inputUserIds.map((userId) => ({ userId, role: "INPUT" as const })),
  ];

  const created = await prisma.actionItem.create({
    data: {
      title: data.title,
      description: data.description,
      status: data.status as never,
      priority: data.priority as never,
      category: data.category as never,
      visibility: data.visibility as never,
      dueDate: data.dueDate,
      weekStart: data.weekStart ? startOfDay(data.weekStart) : null,
      leadId: data.leadId,
      createdById: session.id,
      completedAt: data.status === "COMPLETE" ? new Date() : null,
      assignments:
        assignmentRows.length > 0 ? { create: assignmentRows } : undefined,
      comments: {
        create: { authorId: session.id, type: "SYSTEM", body: "Action created" },
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
  status: z.enum(ACTION_STATUS_VALUES as [string, ...string[]]).optional(),
  priority: z.enum(["LOW", "NORMAL", "HIGH", "URGENT"]).optional(),
  category: z
    .enum(["INSTRUCTION", "TECHNOLOGY", "COMMUNICATION", "STAFF_MANAGEMENT"])
    .optional(),
  visibility: z.enum(ACTION_VISIBILITY_VALUES as [string, ...string[]]).optional(),
  dueDate: OptionalDateString,
  weekStart: OptionalDateString,
  leadId: OptionalUserId,
});

export type UpdateActionItemInput = z.input<typeof UpdateActionItemSchema>;

export async function updateActionItem(input: UpdateActionItemInput) {
  ensureEnabled();
  const session = await requireSessionUser();
  const data = UpdateActionItemSchema.parse(input);

  const access = await loadAccess(data.id);
  if (!canEditAction(session, access)) throw new Error("Unauthorized");

  // Visibility and lead reassignment are officer-only operations.
  const officer = isOfficerTier(session);
  if (data.visibility !== undefined && !officer) throw new Error("Unauthorized");
  if (data.leadId !== undefined && data.leadId !== access.leadId && !officer) {
    throw new Error("Unauthorized");
  }

  const existing = await prisma.actionItem.findUnique({
    where: { id: data.id },
    select: { status: true },
  });
  if (!existing) throw new Error("Action item not found");

  const newStatus = data.status ?? existing.status;
  const statusChanged = data.status !== undefined && data.status !== existing.status;

  await prisma.$transaction(async (tx) => {
    await tx.actionItem.update({
      where: { id: data.id },
      data: {
        title: data.title,
        description: data.description,
        status: newStatus as never,
        priority: data.priority as never,
        category: data.category as never,
        visibility: data.visibility as never,
        dueDate: data.dueDate,
        weekStart: data.weekStart ? startOfDay(data.weekStart) : data.weekStart,
        leadId: data.leadId,
        completedAt:
          newStatus === "COMPLETE"
            ? new Date()
            : statusChanged
              ? null
              : undefined,
      },
    });

    if (statusChanged) {
      await postSystemComment(
        tx,
        data.id,
        session.id,
        "STATUS_CHANGE",
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
      data: {
        status: data.status as never,
        completedAt: data.status === "COMPLETE" ? new Date() : null,
      },
    });
    await postSystemComment(
      tx,
      data.id,
      session.id,
      "STATUS_CHANGE",
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
  role: ActionItemAssignmentRole
) {
  ensureEnabled();
  const session = await requireSessionUser();
  const data = AssignmentSchema.parse({ actionId, userId, role });
  if (!canAssignAction(session)) throw new Error("Unauthorized");

  await loadAccess(data.actionId); // 404 if missing

  await prisma.$transaction(async (tx) => {
    if (data.role === "LEAD") {
      await tx.actionItem.update({
        where: { id: data.actionId },
        data: { leadId: data.userId },
      });
    } else {
      await tx.actionItemAssignment.upsert({
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
    }
    await postSystemComment(
      tx,
      data.actionId,
      session.id,
      "SYSTEM",
      `Assigned ${data.role} role to user ${data.userId}`
    );
  });

  revalidateAll();
}

export async function removeActionAssignment(
  actionId: string,
  userId: string,
  role: ActionItemAssignmentRole
) {
  ensureEnabled();
  const session = await requireSessionUser();
  const data = AssignmentSchema.parse({ actionId, userId, role });
  if (!canAssignAction(session)) throw new Error("Unauthorized");

  const access = await loadAccess(data.actionId);

  await prisma.$transaction(async (tx) => {
    if (data.role === "LEAD") {
      if (access.leadId === data.userId) {
        await tx.actionItem.update({
          where: { id: data.actionId },
          data: { leadId: null },
        });
      }
    } else {
      await tx.actionItemAssignment.deleteMany({
        where: {
          actionItemId: data.actionId,
          userId: data.userId,
          role: data.role as never,
        },
      });
    }
    await postSystemComment(
      tx,
      data.actionId,
      session.id,
      "SYSTEM",
      `Removed ${data.role} role from user ${data.userId}`
    );
  });

  revalidateAll();
}

// --- comments ----------------------------------------------------------------

const CommentSchema = z.object({
  actionId: NonEmptyString,
  body: NonEmptyString.max(5000),
  type: z.enum(ACTION_COMMENT_TYPE_VALUES as [string, ...string[]]).default("COMMENT"),
});

export async function addActionComment(
  actionId: string,
  body: string,
  type: (typeof ACTION_COMMENT_TYPE_VALUES)[number] = "COMMENT"
) {
  ensureEnabled();
  const session = await requireSessionUser();
  const data = CommentSchema.parse({ actionId, body, type });

  const access = await loadAccess(data.actionId);
  if (!canViewAction(session, access)) throw new Error("Unauthorized");

  // Only officers may post system-style comment types; members post COMMENT.
  const finalType = isOfficerTier(session) ? data.type : "COMMENT";

  await prisma.actionItemComment.create({
    data: {
      actionItemId: data.actionId,
      authorId: session.id,
      type: finalType as never,
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
    await tx.actionItemFileLink.create({
      data: {
        actionItemId: data.actionId,
        label: data.label,
        url: data.url,
        createdById: session.id,
      },
    });
    await postSystemComment(
      tx,
      data.actionId,
      session.id,
      "SYSTEM",
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
      data: { flaggedAt: now, flaggedToCpoAt: now, flaggedById: session.id },
    });
    await postSystemComment(
      tx,
      actionId,
      session.id,
      "FLAG",
      "Flagged to CPO for escalation"
    );
  });

  revalidateAll();
  return { flaggedAt: now };
}

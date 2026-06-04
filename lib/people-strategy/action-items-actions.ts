"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { ActionAssignmentRole, ActionCommentType, Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { requireCPO, requireSessionUser } from "@/lib/authorization";
import { isActionTrackerEnabled } from "@/lib/feature-flags";
import { parseDateInput, startOfDay } from "@/lib/leadership-action-center/dates";

import {
  ACTION_ASSIGNMENT_ROLE_VALUES,
  ACTION_COMMENT_TYPE_VALUES,
  ACTION_ITEM_PATHS,
  ACTION_PRIORITY_VALUES,
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
import { notifyNewActionAssignments } from "./action-emails";

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
  flaggedAt: true,
  assignments: { select: { userId: true, role: true } },
} satisfies Prisma.ActionItemSelect;

type LoadedAccess = ActionAccessShape & { id: string; flaggedAt: Date | null };

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
    flaggedAt: item.flaggedAt,
    assignments: item.assignments.map((a) => ({ userId: a.userId, role: a.role })),
  };
}

/**
 * The `completedAt` value implied by a status transition: stamped when an item
 * enters COMPLETE, cleared when it leaves COMPLETE (reopened), and left
 * untouched (undefined → omitted from the update) otherwise. Keeps the exact
 * completion timestamp the Win Log / pulse / momentum rely on in sync with
 * status, without a trigger.
 */
function completedAtForTransition(
  previousStatus: string,
  nextStatus: string,
  now: Date
): Date | null | undefined {
  if (nextStatus === previousStatus) return undefined;
  if (nextStatus === "COMPLETE") return now;
  if (previousStatus === "COMPLETE") return null;
  return undefined;
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
const CreateOptionalText = z
  .string()
  .trim()
  .max(10_000)
  .optional()
  .transform((v) => (v && v.length > 0 ? v : null));
const UpdateOptionalText = z
  .string()
  .trim()
  .max(10_000)
  .nullable()
  .optional()
  .transform((v) => {
    if (v === undefined) return undefined;
    if (v === null || v.length === 0) return null;
    return v;
  });
const RequiredDateString = z.string().trim().min(1);
const CreateOptionalDateString = z
  .string()
  .trim()
  .optional()
  .transform((v, ctx) => {
    if (!v) return null;
    const parsed = parseDateInput(v);
    if (!parsed) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Invalid deadline end date" });
      return z.NEVER;
    }
    return parsed;
  });
const UpdateDeadlineStartString = z
  .string()
  .trim()
  .optional()
  .transform((v, ctx) => {
    if (v === undefined || v.length === 0) return undefined;
    const parsed = parseDateInput(v);
    if (!parsed) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Invalid deadline start date" });
      return z.NEVER;
    }
    return parsed;
  });
const UpdateOptionalDateString = z
  .string()
  .trim()
  .nullable()
  .optional()
  .transform((v, ctx) => {
    if (v === undefined) return undefined;
    if (v === null || v.length === 0) return null;
    const parsed = parseDateInput(v);
    if (!parsed) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Invalid deadline end date" });
      return z.NEVER;
    }
    return parsed;
  });
const UserIdList = z
  .array(z.string().trim().min(1))
  .max(50)
  .optional()
  .transform((v) => Array.from(new Set(v ?? [])));

function assertDeadlineRange(deadlineStart: Date, deadlineEnd: Date | null | undefined) {
  if (deadlineEnd && deadlineEnd.getTime() < deadlineStart.getTime()) {
    throw new Error("Deadline end cannot be before deadline start");
  }
}

async function assertDepartmentExists(departmentId: string) {
  const department = await prisma.department.findUnique({
    where: { id: departmentId },
    select: { id: true },
  });
  if (!department) throw new Error("Invalid department");
}

async function assertUsersExist(userIds: string[]) {
  const uniqueIds = Array.from(new Set(userIds.filter(Boolean)));
  if (uniqueIds.length === 0) return;

  const count = await prisma.user.count({
    where: { id: { in: uniqueIds }, archivedAt: null },
  });
  if (count !== uniqueIds.length) {
    throw new Error("Invalid user assignment");
  }
}

// --- createActionItem --------------------------------------------------------

const CreateActionItemSchema = z.object({
  title: NonEmptyString.max(300),
  description: CreateOptionalText,
  goalCategory: z
    .string()
    .trim()
    .max(300)
    .optional()
    .transform((v) => (v && v.length > 0 ? v : null)),
  departmentId: z
    .string()
    .optional()
    .transform((v) => (v && v.trim() ? v.trim() : null)),
  leadId: NonEmptyString,
  status: z.enum(ACTION_STATUS_VALUES as [string, ...string[]]).default("NOT_STARTED"),
  priority: z.enum(ACTION_PRIORITY_VALUES as [string, ...string[]]).default("MEDIUM"),
  visibility: z
    .enum(ACTION_VISIBILITY_VALUES as [string, ...string[]])
    .default("ALL_LEADERSHIP"),
  deadlineStart: RequiredDateString,
  deadlineEnd: CreateOptionalDateString,
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
  assertDeadlineRange(deadlineStart, data.deadlineEnd);

  // The Lead implicitly executes the work, so a separate Executing assignee is
  // optional: when none is named, the Lead becomes the executor. This unblocks
  // creating an action from just a Title + Lead + Deadline.
  const executingUserIds =
    data.executingUserIds.length > 0 ? data.executingUserIds : [data.leadId];

  if (data.departmentId) await assertDepartmentExists(data.departmentId);
  await assertUsersExist([
    data.leadId,
    ...executingUserIds,
    ...data.inputUserIds,
  ]);

  // Lead is also represented as a LEAD assignment row; the (actionItemId,
  // userId, role) uniqueness lets the Lead additionally hold an EXECUTING row.
  const assignmentRows: Array<{ userId: string; role: ActionAssignmentRole }> = [
    { userId: data.leadId, role: "LEAD" },
    ...executingUserIds
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
      priority: data.priority as never,
      // A rarely-used path, but an item can be created already-complete.
      completedAt: data.status === "COMPLETE" ? new Date() : null,
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

  // Every assignment row on a brand-new item is genuinely new → notify each.
  await notifyNewActionAssignments(created.id, assignmentRows);

  revalidateAll();
  return { id: created.id };
}

// --- updateActionItem --------------------------------------------------------

const UpdateActionItemSchema = z.object({
  id: NonEmptyString,
  title: NonEmptyString.max(300).optional(),
  description: UpdateOptionalText,
  goalCategory: z
    .string()
    .trim()
    .max(300)
    .nullable()
    .optional()
    .transform((v) => {
      if (v === undefined) return undefined;
      if (v === null || v.length === 0) return null;
      return v;
    }),
  departmentId: z
    .string()
    .nullable()
    .optional()
    .transform((v) => {
      if (v === undefined) return undefined;
      if (v === null) return null;
      const trimmed = v.trim();
      return trimmed.length > 0 ? trimmed : null;
    }),
  status: z.enum(ACTION_STATUS_VALUES as [string, ...string[]]).optional(),
  priority: z.enum(ACTION_PRIORITY_VALUES as [string, ...string[]]).optional(),
  visibility: z.enum(ACTION_VISIBILITY_VALUES as [string, ...string[]]).optional(),
  deadlineStart: UpdateDeadlineStartString,
  deadlineEnd: UpdateOptionalDateString,
  leadId: NonEmptyString.optional(),
  officerMeetingId: z
    .string()
    .nullable()
    .optional()
    .transform((v) => {
      if (v === undefined) return undefined;
      if (v === null) return null;
      const trimmed = v.trim();
      return trimmed.length > 0 ? trimmed : null;
    }),
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
    select: { status: true, leadId: true, deadlineStart: true, deadlineEnd: true },
  });
  if (!existing) throw new Error("Action item not found");

  const newStatus = data.status ?? existing.status;
  const nextDeadlineStart = data.deadlineStart ?? existing.deadlineStart;
  const nextDeadlineEnd =
    data.deadlineEnd !== undefined ? data.deadlineEnd : existing.deadlineEnd;
  assertDeadlineRange(nextDeadlineStart, nextDeadlineEnd);

  if (data.departmentId) await assertDepartmentExists(data.departmentId);
  if (data.leadId !== undefined) await assertUsersExist([data.leadId]);

  const statusChanged = data.status !== undefined && data.status !== existing.status;
  const completedAt = completedAtForTransition(existing.status, newStatus, new Date());
  const leadChanged =
    data.leadId !== undefined && data.leadId !== existing.leadId;

  // A lead change only emails when the incoming lead does not already hold a
  // LEAD row — keeps "edit an unrelated field" (or no-op re-set) silent.
  let leadAssignmentIsNew = false;
  if (leadChanged && data.leadId) {
    const existingLeadAssignment = await prisma.actionAssignment.findUnique({
      where: {
        actionItemId_userId_role: {
          actionItemId: data.id,
          userId: data.leadId,
          role: "LEAD",
        },
      },
      select: { id: true },
    });
    leadAssignmentIsNew = !existingLeadAssignment;
  }

  await prisma.$transaction(async (tx) => {
    await tx.actionItem.update({
      where: { id: data.id },
      data: {
        title: data.title,
        description: data.description,
        goalCategory: data.goalCategory,
        departmentId: data.departmentId,
        status: newStatus as never,
        priority: data.priority as never,
        completedAt,
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

  if (leadAssignmentIsNew && data.leadId) {
    await notifyNewActionAssignments(data.id, [
      { userId: data.leadId, role: "LEAD" },
    ]);
  }

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

  const completedAt = completedAtForTransition(existing.status, data.status, new Date());

  await prisma.$transaction(async (tx) => {
    await tx.actionItem.update({
      where: { id: data.id },
      data: { status: data.status as never, completedAt },
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
  await assertUsersExist([data.userId]);

  // Only a genuinely-new (actionItem, user, role) row should trigger an email.
  // An unchanged re-assignment of the same role to the same user is a no-op.
  const existingAssignment = await prisma.actionAssignment.findUnique({
    where: {
      actionItemId_userId_role: {
        actionItemId: data.actionId,
        userId: data.userId,
        role: data.role as never,
      },
    },
    select: { id: true },
  });
  const isNewAssignment = !existingAssignment;

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

  if (isNewAssignment) {
    await notifyNewActionAssignments(data.actionId, [
      { userId: data.userId, role: data.role as ActionAssignmentRole },
    ]);
  }

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
  if (data.role === "EXECUTING") {
    const existingAssignment = await prisma.actionAssignment.findUnique({
      where: {
        actionItemId_userId_role: {
          actionItemId: data.actionId,
          userId: data.userId,
          role: "EXECUTING",
        },
      },
      select: { id: true },
    });
    if (existingAssignment) {
      const executingCount = await prisma.actionAssignment.count({
        where: { actionItemId: data.actionId, role: "EXECUTING" },
      });
      if (executingCount <= 1) {
        throw new Error("At least one Executing assignee is required");
      }
    }
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
  if (access.flaggedAt) return { flaggedAt: access.flaggedAt };

  const now = new Date();
  let flaggedAt = now;
  await prisma.$transaction(async (tx) => {
    const updated = await tx.actionItem.updateMany({
      where: { id: actionId, flaggedAt: null },
      data: { flaggedAt: now },
    });

    if (updated.count > 0) {
      await postSystemComment(
        tx,
        actionId,
        session.id,
        "Flagged to CPO for escalation"
      );
      return;
    }

    const current = await tx.actionItem.findUnique({
      where: { id: actionId },
      select: { flaggedAt: true },
    });
    flaggedAt = current?.flaggedAt ?? now;
  });

  revalidateAll();
  return { flaggedAt };
}

// --- resolve escalation (CPO) -------------------------------------------------

/**
 * Resolve a CPO escalation from the /people Escalation Queue. CPO/Board only.
 * Sets `resolvedAt` (so the item leaves the queue and is never re-escalated)
 * and records a system comment in the item's history. Idempotent via a
 * conditional update — resolving an already-resolved item is a no-op.
 */
export async function resolveEscalation(actionId: string) {
  ensureEnabled();
  const session = await requireCPO();
  if (!actionId) throw new Error("actionId required");

  const now = new Date();
  const updated = await prisma.actionItem.updateMany({
    where: { id: actionId, resolvedAt: null },
    data: { resolvedAt: now },
  });

  if (updated.count > 0) {
    await prisma.actionComment.create({
      data: {
        actionItemId: actionId,
        authorId: session.id,
        type: "NOTE",
        body: "Escalation resolved by CPO",
      },
    });
  }

  revalidateAll();
  revalidatePath("/actions/people");
  revalidatePath("/actions/people/board-rollup");
  return { ok: true, resolved: updated.count > 0 };
}

"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { ActionAssignmentRole, ActionCommentType, Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { requireLeadership, requireSessionUser } from "@/lib/authorization";
import { isActionTrackerEnabled } from "@/lib/feature-flags";
import { syncActionSearchDocument } from "@/lib/help-agent/search-indexing";
import { parseDateInput, startOfDay } from "@/lib/leadership-action-center/dates";

import {
  ACTION_ASSIGNMENT_ROLE_VALUES,
  ACTION_COMMENT_TYPE_VALUES,
  ACTION_ITEM_PATHS,
  ACTION_PRIORITY_VALUES,
  ACTION_STATUS_VALUES,
  ACTION_VISIBILITY_VALUES,
  parseRelatedEntityRef,
  parseRelatedEntityUpdate,
  type RelatedEntityType,
} from "./constants";
import {
  parseActionType,
  parseActionTypeUpdate,
} from "./action-types";
import {
  parseActionCompletionOutcome,
  parseActionSourceType,
  parseStrategicLink,
  parseStrategicLinkUpdate,
} from "./action-source";
import {
  canApproveAction,
  canAssignAction,
  canCreateAction,
  canDeleteAction,
  canEditAction,
  canFlagAction,
  canViewAction,
  isOfficerTier,
  type ActionAccessShape,
} from "./action-permissions";
import { assertActionLeadEligible } from "@/lib/org/action-lead-guard";
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
  // The meeting workspace is a dynamic route; revalidate every instance so a
  // meeting's linked-action counts and wrap-up state reflect an action change
  // even when it was completed/edited from the Action Tracker, not the meeting.
  revalidatePath("/meetings/[id]", "page");
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

/** Clear officer approval when an item leaves COMPLETE or is dropped. */
function approvalFieldsForTransition(
  previousStatus: string,
  nextStatus: string
): { approvedAt: null; approvedById: null } | Record<string, never> {
  if (previousStatus === "COMPLETE" && nextStatus !== "COMPLETE") {
    return { approvedAt: null, approvedById: null };
  }
  return {};
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
// Optional trimmed scalar that normalizes "" → null (create path). Used for the
// Action 4.0 source pointers (sourceId / sourceActionId).
const NullableTrimmed = z
  .string()
  .trim()
  .max(300)
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

/**
 * Confirm the polymorphic related-entity link points at a row that still
 * exists, so a typo'd or stale id never gets persisted. The link has no FK, so
 * this write-time check is the only guard against orphans (it reduces, but
 * cannot eliminate, them — a target deleted later still leaves a dangling id,
 * which the read side tolerates by rendering only entities that still exist).
 */
async function assertRelatedEntityExists(
  type: RelatedEntityType,
  id: string
): Promise<void> {
  let exists = false;
  switch (type) {
    case "CLASS_OFFERING":
      exists = Boolean(
        await prisma.classOffering.findUnique({ where: { id }, select: { id: true } })
      );
      break;
    case "MENTORSHIP":
      exists = Boolean(
        await prisma.mentorship.findUnique({ where: { id }, select: { id: true } })
      );
      break;
    case "USER":
      exists = Boolean(
        await prisma.user.findUnique({ where: { id }, select: { id: true } })
      );
      break;
    case "INSTRUCTOR_APPLICATION":
      exists = Boolean(
        await prisma.instructorApplication.findUnique({
          where: { id },
          select: { id: true },
        })
      );
      break;
    case "PARTNER":
      exists = Boolean(
        await prisma.partner.findUnique({ where: { id }, select: { id: true } })
      );
      break;
    default: {
      // Exhaustiveness guard: adding a value to RELATED_ENTITY_TYPE_VALUES
      // without a case here becomes a compile error.
      const _exhaustive: never = type;
      throw new Error(`Unsupported related entity type: ${String(_exhaustive)}`);
    }
  }
  if (!exists) throw new Error("Linked entity not found");
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
  executingUserIds: UserIdList,
  inputUserIds: UserIdList,
  // Polymorphic related-entity link. Both-or-neither + enum membership + trim
  // are enforced by the pure validator in the superRefine below.
  relatedEntityType: z.string().trim().optional(),
  relatedEntityId: z.string().trim().optional(),
  // Controlled-vocabulary action type (or empty for untyped). Membership is
  // enforced by parseActionType in the superRefine below.
  actionType: z.string().trim().optional(),
  // --- Action System 4.0 contract (all optional; legacy callers unaffected) ---
  // Source provenance: how the action came to exist. Membership enforced below.
  sourceType: z.string().trim().optional(),
  sourceId: NullableTrimmed,
  sourceActionId: NullableTrimmed,
  // Explicit, registry-validated strategic link. Validity enforced below.
  strategicInitiativeId: z.string().trim().optional(),
  strategicProjectId: z.string().trim().optional(),
  // Action quality fields.
  successDefinition: CreateOptionalText,
  blockedReason: CreateOptionalText,
  completionNote: CreateOptionalText,
  completionOutcome: z.string().trim().optional(),
  nextFollowUpAt: CreateOptionalDateString,
}).superRefine((val, ctx) => {
  const parsed = parseRelatedEntityRef(val);
  if (!parsed.ok) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: parsed.error,
      path: ["relatedEntityType"],
    });
  }
  const parsedType = parseActionType(val.actionType);
  if (!parsedType.ok) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: parsedType.error,
      path: ["actionType"],
    });
  }
  const parsedSource = parseActionSourceType(val.sourceType);
  if (!parsedSource.ok) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: parsedSource.error,
      path: ["sourceType"],
    });
  }
  const parsedStrategic = parseStrategicLink(val);
  if (!parsedStrategic.ok) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: parsedStrategic.error,
      path: ["strategicProjectId"],
    });
  }
  const parsedOutcome = parseActionCompletionOutcome(val.completionOutcome);
  if (!parsedOutcome.ok) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: parsedOutcome.error,
      path: ["completionOutcome"],
    });
  }
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

  // Phase 5: the accountable Lead must be eligible (internal level >= 3, or a
  // Manager/Senior Manager authorized by the officer making the assignment).
  // Flag-gated (ORG_ACTION_LEAD_ELIGIBILITY_ENFORCED); no-op by default.
  await assertActionLeadEligible(data.leadId, {
    authorizedByOfficer: isOfficerTier(session),
  });

  // `ok` is guaranteed by the schema's superRefine; re-derive to get the
  // normalized ref (or null when no link was supplied).
  const parsedRelated = parseRelatedEntityRef(data);
  const related = parsedRelated.ok ? parsedRelated.ref : null;
  if (related) await assertRelatedEntityExists(related.type, related.id);

  // Normalized action type (null when untyped); `ok` is guaranteed by the
  // schema superRefine, so a parse failure here would only be a programming
  // error — fall back to null rather than throw on the happy path.
  const parsedType = parseActionType(data.actionType);
  const actionType = parsedType.ok ? parsedType.value : null;

  // Action 4.0 contract: source provenance + registry-validated strategic link.
  // All `ok` outcomes are guaranteed by the schema superRefine above.
  const parsedSource = parseActionSourceType(data.sourceType);
  const sourceType = parsedSource.ok ? parsedSource.value : null;
  const parsedStrategic = parseStrategicLink(data);
  const strategicLink = parsedStrategic.ok
    ? parsedStrategic.link
    : { initiativeId: null, projectId: null };
  const parsedOutcome = parseActionCompletionOutcome(data.completionOutcome);
  const completionOutcome = parsedOutcome.ok ? parsedOutcome.value : null;

  // A FOLLOW_UP parent is a self-relation FK; verify it exists so a stale or
  // hand-edited id degrades to "no parent" instead of a write-time FK error.
  let sourceActionId = data.sourceActionId;
  if (sourceActionId) {
    const parent = await prisma.actionItem.findUnique({
      where: { id: sourceActionId },
      select: { id: true },
    });
    if (!parent) sourceActionId = null;
  }

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
      actionType,
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
      relatedEntityType: related?.type ?? null,
      relatedEntityId: related?.id ?? null,
      // Action 4.0 contract
      sourceType,
      sourceId: data.sourceId,
      sourceActionId,
      strategicInitiativeId: strategicLink.initiativeId,
      strategicProjectId: strategicLink.projectId,
      successDefinition: data.successDefinition,
      blockedReason: data.blockedReason,
      completionNote: data.completionNote,
      completionOutcome,
      nextFollowUpAt: data.nextFollowUpAt,
      assignments: { create: assignmentRows },
      comments: {
        create: { authorId: session.id, type: "NOTE", body: "Action created" },
      },
    },
    select: { id: true },
  });

  // Every assignment row on a brand-new item is genuinely new → notify each.
  await notifyNewActionAssignments(created.id, assignmentRows);

  await syncActionSearchDocument(created.id);
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
  // Polymorphic related-entity link. Omitting BOTH fields leaves the existing
  // link untouched; sending them empty intentionally clears it (see
  // parseRelatedEntityUpdate). Validity is enforced in the superRefine below.
  relatedEntityType: z.string().trim().nullable().optional(),
  relatedEntityId: z.string().trim().nullable().optional(),
  // Action type. Omitting it leaves the existing type untouched; sending it
  // empty intentionally clears it (see parseActionTypeUpdate). Validity is
  // enforced in the superRefine below.
  actionType: z.string().trim().nullable().optional(),
  // --- Action System 4.0 contract (all optional; omitting = leave untouched) --
  sourceType: z.string().trim().nullable().optional(),
  sourceId: z.string().trim().nullable().optional(),
  sourceActionId: z.string().trim().nullable().optional(),
  // Strategic link interpreted as a unit (unchanged / clear / set) below.
  strategicInitiativeId: z.string().trim().nullable().optional(),
  strategicProjectId: z.string().trim().nullable().optional(),
  successDefinition: UpdateOptionalText,
  blockedReason: UpdateOptionalText,
  completionNote: UpdateOptionalText,
  completionOutcome: z.string().trim().nullable().optional(),
  nextFollowUpAt: UpdateOptionalDateString,
}).superRefine((val, ctx) => {
  const result = parseRelatedEntityUpdate(val);
  if (result.kind === "error") {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: result.error,
      path: ["relatedEntityType"],
    });
  }
  const typeResult = parseActionTypeUpdate(val.actionType ?? undefined);
  if (typeResult.kind === "error") {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: typeResult.error,
      path: ["actionType"],
    });
  }
  if (val.sourceType !== undefined && val.sourceType !== null) {
    const sourceResult = parseActionSourceType(val.sourceType);
    if (!sourceResult.ok) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: sourceResult.error,
        path: ["sourceType"],
      });
    }
  }
  const strategicResult = parseStrategicLinkUpdate(val);
  if (strategicResult.kind === "error") {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: strategicResult.error,
      path: ["strategicProjectId"],
    });
  }
  if (val.completionOutcome !== undefined && val.completionOutcome !== null) {
    const outcomeResult = parseActionCompletionOutcome(val.completionOutcome);
    if (!outcomeResult.ok) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: outcomeResult.error,
        path: ["completionOutcome"],
      });
    }
  }
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

  // Phase 5: enforce Lead eligibility when the lead actually changes (flag-gated).
  if (data.leadId !== undefined && data.leadId !== existing.leadId) {
    await assertActionLeadEligible(data.leadId, { authorizedByOfficer: officer });
  }

  // Interpret the related-entity link as a unit: unchanged (both omitted),
  // intentionally cleared (sent empty), or set to a new, existence-checked ref.
  // The "error" kind is unreachable here — the schema superRefine already
  // rejected it — so leaving the fields undefined for it is a safe no-op.
  const relatedUpdate = parseRelatedEntityUpdate(data);
  let relatedEntityType: string | null | undefined;
  let relatedEntityId: string | null | undefined;
  if (relatedUpdate.kind === "set") {
    await assertRelatedEntityExists(relatedUpdate.ref.type, relatedUpdate.ref.id);
    relatedEntityType = relatedUpdate.ref.type;
    relatedEntityId = relatedUpdate.ref.id;
  } else if (relatedUpdate.kind === "clear") {
    relatedEntityType = null;
    relatedEntityId = null;
  }

  // Interpret the action type as a unit: unchanged (omitted), cleared (sent
  // empty), or set to a known member. The "error" kind is unreachable — the
  // schema superRefine already rejected it — so it falls through to undefined.
  const typeUpdate = parseActionTypeUpdate(data.actionType);
  let actionType: string | null | undefined;
  if (typeUpdate.kind === "set") actionType = typeUpdate.value;
  else if (typeUpdate.kind === "clear") actionType = null;

  // Action 4.0 contract on update. `undefined` (field omitted) → leave the column
  // untouched; an explicit null/empty → clear; a valid value → set. Validity is
  // guaranteed by the schema superRefine; the `.ok` narrowing keeps TS happy and
  // degrades to null on the unreachable failure branch.
  let sourceType: string | null | undefined;
  if (data.sourceType !== undefined) {
    const parsed = parseActionSourceType(data.sourceType);
    sourceType = parsed.ok ? parsed.value : null;
  }
  const sourceId =
    data.sourceId === undefined ? undefined : data.sourceId || null;
  const sourceActionId =
    data.sourceActionId === undefined ? undefined : data.sourceActionId || null;

  const strategicUpdate = parseStrategicLinkUpdate(data);
  let strategicInitiativeId: string | null | undefined;
  let strategicProjectId: string | null | undefined;
  if (strategicUpdate.kind === "set") {
    strategicInitiativeId = strategicUpdate.link.initiativeId;
    strategicProjectId = strategicUpdate.link.projectId;
  } else if (strategicUpdate.kind === "clear") {
    strategicInitiativeId = null;
    strategicProjectId = null;
  }

  let completionOutcome: string | null | undefined;
  if (data.completionOutcome !== undefined) {
    const parsed = parseActionCompletionOutcome(data.completionOutcome);
    completionOutcome = parsed.ok ? parsed.value : null;
  }

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
        actionType,
        departmentId: data.departmentId,
        status: newStatus as never,
        priority: data.priority as never,
        completedAt,
        ...approvalFieldsForTransition(existing.status, newStatus),
        visibility: data.visibility as never,
        deadlineStart: data.deadlineStart
          ? startOfDay(data.deadlineStart)
          : undefined,
        deadlineEnd: data.deadlineEnd,
        leadId: data.leadId,
        relatedEntityType,
        relatedEntityId,
        // Action 4.0 contract
        sourceType,
        sourceId,
        sourceActionId,
        strategicInitiativeId,
        strategicProjectId,
        successDefinition: data.successDefinition,
        blockedReason: data.blockedReason,
        completionNote: data.completionNote,
        completionOutcome,
        nextFollowUpAt: data.nextFollowUpAt,
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

  await syncActionSearchDocument(data.id);
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
      data: {
        status: data.status as never,
        completedAt,
        ...approvalFieldsForTransition(existing.status, data.status),
      },
    });
    await postSystemComment(
      tx,
      data.id,
      session.id,
      data.status === "COMPLETE"
        ? `Status changed from ${existing.status} to COMPLETE — waiting for officer approval`
        : `Status changed from ${existing.status} to ${data.status}`
    );
  });

  await syncActionSearchDocument(data.id);
  revalidateAll();
}

const ApproveActionSchema = z.object({
  id: NonEmptyString,
});

/** Officer sign-off on a completed action. */
export async function approveActionItem(id: string) {
  ensureEnabled();
  const session = await requireSessionUser();
  if (!canApproveAction(session)) throw new Error("Unauthorized");

  const data = ApproveActionSchema.parse({ id });
  const access = await loadAccess(data.id);
  if (!canViewAction(session, access)) throw new Error("Unauthorized");

  const existing = await prisma.actionItem.findUnique({
    where: { id: data.id },
    select: { status: true, approvedAt: true },
  });
  if (!existing) throw new Error("Action item not found");
  if (existing.status !== "COMPLETE") {
    throw new Error("Only completed actions can be approved");
  }
  if (existing.approvedAt) return;

  const now = new Date();
  await prisma.$transaction(async (tx) => {
    await tx.actionItem.update({
      where: { id: data.id },
      data: { approvedAt: now, approvedById: session.id },
    });
    await postSystemComment(tx, data.id, session.id, "Action approved by officer");
  });

  await syncActionSearchDocument(data.id);
  revalidateAll();
}

// --- structured completion / blocker capture (Action System 4.0) -------------

const CaptureCompletionSchema = z.object({
  id: NonEmptyString,
  completionOutcome: z
    .string()
    .trim()
    .optional()
    .transform((v, ctx) => {
      const parsed = parseActionCompletionOutcome(v ?? null);
      if (!parsed.ok) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: parsed.error });
        return z.NEVER;
      }
      return parsed.value;
    }),
  completionNote: z
    .string()
    .trim()
    .max(10_000)
    .optional()
    .transform((v) => (v && v.length > 0 ? v : null)),
  nextFollowUpAt: CreateOptionalDateString,
});

/**
 * Mark an action COMPLETE with the structured outcome the 4.0 contract
 * stores: what happened (DELIVERED / PARTIAL / SUPERSEDED / ABANDONED), the
 * completion note, and an optional next follow-up date. One focused mutation
 * so inline capture doesn't need the full edit form.
 */
export async function captureActionCompletion(input: {
  id: string;
  completionOutcome?: string;
  completionNote?: string;
  nextFollowUpAt?: string;
}) {
  ensureEnabled();
  const session = await requireSessionUser();
  const data = CaptureCompletionSchema.parse(input);

  const access = await loadAccess(data.id);
  if (!canEditAction(session, access)) throw new Error("Unauthorized");

  const existing = await prisma.actionItem.findUnique({
    where: { id: data.id },
    select: { status: true },
  });
  if (!existing) throw new Error("Action item not found");

  const completedAt = completedAtForTransition(existing.status, "COMPLETE", new Date());

  await prisma.$transaction(async (tx) => {
    await tx.actionItem.update({
      where: { id: data.id },
      data: {
        status: "COMPLETE" as never,
        ...(completedAt !== undefined ? { completedAt } : {}),
        completionOutcome: data.completionOutcome,
        completionNote: data.completionNote,
        nextFollowUpAt: data.nextFollowUpAt,
      },
    });
    const detail = [
      data.completionOutcome ? `outcome ${data.completionOutcome}` : null,
      data.nextFollowUpAt ? "follow-up scheduled" : null,
    ]
      .filter(Boolean)
      .join(", ");
    await postSystemComment(
      tx,
      data.id,
      session.id,
      existing.status === "COMPLETE"
        ? `Completion details updated${detail ? ` (${detail})` : ""}`
        : `Status changed from ${existing.status} to COMPLETE${detail ? ` (${detail})` : ""}`
    );
  });

  await syncActionSearchDocument(data.id);
  revalidateAll();
}

const CaptureBlockerSchema = z.object({
  id: NonEmptyString,
  blockedReason: z.string().trim().min(1, "Name the blocker").max(10_000),
  nextFollowUpAt: CreateOptionalDateString,
});

/**
 * Mark an action BLOCKED with the reason the 4.0 contract stores (so the
 * blocker is actionable, not just a status) and an optional revisit date.
 */
export async function captureActionBlocker(input: {
  id: string;
  blockedReason: string;
  nextFollowUpAt?: string;
}) {
  ensureEnabled();
  const session = await requireSessionUser();
  const data = CaptureBlockerSchema.parse(input);

  const access = await loadAccess(data.id);
  if (!canEditAction(session, access)) throw new Error("Unauthorized");

  const existing = await prisma.actionItem.findUnique({
    where: { id: data.id },
    select: { status: true },
  });
  if (!existing) throw new Error("Action item not found");

  const completedAt = completedAtForTransition(existing.status, "BLOCKED", new Date());

  await prisma.$transaction(async (tx) => {
    await tx.actionItem.update({
      where: { id: data.id },
      data: {
        status: "BLOCKED" as never,
        ...(completedAt !== undefined ? { completedAt } : {}),
        blockedReason: data.blockedReason,
        nextFollowUpAt: data.nextFollowUpAt,
      },
    });
    await postSystemComment(
      tx,
      data.id,
      session.id,
      existing.status === "BLOCKED"
        ? "Blocker updated"
        : `Status changed from ${existing.status} to BLOCKED (reason captured)`
    );
  });

  await syncActionSearchDocument(data.id);
  revalidateAll();
}

// --- deleteActionItem --------------------------------------------------------

const DeleteActionItemSchema = z.object({
  id: NonEmptyString,
});

/** Remove an action from the open tracker (marks it DROPPED, keeps history). */
export async function deleteActionItem(id: string) {
  ensureEnabled();
  const session = await requireSessionUser();
  const data = DeleteActionItemSchema.parse({ id });

  const access = await loadAccess(data.id);
  if (!canDeleteAction(session, access)) throw new Error("Unauthorized");

  const existing = await prisma.actionItem.findUnique({
    where: { id: data.id },
    select: { status: true },
  });
  if (!existing) throw new Error("Action item not found");
  if (existing.status === "DROPPED") return;

  await prisma.$transaction(async (tx) => {
    await tx.actionItem.update({
      where: { id: data.id },
      data: { status: "DROPPED", completedAt: null, approvedAt: null, approvedById: null },
    });
    await postSystemComment(tx, data.id, session.id, "Action removed");
  });

  revalidateAll();
}

const DeleteActionItemsSchema = z.object({
  ids: z.array(NonEmptyString).min(1).max(50),
});

/** Remove multiple actions from the open tracker (marks each DROPPED). */
export async function deleteActionItems(ids: string[]) {
  ensureEnabled();
  const session = await requireSessionUser();
  const uniqueIds = Array.from(new Set(ids.map((id) => id.trim()).filter(Boolean)));
  const data = DeleteActionItemsSchema.parse({ ids: uniqueIds });

  for (const id of data.ids) {
    const access = await loadAccess(id);
    if (!canDeleteAction(session, access)) throw new Error("Unauthorized");
  }

  await prisma.$transaction(async (tx) => {
    for (const id of data.ids) {
      const existing = await tx.actionItem.findUnique({
        where: { id },
        select: { status: true },
      });
      if (!existing || existing.status === "DROPPED") continue;

      await tx.actionItem.update({
        where: { id },
        data: { status: "DROPPED", completedAt: null, approvedAt: null, approvedById: null },
      });
      await postSystemComment(tx, id, session.id, "Action removed");
    }
  });

  revalidateAll();
  return { removed: data.ids.length };
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

  // Phase 5: a user promoted to LEAD must be eligible (flag-gated, no-op by default).
  if (data.role === "LEAD") {
    await assertActionLeadEligible(data.userId, {
      authorizedByOfficer: isOfficerTier(session),
    });
  }

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

// --- flag to Leadership -------------------------------------------------------------

export async function flagActionToLeadership(actionId: string) {
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
        "Flagged to Leadership for escalation"
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

// --- resolve escalation (Leadership) -------------------------------------------------

/**
 * Resolve a Leadership escalation from the /people Escalation Queue. Leadership/Board only.
 * Sets `resolvedAt` (so the item leaves the queue and is never re-escalated)
 * and records a system comment in the item's history. Idempotent via a
 * conditional update — resolving an already-resolved item is a no-op.
 */
export async function resolveEscalation(actionId: string) {
  ensureEnabled();
  const session = await requireLeadership();
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
        body: "Escalation resolved by Leadership",
      },
    });
  }

  revalidateAll();
  revalidatePath("/actions/people");
  revalidatePath("/actions/people/board-rollup");
  return { ok: true, resolved: updated.count > 0 };
}

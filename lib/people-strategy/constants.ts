import type {
  ActionItemAssignmentRole,
  ActionItemCommentType,
  ActionItemStatus,
  ActionItemVisibility,
} from "@prisma/client";

/**
 * People Strategy — Action Items constants.
 *
 * Mirrors the Prisma enums introduced in Prompt 02A (`ActionItem`,
 * `ActionItemAssignment`, `ActionItemComment`). Kept as plain value arrays so
 * server actions can validate user input with zod without importing the full
 * Prisma runtime into client bundles.
 */

export const ACTION_ASSIGNMENT_ROLE_VALUES: ActionItemAssignmentRole[] = [
  "LEAD",
  "EXECUTING",
  "INPUT",
];

export const ACTION_VISIBILITY_VALUES: ActionItemVisibility[] = [
  "LEADERSHIP",
  "OFFICERS_ONLY",
];

export const ACTION_STATUS_VALUES: ActionItemStatus[] = [
  "NOT_STARTED",
  "IN_PROGRESS",
  "BLOCKED",
  "COMPLETE",
];

export const ACTION_COMMENT_TYPE_VALUES: ActionItemCommentType[] = [
  "COMMENT",
  "SYSTEM",
  "STATUS_CHANGE",
  "FLAG",
];

/** Routes revalidated after an Action Item mutation. */
export const ACTION_ITEM_PATHS = [
  "/my-actions",
  "/admin/actions",
  "/admin/action-center",
] as const;

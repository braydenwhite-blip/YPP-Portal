import type {
  ActionAssignmentRole,
  ActionCommentType,
  ActionItemStatus,
  ActionItemVisibility,
} from "@prisma/client";

/**
 * People Strategy — Action Items constants.
 *
 * Mirrors the Prisma enums introduced in Prompt 02A (`ActionItem`,
 * `ActionAssignment`, `ActionComment`, `ActionFileLink`). Kept as plain value
 * arrays so server actions can validate user input with zod without importing
 * the full Prisma runtime into client bundles.
 */

export const ACTION_ASSIGNMENT_ROLE_VALUES: ActionAssignmentRole[] = [
  "LEAD",
  "EXECUTING",
  "INPUT",
];

export const ACTION_VISIBILITY_VALUES: ActionItemVisibility[] = [
  "ALL_LEADERSHIP",
  "OFFICERS_ONLY",
];

export const ACTION_STATUS_VALUES: ActionItemStatus[] = [
  "NOT_STARTED",
  "IN_PROGRESS",
  "COMPLETE",
  "OVERDUE",
];

export const ACTION_COMMENT_TYPE_VALUES: ActionCommentType[] = [
  "NOTE",
  "INPUT_REQUESTED",
];

/** Human-readable labels for the status enum (used by the Action form / table). */
export const ACTION_STATUS_LABELS: Record<ActionItemStatus, string> = {
  NOT_STARTED: "Not started",
  IN_PROGRESS: "In progress",
  COMPLETE: "Complete",
  OVERDUE: "Overdue",
};

/** Human-readable labels for the visibility enum. */
export const ACTION_VISIBILITY_LABELS: Record<ActionItemVisibility, string> = {
  ALL_LEADERSHIP: "All leadership",
  OFFICERS_ONLY: "Officers only",
};

/** Routes revalidated after an Action Item mutation. */
export const ACTION_ITEM_PATHS = [
  "/my-actions",
  "/admin/actions",
  "/admin/action-center",
] as const;

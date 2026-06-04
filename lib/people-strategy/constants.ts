import type {
  ActionAssignmentRole,
  ActionCommentType,
  ActionItemStatus,
  ActionItemVisibility,
  ActionPriority,
  GoalRatingColor,
  QuarterlyReviewDecision,
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
  "BLOCKED",
  "COMPLETE",
  "OVERDUE",
  "DROPPED",
];

/**
 * Statuses an officer may set from the form/detail UI. OVERDUE is excluded — it
 * is a *computed* effective status (a past-due open item), never set by hand.
 */
export const ACTION_STATUS_SELECTABLE: ActionItemStatus[] = [
  "NOT_STARTED",
  "IN_PROGRESS",
  "BLOCKED",
  "COMPLETE",
  "DROPPED",
];

export const ACTION_COMMENT_TYPE_VALUES: ActionCommentType[] = [
  "NOTE",
  "INPUT_REQUESTED",
];

/** Human-readable labels for the status enum (used by the Action form / table). */
export const ACTION_STATUS_LABELS: Record<ActionItemStatus, string> = {
  NOT_STARTED: "Not started",
  IN_PROGRESS: "In progress",
  BLOCKED: "Blocked",
  COMPLETE: "Complete",
  OVERDUE: "Overdue",
  DROPPED: "Dropped",
};

export const ACTION_PRIORITY_VALUES: ActionPriority[] = [
  "LOW",
  "MEDIUM",
  "HIGH",
  "URGENT",
];

/** Human-readable labels for the priority enum. */
export const ACTION_PRIORITY_LABELS: Record<ActionPriority, string> = {
  LOW: "Low",
  MEDIUM: "Medium",
  HIGH: "High",
  URGENT: "Urgent",
};

/**
 * Numeric weight per priority, used to rank the Command Center attention queue
 * and to weight momentum. Higher = more urgent. Kept here as the single source
 * of truth so UI and scoring never drift.
 */
export const ACTION_PRIORITY_WEIGHT: Record<ActionPriority, number> = {
  LOW: 0,
  MEDIUM: 1,
  HIGH: 2,
  URGENT: 3,
};

/** Human-readable labels for the visibility enum. */
export const ACTION_VISIBILITY_LABELS: Record<ActionItemVisibility, string> = {
  ALL_LEADERSHIP: "All leadership",
  OFFICERS_ONLY: "Officers only",
};

/** Routes revalidated after an Action Item mutation. */
export const ACTION_ITEM_PATHS = [
  "/actions",
  "/actions/all",
  "/actions/all/classes",
  "/admin/actions",
] as const;

/**
 * Quarterly Review — decision enum values + labels (ENABLE_QUARTERLY_REVIEWS).
 * Plain value arrays so server actions can validate input with zod and the
 * client form can render options without importing the Prisma runtime.
 */
export const QUARTERLY_REVIEW_DECISION_VALUES: QuarterlyReviewDecision[] = [
  "PROMOTION",
  "ACHIEVEMENT_AWARD",
  "ROLE_CHANGE",
  "PIP",
  "CONTINUATION",
];

export const QUARTERLY_REVIEW_DECISION_LABELS: Record<
  QuarterlyReviewDecision,
  string
> = {
  PROMOTION: "Promotion",
  ACHIEVEMENT_AWARD: "Achievement award",
  ROLE_CHANGE: "Role change",
  PIP: "Performance improvement plan",
  CONTINUATION: "Continuation",
};

/**
 * Canonical low→high ordering of the four `GoalRatingColor` levels, reused for
 * both the Performance and Potential axes of the Quarterly Review matrix. The
 * labels match `check-in-rating.ts` `RATING_LABELS` (At Risk → Above & Beyond).
 */
export const GOAL_RATING_ORDER: GoalRatingColor[] = [
  "BEHIND_SCHEDULE", // At Risk
  "GETTING_STARTED", // Needs Attention
  "ACHIEVED", // On Track
  "ABOVE_AND_BEYOND", // Above & Beyond
];

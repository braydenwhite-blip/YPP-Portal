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

/**
 * Default deadline (days from today) pre-filled when creating a *new* action.
 * Leadership feedback: a week out felt too far, and a blank required field was
 * blocking creation — so new items default to a tight, editable 3-day target.
 */
export const DEFAULT_ACTION_DEADLINE_DAYS = 3;

/** Routes revalidated after an Action Item mutation. */
export const ACTION_ITEM_PATHS = [
  "/actions",
  "/actions/all",
  "/actions/all/classes",
  "/actions/command-center",
  "/actions/responsibility",
  "/admin/actions",
  "/operations",
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

/**
 * People Strategy Operating System — polymorphic related-entity link.
 *
 * `ActionItem.relatedEntityType` / `relatedEntityId` let an action point at the
 * domain object it is about (a class, a mentorship, a person, an instructor
 * application). The values below are the ones that ship as FULLY-WIRED link
 * targets. The originally-proposed 7-value list was narrowed after a codebase
 * audit (see `docs/people-strategy-operating-system-plan.md` §4):
 *
 *   - DEPARTMENT and OFFICER_MEETING already have dedicated FK columns on
 *     `ActionItem` (`departmentId` / `officerMeetingId`). Adding them here too
 *     would create two sources of truth, so they are intentionally excluded.
 *   - LEADERSHIP_PATHWAY is config-inferred with no stable DB id, so actions
 *     link to USER and surface the stage as context instead.
 *
 * String-typed (no Postgres enum, no FK) to mirror the loosely-typed
 * `goalCategory` field and keep cross-domain linking flexible; validated by the
 * TS union + the pure helpers below + a write-time existence check.
 */
export const RELATED_ENTITY_TYPE_VALUES = [
  "CLASS_OFFERING",
  "MENTORSHIP",
  "USER",
  "INSTRUCTOR_APPLICATION",
] as const;

export type RelatedEntityType = (typeof RELATED_ENTITY_TYPE_VALUES)[number];

/**
 * Human-readable labels. Includes the three values that are intentionally NOT
 * shipped as polymorphic link targets (DEPARTMENT / OFFICER_MEETING use their
 * own FK columns; LEADERSHIP_PATHWAY has no stable id) so any future surface can
 * label them consistently without re-deriving the copy.
 */
export const RELATED_ENTITY_TYPE_LABELS: Record<string, string> = {
  CLASS_OFFERING: "Class",
  MENTORSHIP: "Mentorship",
  USER: "Person",
  INSTRUCTOR_APPLICATION: "Instructor Application",
  DEPARTMENT: "Department",
  OFFICER_MEETING: "Officer Meeting",
  LEADERSHIP_PATHWAY: "Leadership Pathway",
};

/** Type guard: is `value` one of the shipped polymorphic link types? */
export function isRelatedEntityType(value: unknown): value is RelatedEntityType {
  return (
    typeof value === "string" &&
    (RELATED_ENTITY_TYPE_VALUES as readonly string[]).includes(value)
  );
}

/** Label for a related-entity type, falling back to the raw value. */
export function relatedEntityTypeLabel(type: string): string {
  return RELATED_ENTITY_TYPE_LABELS[type] ?? type;
}

/** A validated, normalized polymorphic link. */
export type RelatedEntityRef = { type: RelatedEntityType; id: string };

export type ParsedRelatedEntityRef =
  | { ok: true; ref: RelatedEntityRef | null }
  | { ok: false; error: string };

/**
 * Pure validator for the polymorphic related-entity link. Enforces the three
 * rules from the plan §4: "both present or both absent", enum membership, and a
 * trimmed non-empty id. Returns `ref: null` when neither field is provided — a
 * perfectly valid "no link" action. Shared by the create/update server-action
 * Zod schemas AND unit-tested directly so the rules can never drift.
 */
export function parseRelatedEntityRef(input: {
  relatedEntityType?: string | null;
  relatedEntityId?: string | null;
}): ParsedRelatedEntityRef {
  const type =
    typeof input.relatedEntityType === "string"
      ? input.relatedEntityType.trim()
      : "";
  const id =
    typeof input.relatedEntityId === "string" ? input.relatedEntityId.trim() : "";

  const hasType = type.length > 0;
  const hasId = id.length > 0;

  if (!hasType && !hasId) return { ok: true, ref: null };
  if (hasType !== hasId) {
    return {
      ok: false,
      error: "A linked entity needs both a type and an id (or neither).",
    };
  }
  if (!isRelatedEntityType(type)) {
    return { ok: false, error: "Unknown linked entity type." };
  }
  return { ok: true, ref: { type, id } };
}

/**
 * The result of interpreting a related-entity link on an UPDATE. Distinguishes
 * "leave the existing link untouched" (neither field sent) from "intentionally
 * clear the link" (sent empty) so an unrelated field edit can never silently
 * erase an existing link.
 */
export type RelatedEntityUpdate =
  | { kind: "unchanged" }
  | { kind: "clear" }
  | { kind: "set"; ref: RelatedEntityRef }
  | { kind: "error"; error: string };

/**
 * Pure interpreter for the related-entity link on UPDATE. `undefined` for BOTH
 * fields means "not part of this update" → unchanged. Anything else is treated
 * as the desired end-state and validated as a unit (both-or-neither, membership,
 * trim). Empty/cleared → clear; a valid pair → set; a mismatched/invalid pair →
 * error.
 */
export function parseRelatedEntityUpdate(input: {
  relatedEntityType?: string | null;
  relatedEntityId?: string | null;
}): RelatedEntityUpdate {
  if (
    input.relatedEntityType === undefined &&
    input.relatedEntityId === undefined
  ) {
    return { kind: "unchanged" };
  }
  const parsed = parseRelatedEntityRef(input);
  if (!parsed.ok) return { kind: "error", error: parsed.error };
  if (parsed.ref === null) return { kind: "clear" };
  return { kind: "set", ref: parsed.ref };
}

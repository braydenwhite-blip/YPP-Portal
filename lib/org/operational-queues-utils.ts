/**
 * Pure types + helpers for the operational queues (Phase 7 of
 * docs/ROLES_ACCESS_REVIEWS_MENTORSHIP_PLAN.md). No DB / no "use server", so
 * these can be imported anywhere and unit-tested. The server queries live in
 * `operational-queues.ts`.
 */

export const OPERATIONAL_QUEUE_KEYS = [
  "reviews-to-draft",
  "reviews-to-approve",
  "curriculum-to-review",
  "interviews-assigned",
  "missing-chapter",
  "promotion-setup",
] as const;
export type OperationalQueueKey = (typeof OPERATIONAL_QUEUE_KEYS)[number];

export const OPERATIONAL_QUEUE_LABELS: Record<OperationalQueueKey, string> = {
  "reviews-to-draft": "Reviews to Draft",
  "reviews-to-approve": "Reviews to Approve",
  "curriculum-to-review": "Curriculum to Review",
  "interviews-assigned": "Interviews Assigned",
  "missing-chapter": "Missing Chapter",
  "promotion-setup": "Promotion Setup",
};

export interface OperationalQueueViewer {
  id: string;
  roles: string[];
  primaryRole?: string | null;
  adminSubtypes?: string[];
  chapterId?: string | null;
}

export interface OperationalQueueRow {
  id: string;
  title: string;
  subtitle: string | null;
  href: string | null;
  ageLabel: string | null;
}

export interface OperationalQueueLane {
  key: OperationalQueueKey;
  label: string;
  count: number;
  rows: OperationalQueueRow[];
}

/**
 * A mentor goal review belongs in "Reviews to Draft" when there is a submitted
 * self-reflection and the review still needs the mentor's pen: not started, a
 * working draft, or returned for revision. Submitted-for-approval / approved
 * reviews are out (they are the approver's or done).
 */
export function isReviewAwaitingDraft(
  reviewStatus: string | null | undefined,
  hasSubmittedReflection: boolean
): boolean {
  if (!hasSubmittedReflection) return false;
  if (!reviewStatus) return true; // reflection in, no review yet
  return reviewStatus === "DRAFT" || reviewStatus === "CHANGES_REQUESTED";
}

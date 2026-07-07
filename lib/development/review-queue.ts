import type { GoalRatingColor } from "@prisma/client";

import { RATING_LABELS } from "@/lib/people-strategy/check-in-rating";

import type { DevelopmentPersonFacts } from "./signals";

/**
 * Leadership Development — the review queue (pure).
 *
 * Reduces every review situation to one actionable item: quarterly reviews
 * that are due or overdue, monthly mentor reviews stuck in chair approval, and
 * strong recent reviews worth recognizing. Ordered most-pressing-first so the
 * queue reads top-to-bottom as "do this next".
 */

export type ReviewQueueItemKind =
  | "quarterly-overdue"
  | "quarterly-due"
  | "approval-stuck"
  | "recognize";

export type ReviewQueueItem = {
  /** Stable key, also the dedupe key. */
  id: string;
  kind: ReviewQueueItemKind;
  personId: string;
  personName: string;
  contextLabel: string | null;
  /** Plain-language situation, e.g. "Review overdue — last review 2026-Q1". */
  reason: string;
  actionLabel: string;
  href: string;
  /** Lower sorts first. */
  rank: number;
  tone: "danger" | "warning" | "brand";
};

export type PendingChairApproval = {
  reviewId: string;
  menteeId: string;
  menteeName: string;
  mentorName: string;
  daysWaiting: number;
};

/** A recently released monthly mentor review with a strong overall rating. */
export type RecentStrongReview = {
  menteeId: string;
  menteeName: string;
  contextLabel: string | null;
  overallRating: GoalRatingColor;
  /** "June" — cycle month of the review. */
  monthLabel: string | null;
};

export function buildReviewQueue(input: {
  people: DevelopmentPersonFacts[];
  pendingApprovals: PendingChairApproval[];
  strongReviews: RecentStrongReview[];
}): ReviewQueueItem[] {
  const items: ReviewQueueItem[] = [];

  for (const person of input.people) {
    if (!person.reviewDue) continue;
    if (person.hasAnyReview) {
      items.push({
        id: `quarterly-overdue:${person.id}`,
        kind: "quarterly-overdue",
        personId: person.id,
        personName: person.name || person.email,
        contextLabel: person.contextLabel,
        reason: `Review overdue — last review ${person.lastReviewQuarter}`,
        actionLabel: "Record review",
        href: "/people/quarterly-reviews",
        rank: 0,
        tone: "danger",
      });
    } else {
      items.push({
        id: `quarterly-due:${person.id}`,
        kind: "quarterly-due",
        personId: person.id,
        personName: person.name || person.email,
        contextLabel: person.contextLabel,
        reason: "Review due — no review on file yet",
        actionLabel: "Record review",
        href: "/people/quarterly-reviews",
        rank: 2,
        tone: "warning",
      });
    }
  }

  for (const approval of input.pendingApprovals) {
    items.push({
      id: `approval:${approval.reviewId}`,
      kind: "approval-stuck",
      personId: approval.menteeId,
      personName: approval.menteeName,
      contextLabel: `Mentor: ${approval.mentorName}`,
      reason: `Monthly review waiting ${approval.daysWaiting} ${
        approval.daysWaiting === 1 ? "day" : "days"
      } for chair approval`,
      actionLabel: "Approve",
      href: "/mentorship?view=admin&tab=approvals",
      rank: approval.daysWaiting >= 7 ? 1 : 3,
      tone: approval.daysWaiting >= 7 ? "danger" : "warning",
    });
  }

  for (const review of input.strongReviews) {
    if (review.overallRating !== "ABOVE_AND_BEYOND") continue;
    items.push({
      id: `recognize:${review.menteeId}`,
      kind: "recognize",
      personId: review.menteeId,
      personName: review.menteeName,
      contextLabel: review.contextLabel,
      reason: review.monthLabel
        ? `${review.monthLabel} mentor review: ${RATING_LABELS.ABOVE_AND_BEYOND} — worth recognizing`
        : `Latest mentor review: ${RATING_LABELS.ABOVE_AND_BEYOND} — worth recognizing`,
      actionLabel: "Recognize",
      href: `/mentorship/people/${review.menteeId}`,
      rank: 4,
      tone: "brand",
    });
  }

  // Dedupe by id, order most-pressing-first, then by name for stability.
  const seen = new Set<string>();
  return items
    .filter((item) => (seen.has(item.id) ? false : (seen.add(item.id), true)))
    .sort(
      (a, b) =>
        a.rank - b.rank ||
        a.personName.localeCompare(b.personName, undefined, { sensitivity: "base" })
    );
}

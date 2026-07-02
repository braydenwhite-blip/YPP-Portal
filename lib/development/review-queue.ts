import type { GoalRatingColor } from "@prisma/client";

import { RATING_LABELS } from "@/lib/people-strategy/check-in-rating";

import { CYCLE_DISPLAY_META, type CycleDisplayState } from "./cycle-flow";
import type { DevelopmentPersonFacts } from "./signals";

/**
 * Leadership Development — the review queue (pure).
 *
 * Reduces every review situation to one actionable item: review cycles that
 * need a move (synthesis, action plan, an overdue follow-up — or input being
 * waited on), quarterly reviews due or overdue with no cycle running yet,
 * monthly mentor reviews stuck in chair approval, and strong recent reviews
 * worth recognizing. Ordered most-pressing-first so the queue reads
 * top-to-bottom as "do this next".
 */

export type ReviewQueueItemKind =
  | "cycle-follow-up-overdue"
  | "cycle-synthesis"
  | "cycle-action-plan"
  | "cycle-waiting"
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
  tone: "danger" | "warning" | "info" | "brand";
};

/** One in-flight review cycle, shaped by the loader. */
export type ActiveCycleQueueInput = {
  cycleId: string;
  revieweeId: string;
  revieweeName: string;
  contextLabel: string | null;
  displayState: CycleDisplayState;
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

const CYCLE_QUEUE_ITEMS: Partial<
  Record<
    CycleDisplayState,
    { kind: ReviewQueueItemKind; actionLabel: string; rank: number; tone: ReviewQueueItem["tone"] }
  >
> = {
  "follow-up-overdue": {
    kind: "cycle-follow-up-overdue",
    actionLabel: "Open review",
    rank: 0,
    tone: "danger",
  },
  "ready-for-synthesis": {
    kind: "cycle-synthesis",
    actionLabel: "Write synthesis",
    rank: 1,
    tone: "warning",
  },
  "action-plan-needed": {
    kind: "cycle-action-plan",
    actionLabel: "Build action plan",
    rank: 1,
    tone: "warning",
  },
  "waiting-self-input": {
    kind: "cycle-waiting",
    actionLabel: "Open review",
    rank: 5,
    tone: "info",
  },
  "waiting-feedback": {
    kind: "cycle-waiting",
    actionLabel: "Open review",
    rank: 5,
    tone: "info",
  },
  "waiting-input": {
    kind: "cycle-waiting",
    actionLabel: "Open review",
    rank: 5,
    tone: "info",
  },
};

export function buildReviewQueue(input: {
  people: DevelopmentPersonFacts[];
  activeCycles?: ActiveCycleQueueInput[];
  pendingApprovals: PendingChairApproval[];
  strongReviews: RecentStrongReview[];
}): ReviewQueueItem[] {
  const items: ReviewQueueItem[] = [];

  for (const cycle of input.activeCycles ?? []) {
    const config = CYCLE_QUEUE_ITEMS[cycle.displayState];
    if (!config) continue;
    items.push({
      id: `cycle:${cycle.cycleId}`,
      kind: config.kind,
      personId: cycle.revieweeId,
      personName: cycle.revieweeName,
      contextLabel: cycle.contextLabel,
      reason: CYCLE_DISPLAY_META[cycle.displayState].label,
      actionLabel: config.actionLabel,
      href: `/people/develop/reviews/${cycle.cycleId}`,
      rank: config.rank,
      tone: config.tone,
    });
  }

  // People with a running cycle are covered by their cycle item — don't also
  // nag about the quarterly review the cycle exists to produce.
  const inCycle = new Set((input.activeCycles ?? []).map((c) => c.revieweeId));

  for (const person of input.people) {
    if (!person.reviewDue || inCycle.has(person.id)) continue;
    if (person.hasAnyReview) {
      items.push({
        id: `quarterly-overdue:${person.id}`,
        kind: "quarterly-overdue",
        personId: person.id,
        personName: person.name || person.email,
        contextLabel: person.contextLabel,
        reason: `Review overdue — last review ${person.lastReviewQuarter}`,
        actionLabel: "Start review",
        href: "/people/develop/reviews/new",
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
        actionLabel: "Start review",
        href: "/people/develop/reviews/new",
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
      href: "/admin/mentorship?tab=approvals",
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
      href: `/people/develop/${review.menteeId}`,
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

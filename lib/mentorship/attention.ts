import type { ActionItemStatus, MentorshipActionItemStatus, MentorshipStatus } from "@prisma/client";

import { daysUntil, isOverdue, startOfDay } from "@/lib/leadership-action-center/dates";

/**
 * Canonical mentorship next-step + needs-attention derivation (Unification
 * Phase 5).
 *
 * Before this module, "what needs to happen on this relationship?" was computed
 * 4–5 different ways — the admin cockpit (`cadenceRisks`, 21d, "rhythm reset"),
 * the mentorship hub (`relationshipHealth.staleCircles`, 21d), the mentor home
 * ("quiet mentees", 14d), the queue loader, and Person 360 — each with its own
 * threshold, its own canonical+legacy action merge, and its own user-facing
 * phrasing. This module is the ONE deterministic derivation every surface reads.
 *
 * It is PURE: no Prisma, no IO. Loaders map canonical rows
 * (`ActionItem` + `MentorshipSession` + cycle) into the `*Fact` inputs and call
 * {@link deriveMentorshipNextStep} / {@link deriveMentorshipAttention}; `now` is
 * injected so every branch is unit-testable against fixed dates.
 *
 * The selection order is LOCKED (do not reorder — see the plan §H):
 *   1. overdue action → 2. blocked action → 3. action due soon →
 *   4. missing next check-in → 5. upcoming check-in → 6. review/cycle due → 7. none.
 */

// --- thresholds (the ONE configuration location) ----------------------------

export const MENTORSHIP_ATTENTION_THRESHOLDS = {
  /**
   * An open next step is "due soon" within this many days of its deadline.
   * Mirrors the Action Tracker's `ACTION_DUE_SOON_DAYS` (3) so a mentorship next
   * step and the same action in `/actions` agree on what "due soon" means.
   */
  actionDueSoonDays: 3,
  /**
   * A relationship is overdue for a check-in when its last completed check-in is
   * older than this and none is scheduled. 21 days (3 weeks) is the cadence the
   * admin cockpit and the hub's `staleCircles` already used; the 14d mentor-home
   * "quiet" nudge and the 45d cross-domain Data-360 sweep are deliberately
   * separate, coarser concepts and stay where they are.
   */
  checkInOverdueDays: 21,
} as const;

// --- canonical action facts -------------------------------------------------

/**
 * A single open mentorship next step, normalized from a canonical `ActionItem`
 * (or, transitionally, an unlinked legacy `MentorshipActionItem`). Completed and
 * dropped/cancelled work is excluded before it ever reaches this shape.
 */
export type MentorshipActionFact = {
  id: string;
  title: string;
  /** Canonical `ActionItemStatus` (legacy rows are mapped on the way in). */
  status: ActionItemStatus;
  /** Effective deadline (`deadlineEnd ?? deadlineStart`), or null if undated. */
  dueAt: Date | null;
  /** Provenance — the source check-in, when this step came from one. */
  mentorshipSessionId: string | null;
  /** True when this fact came from a legacy `MentorshipActionItem` row. */
  legacy: boolean;
};

/** A scheduled or completed mentorship check-in (`MentorshipSession`). */
export type MentorshipCheckInFact = {
  id: string;
  scheduledAt: Date;
  completedAt: Date | null;
  cancelledAt: Date | null;
};

/** A pending review / cycle obligation on the relationship. */
export type MentorshipReviewFact = {
  kind: "REVIEW" | "REFLECTION" | "CYCLE";
  dueAt: Date | null;
};

/** Everything the canonical derivation needs about ONE relationship. */
export type MentorshipAttentionFacts = {
  mentorshipId: string;
  menteeId: string;
  menteeName: string;
  mentorName: string;
  status: MentorshipStatus;
  /** Open next steps only (callers exclude COMPLETE / DROPPED first). */
  openActions: MentorshipActionFact[];
  checkIns: MentorshipCheckInFact[];
  /** The pending review / cycle obligation, if any. */
  reviewDue?: MentorshipReviewFact | null;
  /** The authorized relationship-workspace URL for the viewer this is built for. */
  workspaceHref: string;
};

// --- output -----------------------------------------------------------------

export type MentorshipNextStepType =
  | "OVERDUE_ACTION"
  | "BLOCKED_ACTION"
  | "ACTION_DUE_SOON"
  | "MISSING_CHECK_IN"
  | "UPCOMING_CHECK_IN"
  | "REVIEW_DUE"
  | "NONE";

/** Stable, machine-readable reason codes (never shown raw to users). */
export type MentorshipReasonCode =
  | "NEXT_STEP_OVERDUE"
  | "NEXT_STEP_BLOCKED"
  | "NEXT_STEP_DUE_SOON"
  | "CHECK_IN_OVERDUE"
  | "NO_CHECK_IN_SCHEDULED"
  | "CHECK_IN_UPCOMING"
  | "REVIEW_DUE"
  | "NO_IMMEDIATE_ACTION";

export type MentorshipSeverity = "critical" | "high" | "medium" | "low" | "none";

export type MentorshipNextStepSource = "ACTION" | "CHECK_IN" | "REVIEW" | "NONE";

/** The single derived next move for a relationship — structured, not a string. */
export type MentorshipNextStep = {
  type: MentorshipNextStepType;
  reasonCode: MentorshipReasonCode;
  /** Concrete, user-facing label, e.g. "Next step overdue". */
  title: string;
  /** One-sentence plain-language explanation. */
  explanation: string;
  severity: MentorshipSeverity;
  /** The date that drives this step (deadline / scheduled / review due), or null. */
  dueAt: Date | null;
  /** The related `ActionItem` / `MentorshipSession` id, or null. */
  relatedId: string | null;
  source: MentorshipNextStepSource;
  /** Where to go to act — the authorized relationship workspace. */
  href: string;
  /** The recommended next move, phrased as an instruction. */
  recommendedAction: string;
};

export type MentorshipAttentionState = "needs_attention" | "scheduled" | "on_track";

/** The relationship's headline attention read, derived from its next step. */
export type MentorshipAttention = {
  state: MentorshipAttentionState;
  reasonCode: MentorshipReasonCode;
  severity: MentorshipSeverity;
  /** Concrete headline, e.g. "Check-in overdue" — never "unhealthy"/"rhythm reset". */
  headline: string;
  explanation: string;
  relatedId: string | null;
  relevantDate: Date | null;
  recommendedAction: string;
  /** The next step this attention read was derived from. */
  nextStep: MentorshipNextStep;
};

// --- status helpers ---------------------------------------------------------

const CLOSED_ACTION_STATUSES: ActionItemStatus[] = ["COMPLETE", "DROPPED"];

/** Whether a canonical action status counts as open (active) work. */
export function isOpenActionStatus(status: ActionItemStatus): boolean {
  return !CLOSED_ACTION_STATUSES.includes(status);
}

/** Map a legacy `MentorshipActionItemStatus` onto the canonical status. */
export function legacyActionStatusToCanonical(
  status: MentorshipActionItemStatus
): ActionItemStatus {
  switch (status) {
    case "OPEN":
      return "NOT_STARTED";
    case "IN_PROGRESS":
      return "IN_PROGRESS";
    case "BLOCKED":
      return "BLOCKED";
    case "COMPLETE":
      return "COMPLETE";
    default:
      return "NOT_STARTED";
  }
}

function isBlocked(action: MentorshipActionFact): boolean {
  return action.status === "BLOCKED";
}

// --- canonical + legacy merge (the ONE place this happens) -------------------

/** Minimal canonical `ActionItem` shape the merge needs. */
export type CanonicalActionRow = {
  id: string;
  title: string;
  status: ActionItemStatus;
  deadlineStart: Date;
  deadlineEnd: Date | null;
  mentorshipSessionId: string | null;
};

/** Minimal legacy `MentorshipActionItem` shape the merge needs. */
export type LegacyActionRow = {
  id: string;
  title: string;
  status: MentorshipActionItemStatus;
  dueAt: Date | null;
  completedAt: Date | null;
  linkedActionId: string | null;
  sessionId: string | null;
};

/**
 * The ONE place canonical actions and (transitional) legacy rows fold into
 * next-step facts. Canonical actions always win; a legacy row is included only
 * when it was never bridged (`linkedActionId == null`) and is still open — so a
 * migrated legacy row is never double-counted next to its canonical twin, and no
 * consumer invents its own merge. Returns open facts only.
 */
export function mergeMentorshipActionFacts(
  canonical: CanonicalActionRow[],
  legacy: LegacyActionRow[] = []
): MentorshipActionFact[] {
  const facts: MentorshipActionFact[] = [];

  for (const action of canonical) {
    if (!isOpenActionStatus(action.status)) continue;
    facts.push({
      id: action.id,
      title: action.title,
      status: action.status,
      dueAt: action.deadlineEnd ?? action.deadlineStart ?? null,
      mentorshipSessionId: action.mentorshipSessionId ?? null,
      legacy: false,
    });
  }

  for (const row of legacy) {
    if (row.linkedActionId) continue; // already represented canonically
    if (row.completedAt) continue;
    const status = legacyActionStatusToCanonical(row.status);
    if (!isOpenActionStatus(status)) continue;
    facts.push({
      id: row.id,
      title: row.title,
      status,
      dueAt: row.dueAt ?? null,
      mentorshipSessionId: row.sessionId ?? null,
      legacy: true,
    });
  }

  return facts;
}

/** Count open + overdue + blocked across merged next-step facts, in one pass. */
export function summarizeMentorshipActionFacts(
  facts: MentorshipActionFact[],
  now: Date = new Date()
): { open: number; overdue: number; blocked: number } {
  let overdue = 0;
  let blocked = 0;
  for (const fact of facts) {
    if (isBlocked(fact)) blocked += 1;
    if (isOverdue(fact.dueAt, now)) overdue += 1;
  }
  return { open: facts.length, overdue, blocked };
}

function isDueSoon(dueAt: Date | null, now: Date): boolean {
  if (!dueAt) return false;
  const days = daysUntil(dueAt, now);
  return days != null && days >= 0 && days <= MENTORSHIP_ATTENTION_THRESHOLDS.actionDueSoonDays;
}

/** Earliest-due first; undated actions sort last. */
function byDueAsc(a: MentorshipActionFact, b: MentorshipActionFact): number {
  const at = a.dueAt ? a.dueAt.getTime() : Number.POSITIVE_INFINITY;
  const bt = b.dueAt ? b.dueAt.getTime() : Number.POSITIVE_INFINITY;
  return at - bt;
}

type CheckInRead = {
  /** The earliest not-yet-held check-in scheduled for today or later. */
  next: MentorshipCheckInFact | null;
  /** The most recent completed check-in. */
  lastCompletedAt: Date | null;
  /** A check-in was scheduled, never held, and is now in the past. */
  missedPast: boolean;
  /** No check-in has ever been completed. */
  neverHeld: boolean;
};

function readCheckIns(checkIns: MentorshipCheckInFact[], now: Date): CheckInRead {
  const startToday = startOfDay(now).getTime();
  let next: MentorshipCheckInFact | null = null;
  let lastCompletedAt: Date | null = null;
  let missedPast = false;

  for (const checkIn of checkIns) {
    if (checkIn.cancelledAt) continue;
    if (checkIn.completedAt) {
      if (!lastCompletedAt || checkIn.completedAt.getTime() > lastCompletedAt.getTime()) {
        lastCompletedAt = checkIn.completedAt;
      }
      continue;
    }
    // Not completed, not cancelled.
    if (checkIn.scheduledAt.getTime() >= startToday) {
      if (!next || checkIn.scheduledAt.getTime() < next.scheduledAt.getTime()) {
        next = checkIn;
      }
    } else {
      missedPast = true; // a scheduled check-in came and went un-held
    }
  }

  return { next, lastCompletedAt, missedPast, neverHeld: lastCompletedAt == null };
}

/** True when the last completed check-in is older than the cadence threshold. */
function cadenceLapsed(lastCompletedAt: Date | null, now: Date): boolean {
  if (!lastCompletedAt) return false;
  const days = daysUntil(lastCompletedAt, now); // negative = days ago
  return days != null && days <= -MENTORSHIP_ATTENTION_THRESHOLDS.checkInOverdueDays;
}

// --- next-step derivation (the locked order) --------------------------------

function noneStep(href: string): MentorshipNextStep {
  return {
    type: "NONE",
    reasonCode: "NO_IMMEDIATE_ACTION",
    title: "No immediate action",
    explanation: "This relationship is on track — nothing needs your attention right now.",
    severity: "none",
    dueAt: null,
    relatedId: null,
    source: "NONE",
    href,
    recommendedAction: "No action needed.",
  };
}

/**
 * The single highest-priority next move for a relationship, in the LOCKED order.
 * Pure; `now` is injected. Pages and components must call this — never re-derive
 * the order inline.
 */
export function deriveMentorshipNextStep(
  facts: MentorshipAttentionFacts,
  now: Date = new Date()
): MentorshipNextStep {
  const href = facts.workspaceHref;

  // Closed / paused relationships never surface a next step.
  if (facts.status !== "ACTIVE") return noneStep(href);

  const openActions = facts.openActions.filter((action) => isOpenActionStatus(action.status));

  // 1. overdue action — a dated open step past its deadline.
  const overdue = openActions.filter((action) => isOverdue(action.dueAt, now)).sort(byDueAsc)[0];
  if (overdue) {
    return {
      type: "OVERDUE_ACTION",
      reasonCode: "NEXT_STEP_OVERDUE",
      title: "Next step overdue",
      explanation: `"${overdue.title}" is past its due date.`,
      severity: "critical",
      dueAt: overdue.dueAt,
      relatedId: overdue.id,
      source: "ACTION",
      href,
      recommendedAction: "Complete it, push the date, or update the plan.",
    };
  }

  // 2. blocked action — work that cannot proceed.
  const blocked = openActions.filter(isBlocked).sort(byDueAsc)[0];
  if (blocked) {
    return {
      type: "BLOCKED_ACTION",
      reasonCode: "NEXT_STEP_BLOCKED",
      title: "Next step blocked",
      explanation: `"${blocked.title}" is blocked and can't move forward.`,
      severity: "high",
      dueAt: blocked.dueAt,
      relatedId: blocked.id,
      source: "ACTION",
      href,
      recommendedAction: "Clear or escalate the blocker.",
    };
  }

  // 3. action due soon — within the canonical due-soon window.
  const soon = openActions.filter((action) => isDueSoon(action.dueAt, now)).sort(byDueAsc)[0];
  if (soon) {
    const days = daysUntil(soon.dueAt, now);
    return {
      type: "ACTION_DUE_SOON",
      reasonCode: "NEXT_STEP_DUE_SOON",
      title: "Next step due soon",
      explanation:
        days != null && days <= 0
          ? `"${soon.title}" is due today.`
          : `"${soon.title}" is due in ${days} day${days === 1 ? "" : "s"}.`,
      severity: "medium",
      dueAt: soon.dueAt,
      relatedId: soon.id,
      source: "ACTION",
      href,
      recommendedAction: "Confirm it's on track to finish.",
    };
  }

  const checkIns = readCheckIns(facts.checkIns, now);

  // 4. missing next check-in — none scheduled, and one is due / overdue / never held.
  if (!checkIns.next) {
    const overdueForCheckIn = checkIns.missedPast || cadenceLapsed(checkIns.lastCompletedAt, now);
    if (overdueForCheckIn) {
      return {
        type: "MISSING_CHECK_IN",
        reasonCode: "CHECK_IN_OVERDUE",
        title: "Check-in overdue",
        explanation: checkIns.missedPast
          ? "A scheduled check-in was missed and none is on the calendar."
          : "It's been a while since the last check-in and none is scheduled.",
        severity: "high",
        dueAt: checkIns.lastCompletedAt,
        relatedId: null,
        source: "CHECK_IN",
        href,
        recommendedAction: "Schedule the next check-in.",
      };
    }
    if (checkIns.neverHeld) {
      return {
        type: "MISSING_CHECK_IN",
        reasonCode: "NO_CHECK_IN_SCHEDULED",
        title: "No next check-in scheduled",
        explanation: "There's no upcoming check-in on the calendar yet.",
        severity: "medium",
        dueAt: null,
        relatedId: null,
        source: "CHECK_IN",
        href,
        recommendedAction: "Schedule the first check-in.",
      };
    }
    // A check-in was held recently and none is scheduled yet — not yet a problem;
    // fall through to review/cycle (6) or none (7).
  } else {
    // 5. upcoming check-in — one is on the calendar.
    const next = checkIns.next;
    const days = daysUntil(next.scheduledAt, now);
    return {
      type: "UPCOMING_CHECK_IN",
      reasonCode: "CHECK_IN_UPCOMING",
      title: "Check-in coming up",
      explanation:
        days != null && days <= 0
          ? "The next check-in is today."
          : `The next check-in is in ${days} day${days === 1 ? "" : "s"}.`,
      severity: "low",
      dueAt: next.scheduledAt,
      relatedId: next.id,
      source: "CHECK_IN",
      href,
      recommendedAction: "Prepare for the upcoming check-in.",
    };
  }

  // 6. review or cycle due — a recently-active relationship with a pending review.
  if (facts.reviewDue) {
    return {
      type: "REVIEW_DUE",
      reasonCode: "REVIEW_DUE",
      title: "Review due",
      explanation: "A mentorship review or cycle step is due.",
      severity: "medium",
      dueAt: facts.reviewDue.dueAt,
      relatedId: null,
      source: "REVIEW",
      href,
      recommendedAction: "Complete the review or advance the cycle.",
    };
  }

  // 7. no immediate action.
  return noneStep(href);
}

// --- attention derivation ---------------------------------------------------

const NEEDS_ATTENTION_TYPES: ReadonlySet<MentorshipNextStepType> = new Set([
  "OVERDUE_ACTION",
  "BLOCKED_ACTION",
  "ACTION_DUE_SOON",
  "MISSING_CHECK_IN",
  "REVIEW_DUE",
]);

function attentionStateFor(step: MentorshipNextStep): MentorshipAttentionState {
  if (NEEDS_ATTENTION_TYPES.has(step.type)) return "needs_attention";
  if (step.type === "UPCOMING_CHECK_IN") return "scheduled";
  return "on_track";
}

/**
 * The relationship's canonical needs-attention read. Consumes
 * {@link deriveMentorshipNextStep} so attention and the next step can never
 * disagree. Pure; `now` injected.
 */
export function deriveMentorshipAttention(
  facts: MentorshipAttentionFacts,
  now: Date = new Date()
): MentorshipAttention {
  const nextStep = deriveMentorshipNextStep(facts, now);
  return {
    state: attentionStateFor(nextStep),
    reasonCode: nextStep.reasonCode,
    severity: nextStep.severity,
    headline: nextStep.title,
    explanation: nextStep.explanation,
    relatedId: nextStep.relatedId,
    relevantDate: nextStep.dueAt,
    recommendedAction: nextStep.recommendedAction,
    nextStep,
  };
}

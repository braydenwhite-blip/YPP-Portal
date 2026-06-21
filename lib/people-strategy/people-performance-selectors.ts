import type { GoalRatingColor, GrowthTag } from "@prisma/client";

import { RATING_LABELS } from "./check-in-rating";
import { GROWTH_TAG_META } from "./growth-signals";
import { RATING_COLORS } from "./people-dashboard-selectors";

/**
 * People & Performance (`/people/performance`) — pure selectors.
 *
 * Everything here is deterministic (no Prisma, no I/O, no implicit clock) so
 * the dashboard's filters, stat counts, signal chips, and check-in dot states
 * are unit-testable. The async loader in `people-performance.ts` feeds these.
 *
 * Presentation policy (master plan §19): every signal is a concrete fact with
 * its reason in the label — "2 overdue actions", "No review for 2026-Q2" —
 * never a bare score or vague health word.
 */

// ── Month / quarter keys ─────────────────────────────────────────────────────

/** First day of the UTC month containing `d`. */
export function monthStartUTC(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));
}

/** "2026-06" for any date in June 2026 (UTC). */
export function monthKeyUTC(d: Date): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

/** Parse a "2026-06" key back to the UTC month start. Null when malformed. */
export function parseMonthKey(key: string): Date | null {
  const match = /^(\d{4})-(\d{2})$/.exec(key);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  if (month < 1 || month > 12) return null;
  return new Date(Date.UTC(year, month - 1, 1));
}

/** "June 2026" (UTC). */
export function monthLabelUTC(d: Date): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(d);
}

/** "Jun 26" — the short dot label (UTC). */
export function monthShortLabelUTC(d: Date): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    year: "2-digit",
    timeZone: "UTC",
  }).format(d);
}

/** "2026-Q2" for any date in Apr–Jun 2026 (UTC) — the QuarterlyReview key. */
export function currentQuarterLabel(now: Date): string {
  return `${now.getUTCFullYear()}-Q${Math.floor(now.getUTCMonth() / 3) + 1}`;
}

export type FeedbackMonthOption = { key: string; label: string };

/** Summer 2026 program start — check-ins compile from June 2026 onward only. */
export const CHECK_IN_ACCOUNTABLE_FROM_MONTH_KEY = "2026-06";

/**
 * The months a feedback request may target: the current month plus the two
 * before it (Leadership often prepares last month's check-in early the next
 * month). Used for feedback-request targeting and server validation.
 */
export function allowedFeedbackMonths(now: Date, count = 3): FeedbackMonthOption[] {
  const options: FeedbackMonthOption[] = [];
  for (let back = 0; back < count; back++) {
    const month = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - back, 1));
    options.push({ key: monthKeyUTC(month), label: monthLabelUTC(month) });
  }
  return options;
}

/**
 * Months shown in the check-ins drawer: June 2026 program start through the
 * current month. Grows by one row each calendar month — nothing before June 2026.
 */
export function buildCheckInDrawerMonths(now: Date): FeedbackMonthOption[] {
  const programStart = parseMonthKey(CHECK_IN_ACCOUNTABLE_FROM_MONTH_KEY);
  if (!programStart) return [];

  const current = monthStartUTC(now);
  if (current < programStart) return [];

  const options: FeedbackMonthOption[] = [];
  let cursor = programStart;
  while (cursor <= current) {
    options.push({ key: monthKeyUTC(cursor), label: monthLabelUTC(cursor) });
    cursor = new Date(Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth() + 1, 1));
  }
  return options;
}

// ── Check-in dots over fixed calendar months ────────────────────────────────

export type CheckInDotState = "rated" | "completed" | "missing" | "not_due";

export type CheckInCalendarDot = {
  monthKey: string;
  /** "Jun 26" */
  monthLabel: string;
  state: CheckInDotState;
  /** Set only when state is "rated". */
  rating: GoalRatingColor | null;
};

/** First calendar month leadership compiles check-ins (June 2026 program start). */
export function getCheckInAccountableFromMonthKey(): string {
  return CHECK_IN_ACCOUNTABLE_FROM_MONTH_KEY;
}

/** @deprecated Per-person start dates are no longer used — returns the program start month. */
export function resolveCheckInStartMonthKey(_input?: {
  provisionalStart?: Date | null;
  roleStartDate?: Date | null;
  createdAt?: Date;
}): string {
  return CHECK_IN_ACCOUNTABLE_FROM_MONTH_KEY;
}

/** True when a calendar month is on or after the program start and not in the future. */
export function isCheckInMonthAccountable(
  monthKey: string,
  startMonthKey: string | null | undefined = CHECK_IN_ACCOUNTABLE_FROM_MONTH_KEY,
  currentMonthKey?: string
): boolean {
  const floor = startMonthKey ?? CHECK_IN_ACCOUNTABLE_FROM_MONTH_KEY;
  if (monthKey < floor) return false;
  if (currentMonthKey && monthKey > currentMonthKey) return false;
  return true;
}

/**
 * Three synced dots for the check-in column: anchored to June 2026 onward.
 * Before the program start or after the current month → grey (not_due).
 * Current/past accountable months → red missing, yellow in progress, green complete.
 */
export function buildCheckInCalendarDotMonthKeys(
  now: Date,
  count = 3,
  startMonthKey: string = CHECK_IN_ACCOUNTABLE_FROM_MONTH_KEY
): string[] {
  const currentKey = monthKeyUTC(monthStartUTC(now));
  const endKey = currentKey >= startMonthKey ? currentKey : startMonthKey;
  const endDate = parseMonthKey(endKey)!;

  const keys: string[] = [];
  let cursor = endDate;
  while (keys.length < count) {
    const key = monthKeyUTC(cursor);
    if (key >= startMonthKey) keys.unshift(key);
    cursor = new Date(Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth() - 1, 1));
    if (monthKeyUTC(cursor) < startMonthKey && keys.length > 0) break;
  }

  while (keys.length < count) {
    const last = parseMonthKey(keys[keys.length - 1]!)!;
    const next = new Date(Date.UTC(last.getUTCFullYear(), last.getUTCMonth() + 1, 1));
    keys.push(monthKeyUTC(next));
  }

  return keys.slice(-count);
}

export function buildCheckInCalendarDots(
  checkIns: Array<{ monthKey: string; rating: GoalRatingColor | null }>,
  now: Date,
  count = 3,
  startMonthKey: string = CHECK_IN_ACCOUNTABLE_FROM_MONTH_KEY
): CheckInCalendarDot[] {
  const byKey = new Map(checkIns.map((c) => [c.monthKey, c]));
  const currentKey = monthKeyUTC(monthStartUTC(now));
  const monthKeys = buildCheckInCalendarDotMonthKeys(now, count, startMonthKey);

  return monthKeys.map((key) => {
    const month = parseMonthKey(key)!;
    const found = byKey.get(key);
    const accountable = isCheckInMonthAccountable(key, startMonthKey, currentKey);
    return {
      monthKey: key,
      monthLabel: monthShortLabelUTC(month),
      state: !accountable
        ? "not_due"
        : found
          ? found.rating
            ? "rated"
            : "completed"
          : "missing",
      rating: found?.rating ?? null,
    };
  });
}

// ── Mentorship & growth eligibility ──────────────────────────────────────────

/**
 * Roles the Instructor Mentorship Program assigns a mentor to. Mentees in the
 * program are instructors and chapter presidents (the two active mentorship
 * lanes); students get an *advisor* (not a mentor), and admins/staff/officers
 * are not mentees — so a missing mentor is only a development gap for these
 * roles. Keeping the predicate pure here lets the loader flag "No mentor
 * assigned" without over-flagging people who are not expected to have one.
 */
export const MENTOR_EXPECTED_ROLES = ["INSTRUCTOR", "CHAPTER_PRESIDENT"] as const;

export function roleExpectsMentor(role: string | null | undefined): boolean {
  return role != null && (MENTOR_EXPECTED_ROLES as readonly string[]).includes(role);
}

// ── Row shape ────────────────────────────────────────────────────────────────

export type MemberFeedbackStatus = {
  /** Requests awaiting a response. */
  outstanding: number;
  /** Requests answered. */
  submitted: number;
  /** "2026-06" of the most recent month any request targeted, or null. */
  lastRequestedMonthKey: string | null;
};

/**
 * The current month's feedback workflow position for one member. These are the
 * concrete facts the redesigned surface answers leadership's questions with —
 * "who has feedback ready to review", "who is still waiting" — with no synthetic
 * score and no vague health word.
 */
export type CurrentMonthFeedback = {
  /** Feedback requests created targeting the current month. */
  requested: number;
  /** Of those, responses already received. */
  submitted: number;
  /** Of those, still awaiting a response. */
  pending: number;
  /** A response arrived after the current-month check-in was compiled. */
  newSinceCheckIn: boolean;
};

export const EMPTY_CURRENT_MONTH_FEEDBACK: CurrentMonthFeedback = {
  requested: 0,
  submitted: 0,
  pending: 0,
  newSinceCheckIn: false,
};

export type PerformanceSignal = {
  label: string;
  tone: "danger" | "warning" | "info" | "success" | "brand" | "neutral";
};

/**
 * The per-member facts the signal chips and filters consume. The loader
 * derives this from a `PeopleDashboardRow` plus feedback-request counts.
 */
export type PerformanceRowFacts = {
  /** Concrete workload warning ("2 overdue actions"), or null. */
  workloadWarning: string | null;
  /** True when any active action the member carries is overdue. */
  hasOverdueAction: boolean;
  trend: "Improving" | "Declining" | "Stable" | "Insufficient Data";
  /** Latest quarterly review flagged them as a succession candidate. */
  successor: boolean;
  /** No compiled check-in for the current month. */
  needsCheckIn: boolean;
  /** No quarterly review for the current quarter. */
  reviewDue: boolean;
  /** A quarterly review exists, but for an older quarter than the current one. */
  hasAnyReview: boolean;
  feedback: MemberFeedbackStatus;
  /** The current month's feedback workflow position. */
  monthFeedback: CurrentMonthFeedback;
  /** Active (incomplete) work items the member carries. */
  activeActionCount: number;
  /** Of those, how many are overdue. */
  overdueActionCount: number;
  /** "2026-06" — the current month, for the needs-feedback comparison. */
  currentMonthKey: string;
  // ── Mentorship & growth — the People-memory dimensions ──
  /** An active mentorship pairing names a mentor for this person. */
  hasMentor: boolean;
  /** This person's role is one the mentorship program assigns a mentor to. */
  mentorEligible: boolean;
  /** Mentor-eligible but no active mentor on file — a development gap. */
  needsMentor: boolean;
  /** Carries a "Ready for more" / "Potential team lead" growth signal. */
  growthOpportunity: boolean;
  /** Carries the "At risk of disengaging" watch signal. */
  disengagementRisk: boolean;
};

/**
 * The Signals column: workload, trend, succession, and feedback state only —
 * check-in and review gaps render inside their own columns, so they are not
 * duplicated here. Every label carries its reason.
 */
export function buildSignals(facts: PerformanceRowFacts): PerformanceSignal[] {
  const signals: PerformanceSignal[] = [];
  if (facts.disengagementRisk) {
    signals.push({ label: "At risk of disengaging", tone: "danger" });
  }
  if (facts.workloadWarning) {
    signals.push({
      label: facts.workloadWarning,
      tone: facts.hasOverdueAction ? "danger" : "warning",
    });
  }
  if (facts.trend === "Declining") {
    signals.push({ label: "Check-ins declining", tone: "danger" });
  } else if (facts.trend === "Improving") {
    signals.push({ label: "Check-ins improving", tone: "success" });
  }
  if (facts.successor) {
    signals.push({ label: "Succession candidate", tone: "brand" });
  }
  if (facts.growthOpportunity) {
    signals.push({ label: "Ready for more", tone: "success" });
  }
  if (facts.needsMentor) {
    signals.push({ label: "No mentor assigned", tone: "warning" });
  }
  if (facts.feedback.outstanding > 0) {
    signals.push({
      label: `${facts.feedback.outstanding} feedback ${
        facts.feedback.outstanding === 1 ? "reply" : "replies"
      } pending`,
      tone: "info",
    });
  } else if (facts.feedback.lastRequestedMonthKey !== facts.currentMonthKey) {
    signals.push({ label: "No feedback requested this month", tone: "neutral" });
  }
  return signals;
}

// ── Filters and stats ────────────────────────────────────────────────────────

export const PERFORMANCE_FILTERS = [
  "needs-attention",
  "all",
  "needs-checkin",
  "feedback-pending",
  "reviews-due",
  "workload",
  "succession",
  "no-mentor",
  "growth",
] as const;
export type PerformanceFilter = (typeof PERFORMANCE_FILTERS)[number];

/** Filters shown on the simplified performance page. */
export const PERFORMANCE_SIMPLE_FILTERS = [
  "needs-attention",
  "needs-checkin",
  "reviews-due",
  "all",
] as const satisfies readonly PerformanceFilter[];

export const PERFORMANCE_FILTER_LABELS: Record<PerformanceFilter, string> = {
  "needs-attention": "Needs attention",
  all: "All team",
  "needs-checkin": "Needs check-in",
  "feedback-pending": "Feedback pending",
  "reviews-due": "Reviews due",
  workload: "Workload flagged",
  succession: "Succession",
  "no-mentor": "No mentor",
  growth: "Ready for more",
};

export function memberNeedsAttention(facts: PerformanceRowFacts): boolean {
  return (
    facts.needsCheckIn ||
    facts.reviewDue ||
    facts.hasOverdueAction ||
    facts.feedback.outstanding > 0 ||
    facts.needsMentor ||
    facts.disengagementRisk
  );
}

export function asPerformanceFilter(value: string | undefined): PerformanceFilter {
  return value && (PERFORMANCE_FILTERS as readonly string[]).includes(value)
    ? (value as PerformanceFilter)
    : "needs-attention";
}

export function factsMatchFilter(facts: PerformanceRowFacts, filter: PerformanceFilter): boolean {
  switch (filter) {
    case "needs-attention":
      return memberNeedsAttention(facts);
    case "needs-checkin":
      return facts.needsCheckIn;
    case "feedback-pending":
      return facts.feedback.outstanding > 0;
    case "reviews-due":
      return facts.reviewDue;
    case "workload":
      return facts.workloadWarning !== null;
    case "succession":
      return facts.successor;
    case "no-mentor":
      return facts.needsMentor;
    case "growth":
      return facts.growthOpportunity;
    case "all":
    default:
      return true;
  }
}

/** Count rows matching a filter — powers the filter chips' live counts. */
export function countMatchingFilter(
  rows: Array<{ facts: PerformanceRowFacts }>,
  filter: PerformanceFilter
): number {
  return rows.reduce((n, r) => (factsMatchFilter(r.facts, filter) ? n + 1 : n), 0);
}

export type PerformanceStats = {
  needsAttention: number;
  needsCheckIn: number;
  feedbackPending: number;
  reviewsDue: number;
  workloadFlagged: number;
  succession: number;
};

export function computePerformanceStats(rows: Array<{ facts: PerformanceRowFacts }>): PerformanceStats {
  const stats: PerformanceStats = {
    needsAttention: 0,
    needsCheckIn: 0,
    feedbackPending: 0,
    reviewsDue: 0,
    workloadFlagged: 0,
    succession: 0,
  };
  for (const { facts } of rows) {
    if (memberNeedsAttention(facts)) stats.needsAttention++;
    if (facts.needsCheckIn) stats.needsCheckIn++;
    if (facts.feedback.outstanding > 0) stats.feedbackPending++;
    if (facts.reviewDue) stats.reviewsDue++;
    if (facts.workloadWarning !== null) stats.workloadFlagged++;
    if (facts.successor) stats.succession++;
  }
  return stats;
}

// ── Plain-English cell status (table + drawer share this language) ───────────

export type CellStatus = { text: string; tone: PerformanceSignal["tone"] };

function plural(n: number, one: string, many = `${one}s`): string {
  return n === 1 ? one : many;
}

/** "3 in, 2 waiting" · "No request this month" · "Ready to review". */
export function feedbackCellStatus(facts: PerformanceRowFacts): CellStatus {
  const f = facts.monthFeedback;
  if (f.requested === 0) {
    return { text: "No request this month", tone: "neutral" };
  }
  const readyToReview = f.submitted > 0 && (facts.needsCheckIn || f.newSinceCheckIn);
  if (readyToReview) {
    if (f.newSinceCheckIn && !facts.needsCheckIn) {
      return { text: "New feedback since check-in", tone: "info" };
    }
    return {
      text: f.pending > 0 ? `${f.submitted} in, ${f.pending} waiting` : "Ready to review",
      tone: "info",
    };
  }
  if (f.submitted === 0 && f.pending > 0) {
    return { text: `Waiting on ${f.pending}`, tone: "warning" };
  }
  if (f.submitted > 0) {
    return { text: `${f.submitted} ${plural(f.submitted, "response")} in`, tone: "success" };
  }
  return { text: "No responses yet", tone: "neutral" };
}

/** "May compiled" · "Missing May" · "Ready to compile". `monthLabel` is short ("May"). */
export function checkInCellStatus(
  facts: PerformanceRowFacts,
  monthLabel: string
): CellStatus {
  if (facts.needsCheckIn) {
    if (facts.monthFeedback.submitted > 0) {
      return { text: "Ready to compile", tone: "info" };
    }
    return { text: `Missing ${monthLabel}`, tone: "warning" };
  }
  if (facts.monthFeedback.newSinceCheckIn) {
    return { text: "New feedback since", tone: "info" };
  }
  return { text: `${monthLabel} compiled`, tone: "success" };
}

/** "4 active, 1 overdue" · "No active items". */
export function workloadCellStatus(facts: PerformanceRowFacts): CellStatus {
  const { activeActionCount: active, overdueActionCount: overdue } = facts;
  if (active === 0) {
    return { text: "No active items", tone: "neutral" };
  }
  if (overdue > 0) {
    return { text: `${active} active, ${overdue} overdue`, tone: "danger" };
  }
  return { text: `${active} active`, tone: "neutral" };
}

/** "Review overdue" · "Review due" · "Monthly current" — quarterly reviews table. */
export function quarterlyReviewTableStatus(facts: PerformanceRowFacts): CellStatus {
  if (!facts.reviewDue) return { text: "Monthly current", tone: "success" };
  if (facts.hasAnyReview) return { text: "Review overdue", tone: "danger" };
  return { text: "Review due", tone: "warning" };
}

/** Sort quarterly roster: overdue first, then due, then current. */
export function sortQuarterlyReviewRows<
  T extends { name: string; email: string; facts: PerformanceRowFacts },
>(rows: T[]): T[] {
  const rank = (facts: PerformanceRowFacts) => {
    if (facts.reviewDue && facts.hasAnyReview) return 0;
    if (facts.reviewDue) return 1;
    return 2;
  };
  return [...rows].sort((a, b) => {
    const diff = rank(a.facts) - rank(b.facts);
    if (diff !== 0) return diff;
    return (a.name || a.email).localeCompare(b.name || b.email, undefined, {
      sensitivity: "base",
    });
  });
}

/** "Complete" · "Missing" · "Not due". `enabled` reflects ENABLE_QUARTERLY_REVIEWS. */
export function quarterlyCellStatus(
  facts: PerformanceRowFacts,
  enabled = true
): CellStatus {
  if (!enabled) return { text: "Not due", tone: "neutral" };
  if (!facts.reviewDue) return { text: "Complete", tone: "success" };
  return { text: "Missing", tone: "warning" };
}

// ── Next action: one concrete step per person ────────────────────────────────

export type NextActionKind =
  | "support-checkin"
  | "review-feedback"
  | "compile-check-in"
  | "request-feedback"
  | "await-feedback"
  | "open-review"
  | "assign-mentor"
  | "view-overdue"
  | "recognize-growth"
  | "view-details";

export type NextAction = {
  kind: NextActionKind;
  /** Button label, e.g. "Review feedback". */
  actionLabel: string;
  /** Concrete reason with its real number, e.g. "3 responses ready to review". */
  reason: string;
};

/** Lower = more urgent. Drives the "Needs action" list ordering. */
export const NEXT_ACTION_RANK: Record<NextActionKind, number> = {
  "support-checkin": 0,
  "review-feedback": 1,
  "compile-check-in": 2,
  "request-feedback": 3,
  "await-feedback": 4,
  "open-review": 5,
  "assign-mentor": 6,
  "view-overdue": 7,
  "recognize-growth": 8,
  "view-details": 9,
};

/**
 * Decide the single best next step for a member from concrete workflow facts —
 * never a score. The order mirrors the request → respond → review → compile →
 * review loop: act on feedback that is in, then close the month's check-in,
 * then chase what is still missing.
 */
export function deriveNextAction(
  facts: PerformanceRowFacts,
  ctx: { monthLabel: string; quarter: string }
): NextAction {
  const f = facts.monthFeedback;

  // 0. A human flagged them as pulling back — a supportive check-in comes first.
  if (facts.disengagementRisk) {
    return {
      kind: "support-checkin",
      actionLabel: "Schedule check-in",
      reason: "Flagged at risk of disengaging",
    };
  }

  // 1. New feedback responses ready to review.
  if (f.submitted > 0 && (facts.needsCheckIn || f.newSinceCheckIn)) {
    const reason =
      f.newSinceCheckIn && !facts.needsCheckIn
        ? `${f.submitted} new ${plural(f.submitted, "response")} since check-in`
        : `${f.submitted} ${plural(f.submitted, "response")} ready to review`;
    return { kind: "review-feedback", actionLabel: "Review feedback", reason };
  }

  // 2 + 3. Check-in for the current month is not compiled yet.
  if (facts.needsCheckIn) {
    return {
      kind: "compile-check-in",
      actionLabel: "Compile check-in",
      reason: `${ctx.monthLabel} check-in not compiled`,
    };
  }

  // 4. No feedback request was sent this month.
  if (f.requested === 0) {
    return {
      kind: "request-feedback",
      actionLabel: "Request feedback",
      reason: "No feedback request sent this month",
    };
  }

  // 5. Waiting on outstanding responses.
  if (f.pending > 0) {
    return {
      kind: "await-feedback",
      actionLabel: "View feedback",
      reason: `Waiting on ${f.pending} ${plural(f.pending, "response")}`,
    };
  }

  // 6. Quarterly review missing for the current quarter.
  if (facts.reviewDue) {
    return {
      kind: "open-review",
      actionLabel: "Open quarterly review",
      reason: `No ${ctx.quarter} review`,
    };
  }

  // 7. Mentor-eligible but unpaired — close the structural development gap.
  if (facts.needsMentor) {
    return {
      kind: "assign-mentor",
      actionLabel: "Assign mentor",
      reason: "No mentor assigned",
    };
  }

  // 8. Overdue work items.
  if (facts.overdueActionCount > 0) {
    return {
      kind: "view-overdue",
      actionLabel: "View overdue work",
      reason:
        facts.workloadWarning ??
        `${facts.overdueActionCount} overdue ${plural(facts.overdueActionCount, "item")}`,
    };
  }

  // 9. Ready for more — recognize and advance when nothing else is pressing.
  if (facts.growthOpportunity) {
    return {
      kind: "recognize-growth",
      actionLabel: "Recognize & advance",
      reason: "Ready for more responsibility",
    };
  }

  // 10. Nothing pressing.
  return { kind: "view-details", actionLabel: "View details", reason: "Up to date" };
}

// ── "This month" snapshot strip + "Needs action" list ────────────────────────

export type MonthSnapshot = {
  feedbackRequested: number;
  feedbackReceived: number;
  feedbackToReview: number;
  checkInsCompleted: number;
  checkInsMissing: number;
  reviewsToAttend: number;
};

export function buildMonthSnapshot(
  rows: Array<{ facts: PerformanceRowFacts }>
): MonthSnapshot {
  const snap: MonthSnapshot = {
    feedbackRequested: 0,
    feedbackReceived: 0,
    feedbackToReview: 0,
    checkInsCompleted: 0,
    checkInsMissing: 0,
    reviewsToAttend: 0,
  };
  for (const { facts } of rows) {
    const f = facts.monthFeedback;
    snap.feedbackRequested += f.requested;
    snap.feedbackReceived += f.submitted;
    if (f.submitted > 0 && (facts.needsCheckIn || f.newSinceCheckIn)) {
      snap.feedbackToReview++;
    }
    if (facts.needsCheckIn) snap.checkInsMissing++;
    else snap.checkInsCompleted++;
    if (facts.reviewDue) snap.reviewsToAttend++;
  }
  return snap;
}

export type NeedsActionItem = {
  id: string;
  name: string;
  action: NextAction;
};

/**
 * The short triage list at the top of the page — the most urgent concrete
 * actions, capped. Members whose next step is "view-details" (nothing pressing)
 * never appear here: this is a to-do list, not a roster.
 */
export function buildNeedsActionList<
  T extends { id: string; name: string; email: string; facts: PerformanceRowFacts },
>(
  rows: T[],
  ctx: { monthLabel: string; quarter: string },
  limit = 8
): NeedsActionItem[] {
  return rows
    .map((row) => ({
      id: row.id,
      name: row.name || row.email,
      action: deriveNextAction(row.facts, ctx),
    }))
    .filter((item) => item.action.kind !== "view-details")
    .sort((a, b) => NEXT_ACTION_RANK[a.action.kind] - NEXT_ACTION_RANK[b.action.kind])
    .slice(0, limit);
}

// ── Feedback-aware compile result language ───────────────────────────────────

/**
 * Plain-English sentence describing what a compile did, from aggregate counts
 * only — no collaborator names, no response bodies. Shared by the compile
 * action's caller so the wording is consistent.
 */
export function describeCompileResult(
  monthLabel: string,
  args: { feedbackResponses: number; isRecompile: boolean; newResponses: number }
): string {
  const verb = args.isRecompile ? "Recompiled" : "Compiled";
  if (args.feedbackResponses === 0) {
    return `${verb} ${monthLabel} check-in. No collaborator feedback was available yet.`;
  }
  if (args.isRecompile && args.newResponses > 0) {
    return `Recompiled ${monthLabel} check-in with ${args.newResponses} new ${plural(
      args.newResponses,
      "response"
    )}.`;
  }
  return `${verb} ${monthLabel} check-in using ${args.feedbackResponses} feedback ${plural(
    args.feedbackResponses,
    "response"
  )}.`;
}

// ── People & Reviews list presentation (handoff reference) ───────────────────

/** Leadership tier label for the handoff "Chair" meta line. */
export function peopleChairTier(role: string | null | undefined): string {
  if (!role) return "Leadership";
  if (role === "STUDENT" || role === "APPLICANT") return "Students";
  if (role === "INSTRUCTOR" || role === "CHAPTER_PRESIDENT" || role === "MENTOR") {
    return "Instructors";
  }
  if (role === "ADMIN" || role === "OFFICER" || role === "HIRING_CHAIR") {
    return "Officers";
  }
  return "Leadership";
}

/** Next check-in label + urgency for the list row header. */
export function nextCheckInDisplay(
  facts: PerformanceRowFacts,
  monthShortLabel: string,
  seed = 0
): { label: string; urgent: boolean } {
  const day = 18 + (Math.abs(seed) % 12);
  const label = `${monthShortLabel} ${day}`;
  if (facts.needsCheckIn) {
    return { label, urgent: true };
  }
  if (facts.monthFeedback.newSinceCheckIn) {
    return { label: "Recompile", urgent: true };
  }
  return { label, urgent: false };
}

/** Mockup-friendly feedback column copy ("2 of 4 received", "Requested", "Complete"). */
export function feedbackStatusLabel(facts: PerformanceRowFacts): string {
  const f = facts.monthFeedback;
  if (f.requested === 0) return "No request";
  if (f.submitted === 0) return "Requested";
  if (f.pending > 0) return `${f.submitted} of ${f.requested} received`;
  return "Complete";
}

/** Leadership activity summary line for the People & Reviews table. */
export function leadershipActivitySummary(row: {
  leadActions: unknown[];
  executingActions: unknown[];
  calendarDots: CheckInCalendarDot[];
}): { summary: string; missedMeetings: number } {
  const lead = row.leadActions.length;
  const exec = row.executingActions.length;
  const missedMeetings = countMissedCheckIns(row.calendarDots);
  return {
    summary: `${lead} leading · ${exec} executing`,
    missedMeetings,
  };
}

/** Flag text when someone needs leadership attention (handoff ⚑ badges). */
export function derivePeopleFlagText(facts: PerformanceRowFacts): string | null {
  if (facts.disengagementRisk) return "At risk of disengaging";
  if (facts.reviewDue && facts.hasAnyReview) return "Review overdue";
  const f = facts.monthFeedback;
  if (f.requested > 0 && f.submitted === 0) return "No response";
  if (facts.overdueActionCount >= 2) {
    return `${facts.overdueActionCount} overdue items`;
  }
  return null;
}

export function countMissedCheckIns(dots: CheckInCalendarDot[]): number {
  return dots.filter((d) => d.state === "missing").length;
}

const MAX_QUICK_BULLETS = 3;

/** Short delivery bullets when no quarterly Performance rating is on file. */
export function performanceQuickBullets(
  row: {
    facts: PerformanceRowFacts;
    recentCheckIns: Array<{ rating: GoalRatingColor | null }>;
  },
  monthLabel: string
): string[] {
  const bullets: string[] = [];
  const { facts } = row;

  const latestRating = row.recentCheckIns.find((c) => c.rating)?.rating ?? null;
  if (latestRating) {
    bullets.push(`Last check-in · ${RATING_LABELS[latestRating]}`);
  }

  if (facts.needsCheckIn) {
    bullets.push(`${monthLabel} check-in missing`);
  } else if (facts.monthFeedback.newSinceCheckIn) {
    bullets.push("New feedback to compile");
  }

  const workload = workloadCellStatus(facts);
  if (workload.text !== "No active items") {
    bullets.push(workload.text);
  }

  if (facts.trend === "Declining") {
    bullets.push("Check-ins declining");
  } else if (facts.trend === "Improving") {
    bullets.push("Check-ins improving");
  }

  if (facts.reviewDue) {
    bullets.push("Quarterly review due");
  }

  if (bullets.length === 0) {
    bullets.push("Awaiting review");
  }

  return bullets.slice(0, MAX_QUICK_BULLETS);
}

/** Short growth bullets when no quarterly Potential rating is on file. */
export function potentialQuickBullets(row: {
  facts: PerformanceRowFacts;
  growthTags: GrowthTag[];
  successor: boolean;
}): string[] {
  const bullets: string[] = [];

  if (row.successor || row.facts.successor) {
    bullets.push("Succession candidate");
  }

  for (const tag of row.growthTags) {
    const label = GROWTH_TAG_META[tag].label;
    if (!bullets.includes(label)) bullets.push(label);
    if (bullets.length >= MAX_QUICK_BULLETS) break;
  }

  if (bullets.length < MAX_QUICK_BULLETS && row.facts.reviewDue) {
    bullets.push(row.facts.hasAnyReview ? "Review overdue" : "No review on file");
  }

  if (bullets.length === 0) {
    bullets.push("Awaiting quarterly review");
  }

  return bullets.slice(0, MAX_QUICK_BULLETS);
}

/** Plain-language label for a check-in calendar cell (table + drawer). */
export function checkInDotStatusLabel(dot: CheckInCalendarDot): string {
  if (dot.state === "missing") return "Not compiled";
  if (!dot.rating) return "Compiled";
  return RATING_LABELS[dot.rating];
}

export type CheckInDotTone = "danger" | "warning" | "success";

/** Text color tone for a check-in month row. */
export function checkInDotStatusTone(dot: CheckInCalendarDot): CheckInDotTone {
  if (dot.state === "missing") return "danger";
  if (!dot.rating) return "warning";
  if (dot.rating === "BEHIND_SCHEDULE") return "danger";
  if (dot.rating === "GETTING_STARTED") return "warning";
  return "success";
}

/** CSS background for a calendar dot (green / amber / red / neutral). */
export function calendarDotBackground(dot: CheckInCalendarDot): string {
  if (dot.state === "not_due") return "#e8e8f0";
  if (dot.state === "missing") return "#c0392b";
  if (dot.state === "completed" && !dot.rating) return "#e0a008";
  if (dot.rating) return RATING_COLORS[dot.rating].dot;
  return "#0e9f6e";
}

/** Sort roster by who needs a leadership step next (handoff default order). */
export function sortPerformanceRowsByUrgency<
  T extends { name: string; email: string; facts: PerformanceRowFacts },
>(rows: T[], ctx: { monthLabel: string; quarter: string }): T[] {
  return [...rows].sort((a, b) => {
    const rankA = NEXT_ACTION_RANK[deriveNextAction(a.facts, ctx).kind];
    const rankB = NEXT_ACTION_RANK[deriveNextAction(b.facts, ctx).kind];
    if (rankA !== rankB) return rankA - rankB;
    return (a.name || a.email).localeCompare(b.name || b.email, undefined, {
      sensitivity: "base",
    });
  });
}

// ── People & Reviews table filters (mockup dropdown row) ─────────────────────

export const PEOPLE_CHAIR_TIERS = [
  "Officers",
  "Instructors",
  "Students",
  "Leadership",
] as const;

export type PeopleChairTier = (typeof PEOPLE_CHAIR_TIERS)[number];

export type PeopleReviewsFeedbackFilter =
  | "requested"
  | "partial"
  | "complete"
  | "review";

export const PEOPLE_REVIEWS_FEEDBACK_FILTER_LABELS: Record<
  PeopleReviewsFeedbackFilter,
  string
> = {
  requested: "Requested",
  partial: "Partially received",
  complete: "Complete",
  review: "Ready to review",
};

/** Bucket a row's feedback state for the Feedback status filter. */
export function feedbackFilterBucket(
  facts: PerformanceRowFacts
): PeopleReviewsFeedbackFilter | null {
  const f = facts.monthFeedback;
  if (f.submitted > 0 && (facts.needsCheckIn || f.newSinceCheckIn)) return "review";
  if (f.requested === 0) return null;
  if (f.submitted === 0) return "requested";
  if (f.pending > 0) return "partial";
  return "complete";
}

export type PeopleReviewsTableFilters = {
  mentor?: string;
  chair?: PeopleChairTier;
  performance?: GoalRatingColor;
  potential?: GoalRatingColor;
  feedback?: PeopleReviewsFeedbackFilter;
};

export function rowMatchesPeopleReviewsFilters(
  row: {
    mentorName: string | null;
    role: string | null;
    quarterly: { performanceRating: GoalRatingColor; potentialRating: GoalRatingColor } | null;
    facts: PerformanceRowFacts;
  },
  filters: PeopleReviewsTableFilters
): boolean {
  if (filters.mentor) {
    const mentor = row.mentorName ?? "";
    if (mentor !== filters.mentor) return false;
  }
  if (filters.chair && peopleChairTier(row.role) !== filters.chair) return false;
  if (filters.performance) {
    if (row.quarterly?.performanceRating !== filters.performance) return false;
  }
  if (filters.potential) {
    if (row.quarterly?.potentialRating !== filters.potential) return false;
  }
  if (filters.feedback) {
    if (feedbackFilterBucket(row.facts) !== filters.feedback) return false;
  }
  return true;
}

export function collectPeopleReviewsFilterOptions(
  rows: Array<{
    mentorName: string | null;
    role: string | null;
    quarterly: { performanceRating: GoalRatingColor; potentialRating: GoalRatingColor } | null;
    facts: PerformanceRowFacts;
  }>
): {
  mentors: string[];
  chairs: PeopleChairTier[];
  performanceRatings: GoalRatingColor[];
  potentialRatings: GoalRatingColor[];
  feedbackStatuses: PeopleReviewsFeedbackFilter[];
} {
  const mentors = new Set<string>();
  const chairs = new Set<PeopleChairTier>();
  const performanceRatings = new Set<GoalRatingColor>();
  const potentialRatings = new Set<GoalRatingColor>();
  const feedbackStatuses = new Set<PeopleReviewsFeedbackFilter>();

  for (const row of rows) {
    if (row.mentorName) mentors.add(row.mentorName);
    chairs.add(peopleChairTier(row.role) as PeopleChairTier);
    if (row.quarterly) {
      performanceRatings.add(row.quarterly.performanceRating);
      potentialRatings.add(row.quarterly.potentialRating);
    }
    const bucket = feedbackFilterBucket(row.facts);
    if (bucket) feedbackStatuses.add(bucket);
  }

  return {
    mentors: [...mentors].sort((a, b) => a.localeCompare(b)),
    chairs: PEOPLE_CHAIR_TIERS.filter((tier) => chairs.has(tier)),
    performanceRatings: [...performanceRatings],
    potentialRatings: [...potentialRatings],
    feedbackStatuses: [...feedbackStatuses],
  };
}

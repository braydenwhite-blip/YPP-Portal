import type { GoalRatingColor } from "@prisma/client";

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

/**
 * The months a feedback request may target: the current month plus the two
 * before it (Leadership often prepares last month's check-in early the next
 * month). The same list drives the drawer's month picker and the server
 * action's validation.
 */
export function allowedFeedbackMonths(now: Date, count = 3): FeedbackMonthOption[] {
  const options: FeedbackMonthOption[] = [];
  for (let back = 0; back < count; back++) {
    const month = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - back, 1));
    options.push({ key: monthKeyUTC(month), label: monthLabelUTC(month) });
  }
  return options;
}

// ── Check-in dots over fixed calendar months ────────────────────────────────

export type CheckInDotState = "rated" | "completed" | "missing";

export type CheckInCalendarDot = {
  monthKey: string;
  /** "Jun 26" */
  monthLabel: string;
  state: CheckInDotState;
  /** Set only when state is "rated". */
  rating: GoalRatingColor | null;
};

/**
 * Dots for the last `count` calendar months ENDING with the current month,
 * oldest first. Unlike the legacy strip (which showed only the check-ins that
 * exist), a month with no compiled check-in renders an explicit "missing"
 * dot — absence is a state, not a blank.
 */
export function buildCheckInCalendarDots(
  checkIns: Array<{ monthKey: string; rating: GoalRatingColor | null }>,
  now: Date,
  count = 3
): CheckInCalendarDot[] {
  const byKey = new Map(checkIns.map((c) => [c.monthKey, c]));
  const dots: CheckInCalendarDot[] = [];
  for (let back = count - 1; back >= 0; back--) {
    const month = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - back, 1));
    const key = monthKeyUTC(month);
    const found = byKey.get(key);
    dots.push({
      monthKey: key,
      monthLabel: monthShortLabelUTC(month),
      state: found ? (found.rating ? "rated" : "completed") : "missing",
      rating: found?.rating ?? null,
    });
  }
  return dots;
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
};

/**
 * The Signals column: workload, trend, succession, and feedback state only —
 * check-in and review gaps render inside their own columns, so they are not
 * duplicated here. Every label carries its reason.
 */
export function buildSignals(facts: PerformanceRowFacts): PerformanceSignal[] {
  const signals: PerformanceSignal[] = [];
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
};

export function memberNeedsAttention(facts: PerformanceRowFacts): boolean {
  return (
    facts.needsCheckIn ||
    facts.reviewDue ||
    facts.hasOverdueAction ||
    facts.feedback.outstanding > 0
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
    case "all":
    default:
      return true;
  }
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
  | "review-feedback"
  | "compile-check-in"
  | "request-feedback"
  | "await-feedback"
  | "open-review"
  | "view-overdue"
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
  "review-feedback": 0,
  "compile-check-in": 1,
  "request-feedback": 2,
  "await-feedback": 3,
  "open-review": 4,
  "view-overdue": 5,
  "view-details": 6,
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

  // 7. Overdue work items.
  if (facts.overdueActionCount > 0) {
    return {
      kind: "view-overdue",
      actionLabel: "View overdue work",
      reason:
        facts.workloadWarning ??
        `${facts.overdueActionCount} overdue ${plural(facts.overdueActionCount, "item")}`,
    };
  }

  // 8. Nothing pressing.
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

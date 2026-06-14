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
  feedback: MemberFeedbackStatus;
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

/** Up to three plain-language status chips for the simplified table. */
export function buildAttentionLabels(
  facts: PerformanceRowFacts,
  currentMonthLabel: string,
  currentQuarter: string
): PerformanceSignal[] {
  const labels: PerformanceSignal[] = [];
  if (facts.needsCheckIn) {
    labels.push({ label: `No ${currentMonthLabel} check-in`, tone: "warning" });
  }
  if (facts.reviewDue) {
    labels.push({ label: `No ${currentQuarter} review`, tone: "warning" });
  }
  if (facts.workloadWarning) {
    labels.push({
      label: facts.workloadWarning,
      tone: facts.hasOverdueAction ? "danger" : "warning",
    });
  }
  if (facts.feedback.outstanding > 0) {
    labels.push({
      label: `${facts.feedback.outstanding} feedback pending`,
      tone: "info",
    });
  }
  if (labels.length === 0) {
    labels.push({ label: "On track", tone: "success" });
  }
  return labels.slice(0, 3);
}

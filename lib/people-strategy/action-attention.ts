import type { ActionItemWithRelations } from "./action-queries";
import { actionHasDeadline, actionHasOwner } from "./action-next-cta";
import { effectiveDeadline, isActionOverdue, needsViewerInput } from "./my-actions-selectors";
import { daysOverdue, lastActivityAt, STALE_ACTIVITY_DAYS } from "./command-center-selectors";

/**
 * People Strategy — the Action Tracker's own "Needs Attention" engine.
 *
 * The unified `needs-attention.ts` engine is intentionally minimal (one urgency
 * signal + missing-owner) because it spans people / meetings / classes too. The
 * Action Tracker surfaces need a RICHER, action-shaped read: a member opening
 * `/actions` must instantly see what is on fire today, and leadership must see
 * what is stuck, ownerless, escalated, or rotting in a closed meeting.
 *
 * This module turns already-loaded `ActionItemWithRelations[]` (no second DB
 * round-trip) into explainable, severity-ranked signals plus a leadership
 * data-quality sweep. It is PURE — `now` is injected — so it unit-tests
 * deterministically, and it REUSES the canonical primitives
 * ({@link isActionOverdue}, {@link daysOverdue}, {@link lastActivityAt},
 * {@link actionHasOwner}, {@link needsViewerInput}) rather than re-deriving
 * "overdue" / "owner" / "stale".
 */

const DAY_MS = 86_400_000;
const SETTLED = new Set(["COMPLETE", "DROPPED"]);

/** An open action becomes "due soon" within this many days of its deadline. */
export const ACTION_DUE_SOON_DAYS = 3;

export type ActionAttentionKind =
  | "overdue"
  | "blocked"
  | "escalated"
  | "missing_lead"
  | "missing_executor"
  | "missing_due_date"
  | "due_soon"
  | "waiting_input"
  | "stale"
  | "meeting_unresolved";

export type ActionAttentionSeverity = "critical" | "high" | "medium" | "low";

/** One explainable, linkable signal about a single action. */
export interface ActionAttentionSignal {
  actionId: string;
  title: string;
  kind: ActionAttentionKind;
  severity: ActionAttentionSeverity;
  /** Plain-language explanation, e.g. "Overdue by 3 days". */
  reason: string;
  /** The recommended next move, e.g. "Assign an accountable lead". */
  nextStep: string;
  ownerName: string | null;
  priority: ActionItemWithRelations["priority"];
  href: string;
  meetingId: string | null;
  meetingTitle: string | null;
}

const SEVERITY_RANK: Record<ActionAttentionSeverity, number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
};

const isOpen = (i: ActionItemWithRelations) => !SETTLED.has(i.status) && i.resolvedAt == null;

/** Lead's display name from the lead relation or a LEAD assignment, else null. */
function leadName(item: ActionItemWithRelations): string | null {
  if (item.lead) return item.lead.name ?? item.lead.email ?? null;
  const lead = item.assignments.find((a) => a.role === "LEAD");
  return lead ? lead.user.name ?? lead.user.email ?? null : null;
}

function hasLead(item: ActionItemWithRelations): boolean {
  return item.leadId != null || item.assignments.some((a) => a.role === "LEAD");
}

function hasExecutor(item: ActionItemWithRelations): boolean {
  return item.assignments.some((a) => a.role === "EXECUTING");
}

function hasInputAssignee(item: ActionItemWithRelations): boolean {
  return item.assignments.some((a) => a.role === "INPUT");
}

function daysSince(date: Date, now: Date): number {
  return Math.max(0, Math.floor((now.getTime() - date.getTime()) / DAY_MS));
}

function deltaDays(now: Date, target: Date): number {
  return Math.round((target.getTime() - now.getTime()) / DAY_MS);
}

function plural(n: number): string {
  const abs = Math.abs(n);
  return `${abs} day${abs === 1 ? "" : "s"}`;
}

function base(item: ActionItemWithRelations) {
  return {
    actionId: item.id,
    title: item.title,
    ownerName: leadName(item),
    priority: item.priority,
    href: `/actions/${item.id}`,
    meetingId: item.officerMeetingId ?? null,
    meetingTitle: item.officerMeeting?.title ?? null,
  };
}

/**
 * All attention signals for ONE open action. Emits at most one urgency signal
 * (overdue → blocked → due-soon) plus any structural signals (missing lead /
 * executor / due date, escalated, waiting on input, stale, meeting-unresolved).
 * Settled or resolved actions produce nothing.
 */
export function deriveActionSignals(
  item: ActionItemWithRelations,
  now: Date = new Date()
): ActionAttentionSignal[] {
  if (!isOpen(item)) return [];

  const out: ActionAttentionSignal[] = [];
  const b = base(item);

  const overdue = isActionOverdue(item, now);
  const blocked = item.status === "BLOCKED" || item.flaggedAt != null;
  const dueDelta = actionHasDeadline(item) ? deltaDays(now, effectiveDeadline(item)) : null;

  // --- one primary urgency signal -----------------------------------------
  if (overdue) {
    const d = daysOverdue(item, now);
    out.push({
      ...b,
      kind: "overdue",
      severity: "critical",
      reason: d > 0 ? `Overdue by ${plural(d)}` : "Marked overdue",
      nextStep: "Update the status or push the deadline",
    });
  } else if (blocked) {
    const note = (item.blockedReason ?? "").trim();
    out.push({
      ...b,
      kind: "blocked",
      severity: "high",
      reason: note ? `Blocked — ${note}` : "Blocked — work can't proceed",
      nextStep: "Clear or escalate the blocker",
    });
  } else if (dueDelta != null && dueDelta <= ACTION_DUE_SOON_DAYS) {
    out.push({
      ...b,
      kind: "due_soon",
      severity: "medium",
      reason: dueDelta <= 0 ? "Due today" : `Due in ${plural(dueDelta)}`,
      nextStep: "Confirm it's on track to finish",
    });
  }

  // --- structural signals (can co-exist with the urgency signal) ----------
  if (item.escalatedToLeadershipAt != null) {
    out.push({
      ...b,
      kind: "escalated",
      severity: "high",
      reason: item.boardRolledUpAt != null
        ? "Escalated and rolled up to the Board"
        : "Escalated to leadership for a decision",
      nextStep: "Review and resolve the escalation",
    });
  }

  if (!hasLead(item)) {
    out.push({
      ...b,
      kind: "missing_lead",
      severity: "high",
      reason: "No accountable lead assigned",
      nextStep: "Assign an accountable lead",
    });
  } else if (!hasExecutor(item)) {
    out.push({
      ...b,
      kind: "missing_executor",
      severity: "medium",
      reason: "No one assigned to execute it",
      nextStep: "Assign someone to execute it",
    });
  }

  if (!actionHasDeadline(item)) {
    out.push({
      ...b,
      kind: "missing_due_date",
      severity: "medium",
      reason: "No due date set",
      nextStep: "Set a due date to anchor it",
    });
  }

  if (hasInputAssignee(item)) {
    out.push({
      ...b,
      kind: "waiting_input",
      severity: "low",
      reason: "Waiting on someone's input",
      nextStep: "Nudge the reviewer or capture their input",
    });
  }

  // Stale only when nothing more urgent is already shouting.
  if (!overdue && !blocked && (dueDelta == null || dueDelta > ACTION_DUE_SOON_DAYS)) {
    const since = daysSince(lastActivityAt(item), now);
    if (since >= STALE_ACTIVITY_DAYS) {
      out.push({
        ...b,
        kind: "stale",
        severity: "low",
        reason: `No update in ${plural(since)}`,
        nextStep: "Post a status update",
      });
    }
  }

  return out;
}

/** Stable sort: most severe first, then highest priority, then most overdue. */
const PRIORITY_RANK: Record<string, number> = { URGENT: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };

export function sortActionSignals(signals: ActionAttentionSignal[]): ActionAttentionSignal[] {
  return [...signals].sort((a, b) => {
    const sev = SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity];
    if (sev !== 0) return sev;
    return (PRIORITY_RANK[a.priority] ?? 9) - (PRIORITY_RANK[b.priority] ?? 9);
  });
}

/** True when `userId` leads, executes, or owes input on the action. */
function viewerInvolved(item: ActionItemWithRelations, userId: string): boolean {
  if (item.leadId === userId) return true;
  return item.assignments.some((a) => a.user.id === userId);
}

/**
 * Personal action attention for one member: the signals on the actions they
 * lead, execute, or owe input on — exactly the "what do I need to handle?" feed.
 * `waiting_input` is kept (they may be the reviewer being chased).
 */
export function personalActionAttention(
  items: ActionItemWithRelations[],
  viewerId: string,
  now: Date = new Date()
): ActionAttentionSignal[] {
  const mine = items.filter((i) => viewerInvolved(i, viewerId) || needsViewerInput(i, viewerId));
  return sortActionSignals(mine.flatMap((i) => deriveActionSignals(i, now)));
}

/**
 * Leadership-wide action attention: every open action's signals. The caller
 * passes the already visibility-scoped list (officers see everything they may),
 * so no extra confidentiality filtering is needed here.
 */
export function leadershipActionAttention(
  items: ActionItemWithRelations[],
  now: Date = new Date()
): ActionAttentionSignal[] {
  return sortActionSignals(items.flatMap((i) => deriveActionSignals(i, now)));
}

export interface ActionAttentionSummary {
  total: number;
  bySeverity: Record<ActionAttentionSeverity, number>;
  byKind: Partial<Record<ActionAttentionKind, number>>;
}

/** Headline counts for a panel header / banner. */
export function summarizeActionAttention(
  signals: ActionAttentionSignal[]
): ActionAttentionSummary {
  const bySeverity: Record<ActionAttentionSeverity, number> = {
    critical: 0,
    high: 0,
    medium: 0,
    low: 0,
  };
  const byKind: Partial<Record<ActionAttentionKind, number>> = {};
  for (const s of signals) {
    bySeverity[s.severity] += 1;
    byKind[s.kind] = (byKind[s.kind] ?? 0) + 1;
  }
  return { total: signals.length, bySeverity, byKind };
}

// ---------------------------------------------------------------------------
// Leadership data-quality sweep
// ---------------------------------------------------------------------------

export type DataQualityIssueKind =
  | "no_lead"
  | "no_executor"
  | "no_due_date"
  | "stale_update"
  | "blocked_without_note"
  | "overdue_not_escalated"
  | "open_in_closed_meeting";

export interface DataQualityFlag {
  actionId: string;
  title: string;
  kind: DataQualityIssueKind;
  /** What's wrong, in plain language. */
  issue: string;
  /** How to fix it. */
  recommendedFix: string;
  ownerName: string | null;
  href: string;
}

/** How many days an overdue action may sit un-escalated before it's flagged. */
export const OVERDUE_ESCALATION_GRACE_DAYS = 7;

/**
 * Leadership / SUPER_ADMIN data-quality sweep over the open actions: surfaces
 * the hygiene problems that make a tracker untrustworthy — ownerless work,
 * missing deadlines, blockers with no explanation, overdue items nobody has
 * escalated, and actions still open under a meeting that has come and gone.
 * Each flag carries the fix and a direct link. Pure; `now` injected.
 */
export function actionDataQuality(
  items: ActionItemWithRelations[],
  now: Date = new Date()
): DataQualityFlag[] {
  const out: DataQualityFlag[] = [];

  for (const item of items) {
    if (!isOpen(item)) continue;
    const owner = leadName(item);
    const href = `/actions/${item.id}`;
    const b = { actionId: item.id, title: item.title, ownerName: owner, href };

    if (!hasLead(item)) {
      out.push({
        ...b,
        kind: "no_lead",
        issue: "No accountable lead",
        recommendedFix: "Assign a lead who owns the outcome",
      });
    }
    if (!hasExecutor(item)) {
      out.push({
        ...b,
        kind: "no_executor",
        issue: "No one assigned to execute it",
        recommendedFix: "Assign an executor",
      });
    }
    if (!actionHasDeadline(item)) {
      out.push({
        ...b,
        kind: "no_due_date",
        issue: "No due date",
        recommendedFix: "Set a due date so it can't drift",
      });
    }
    if (item.status === "BLOCKED" && !(item.blockedReason ?? "").trim()) {
      out.push({
        ...b,
        kind: "blocked_without_note",
        issue: "Blocked, but no blocker reason recorded",
        recommendedFix: "Record what is blocking it",
      });
    }
    if (
      isActionOverdue(item, now) &&
      daysOverdue(item, now) >= OVERDUE_ESCALATION_GRACE_DAYS &&
      item.escalatedToLeadershipAt == null
    ) {
      out.push({
        ...b,
        kind: "overdue_not_escalated",
        issue: `Overdue ${plural(daysOverdue(item, now))} with no escalation`,
        recommendedFix: "Escalate it or reset the plan",
      });
    }
    if (
      item.officerMeetingId != null &&
      item.officerMeeting?.date != null &&
      daysSince(item.officerMeeting.date, now) > STALE_ACTIVITY_DAYS
    ) {
      out.push({
        ...b,
        kind: "open_in_closed_meeting",
        issue: "Still open under a meeting that's long past",
        recommendedFix: "Close it out or move it to the next meeting",
      });
    }
  }

  return out;
}

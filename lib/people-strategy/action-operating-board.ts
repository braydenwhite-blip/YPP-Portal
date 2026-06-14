import { addDays, startOfDay, startOfOperatingWeek } from "@/lib/leadership-action-center/dates";

import type { ActionItemWithRelations } from "./action-queries";
import {
  buildWeeklyPulse,
  daysOverdue,
  lastActivityAt,
  STALE_ACTIVITY_DAYS,
} from "./command-center-selectors";
import { effectiveDeadline, isActionOverdue, sortByDeadline } from "./my-actions-selectors";
import { actionHasDeadline, actionHasOwner } from "./action-next-cta";

/**
 * People Strategy — the Action Tracker operating board.
 *
 * Turns a flat list of visible actions into the simple operating structure the
 * main page is built around: a compact factual strip and four sections —
 * Needs attention / My actions / Team actions / Recently completed. Pure: no
 * DB, no React, no session; `now` is injected so it unit-tests deterministically.
 *
 * It REUSES the canonical primitives ({@link buildWeeklyPulse},
 * {@link isActionOverdue}, {@link daysOverdue}, {@link lastActivityAt},
 * {@link actionHasOwner}) rather than re-deriving "overdue" / "owner" / "stale".
 */

const SETTLED = new Set(["COMPLETE", "DROPPED"]);
const isOpen = (i: ActionItemWithRelations) => !SETTLED.has(i.status);

/** Days an open action can sit without movement before it's "waiting too long". */
export const WAITING_TOO_LONG_DAYS = STALE_ACTIVITY_DAYS;
/** How far back a completion still counts as "recently completed". */
export const RECENTLY_COMPLETED_DAYS = 7;

// ---------------------------------------------------------------------------
// Compact factual strip
// ---------------------------------------------------------------------------

export type ActionPulseStatKey =
  | "overdue"
  | "dueThisWeek"
  | "blocked"
  | "unassigned"
  | "completedThisWeek";

export type ActionPulseStat = {
  key: ActionPulseStatKey;
  label: string;
  count: number;
  /** A `/actions` preset that narrows to this slice, when one exists. */
  href: string | null;
};

const PULSE_META: Record<ActionPulseStatKey, { label: string; href: string | null }> = {
  overdue: { label: "Overdue", href: "/actions/all?preset=overdue" },
  dueThisWeek: { label: "Due this week", href: "/actions/all?preset=due_soon" },
  blocked: { label: "Blocked", href: "/actions/all?preset=blocked" },
  unassigned: { label: "Unassigned", href: "/actions/all?preset=unassigned" },
  completedThisWeek: { label: "Completed this week", href: null },
};

/**
 * The compact factual strip at the top of the page: overdue, due this week,
 * blocked, unassigned, completed this week. No scores, no health meters — just
 * five honest counts, computed from the canonical {@link buildWeeklyPulse}.
 */
export function buildActionPulseStrip(
  items: ActionItemWithRelations[],
  now: Date = new Date()
): ActionPulseStat[] {
  const pulse = buildWeeklyPulse(items, now);
  const counts: Record<ActionPulseStatKey, number> = {
    overdue: pulse.overdue,
    dueThisWeek: pulse.dueThisWeek,
    blocked: pulse.blocked,
    unassigned: pulse.unowned,
    completedThisWeek: pulse.completedThisWeek,
  };
  return (Object.keys(PULSE_META) as ActionPulseStatKey[]).map((key) => ({
    key,
    label: PULSE_META[key].label,
    count: counts[key],
    href: PULSE_META[key].href,
  }));
}

// ---------------------------------------------------------------------------
// Needs attention
// ---------------------------------------------------------------------------

/** True when `userId` leads, executes, or owes input on the action. */
export function viewerIsInvolved(item: ActionItemWithRelations, userId: string): boolean {
  if (item.leadId === userId) return true;
  return item.assignments.some((a) => a.user.id === userId);
}

/** An open action has been waiting too long when nothing has moved in a fortnight. */
export function isWaitingTooLong(item: ActionItemWithRelations, now: Date): boolean {
  if (!isOpen(item)) return false;
  return lastActivityAt(item).getTime() < addDays(now, -WAITING_TOO_LONG_DAYS).getTime();
}

/** Overdue check that tolerates a missing deadline (a dateless row is never overdue). */
function safeOverdue(item: ActionItemWithRelations, now: Date): boolean {
  return actionHasDeadline(item) && isActionOverdue(item, now);
}

/** Why an action surfaced in "Needs attention" — drives the one-line reason. */
export function attentionReason(
  item: ActionItemWithRelations,
  now: Date
): string | null {
  if (!isOpen(item)) return null;
  if (safeOverdue(item, now)) {
    const d = daysOverdue(item, now);
    return `${d} day${d === 1 ? "" : "s"} overdue`;
  }
  if (item.status === "BLOCKED") {
    const reason = (item.blockedReason ?? "").trim();
    return reason ? `Blocked — ${reason}` : "Blocked";
  }
  if (!actionHasOwner(item)) return "No owner yet";
  if (!actionHasDeadline(item)) return "No deadline set";
  if (isWaitingTooLong(item, now)) return "Waiting too long";
  return null;
}

/**
 * Open actions that need a human decision: overdue, blocked, ownerless,
 * deadline-less, or sitting untouched too long. Sorted with the most pressing
 * first (overdue by days-overdue desc, then everything else by soonest deadline).
 */
export function selectNeedsAttention(
  items: ActionItemWithRelations[],
  now: Date = new Date()
): ActionItemWithRelations[] {
  const flagged = items.filter((i) => attentionReason(i, now) != null);
  const deadlineTime = (i: ActionItemWithRelations) =>
    actionHasDeadline(i) ? effectiveDeadline(i).getTime() : Number.POSITIVE_INFINITY;
  return flagged.sort((a, b) => {
    const aOver = safeOverdue(a, now);
    const bOver = safeOverdue(b, now);
    if (aOver !== bOver) return aOver ? -1 : 1;
    if (aOver && bOver) return daysOverdue(b, now) - daysOverdue(a, now);
    return deadlineTime(a) - deadlineTime(b);
  });
}

// ---------------------------------------------------------------------------
// The board
// ---------------------------------------------------------------------------

export type ActionOperatingBoard = {
  /** Open actions that need a decision now (a priority lens, may overlap mine/team). */
  needsAttention: ActionItemWithRelations[];
  /** Open actions the viewer leads, executes, or owes input on — by urgency. */
  mine: ActionItemWithRelations[];
  /** Open actions owned by others — the rest of the org's active work. */
  team: ActionItemWithRelations[];
  /** A short list of the last week's completions — not a giant archive. */
  recentlyCompleted: ActionItemWithRelations[];
};

/**
 * Build the four-section operating board for one viewer. `mine` and `team`
 * partition the OPEN work (involved vs not), `needsAttention` is a priority
 * lens over everything open, and `recentlyCompleted` is a deliberately small
 * trailing window so the page never becomes an archive.
 */
export function buildActionOperatingBoard(
  items: ActionItemWithRelations[],
  viewerId: string,
  now: Date = new Date()
): ActionOperatingBoard {
  const open = items.filter(isOpen);
  const mine = sortByDeadline(open.filter((i) => viewerIsInvolved(i, viewerId)));
  const team = sortByDeadline(open.filter((i) => !viewerIsInvolved(i, viewerId)));

  const recentCutoff = startOfDay(addDays(now, -RECENTLY_COMPLETED_DAYS)).getTime();
  const recentlyCompleted = items
    .filter((i) => i.status === "COMPLETE")
    .filter((i) => (i.completedAt ?? i.updatedAt).getTime() >= recentCutoff)
    .sort(
      (a, b) =>
        (b.completedAt ?? b.updatedAt).getTime() - (a.completedAt ?? a.updatedAt).getTime()
    );

  return {
    needsAttention: selectNeedsAttention(items, now),
    mine,
    team,
    recentlyCompleted,
  };
}

/** The Monday of the operating week the board's "completed this week" counts. */
export function boardWeekStart(now: Date = new Date()): Date {
  return startOfOperatingWeek(now);
}

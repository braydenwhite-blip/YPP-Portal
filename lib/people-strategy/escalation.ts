import type { ActionItemStatus } from "@prisma/client";

/**
 * People Strategy — CPO escalation rules (pure, no DB / no session).
 *
 * A flagged or OVERDUE action item that has gone unresolved for 48h+ is
 * escalated to the CPO. These predicates are shared by the daily escalation
 * cron (`action-cron.ts`, authoritative send + mark) and the CPO Escalation
 * Queue loader (`escalation-queue.ts`, what the /people view shows) so both
 * agree on exactly which items qualify, how old they are, and why.
 *
 * "Older than 48 hours" is measured from the OLDEST active trigger: an item's
 * flag timestamp and/or the moment its deadline passed (when status is
 * OVERDUE). The oldest trigger drives both eligibility and the displayed age.
 */

/** 48 hours in milliseconds — the escalation threshold. */
export const ESCALATION_THRESHOLD_MS = 48 * 60 * 60 * 1000;

/** Minimal item shape needed to evaluate escalation state. */
export type EscalationItem = {
  status: ActionItemStatus;
  flaggedAt: Date | null;
  deadlineStart: Date;
  deadlineEnd: Date | null;
  resolvedAt: Date | null;
};

export type EscalationReason = "Flagged" | "Overdue" | "Flagged & Overdue";

/** The deadline that drives "overdue": end date if present, else start. */
export function escalationDeadline(item: EscalationItem): Date {
  return item.deadlineEnd ?? item.deadlineStart;
}

/**
 * Active trigger start-times. A flagged item contributes its `flaggedAt`; an
 * OVERDUE item contributes the moment its deadline passed. Returns an empty
 * array when neither trigger is active.
 */
function activeTriggerTimes(item: EscalationItem): Date[] {
  const times: Date[] = [];
  if (item.flaggedAt) times.push(item.flaggedAt);
  if (item.status === "OVERDUE") times.push(escalationDeadline(item));
  return times;
}

/** The oldest active trigger time (escalation clock start), or null if none. */
export function escalationSince(item: EscalationItem): Date | null {
  const times = activeTriggerTimes(item);
  if (times.length === 0) return null;
  return new Date(Math.min(...times.map((t) => t.getTime())));
}

/** Whether this item is flagged, OVERDUE, or both (regardless of age). */
export function escalationReason(item: EscalationItem): EscalationReason | null {
  const flagged = item.flaggedAt != null;
  const overdue = item.status === "OVERDUE";
  if (flagged && overdue) return "Flagged & Overdue";
  if (overdue) return "Overdue";
  if (flagged) return "Flagged";
  return null;
}

/**
 * Eligible for CPO escalation: not yet resolved and the oldest active trigger
 * is at least 48h old.
 */
export function isEscalationEligible(item: EscalationItem, now: Date): boolean {
  if (item.resolvedAt) return false;
  const since = escalationSince(item);
  if (!since) return false;
  return now.getTime() - since.getTime() >= ESCALATION_THRESHOLD_MS;
}

/**
 * Board roll-up threshold: **7 days after the CPO escalation** (`escalatedToCpoAt`).
 *
 * No explicit product decision exists for when an unresolved CPO escalation
 * should reach the Board, so this is the documented default (per the task
 * "If no product decision exists, use 7 days after CPO escalation"). It is the
 * sole source of truth — change it here to retune the cadence.
 */
export const BOARD_ROLLUP_THRESHOLD_MS = 7 * 24 * 60 * 60 * 1000;

/** Minimal item shape needed to evaluate Board roll-up state. */
export type BoardRollupItem = {
  escalatedToCpoAt: Date | null;
  resolvedAt: Date | null;
  boardRolledUpAt: Date | null;
};

/**
 * Eligible for Board roll-up: CPO-escalated, still unresolved, not yet rolled
 * up, and at least 7 days past the CPO escalation.
 */
export function isBoardRollupEligible(item: BoardRollupItem, now: Date): boolean {
  if (item.resolvedAt) return false;
  if (item.boardRolledUpAt) return false;
  if (!item.escalatedToCpoAt) return false;
  return now.getTime() - item.escalatedToCpoAt.getTime() >= BOARD_ROLLUP_THRESHOLD_MS;
}

/** Human age of an escalation, e.g. "3 days" or "50 hours". */
export function formatEscalationAge(since: Date, now: Date): string {
  const ms = Math.max(0, now.getTime() - since.getTime());
  const days = Math.floor(ms / 86_400_000);
  if (days >= 1) return `${days} day${days === 1 ? "" : "s"}`;
  const hours = Math.floor(ms / 3_600_000);
  return `${hours} hour${hours === 1 ? "" : "s"}`;
}

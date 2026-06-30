// Pure date helpers for the Automation Brain. Deterministic (callers pass `now`)
// so every rule is unit-testable. We re-export the existing, battle-tested
// `businessDaysBetween` from the Chapter pipeline rather than forking it, keeping
// a single source of truth for the playbook's business-day cadence.

export { businessDaysBetween } from "@/lib/chapters/pipeline";

const DAY_MS = 24 * 60 * 60 * 1000;
const HOUR_MS = 60 * 60 * 1000;

/** Whole calendar days from `from` → `to` (negative when `to` precedes `from`). */
export function daysBetween(from: Date, to: Date): number {
  return Math.floor((to.getTime() - from.getTime()) / DAY_MS);
}

/** Whole hours elapsed from `from` → `to` (clamped at 0). */
export function hoursBetween(from: Date, to: Date): number {
  return Math.max(0, Math.floor((to.getTime() - from.getTime()) / HOUR_MS));
}

/** Calendar days until `date` (negative = in the past). null when no date. */
export function daysUntil(date: Date | null | undefined, now: Date): number | null {
  if (!date) return null;
  return Math.ceil((date.getTime() - now.getTime()) / DAY_MS);
}

/** A new Date `n` days after `base` (n may be negative). */
export function addDays(base: Date, n: number): Date {
  return new Date(base.getTime() + n * DAY_MS);
}

/** Serialize a Date to ISO, tolerating null/undefined. */
export function isoOrNull(date: Date | null | undefined): string | null {
  return date ? date.toISOString() : null;
}

/** Parse an ISO string (or Date) back to a Date, tolerating null. */
export function toDate(value: string | Date | null | undefined): Date | null {
  if (!value) return null;
  return value instanceof Date ? value : new Date(value);
}

/** "today", "in 3 days", "5 days ago" — humanized, deterministic. */
export function relativeDueLabel(due: Date | null, now: Date): string {
  if (!due) return "no due date";
  const days = daysUntil(due, now);
  if (days == null) return "no due date";
  if (days === 0) return "due today";
  if (days < 0) return `${Math.abs(days)} day${Math.abs(days) === 1 ? "" : "s"} overdue`;
  return `due in ${days} day${days === 1 ? "" : "s"}`;
}

/**
 * Whether a due date is in the past relative to `now`. A null due date is never
 * overdue (it has no deadline).
 */
export function isOverdue(due: Date | null, now: Date): boolean {
  return due != null && due.getTime() < now.getTime();
}

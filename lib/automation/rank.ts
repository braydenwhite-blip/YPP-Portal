// Pure urgency scoring + ordering for automation items. Severity is categorical;
// urgency is a 0–100 score that blends severity with how overdue / due-soon an
// item is, whether it escalates, and how much playbook pressure it carries. This
// is what lets the "today" surfaces show the single most pressing thing first.

import type { AutomationItem, AutomationSeverity } from "@/lib/automation/types";
import { SEVERITY_RANK } from "@/lib/automation/types";
import { daysUntil, daysBetween } from "@/lib/automation/date-helpers";

const SEVERITY_BASE: Record<AutomationSeverity, number> = {
  BLOCKING: 80,
  URGENT: 60,
  ATTENTION: 40,
  INFO: 20,
};

export type UrgencyInput = {
  severity: AutomationSeverity;
  dueAt: Date | null;
  now: Date;
  hasEscalation?: boolean;
  /** The playbook week this item belongs to (for "falling behind" pressure). */
  playbookWeekRelevance?: number | null;
  /** The chapter's current playbook week. */
  currentWeek?: number;
};

/** Compute a 0–100 urgency score. Deterministic (pass `now`). */
export function computeUrgency(input: UrgencyInput): number {
  let score = SEVERITY_BASE[input.severity];

  // Overdue work climbs fast (up to +20 over ~5 days).
  if (input.dueAt && input.dueAt.getTime() < input.now.getTime()) {
    const overdueDays = daysBetween(input.dueAt, input.now);
    score += Math.min(20, Math.max(4, overdueDays * 4));
  } else {
    // Due within 3 days adds a nudge.
    const d = daysUntil(input.dueAt, input.now);
    if (d != null && d >= 0 && d <= 3) score += 10 - d * 2;
  }

  if (input.hasEscalation) score += 10;

  // Playbook pressure: the further past its due week, the more it weighs.
  if (input.playbookWeekRelevance != null && input.currentWeek != null) {
    const behind = input.currentWeek - input.playbookWeekRelevance;
    if (behind > 0) score += Math.min(10, behind * 3);
  }

  return Math.max(0, Math.min(100, Math.round(score)));
}

/**
 * Canonical ordering: highest urgency first, then severity, then soonest due
 * date, then id (stable). Returns a new array.
 */
export function sortAutomationItems(items: AutomationItem[]): AutomationItem[] {
  return [...items].sort((a, b) => {
    if (b.urgency !== a.urgency) return b.urgency - a.urgency;
    const sev = SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity];
    if (sev !== 0) return sev;
    const ad = a.dueAt ? Date.parse(a.dueAt) : Number.POSITIVE_INFINITY;
    const bd = b.dueAt ? Date.parse(b.dueAt) : Number.POSITIVE_INFINITY;
    if (ad !== bd) return ad - bd;
    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
  });
}

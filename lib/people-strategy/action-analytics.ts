import type { ActionItemStatus } from "@prisma/client";

import type { ActionItemWithRelations } from "./action-queries";
import { effectiveStatus } from "./action-filters";

/**
 * People Strategy — Action Tracker analytics.
 *
 * Pure aggregations over an ALREADY-FILTERED set of items, so the status donut
 * and the per-department mini-bars always reflect exactly the rows currently
 * shown in the list (and exported to CSV). No global totals.
 */

export type ActionStatusBreakdown = {
  total: number;
  counts: Record<ActionItemStatus, number>;
};

/** Count items by their effective status (computed overdue overrides stored). */
export function summarizeStatuses(
  items: ActionItemWithRelations[],
  now: Date = new Date()
): ActionStatusBreakdown {
  const counts: Record<ActionItemStatus, number> = {
    NOT_STARTED: 0,
    IN_PROGRESS: 0,
    BLOCKED: 0,
    COMPLETE: 0,
    OVERDUE: 0,
    DROPPED: 0,
  };
  for (const item of items) {
    counts[effectiveStatus(item, now)] += 1;
  }
  return { total: items.length, counts };
}

export type DepartmentBar = {
  id: string;
  name: string;
  total: number;
  overdue: number;
};

/**
 * Per-department totals + overdue counts, sorted by total (desc) then name, for
 * the mini-bars. "Unassigned" collects any item missing a department.
 */
export function summarizeDepartments(
  items: ActionItemWithRelations[],
  now: Date = new Date()
): DepartmentBar[] {
  const byId = new Map<string, DepartmentBar>();
  for (const item of items) {
    const id = item.department?.id ?? item.departmentId ?? "unassigned";
    const name = item.department?.name ?? "Unassigned";
    let bar = byId.get(id);
    if (!bar) {
      bar = { id, name, total: 0, overdue: 0 };
      byId.set(id, bar);
    }
    bar.total += 1;
    if (effectiveStatus(item, now) === "OVERDUE") bar.overdue += 1;
  }
  return Array.from(byId.values()).sort(
    (a, b) => b.total - a.total || a.name.localeCompare(b.name)
  );
}

export type CompletionSummary = {
  total: number;
  completed: number;
  dropped: number;
  /** Open = not settled (not COMPLETE / DROPPED): not-started, in-progress, blocked, overdue. */
  open: number;
  overdue: number;
  blocked: number;
  /** Completed as a share of all non-dropped work (0–1). */
  completionRate: number;
  /** Overdue as a share of open work (0–1). */
  overdueRate: number;
};

/**
 * Headline completion metrics for the Action Completion Report. Pure over an
 * already-visibility-filtered set, using the same effective-status rule as the
 * rest of the tracker so the report agrees with the list, the donut, and the
 * CSV export. Dropped work is excluded from the completion-rate denominator
 * (it was deliberately abandoned, not "incomplete").
 */
export function summarizeCompletion(
  items: ActionItemWithRelations[],
  now: Date = new Date()
): CompletionSummary {
  let completed = 0;
  let dropped = 0;
  let open = 0;
  let overdue = 0;
  let blocked = 0;
  for (const item of items) {
    const status = effectiveStatus(item, now);
    if (status === "COMPLETE") {
      completed += 1;
    } else if (status === "DROPPED") {
      dropped += 1;
    } else {
      open += 1;
      if (status === "OVERDUE") overdue += 1;
      if (status === "BLOCKED") blocked += 1;
    }
  }
  const considered = items.length - dropped;
  return {
    total: items.length,
    completed,
    dropped,
    open,
    overdue,
    blocked,
    completionRate: considered > 0 ? completed / considered : 0,
    overdueRate: open > 0 ? overdue / open : 0,
  };
}

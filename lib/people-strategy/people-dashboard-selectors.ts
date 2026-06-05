import type { ActionItemStatus, GoalRatingColor } from "@prisma/client";

import { RATING_POINTS, RATING_LABELS } from "./check-in-rating";

/**
 * People Strategy — Leadership People Dashboard (`/people`) pure selectors.
 *
 * Everything here is pure (no Prisma runtime, no I/O, no clock unless passed
 * in) so the dashboard's row computations are deterministic and unit-testable.
 * The async loader in `people-dashboard.ts` reads the live Action Tracker,
 * Quarterly Review, and Monthly Check-In data and feeds these functions.
 *
 * No second source of truth is created: ratings reuse the live
 * `GoalRatingColor` enum (At Risk / Needs Attention / On Track / Above &
 * Beyond), exactly as `check-in-rating.ts` and `lib/matrix.ts` already do.
 */

/** Color key for the four `GoalRatingColor` levels (matches INTEGRATION_MAP). */
export const RATING_COLORS: Record<
  GoalRatingColor,
  { dot: string; bg: string; text: string; label: string }
> = {
  BEHIND_SCHEDULE: { dot: "#dc2626", bg: "#fef2f2", text: "#b91c1c", label: RATING_LABELS.BEHIND_SCHEDULE },
  GETTING_STARTED: { dot: "#f59e0b", bg: "#fffbeb", text: "#b45309", label: RATING_LABELS.GETTING_STARTED },
  ACHIEVED: { dot: "#16a34a", bg: "#ecfdf5", text: "#047857", label: RATING_LABELS.ACHIEVED },
  ABOVE_AND_BEYOND: { dot: "#7c3aed", bg: "#f5f3ff", text: "#6d28d9", label: RATING_LABELS.ABOVE_AND_BEYOND },
};

/** Neutral marker used when a check-in has no derived performance rating. */
export const NO_RATING_COLOR = { dot: "#cbd5e1", bg: "#f1f5f9", text: "#64748b", label: "No data" };

/** A trend word summarizing the last few monthly check-ins. */
export type TrendWord = "Improving" | "Declining" | "Stable" | "Insufficient Data";

/** Minimal action shape the dashboard needs (decoupled from the Prisma payload). */
export interface DashboardAction {
  id: string;
  title: string;
  status: ActionItemStatus;
  deadlineStart: Date;
  deadlineEnd: Date | null;
  departmentName: string | null;
}

/** Minimal monthly check-in shape (oldest-or-newest order does not matter). */
export interface DashboardCheckIn {
  month: Date;
  performanceRating: GoalRatingColor | null;
}

/** An action is active when it is not yet COMPLETE. */
export function isActiveAction(action: { status: ActionItemStatus }): boolean {
  return action.status !== "COMPLETE";
}

/** The day an action is due by: its end of the window, else its start. */
export function actionDeadline(action: DashboardAction): Date {
  return action.deadlineEnd ?? action.deadlineStart;
}

/** True when an active action is past due (explicit OVERDUE, or deadline passed). */
export function isActionOverdue(action: DashboardAction, now: Date = new Date()): boolean {
  if (action.status === "COMPLETE") return false;
  if (action.status === "OVERDUE") return true;
  return actionDeadline(action).getTime() < now.getTime();
}

/**
 * Split a person's active actions into the ones they LEAD and the ones they are
 * EXECUTING. The two lists are independent — a person can both lead and execute
 * the same item (it then appears in both), matching the assignment model.
 */
export function splitActiveActions(input: {
  led: DashboardAction[];
  executing: DashboardAction[];
}): { lead: DashboardAction[]; executing: DashboardAction[] } {
  return {
    lead: input.led.filter(isActiveAction).sort(sortByDeadline),
    executing: input.executing.filter(isActiveAction).sort(sortByDeadline),
  };
}

function sortByDeadline(a: DashboardAction, b: DashboardAction): number {
  return actionDeadline(a).getTime() - actionDeadline(b).getTime();
}

/**
 * Derive a simple trend word from a person's monthly check-ins. Compares the
 * earliest and latest *rated* check-ins by points:
 *   - fewer than 2 rated check-ins -> "Insufficient Data"
 *   - latest higher than earliest  -> "Improving"
 *   - latest lower than earliest   -> "Declining"
 *   - otherwise                    -> "Stable"
 *
 * `checkIns` may be in any order; it is sorted chronologically here.
 */
export function computeTrend(checkIns: DashboardCheckIn[]): TrendWord {
  const rated = checkIns
    .filter((c): c is DashboardCheckIn & { performanceRating: GoalRatingColor } =>
      c.performanceRating != null
    )
    .sort((a, b) => a.month.getTime() - b.month.getTime());

  if (rated.length < 2) return "Insufficient Data";

  const first = RATING_POINTS[rated[0].performanceRating];
  const last = RATING_POINTS[rated[rated.length - 1].performanceRating];

  if (last > first) return "Improving";
  if (last < first) return "Declining";
  return "Stable";
}

/**
 * The last `count` check-ins, most-recent first, for the colored-dot strip.
 * Returns up to `count` entries (fewer when the person has fewer check-ins).
 */
export function lastCheckIns(
  checkIns: DashboardCheckIn[],
  count = 3
): DashboardCheckIn[] {
  return [...checkIns]
    .sort((a, b) => b.month.getTime() - a.month.getTime())
    .slice(0, count);
}

/** Threshold above which a person's active workload is flagged as heavy. */
export const WORKLOAD_ACTIVE_THRESHOLD = 5;

/**
 * A reasonable workload warning. Flags a person when they carry a lot of active
 * work (lead + executing combined) or when any active item is overdue, so the
 * Leadership can spot over-loaded or slipping people at a glance. Returns null when
 * there is nothing to warn about.
 */
export function workloadWarning(
  split: { lead: DashboardAction[]; executing: DashboardAction[] },
  now: Date = new Date()
): string | null {
  const activeTotal = split.lead.length + split.executing.length;
  const overdue = [...split.lead, ...split.executing].filter((a) =>
    isActionOverdue(a, now)
  ).length;

  if (overdue > 0) {
    return `${overdue} overdue action${overdue === 1 ? "" : "s"}`;
  }
  if (activeTotal >= WORKLOAD_ACTIVE_THRESHOLD) {
    return `Heavy load · ${activeTotal} active actions`;
  }
  return null;
}

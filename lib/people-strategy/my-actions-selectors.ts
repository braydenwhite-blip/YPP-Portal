import { addDays, startOfDay } from "@/lib/leadership-action-center/dates";

import type { ActionItemWithRelations } from "./action-queries";

/**
 * People Strategy — "My Actions" view selectors.
 *
 * Pure functions over the `ActionItemWithRelations` rows returned by
 * `getMyActionItems`. They are shared by the full `/my-actions` page and the
 * compact dashboard queue card so both surfaces compute the same counts, and
 * they hold no DB or session access (easy to unit-test).
 *
 * "Deadline" for an action is its `deadlineEnd` when present (the day work is
 * due by), otherwise `deadlineStart`. An action is overdue when its status is
 * OVERDUE, or when that effective deadline has passed and it is not COMPLETE.
 */

type RoleOf = ActionItemWithRelations["assignments"][number]["role"];

/** The day an action is due by: its end of the window, else its start. */
export function effectiveDeadline(item: ActionItemWithRelations): Date {
  return item.deadlineEnd ?? item.deadlineStart;
}

/** True when `userId` holds `role` on the action (lead is tracked both ways). */
function viewerHasRole(
  item: ActionItemWithRelations,
  userId: string,
  role: RoleOf
): boolean {
  if (role === "LEAD" && item.leadId === userId) return true;
  return item.assignments.some((a) => a.user.id === userId && a.role === role);
}

/** True when the action is past due and still open (or explicitly OVERDUE). */
export function isActionOverdue(
  item: ActionItemWithRelations,
  now: Date = new Date()
): boolean {
  // Completed and dropped items are settled — never overdue.
  if (item.status === "COMPLETE" || item.status === "DROPPED") return false;
  if (item.status === "OVERDUE") return true;
  return effectiveDeadline(item).getTime() < startOfDay(now).getTime();
}

/** Sort a copy of `items` by effective deadline, soonest (and overdue) first. */
export function sortByDeadline(
  items: ActionItemWithRelations[]
): ActionItemWithRelations[] {
  return [...items].sort(
    (a, b) => effectiveDeadline(a).getTime() - effectiveDeadline(b).getTime()
  );
}

/** Actions the viewer is executing (EXECUTING role assignment). */
export function selectExecuting(
  items: ActionItemWithRelations[],
  userId: string
): ActionItemWithRelations[] {
  return sortByDeadline(items.filter((item) => viewerHasRole(item, userId, "EXECUTING")));
}

/** Open actions, soonest deadline first. Settled work never appears. */
export function selectUpcoming(
  items: ActionItemWithRelations[]
): ActionItemWithRelations[] {
  return sortByDeadline(
    items.filter((item) => item.status !== "COMPLETE" && item.status !== "DROPPED")
  );
}

export type UrgencyBuckets = {
  overdue: ActionItemWithRelations[];
  today: ActionItemWithRelations[];
  thisWeek: ActionItemWithRelations[];
  later: ActionItemWithRelations[];
};

/** Bucket render order + section copy for the "By Deadline" view. */
export const URGENCY_BUCKET_ORDER: Array<{
  key: keyof UrgencyBuckets;
  label: string;
}> = [
  { key: "overdue", label: "Overdue" },
  { key: "today", label: "Due today" },
  { key: "thisWeek", label: "Due this week" },
  { key: "later", label: "Later" },
];

/**
 * Group the viewer's OPEN actions by deadline urgency: past-due, due today, due
 * within the next 7 days, and everything further out. Settled (COMPLETE /
 * DROPPED) items are excluded, and each bucket is deadline-sorted (soonest
 * first). Pure — `now` is injected — so it unit-tests deterministically. Every
 * action carries a required deadline, so there is no "no due date" bucket here.
 */
export function bucketByUrgency(
  items: ActionItemWithRelations[],
  now: Date = new Date()
): UrgencyBuckets {
  const todayStart = startOfDay(now).getTime();
  const weekEnd = startOfDay(addDays(now, 7)).getTime();
  const buckets: UrgencyBuckets = { overdue: [], today: [], thisWeek: [], later: [] };

  for (const item of sortByDeadline(items)) {
    if (item.status === "COMPLETE" || item.status === "DROPPED") continue;
    if (isActionOverdue(item, now)) {
      buckets.overdue.push(item);
      continue;
    }
    const due = startOfDay(effectiveDeadline(item)).getTime();
    if (due <= todayStart) buckets.today.push(item);
    else if (due <= weekEnd) buckets.thisWeek.push(item);
    else buckets.later.push(item);
  }
  return buckets;
}

export type MyActionsSummary = {
  total: number;
  overdue: number;
  inProgress: number;
  executing: number;
  nextDeadline: Date | null;
};

/** Headline counts for the stat cards and the dashboard queue card. */
export function summarizeMyActions(
  items: ActionItemWithRelations[],
  userId: string,
  now: Date = new Date()
): MyActionsSummary {
  const upcoming = selectUpcoming(items);
  return {
    total: items.length,
    overdue: items.filter((item) => isActionOverdue(item, now)).length,
    inProgress: items.filter((item) => item.status === "IN_PROGRESS").length,
    executing: items.filter((item) => viewerHasRole(item, userId, "EXECUTING")).length,
    nextDeadline: upcoming.length > 0 ? effectiveDeadline(upcoming[0]) : null,
  };
}

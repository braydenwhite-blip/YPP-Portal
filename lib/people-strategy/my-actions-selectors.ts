import { startOfDay } from "@/lib/leadership-action-center/dates";

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

/**
 * Items awaiting the viewer's input. Primary signal is an INPUT assignment;
 * the latest INPUT_REQUESTED comment authored by someone else is surfaced as
 * the "ask". A comment alone also counts only when the viewer is neither the
 * lead nor an executor (so it never double-counts an item they already own).
 */
export function needsViewerInput(
  item: ActionItemWithRelations,
  userId: string
): boolean {
  if (viewerHasRole(item, userId, "INPUT")) return true;

  const ownsAction =
    viewerHasRole(item, userId, "LEAD") || viewerHasRole(item, userId, "EXECUTING");
  if (ownsAction) return false;

  return item.comments.some(
    (c) => c.type === "INPUT_REQUESTED" && c.author?.id !== userId
  );
}

/** Latest INPUT_REQUESTED comment from another user, for the "ask" prompt. */
export function latestInputRequest(
  item: ActionItemWithRelations,
  userId: string
): ActionItemWithRelations["comments"][number] | null {
  const requests = item.comments.filter(
    (c) => c.type === "INPUT_REQUESTED" && c.author?.id !== userId
  );
  return requests.length > 0 ? requests[requests.length - 1] : null;
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

/** Actions awaiting the viewer's input. */
export function selectNeedsInput(
  items: ActionItemWithRelations[],
  userId: string
): ActionItemWithRelations[] {
  return sortByDeadline(items.filter((item) => needsViewerInput(item, userId)));
}

/** Open (not COMPLETE) actions, soonest deadline first. */
export function selectUpcoming(
  items: ActionItemWithRelations[]
): ActionItemWithRelations[] {
  return sortByDeadline(items.filter((item) => item.status !== "COMPLETE"));
}

export type MyActionsSummary = {
  total: number;
  overdue: number;
  inProgress: number;
  executing: number;
  needsInput: number;
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
    needsInput: selectNeedsInput(items, userId).length,
    nextDeadline: upcoming.length > 0 ? effectiveDeadline(upcoming[0]) : null,
  };
}

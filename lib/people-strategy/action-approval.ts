import type { ActionItemWithRelations } from "./action-queries";

/** How long an approved action stays on the main hub before rolling off. */
export const APPROVED_HUB_GRACE_MS = 3 * 60 * 1000;

type ApprovalFields = {
  status: string;
  approvedAt: Date | null;
};

export function isWaitingForActionApproval(item: ApprovalFields): boolean {
  return item.status === "COMPLETE" && item.approvedAt == null;
}

export function isApprovedAction(item: ApprovalFields): boolean {
  return item.status === "COMPLETE" && item.approvedAt != null;
}

export function isRecentlyApprovedOnHub(item: ApprovalFields, now: Date = new Date()): boolean {
  if (!isApprovedAction(item) || !item.approvedAt) return false;
  return now.getTime() - item.approvedAt.getTime() < APPROVED_HUB_GRACE_MS;
}

/** Main hub: open work, waiting for approval, and briefly-visible approved items. */
export function showOnActiveHub(item: ApprovalFields, now: Date = new Date()): boolean {
  if (item.status === "DROPPED") return false;
  if (isWaitingForActionApproval(item)) return true;
  if (isRecentlyApprovedOnHub(item, now)) return true;
  if (isApprovedAction(item)) return false;
  return item.status !== "COMPLETE";
}

/** Approved archive tab — all officer-approved completions. */
export function showOnApprovedHub(item: ApprovalFields): boolean {
  return isApprovedAction(item);
}

export function filterActiveHubItems(
  items: ActionItemWithRelations[],
  now: Date = new Date()
): ActionItemWithRelations[] {
  return items.filter((item) => showOnActiveHub(item, now));
}

export function filterApprovedHubItems(items: ActionItemWithRelations[]): ActionItemWithRelations[] {
  return items.filter((item) => showOnApprovedHub(item));
}

export function msUntilHubRollOff(approvedAt: Date, now: Date = new Date()): number {
  return Math.max(0, APPROVED_HUB_GRACE_MS - (now.getTime() - approvedAt.getTime()));
}

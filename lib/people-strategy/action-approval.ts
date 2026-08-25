import {
  isOfficerTier,
  type ActionViewer,
} from "@/lib/people-strategy/action-permissions";
import type { ActionItemWithRelations } from "./action-queries";
import { actionItemDepartments } from "./action-item-departments";

type ApprovalShape = {
  status: string;
  approvedAt?: Date | string | null;
};

/** Work finished but waiting for an officer-tier sign-off. */
export function isPendingCompletionApproval(item: ApprovalShape): boolean {
  return item.status === "COMPLETE" && item.approvedAt == null;
}

/** Approved completions and dropped items — off the active hub. */
export function isArchivedAction(item: ApprovalShape): boolean {
  if (item.status === "DROPPED") return true;
  return item.status === "COMPLETE" && item.approvedAt != null;
}

/** Open work plus completion requests awaiting officer approval. */
export function showOnActiveHub(item: ApprovalShape): boolean {
  if (item.status === "DROPPED") return false;
  if (item.status === "COMPLETE" && item.approvedAt != null) return false;
  return true;
}

export function filterActiveHubItems(
  items: ActionItemWithRelations[],
): ActionItemWithRelations[] {
  return items.filter((item) => showOnActiveHub(item));
}

export function filterArchivedItems(
  items: ActionItemWithRelations[],
): ActionItemWithRelations[] {
  return items.filter((item) => isArchivedAction(item));
}

/** Officer-tier users may approve a submitted completion. */
export function canApproveActionCompletion(viewer: ActionViewer): boolean {
  return isOfficerTier(viewer);
}

export type PendingApprovalQueueItem = {
  id: string;
  title: string;
  leadName: string;
  department: string;
  chapter: string | null;
  submittedAt: string | null;
};

export function toPendingApprovalQueueItem(
  item: ActionItemWithRelations
): PendingApprovalQueueItem {
  const departments = actionItemDepartments(item);
  return {
    id: item.id,
    title: item.title,
    leadName: item.lead?.name?.trim() || item.lead?.email || "Unassigned",
    department: departments[0]?.name ?? "Unassigned",
    chapter: item.chapter?.name ?? null,
    submittedAt: item.completedAt ? item.completedAt.toISOString() : null,
  };
}

export function pendingApprovalQueue(
  items: ActionItemWithRelations[]
): PendingApprovalQueueItem[] {
  return items.filter(isPendingCompletionApproval).map(toPendingApprovalQueueItem);
}

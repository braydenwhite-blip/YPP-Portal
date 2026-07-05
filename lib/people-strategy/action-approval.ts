import {
  isOfficerTier,
  type ActionViewer,
} from "@/lib/people-strategy/action-permissions";
import type { ActionItemWithRelations } from "./action-queries";

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

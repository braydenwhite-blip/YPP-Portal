import type { ActionItemWithRelations } from "./action-queries";

/** Open actions on the hub — excludes completed and dropped items. */
export function showOnActiveHub(item: { status: string }): boolean {
  if (item.status === "DROPPED") return false;
  if (item.status === "COMPLETE") return false;
  return true;
}

export function filterActiveHubItems(
  items: ActionItemWithRelations[]
): ActionItemWithRelations[] {
  return items.filter((item) => showOnActiveHub(item));
}

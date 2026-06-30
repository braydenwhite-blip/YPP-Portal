// A titled list of automation items with an honest empty state. Read-only.

import { EmptyStateV2 } from "@/components/ui-v2";
import type { AutomationItem } from "@/lib/automation/types";
import { AutomationItemCard } from "./automation-item-card";

export function AutomationItemList({
  items,
  emptyTitle = "Nothing here right now",
  emptyBody = "When the portal detects work to do, it appears here.",
  compact = false,
  limit,
}: {
  items: AutomationItem[];
  emptyTitle?: string;
  emptyBody?: string;
  compact?: boolean;
  limit?: number;
}) {
  const shown = typeof limit === "number" ? items.slice(0, limit) : items;
  if (shown.length === 0) {
    return <EmptyStateV2 title={emptyTitle} body={emptyBody} />;
  }
  return (
    <div className="flex flex-col gap-2.5">
      {shown.map((item) => (
        <AutomationItemCard key={item.id} item={item} compact={compact} />
      ))}
      {typeof limit === "number" && items.length > limit && (
        <p className="m-0 text-[12.5px] text-ink-muted">+{items.length - limit} more</p>
      )}
    </div>
  );
}

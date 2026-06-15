import type { QueueItem } from "@/lib/queue/types";

import { QueueStrip } from "./queue-strip";

/**
 * InitiativeUnblockQueue — initiatives that have drifted into a concrete problem
 * (no owner, no next move, overdue linked work, or past target). Each is a loop
 * with a next move, not a static 0% progress bar.
 */
export function InitiativeUnblockQueue({ items }: { items: QueueItem[] }) {
  return (
    <QueueStrip
      title="Initiative cleanup"
      tagline="Initiatives drifting without an owner, a next move, or on-time work."
      items={items}
      queueKey="initiative-cleanup"
      accent="info"
      emptyText="Every tracked initiative has an owner and a next move."
    />
  );
}

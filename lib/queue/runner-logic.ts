import type { QueueItem } from "./types";

/**
 * Pure decision logic behind My Queue's one-at-a-time runner. Kept out of the
 * component so the invariants — skip never resolves, a loop leaves only when its
 * source record stops producing it — are deterministic and unit-tested.
 */

/** The loops still in play this session: source items minus locally skipped. */
export function visibleLoops(
  items: QueueItem[],
  skipped: ReadonlySet<string>
): QueueItem[] {
  return items.filter((item) => !skipped.has(item.id));
}

/** Index of the active loop within the visible list (0 when not found/unset). */
export function activeIndex(visible: QueueItem[], activeId: string | null): number {
  if (!activeId) return 0;
  const idx = visible.findIndex((item) => item.id === activeId);
  return idx === -1 ? 0 : idx;
}

/**
 * After a mutation + refresh, a loop is resolved ONLY when its underlying record
 * no longer produces a queue item. Partial progress (e.g. an action marked
 * blocked is still open work) leaves the item present, so it stays in the queue.
 */
export function loopResolved(freshItems: QueueItem[], actedId: string): boolean {
  return !freshItems.some((item) => item.id === actedId);
}

/** The id to focus after skipping the current loop (the next one, else done). */
export function nextIdAfterSkip(
  visible: QueueItem[],
  currentIndex: number
): string | null {
  return visible[currentIndex + 1]?.id ?? null;
}

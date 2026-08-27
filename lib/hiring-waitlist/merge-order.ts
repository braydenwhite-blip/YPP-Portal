/**
 * Merge live waitlist keys with a saved order.
 * - Saved keys that are still waitlisted keep their relative order.
 * - New waitlisted people append by waitlistedAt ascending (oldest = next).
 * - Keys no longer waitlisted drop out.
 */
export function mergeWaitlistOrder(
  savedOrder: string[],
  live: Array<{ key: string; waitlistedAt: string }>
): string[] {
  const liveKeys = new Set(live.map((e) => e.key));
  const kept = savedOrder.filter((k) => liveKeys.has(k));
  const keptSet = new Set(kept);
  const newcomers = live
    .filter((e) => !keptSet.has(e.key))
    .sort(
      (a, b) =>
        new Date(a.waitlistedAt).getTime() - new Date(b.waitlistedAt).getTime()
    )
    .map((e) => e.key);
  return [...kept, ...newcomers];
}

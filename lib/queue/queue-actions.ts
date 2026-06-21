"use server";

import { revalidatePath } from "next/cache";

/**
 * Queue action execution — the consistency half of the actionable queue.
 *
 * The queue itself owns NO mutations: every inline action calls an existing
 * domain server action (`captureActionCompletion`, `convertDecisionToAction`,
 * `setFollowUpStatus`, …) that already re-checks permission server-side. What
 * this module adds is cross-surface freshness: after one of those mutations the
 * runner calls `router.refresh()` to re-pull the current queue from source
 * truth, and this marks every OTHER surface that shows queue counts or previews
 * (Home, Mission Control, the named workspaces) stale so they recompute too.
 *
 * The queue is always derived from the underlying records — an item leaves only
 * when its source condition is gone — so revalidation, not hand-maintained
 * client state, is what keeps the whole portal in sync.
 */

const QUEUE_SURFACES = [
  "/",
  "/work",
  "/work/queue",
  "/actions",
  "/follow-up",
  "/decide",
  "/delegate",
  "/review",
  "/meetings",
] as const;

export async function revalidateQueueSurfaces(): Promise<void> {
  for (const path of QUEUE_SURFACES) {
    revalidatePath(path);
  }
}

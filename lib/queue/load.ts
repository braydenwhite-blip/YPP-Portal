import type { ActionViewer } from "@/lib/people-strategy/action-permissions";
import { loadWorkHub } from "@/lib/work/work-hub";

import { buildQueueEngine, type QueueEngine } from "./engine";
import { loadMentorshipQueueItems } from "./mentorship-load";

/**
 * Server entry point for the Queue Engine. One read (`loadWorkHub` — the same
 * unified pool the Command Center and Data 360 use), folded into the canonical
 * queue. Keep this out of client bundles; client code imports the pure modules
 * (`types`, `selectors`, `ranking`) from the barrel instead.
 */
export async function loadQueueEngine(
  viewer: ActionViewer,
  options: { now?: Date } = {}
): Promise<QueueEngine> {
  const now = options.now ?? new Date();
  const [data, mentorshipItems] = await Promise.all([
    loadWorkHub(viewer, { now }),
    loadMentorshipQueueItems(viewer, now),
  ]);
  return buildQueueEngine(data, now, { mentorshipItems });
}

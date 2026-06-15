import type { QueueEngine } from "@/lib/queue/engine";
import { ownerLanesFromItems } from "@/lib/queue/selectors";
import type { QueueItem, QueueSummary } from "@/lib/queue/types";

/** Fixed clock for deterministic Command Center adapter tests. */
export const NOW = new Date("2025-08-28T09:00:00.000Z");

/**
 * Assemble a QueueEngine from items for adapter tests. Summary counts are
 * derived from the items (so assertions stay meaningful); owner lanes use the
 * real selector. The adapters never read `engine.lanes` / `triageGroups`.
 */
export function makeEngine(
  items: QueueItem[],
  overrides: { summary?: Partial<QueueSummary>; ownerLanes?: QueueEngine["ownerLanes"] } = {}
): QueueEngine {
  const summary: QueueSummary = {
    openLoops: items.length,
    mine: items.filter((i) => i.signals.mine).length,
    overdue: items.filter((i) => i.signals.overdue).length,
    blocked: items.filter((i) => i.signals.blocking).length,
    unowned: items.filter((i) => i.signals.missingOwner).length,
    needsDecision: items.filter((i) => i.signals.needsDecision || i.type === "decision").length,
    quickWins: items.filter((i) => i.signals.quickWin).length,
    upcomingMeetings: 0,
    clearedThisWeek: 0,
    ...overrides.summary,
  };

  return {
    generatedAtISO: NOW.toISOString(),
    items,
    summary,
    lanes: {} as QueueEngine["lanes"],
    ownerLanes: overrides.ownerLanes ?? ownerLanesFromItems(items, NOW),
    triageGroups: [],
  };
}

/** ISO helper: a date `days` from NOW. */
export function isoFromNow(days: number): string {
  return new Date(NOW.getTime() + days * 24 * 60 * 60 * 1000).toISOString();
}

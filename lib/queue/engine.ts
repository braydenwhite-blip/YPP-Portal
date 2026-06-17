import {
  type AttentionCategory,
  groupAttentionItems,
} from "@/lib/operations/attention";
import type { WorkHubData } from "@/lib/work/work-hub";

import { queueItemFromAttentionItem } from "./from-attention";
import {
  queueItemFromDecision,
  queueItemFromInitiativeCard,
} from "./from-initiatives";
import { queueItemFromWorkHubRow } from "./from-work-hub";
import { rankQueueItems } from "./ranking";
import { buildQueueLane, ownerLanesFromItems, selectQueue } from "./selectors";
import {
  type OwnerLane,
  type QueueItem,
  type QueueKey,
  type QueueLane,
  type QueueSummary,
  QUEUE_KEYS,
} from "./types";

/**
 * The Queue Engine (Queue Engine §4) — assembles every open loop in the portal
 * from the single Work Hub read into ONE ranked queue, then projects the named
 * lanes, owner lanes, triage groups, and headline summary over it.
 *
 * Deterministic and serializable end-to-end: it folds the rows, meeting rows,
 * initiative cards, and unconverted decisions `loadWorkHub` already produced,
 * ranks them once, and hands the result to the UI. No DB and no clock here — the
 * caller injects `now`; `lib/queue/load.ts` is the thin server wrapper that
 * supplies the data.
 */

export type TriageGroup = {
  category: AttentionCategory;
  label: string;
  hint: string;
  items: QueueItem[];
};

export type QueueEngine = {
  generatedAtISO: string;
  /** Every open loop, ranked worst-first. The cockpit re-selects from this. */
  items: QueueItem[];
  summary: QueueSummary;
  /** Count + worst-first preview for every named queue. */
  lanes: Record<QueueKey, QueueLane>;
  /** Per-owner load (Owner Accountability lane), worst-first, top owners. */
  ownerLanes: OwnerLane[];
  /** Needs Attention grouped into triage categories (the Triage Desk). */
  triageGroups: TriageGroup[];
};

export function buildQueueEngine(
  data: WorkHubData,
  now: Date,
  options: {
    /**
     * Mentorship loops (Phase 10) folded in alongside the Work Hub loops. The
     * server loader builds these from canonical mentorship state; pure callers
     * (tests) may omit them. Ranked together so a mentor's review-due sits in
     * the same worst-first order as their overdue actions.
     */
    mentorshipItems?: QueueItem[];
  } = {}
): QueueEngine {
  const workItems = [...data.rows, ...data.meetingRows].map((row) =>
    queueItemFromWorkHubRow(row, now)
  );
  const initiativeItems = data.initiatives
    .map(queueItemFromInitiativeCard)
    .filter((item): item is QueueItem => item !== null);
  const decisionItems = data.decisionsWithoutActions.map(queueItemFromDecision);

  const items = rankQueueItems(
    [
      ...workItems,
      ...initiativeItems,
      ...decisionItems,
      ...(options.mentorshipItems ?? []),
    ],
    now
  );

  const summary: QueueSummary = {
    openLoops: items.length,
    mine: items.filter((i) => i.signals.mine).length,
    overdue: items.filter((i) => i.signals.overdue).length,
    blocked: items.filter((i) => i.signals.blocking).length,
    unowned: items.filter((i) => i.signals.missingOwner).length,
    needsDecision: items.filter((i) => i.signals.needsDecision || i.type === "decision")
      .length,
    quickWins: items.filter((i) => i.signals.quickWin).length,
    upcomingMeetings: data.stats.upcomingMeetings,
    clearedThisWeek: data.weeklyReview.completedThisWeek,
  };

  const lanes = Object.fromEntries(
    QUEUE_KEYS.map((key) => [key, buildQueueLane(items, key, now)])
  ) as Record<QueueKey, QueueLane>;

  const ownerLanes = ownerLanesFromItems(items, now).slice(0, 12);

  const triageGroups: TriageGroup[] = groupAttentionItems(data.attention).map(
    (group) => ({
      category: group.category,
      label: group.label,
      hint: group.hint,
      items: rankQueueItems(group.items.map(queueItemFromAttentionItem), now),
    })
  );

  return {
    generatedAtISO: data.generatedAtISO,
    items,
    summary,
    lanes,
    ownerLanes,
    triageGroups,
  };
}

/** Re-select a named queue from an already-built engine (server or client). */
export function getEngineQueue(
  engine: QueueEngine,
  key: QueueKey,
  now: Date
): QueueItem[] {
  return selectQueue(engine.items, key, now);
}

import { rankQueueItems } from "./ranking";
import {
  type OwnerLane,
  type QueueItem,
  type QueueKey,
  QUEUE_DESCRIPTORS,
  type QueueLane,
} from "./types";

/**
 * The named queues (Queue Engine §8). Each is a pure, deterministic projection
 * over the canonical QueueItem list — a different lens on the same loops, always
 * ranked worst-first. Selecting never mutates and never reads the clock except
 * through the injected `now` used by ranking.
 */

const isDueWithin = (item: QueueItem, now: Date, days: number): boolean => {
  if (!item.dueISO) return false;
  const due = new Date(item.dueISO).getTime();
  if (Number.isNaN(due)) return false;
  return due <= now.getTime() + days * 24 * 60 * 60 * 1000;
};

/** My Queue — open loops the viewer owns or leads. */
export function selectMyQueue(items: QueueItem[]): QueueItem[] {
  return items.filter((i) => i.signals.mine);
}

/** Leadership Queue — the highest-leverage loops across the org. */
export function selectLeadershipQueue(items: QueueItem[]): QueueItem[] {
  return items.filter(
    (i) =>
      i.severity === "critical" ||
      i.severity === "high" ||
      i.signals.overdue ||
      i.signals.blocking ||
      i.signals.missingOwner ||
      i.signals.needsDecision ||
      i.signals.escalated ||
      i.signals.flagshipInitiative
  );
}

/** Quick Wins — small loops that close in one pass. */
export function selectQuickWins(items: QueueItem[]): QueueItem[] {
  return items.filter((i) => i.signals.quickWin && !i.signals.overdue && !i.signals.blocking);
}

/** Decisions Needed — loops waiting on a leadership call. */
export function selectDecisionQueue(items: QueueItem[]): QueueItem[] {
  return items.filter((i) => i.signals.needsDecision || i.type === "decision");
}

/** Meeting Prep — what to review before upcoming meetings. */
export function selectMeetingPrepQueue(items: QueueItem[]): QueueItem[] {
  return items.filter((i) => i.type === "meeting_prep");
}

/** Post-Meeting — follow-ups + decisions still open from past meetings. */
export function selectPostMeetingQueue(items: QueueItem[]): QueueItem[] {
  return items.filter(
    (i) => i.type === "meeting" || i.type === "follow_up" || i.type === "decision"
  );
}

/** Unblock — blocked work holding up everything downstream. */
export function selectUnblockQueue(items: QueueItem[]): QueueItem[] {
  return items.filter((i) => i.signals.blocking);
}

/** Owner Accountability — loops nobody is on the hook for. */
export function selectOwnerAccountabilityQueue(items: QueueItem[]): QueueItem[] {
  return items.filter((i) => i.signals.missingOwner);
}

/** Initiative Cleanup — initiatives drifting without a next move. */
export function selectInitiativeCleanupQueue(items: QueueItem[]): QueueItem[] {
  return items.filter((i) => i.type === "initiative");
}

/** Waiting On — loops parked on someone else. */
export function selectWaitingQueue(items: QueueItem[]): QueueItem[] {
  return items.filter((i) => i.signals.waitingOn);
}

/** Weekly Review — everything that should be closed before the week resets. */
export function selectWeeklyReviewQueue(items: QueueItem[], now: Date): QueueItem[] {
  return items.filter(
    (i) =>
      i.signals.overdue ||
      i.signals.blocking ||
      i.signals.missingOwner ||
      i.signals.missingNextStep ||
      i.signals.needsDecision ||
      isDueWithin(i, now, 7)
  );
}

/** Resolve a queue key to its ranked item list. */
export function selectQueue(items: QueueItem[], key: QueueKey, now: Date): QueueItem[] {
  let selected: QueueItem[];
  switch (key) {
    case "my":
      selected = selectMyQueue(items);
      break;
    case "leadership":
      selected = selectLeadershipQueue(items);
      break;
    case "quick-wins":
      selected = selectQuickWins(items);
      break;
    case "decisions":
      selected = selectDecisionQueue(items);
      break;
    case "meeting-prep":
      selected = selectMeetingPrepQueue(items);
      break;
    case "post-meeting":
      selected = selectPostMeetingQueue(items);
      break;
    case "unblock":
      selected = selectUnblockQueue(items);
      break;
    case "owner-accountability":
      selected = selectOwnerAccountabilityQueue(items);
      break;
    case "initiative-cleanup":
      selected = selectInitiativeCleanupQueue(items);
      break;
    case "waiting":
      selected = selectWaitingQueue(items);
      break;
    case "weekly-review":
      selected = selectWeeklyReviewQueue(items, now);
      break;
  }
  return rankQueueItems(selected, now);
}

/** Build a cockpit lane (descriptor + count + worst-first preview). */
export function buildQueueLane(
  items: QueueItem[],
  key: QueueKey,
  now: Date,
  previewCount = 4
): QueueLane {
  const ranked = selectQueue(items, key, now);
  return {
    descriptor: QUEUE_DESCRIPTORS[key],
    count: ranked.length,
    items: ranked.slice(0, previewCount),
  };
}

const UNOWNED_KEY = "__unowned__";

/**
 * Owner lanes — per-owner open-loop load, worst-first. Loops with no owner are
 * grouped into a single "Unassigned" lane so they read as the accountability
 * gap they are. Deterministic: owners ordered by overdue, then open count, then
 * name; the unassigned lane always sorts to the bottom.
 */
export function ownerLanesFromItems(items: QueueItem[], now: Date): OwnerLane[] {
  const byOwner = new Map<string, QueueItem[]>();
  for (const item of items) {
    const key = item.signals.missingOwner ? UNOWNED_KEY : (item.ownerName ?? UNOWNED_KEY);
    const list = byOwner.get(key) ?? [];
    list.push(item);
    byOwner.set(key, list);
  }

  const lanes: OwnerLane[] = [];
  for (const [key, list] of byOwner) {
    const unowned = key === UNOWNED_KEY;
    lanes.push({
      ownerId: null,
      ownerName: unowned ? "Unassigned" : key,
      open: list.length,
      overdue: list.filter((i) => i.signals.overdue).length,
      blocked: list.filter((i) => i.signals.blocking).length,
      unowned,
      items: rankQueueItems(list, now),
    });
  }

  return lanes.sort((a, b) => {
    if (a.unowned !== b.unowned) return a.unowned ? 1 : -1;
    if (a.overdue !== b.overdue) return b.overdue - a.overdue;
    if (a.open !== b.open) return b.open - a.open;
    return a.ownerName.localeCompare(b.ownerName);
  });
}

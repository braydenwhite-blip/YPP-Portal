import { type QueueItem, type QueueSeverity, type QueueSignals } from "./types";

/**
 * Deterministic queue ranking (Queue Engine §12).
 *
 * The portal's ranking priority, highest first:
 *   1. Overdue
 *   2. Blocking other work
 *   3. Missing owner
 *   4. Missing next step
 *   5. Connected to an upcoming meeting
 *   6. Connected to a flagship / high-priority initiative
 *   7. Escalated
 *   8. Stale
 *   9. Assigned to the current user
 *  10. Recently created but unresolved
 *
 * Each rung gets a power-of-two weight so a higher signal STRICTLY dominates
 * every combination of lower ones (2^k > sum of all 2^j, j<k). Severity and
 * due-proximity are sub-tier nudges that only reorder items with identical
 * signals. No clock reads, no randomness — same item, same score, always.
 */

export const QUEUE_SIGNAL_WEIGHTS = {
  overdue: 1 << 9, // 512
  blocking: 1 << 8, // 256
  missingOwner: 1 << 7, // 128
  missingNextStep: 1 << 6, // 64
  connectedToMeeting: 1 << 5, // 32
  flagshipInitiative: 1 << 4, // 16
  escalated: 1 << 3, // 8
  stale: 1 << 2, // 4
  mine: 1 << 1, // 2
  recentlyCreated: 1 << 0, // 1
} as const;

const SEVERITY_WEIGHT: Record<QueueSeverity, number> = {
  critical: 3,
  high: 2,
  medium: 1,
  low: 0,
};

/** The summed signal weight — the dominant ranking term. */
export function signalScore(signals: QueueSignals): number {
  let total = 0;
  if (signals.overdue) total += QUEUE_SIGNAL_WEIGHTS.overdue;
  if (signals.blocking) total += QUEUE_SIGNAL_WEIGHTS.blocking;
  if (signals.missingOwner) total += QUEUE_SIGNAL_WEIGHTS.missingOwner;
  if (signals.missingNextStep) total += QUEUE_SIGNAL_WEIGHTS.missingNextStep;
  if (signals.connectedToMeeting) total += QUEUE_SIGNAL_WEIGHTS.connectedToMeeting;
  if (signals.flagshipInitiative) total += QUEUE_SIGNAL_WEIGHTS.flagshipInitiative;
  if (signals.escalated) total += QUEUE_SIGNAL_WEIGHTS.escalated;
  if (signals.stale) total += QUEUE_SIGNAL_WEIGHTS.stale;
  if (signals.mine) total += QUEUE_SIGNAL_WEIGHTS.mine;
  if (signals.recentlyCreated) total += QUEUE_SIGNAL_WEIGHTS.recentlyCreated;
  return total;
}

const DAY_MS = 24 * 60 * 60 * 1000;

/** 0–9 nudge for how close a (non-overdue) due date is. */
function dueProximityBump(dueISO: string | null, now: Date): number {
  if (!dueISO) return 0;
  const due = new Date(dueISO).getTime();
  if (Number.isNaN(due)) return 0;
  const days = (due - now.getTime()) / DAY_MS;
  if (days <= 0) return 0; // overdue is already a top-tier signal
  if (days <= 1) return 6;
  if (days <= 3) return 4;
  if (days <= 7) return 2;
  return 1;
}

/**
 * The full deterministic score. Signal tier dominates (× 1000); severity (× 10)
 * and due-proximity (× 1) only separate items that are otherwise identical.
 */
export function scoreQueueItem(item: QueueItem, now: Date): number {
  return (
    signalScore(item.signals) * 1000 +
    SEVERITY_WEIGHT[item.severity] * 10 +
    dueProximityBump(item.dueISO, now)
  );
}

/**
 * Rank a list worst-first. Stable + total order: score desc, then soonest due,
 * then severity, then title, then id — so the same set always renders the same.
 */
export function rankQueueItems(items: QueueItem[], now: Date): QueueItem[] {
  return [...items]
    .map((item) => ({ ...item, score: scoreQueueItem(item, now) }))
    .sort((a, b) => {
      if (a.score !== b.score) return b.score - a.score;
      const aDue = a.dueISO ? new Date(a.dueISO).getTime() : Number.POSITIVE_INFINITY;
      const bDue = b.dueISO ? new Date(b.dueISO).getTime() : Number.POSITIVE_INFINITY;
      if (aDue !== bDue) return aDue - bDue;
      if (a.severity !== b.severity)
        return SEVERITY_WEIGHT[b.severity] - SEVERITY_WEIGHT[a.severity];
      return a.title.localeCompare(b.title) || a.id.localeCompare(b.id);
    });
}

/**
 * The deterministic reason string — a stable, machine-readable summary of why a
 * loop ranks where it does ("overdue|blocking|unowned|mine"). Order matches the
 * ranking priority so the string reads top-down.
 */
export function buildReasonString(signals: QueueSignals): string {
  const parts: string[] = [];
  if (signals.overdue) parts.push("overdue");
  if (signals.blocking) parts.push("blocking");
  if (signals.missingOwner) parts.push("unowned");
  if (signals.missingNextStep) parts.push("no-next-step");
  if (signals.connectedToMeeting) parts.push("meeting-linked");
  if (signals.flagshipInitiative) parts.push("flagship");
  if (signals.escalated) parts.push("escalated");
  if (signals.stale) parts.push("stale");
  if (signals.needsDecision) parts.push("needs-decision");
  if (signals.waitingOn) parts.push("waiting-on");
  if (signals.quickWin) parts.push("quick-win");
  if (signals.mine) parts.push("mine");
  if (signals.recentlyCreated) parts.push("recent");
  return parts.join("|") || "open";
}

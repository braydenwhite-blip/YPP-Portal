import type { QueueDeferReason, QueueItem, QueueResolution } from "@/lib/queue/types";

/** One recorded decision from a queue session (runner / cockpit). */
export type SessionDecision = {
  item: QueueItem;
  resolution: QueueResolution;
  reason?: QueueDeferReason;
};

export type SessionTally = {
  resolved: number;
  delegated: number;
  discussed: number;
  deferred: number;
};

export function tallyDecisions(decisions: SessionDecision[]): SessionTally {
  const tally: SessionTally = { resolved: 0, delegated: 0, discussed: 0, deferred: 0 };
  for (const d of decisions) {
    if (d.resolution === "resolve") tally.resolved += 1;
    else if (d.resolution === "delegate") tally.delegated += 1;
    else if (d.resolution === "discuss") tally.discussed += 1;
    else if (d.resolution === "defer") tally.deferred += 1;
  }
  return tally;
}

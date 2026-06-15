import { describe, expect, it } from "vitest";

import {
  buildReasonString,
  QUEUE_SIGNAL_WEIGHTS,
  rankQueueItems,
  scoreQueueItem,
  signalScore,
} from "@/lib/queue/ranking";

import { makeQueueItem, makeSignals } from "./fixtures";

const NOW = new Date("2026-06-15T12:00:00.000Z");

describe("signalScore — power-of-two dominance", () => {
  it("ranks every signal strictly above the sum of all lower-priority signals", () => {
    // The contract: a higher-priority signal alone must outweigh ALL lower
    // ones combined. This is what makes 'overdue beats everything' true.
    const order: (keyof typeof QUEUE_SIGNAL_WEIGHTS)[] = [
      "overdue",
      "blocking",
      "missingOwner",
      "missingNextStep",
      "connectedToMeeting",
      "flagshipInitiative",
      "escalated",
      "stale",
      "mine",
      "recentlyCreated",
    ];
    for (let i = 0; i < order.length; i++) {
      const higher = QUEUE_SIGNAL_WEIGHTS[order[i]];
      const lowerSum = order
        .slice(i + 1)
        .reduce((sum, key) => sum + QUEUE_SIGNAL_WEIGHTS[key], 0);
      expect(higher).toBeGreaterThan(lowerSum);
    }
  });

  it("an overdue loop outscores a loop with every other signal set", () => {
    const overdueOnly = signalScore(makeSignals({ overdue: true }));
    const everythingElse = signalScore(
      makeSignals({
        blocking: true,
        missingOwner: true,
        missingNextStep: true,
        connectedToMeeting: true,
        flagshipInitiative: true,
        escalated: true,
        stale: true,
        mine: true,
        recentlyCreated: true,
      })
    );
    expect(overdueOnly).toBeGreaterThan(everythingElse);
  });
});

describe("scoreQueueItem", () => {
  it("uses severity only to separate items with identical signals", () => {
    const critical = makeQueueItem({ severity: "critical", signals: makeSignals({ mine: true }) });
    const low = makeQueueItem({ severity: "low", signals: makeSignals({ mine: true }) });
    expect(scoreQueueItem(critical, NOW)).toBeGreaterThan(scoreQueueItem(low, NOW));

    // ...but severity can never cross a signal tier.
    const blockingLow = makeQueueItem({ severity: "low", signals: makeSignals({ blocking: true }) });
    const mineCritical = makeQueueItem({ severity: "critical", signals: makeSignals({ mine: true }) });
    expect(scoreQueueItem(blockingLow, NOW)).toBeGreaterThan(scoreQueueItem(mineCritical, NOW));
  });

  it("nudges sooner due dates higher within the same signal tier", () => {
    const soon = makeQueueItem({ dueISO: "2026-06-16T12:00:00.000Z" });
    const later = makeQueueItem({ dueISO: "2026-07-30T12:00:00.000Z" });
    expect(scoreQueueItem(soon, NOW)).toBeGreaterThan(scoreQueueItem(later, NOW));
  });
});

describe("rankQueueItems — determinism", () => {
  it("produces the documented priority order", () => {
    const items = [
      makeQueueItem({ id: "recent", title: "Recent", signals: makeSignals({ recentlyCreated: true }) }),
      makeQueueItem({ id: "overdue", title: "Overdue", signals: makeSignals({ overdue: true }) }),
      makeQueueItem({ id: "owner", title: "Owner", signals: makeSignals({ missingOwner: true }) }),
      makeQueueItem({ id: "block", title: "Blocked", signals: makeSignals({ blocking: true }) }),
      makeQueueItem({ id: "stale", title: "Stale", signals: makeSignals({ stale: true }) }),
    ];
    const ranked = rankQueueItems(items, NOW).map((i) => i.id);
    expect(ranked).toEqual(["overdue", "block", "owner", "stale", "recent"]);
  });

  it("is a pure, total order — same input, same output, original array untouched", () => {
    const items = [
      makeQueueItem({ id: "b", title: "Beta", signals: makeSignals({ overdue: true }) }),
      makeQueueItem({ id: "a", title: "Alpha", signals: makeSignals({ overdue: true }) }),
    ];
    const first = rankQueueItems(items, NOW).map((i) => i.id);
    const second = rankQueueItems(items, NOW).map((i) => i.id);
    expect(first).toEqual(second);
    // Equal score → deterministic tie-break by title then id.
    expect(first).toEqual(["a", "b"]);
    // Input not mutated.
    expect(items.map((i) => i.id)).toEqual(["b", "a"]);
  });

  it("writes the computed score back onto each item", () => {
    const [ranked] = rankQueueItems(
      [makeQueueItem({ signals: makeSignals({ overdue: true }) })],
      NOW
    );
    expect(ranked.score).toBe(scoreQueueItem(ranked, NOW));
    expect(ranked.score).toBeGreaterThan(0);
  });
});

describe("buildReasonString", () => {
  it("is a stable top-down summary of the active signals", () => {
    expect(
      buildReasonString(makeSignals({ overdue: true, missingOwner: true, mine: true }))
    ).toBe("overdue|unowned|mine");
  });

  it("falls back to 'open' when nothing is flagged", () => {
    expect(buildReasonString(makeSignals())).toBe("open");
  });
});

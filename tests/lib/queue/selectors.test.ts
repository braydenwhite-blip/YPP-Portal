import { describe, expect, it } from "vitest";

import {
  ownerLanesFromItems,
  selectDecisionQueue,
  selectMeetingPrepQueue,
  selectMyQueue,
  selectOwnerAccountabilityQueue,
  selectQuickWins,
  selectQueue,
  selectUnblockQueue,
  selectWaitingQueue,
  selectWeeklyReviewQueue,
} from "@/lib/queue/selectors";

import { makeQueueItem, makeSignals } from "./fixtures";

const NOW = new Date("2026-06-15T12:00:00.000Z");

const mine = makeQueueItem({ id: "mine", signals: makeSignals({ mine: true }) });
const blocked = makeQueueItem({ id: "blocked", signals: makeSignals({ blocking: true }) });
const unowned = makeQueueItem({ id: "unowned", signals: makeSignals({ missingOwner: true }) });
const quick = makeQueueItem({ id: "quick", signals: makeSignals({ quickWin: true }) });
const decision = makeQueueItem({ id: "decision", type: "decision", signals: makeSignals({ missingNextStep: true }) });
const needsDecision = makeQueueItem({ id: "needs-decision", signals: makeSignals({ needsDecision: true }) });
const prep = makeQueueItem({ id: "prep", type: "meeting_prep", signals: makeSignals({ connectedToMeeting: true }) });
const waiting = makeQueueItem({ id: "waiting", ownerName: "Sam", signals: makeSignals({ waitingOn: true }) });

const ALL = [mine, blocked, unowned, quick, decision, needsDecision, prep, waiting];

describe("named queue selectors", () => {
  it("My Queue selects only the viewer's loops", () => {
    expect(selectMyQueue(ALL).map((i) => i.id)).toEqual(["mine"]);
  });

  it("Unblock selects only blocked loops", () => {
    expect(selectUnblockQueue(ALL).map((i) => i.id)).toEqual(["blocked"]);
  });

  it("Owner Accountability selects only owner-less loops", () => {
    expect(selectOwnerAccountabilityQueue(ALL).map((i) => i.id)).toEqual(["unowned"]);
  });

  it("Quick Wins excludes anything overdue or blocked", () => {
    const overdueQuick = makeQueueItem({
      id: "overdue-quick",
      signals: makeSignals({ quickWin: true, overdue: true }),
    });
    expect(selectQuickWins([...ALL, overdueQuick]).map((i) => i.id)).toEqual(["quick"]);
  });

  it("Decision Queue catches both decision-type loops and needs-decision signals", () => {
    expect(selectDecisionQueue(ALL).map((i) => i.id).sort()).toEqual(
      ["decision", "needs-decision"].sort()
    );
  });

  it("Meeting Prep selects upcoming-meeting loops", () => {
    expect(selectMeetingPrepQueue(ALL).map((i) => i.id)).toEqual(["prep"]);
  });

  it("Waiting On selects loops parked on someone else", () => {
    expect(selectWaitingQueue(ALL).map((i) => i.id)).toEqual(["waiting"]);
  });

  it("Weekly Review gathers everything that should close this week", () => {
    const ids = selectWeeklyReviewQueue(ALL, NOW).map((i) => i.id);
    expect(ids).toContain("blocked");
    expect(ids).toContain("unowned");
    expect(ids).toContain("decision");
    // A waiting-only quick win with no due date is not weekly-review debt.
    expect(ids).not.toContain("waiting");
  });

  it("selectQueue returns a ranked list for any key", () => {
    const overdueMine = makeQueueItem({
      id: "overdue-mine",
      signals: makeSignals({ mine: true, overdue: true }),
    });
    const ranked = selectQueue([mine, overdueMine], "my", NOW);
    expect(ranked.map((i) => i.id)).toEqual(["overdue-mine", "mine"]);
  });
});

describe("ownerLanesFromItems", () => {
  it("groups by owner, isolates the unassigned lane, and ranks owners worst-first", () => {
    const items = [
      makeQueueItem({ id: "a1", ownerName: "Alice", signals: makeSignals({ overdue: true }) }),
      makeQueueItem({ id: "a2", ownerName: "Alice" }),
      makeQueueItem({ id: "b1", ownerName: "Bob" }),
      makeQueueItem({ id: "u1", signals: makeSignals({ missingOwner: true }) }),
    ];
    const lanes = ownerLanesFromItems(items, NOW);
    expect(lanes.map((l) => l.ownerName)).toEqual(["Alice", "Bob", "Unassigned"]);
    expect(lanes[0].open).toBe(2);
    expect(lanes[0].overdue).toBe(1);
    expect(lanes[2].unowned).toBe(true);
  });
});

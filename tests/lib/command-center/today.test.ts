import { describe, expect, it } from "vitest";

import { buildRecentChanges, buildTodayWorkspace } from "@/lib/command-center";

import { makeQueueItem, makeSignals } from "../queue/fixtures";
import { isoFromNow, makeEngine, NOW } from "./helpers";

describe("buildTodayWorkspace mission", () => {
  it("assembles a deterministic mission from prep, owner gap, and overdue follow-ups", () => {
    const items = [
      makeQueueItem({
        id: "prep",
        type: "meeting_prep",
        title: "Prep loop",
        relatedMeeting: { id: "m1", title: "Leadership Sync" },
        primaryAction: { resolution: "discuss", label: "Prep", href: "/meet?m=m1" },
      }),
      makeQueueItem({
        id: "owner",
        title: "Owner gap",
        relatedInitiative: { id: "i1", title: "Summer Camps 2026" },
        signals: makeSignals({ missingOwner: true, flagshipInitiative: true }),
      }),
      makeQueueItem({ id: "f1", type: "follow_up", signals: makeSignals({ overdue: true }) }),
      makeQueueItem({ id: "f2", type: "follow_up", signals: makeSignals({ overdue: true }) }),
    ];
    const vm = buildTodayWorkspace({
      engine: makeEngine(items, { summary: { overdue: 2 } }),
      meetings: [],
      viewerName: "Brayden White",
      now: NOW,
    });

    expect(vm.viewerFirstName).toBe("Brayden");
    expect(vm.mission).toBe(
      "Prep Leadership Sync, assign an owner to Summer Camps 2026, and clear 2 overdue follow-ups."
    );
  });

  it("falls back to a calm message when the queue is clear", () => {
    const vm = buildTodayWorkspace({
      engine: makeEngine([]),
      meetings: [],
      viewerName: "Brayden",
      now: NOW,
    });
    expect(vm.mission).toMatch(/queue is clear/i);
    expect(vm.flow.now).toBeNull();
  });
});

describe("buildTodayWorkspace flow (Now / Next / Later)", () => {
  it("picks three distinct loops and routes Next into the meeting", () => {
    const items = [
      makeQueueItem({ id: "now", title: "Update interview times", signals: makeSignals({ mine: true, overdue: true }) }),
      makeQueueItem({
        id: "next",
        type: "meeting_prep",
        title: "Prepare for Leadership Sync",
        signals: makeSignals({ connectedToMeeting: true }),
      }),
      makeQueueItem({ id: "later", title: "Review proposals", signals: makeSignals({ quickWin: true }) }),
    ];
    const vm = buildTodayWorkspace({ engine: makeEngine(items), meetings: [], viewerName: "B", now: NOW });

    expect(vm.flow.now?.title).toBe("Update interview times");
    expect(vm.flow.next?.title).toBe("Prepare for Leadership Sync");
    expect(vm.flow.next?.ctaLabel).toBe("Prep meeting");
    expect(vm.flow.later?.title).toBe("Review proposals");
    const ids = new Set([vm.flow.now?.title, vm.flow.next?.title, vm.flow.later?.title]);
    expect(ids.size).toBe(3);
  });
});

describe("buildRecentChanges", () => {
  it("keeps only loops touched in the window, newest first", () => {
    const items = [
      makeQueueItem({ id: "old", updatedISO: isoFromNow(-10) }),
      makeQueueItem({ id: "fresh", updatedISO: isoFromNow(-1) }),
      makeQueueItem({ id: "newest", updatedISO: isoFromNow(0) }),
    ];
    const changes = buildRecentChanges(items, NOW, 5);
    expect(changes.map((c) => c.id)).toEqual(["newest", "fresh"]);
  });
});

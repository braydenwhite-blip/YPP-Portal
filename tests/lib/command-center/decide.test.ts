import { describe, expect, it } from "vitest";

import { buildDecideWorkspace } from "@/lib/command-center";

import { makeQueueItem, makeSignals } from "../queue/fixtures";
import { makeEngine, NOW } from "./helpers";

function ownedItem(id: string, owner: string, signals = {}) {
  return makeQueueItem({ id, ownerId: `u-${owner}`, ownerName: owner, signals: makeSignals(signals) });
}

describe("buildDecideWorkspace — ownership focus", () => {
  const items = [
    makeQueueItem({
      id: "gap",
      title: "Summer Camps 2026 owner",
      relatedInitiative: { id: "i1", title: "Summer Camps 2026" },
      signals: makeSignals({ missingOwner: true, flagshipInitiative: true }),
    }),
    ownedItem("mia-1", "Mia Ward"),
    ownedItem("alex-1", "Alex Brooks", { overdue: true }),
  ];
  const vm = buildDecideWorkspace({ engine: makeEngine(items), recentDecisions: [], now: NOW });

  it("frames an owner gap as a 'Who owns …?' decision", () => {
    expect(vm.focus?.title).toBe("Who owns Summer Camps 2026?");
    expect(vm.focus?.isOwnershipDecision).toBe(true);
    expect(vm.focus?.ownerFallback).toBe("Unassigned");
  });

  it("recommends the lightest-load owner first, deterministically", () => {
    const options = vm.focus?.options ?? [];
    expect(options[0]?.name).toBe("Mia Ward");
    expect(options[0]?.recommended).toBe(true);
    expect(options.some((o) => o.name === "Alex Brooks")).toBe(true);
  });

  it("counts the ownership gap in the summary", () => {
    expect(vm.summary.needsOwner).toBe(1);
  });
});

describe("buildDecideWorkspace — brief", () => {
  it("names how many decisions block a flagship initiative", () => {
    const items = [
      makeQueueItem({ id: "d1", type: "decision", signals: makeSignals({ needsDecision: true, flagshipInitiative: true, blocking: true }) }),
      makeQueueItem({ id: "d2", type: "decision", signals: makeSignals({ needsDecision: true }) }),
    ];
    const vm = buildDecideWorkspace({ engine: makeEngine(items), recentDecisions: [], now: NOW });
    expect(vm.brief).toBe("2 decisions need leadership. 1 blocks a flagship initiative.");
    expect(vm.flagshipBlockers).toBe(1);
  });

  it("stays calm when nothing needs a decision", () => {
    const vm = buildDecideWorkspace({ engine: makeEngine([]), recentDecisions: [], now: NOW });
    expect(vm.brief).toMatch(/No decisions need leadership/i);
    expect(vm.focus).toBeNull();
  });
});

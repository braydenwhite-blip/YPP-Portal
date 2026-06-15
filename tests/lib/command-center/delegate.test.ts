import { describe, expect, it } from "vitest";

import { buildDelegateWorkspace } from "@/lib/command-center";

import { makeQueueItem, makeSignals } from "../queue/fixtures";
import { makeEngine, NOW } from "./helpers";

describe("buildDelegateWorkspace", () => {
  const items = [
    makeQueueItem({ id: "mia-1", ownerName: "Mia Ward", ownerId: "u1" }),
    makeQueueItem({ id: "alex-1", ownerName: "Alex Brooks", ownerId: "u2", signals: makeSignals({ overdue: true }) }),
    makeQueueItem({
      id: "gap-1",
      title: "Summer Camps 2026",
      relatedInitiative: { id: "i1", title: "Summer Camps 2026" },
      signals: makeSignals({ missingOwner: true, flagshipInitiative: true }),
    }),
    makeQueueItem({
      id: "wait-1",
      ownerName: "Jordan Taylor",
      relatedPerson: { type: "person", id: "p1", label: "Jordan Taylor" },
      signals: makeSignals({ waitingOn: true, needsDecision: true }),
    }),
    // A second Jordan loop so Mia is unambiguously the lightest-load owner.
    makeQueueItem({ id: "jordan-2", ownerName: "Jordan Taylor", ownerId: "u3" }),
  ];
  const vm = buildDelegateWorkspace({ engine: makeEngine(items), now: NOW });

  it("summarizes ownership gaps and overdue work", () => {
    expect(vm.summary.needOwnership).toBe(1);
    expect(vm.summary.overdueItems).toBe(1);
    expect(vm.briefHeadline).toBe("1 item need ownership.");
    expect(vm.briefSub).toContain("Summer Camps 2026");
  });

  it("derives operational owner status, not a health score", () => {
    const mia = vm.ownerLanes.find((lane) => lane.ownerName === "Mia Ward");
    const alex = vm.ownerLanes.find((lane) => lane.ownerName === "Alex Brooks");
    expect(mia?.status.label).toBe("On track");
    expect(alex?.status.label).toBe("Overdue (1)");
    for (const lane of vm.ownerLanes) {
      expect(lane.status.label.toLowerCase()).not.toContain("health");
    }
  });

  it("suggests the lightest-load owner for unowned work", () => {
    const assignment = vm.assignmentQueue.find((item) => item.id === "gap-1");
    expect(assignment?.suggestedOwnerName).toBe("Mia Ward");
    expect(assignment?.priorityLabel).toBeTruthy();
  });

  it("enables tools with work and disables the empty ones", () => {
    const assignMissing = vm.batchTools.find((tool) => tool.id === "assign-missing");
    const reassign = vm.batchTools.find((tool) => tool.id === "reassign-overdue");
    const addToMeeting = vm.batchTools.find((tool) => tool.id === "add-to-meeting");
    expect(assignMissing?.disabled).toBe(false); // one item needs an owner
    expect(reassign?.disabled).toBe(false); // the overdue item has an owner and can be reassigned
    expect(addToMeeting?.disabled).toBe(true); // no loop is flagged for discussion
  });

  it("groups who we're waiting on by person", () => {
    expect(vm.waitingOn[0]?.name).toBe("Jordan Taylor");
    expect(vm.waitingOn[0]?.count).toBe(1);
    expect(vm.waitingOn[0]?.reason).toContain("decisions");
  });
});

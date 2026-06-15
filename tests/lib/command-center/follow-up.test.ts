import { describe, expect, it } from "vitest";

import { buildFollowUpWorkspace } from "@/lib/command-center";

import { makeQueueItem, makeSignals } from "../queue/fixtures";
import { makeEngine, NOW } from "./helpers";

describe("buildFollowUpWorkspace", () => {
  const items = [
    makeQueueItem({ id: "app", type: "application", title: "Applicant decision" }),
    makeQueueItem({ id: "fu", type: "follow_up", title: "Meeting follow-up", relatedMeeting: { id: "m1", title: "Sync" }, signals: makeSignals({ overdue: true }) }),
    makeQueueItem({ id: "pr", type: "partner_request", title: "Partner ask" }),
    makeQueueItem({ id: "cs", type: "class_setup", title: "Class readiness" }),
    makeQueueItem({ id: "ac", type: "advisor_check_in", title: "Advisor check-in" }),
    makeQueueItem({ id: "ou", type: "action", title: "Owner update", ownerName: "Mia Ward", signals: makeSignals({ waitingOn: true }) }),
  ];
  const vm = buildFollowUpWorkspace({ engine: makeEngine(items), now: NOW });

  it("maps each loop to a concrete follow-up category", () => {
    const byId = Object.fromEntries(vm.items.map((item) => [item.id, item.category]));
    expect(byId.app).toBe("applicant");
    expect(byId.fu).toBe("meeting");
    expect(byId.pr).toBe("partner");
    expect(byId.cs).toBe("class_readiness");
    expect(byId.ac).toBe("instructor");
    expect(byId.ou).toBe("owner_update");
  });

  it("writes a concrete brief about open / overdue / blocking", () => {
    expect(vm.brief).toBe("6 follow-ups are open. 1 is overdue. 1 person is blocking active work.");
    expect(vm.summary.open).toBe(6);
    expect(vm.summary.overdue).toBe(1);
    expect(vm.summary.waitingOnPeople).toBe(1);
  });

  it("always offers the All and Overdue filter chips", () => {
    const keys = vm.typeChips.map((chip) => chip.key);
    expect(keys).toContain("all");
    expect(keys).toContain("overdue");
    expect(vm.typeChips.find((chip) => chip.key === "all")?.count).toBe(6);
  });

  it("guides the user when nothing is open", () => {
    const empty = buildFollowUpWorkspace({ engine: makeEngine([]), now: NOW });
    expect(empty.brief).toMatch(/No follow-ups are open/i);
  });
});

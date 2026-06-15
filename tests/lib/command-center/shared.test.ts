import { describe, expect, it } from "vitest";

import {
  distinctWaitingPeople,
  dueLabel,
  initialsFromName,
  joinClauses,
  needsMeeting,
  operationalState,
  ownerStatus,
} from "@/lib/command-center/shared";
import type { OwnerLane } from "@/lib/queue/types";

import { makeSignals } from "../queue/fixtures";
import { makeQueueItem } from "../queue/fixtures";
import { isoFromNow, NOW } from "./helpers";

describe("operationalState — concrete operating language, worst-first", () => {
  it("ranks overdue above every other signal", () => {
    const item = makeQueueItem({
      ageLabel: "3 days overdue",
      signals: makeSignals({ overdue: true, blocking: true, missingOwner: true }),
    });
    expect(operationalState(item)).toEqual({ label: "3 days overdue", tone: "danger" });
  });

  it("maps each signal to concrete operating language (never 'health')", () => {
    const cases: Array<[Parameters<typeof makeSignals>[0], string]> = [
      [{ blocking: true }, "Blocked"],
      [{ missingOwner: true }, "No owner"],
      [{ needsDecision: true }, "Needs decision"],
      [{ waitingOn: true }, "Waiting on"],
      [{ missingNextStep: true }, "No next step"],
      [{ stale: true }, "No update"],
    ];
    for (const [signals, label] of cases) {
      const item = makeQueueItem({ signals: makeSignals(signals) });
      expect(operationalState(item).label).toBe(label);
    }
  });

  it("falls back to the item status when no signal is set", () => {
    const item = makeQueueItem({ statusLabel: "Open", tone: "info" });
    expect(operationalState(item)).toEqual({ label: "Open", tone: "info" });
  });
});

describe("dueLabel", () => {
  it("uses calm relative language around now", () => {
    expect(dueLabel(isoFromNow(0), NOW)).toBe("Due today");
    expect(dueLabel(isoFromNow(1), NOW)).toBe("Due tomorrow");
    expect(dueLabel(isoFromNow(-1), NOW)).toBe("1 day overdue");
    expect(dueLabel(isoFromNow(-4), NOW)).toBe("4 days overdue");
    expect(dueLabel(isoFromNow(3), NOW)).toBe("Due in 3 days");
    expect(dueLabel(null, NOW)).toBeNull();
  });
});

describe("ownerStatus — operational, never evaluative", () => {
  const base: OwnerLane = {
    ownerId: "u1",
    ownerName: "Mia Ward",
    open: 2,
    overdue: 0,
    blocked: 0,
    unowned: false,
    items: [],
  };

  it("calls out overdue first", () => {
    expect(ownerStatus({ ...base, overdue: 2 })).toEqual({ label: "Overdue (2)", tone: "danger" });
  });

  it("flags at-capacity once the open load is heavy", () => {
    expect(ownerStatus({ ...base, open: 7 })).toEqual({ label: "At capacity", tone: "warning" });
  });

  it("is on track otherwise", () => {
    expect(ownerStatus(base)).toEqual({ label: "On track", tone: "success" });
  });

  it("marks the unassigned lane", () => {
    expect(ownerStatus({ ...base, unowned: true })).toEqual({ label: "Unassigned", tone: "warning" });
  });
});

describe("misc helpers", () => {
  it("needsMeeting reads the discuss resolution", () => {
    expect(needsMeeting(makeQueueItem({ resolutions: ["resolve", "discuss"] }))).toBe(true);
    expect(needsMeeting(makeQueueItem({ resolutions: ["resolve"] }))).toBe(false);
  });

  it("initialsFromName handles one and two names", () => {
    expect(initialsFromName("Mia Ward")).toBe("MW");
    expect(initialsFromName("Mia")).toBe("MI");
    expect(initialsFromName(null)).toBe("?");
  });

  it("joinClauses builds a calm sentence and drops empties", () => {
    expect(joinClauses(["a", null, "b", "c"])).toBe("a, b, and c");
    expect(joinClauses(["only"])).toBe("only");
    expect(joinClauses([null, undefined])).toBe("");
  });

  it("distinctWaitingPeople de-dupes by name across waiting loops", () => {
    const items = [
      makeQueueItem({ id: "1", ownerName: "Mia Ward", signals: makeSignals({ waitingOn: true }) }),
      makeQueueItem({ id: "2", ownerName: "Mia Ward", signals: makeSignals({ waitingOn: true }) }),
      makeQueueItem({ id: "3", ownerName: "Alex Brooks", signals: makeSignals({ waitingOn: true }) }),
      makeQueueItem({ id: "4", ownerName: "Jordan", signals: makeSignals({ waitingOn: false }) }),
    ];
    expect(distinctWaitingPeople(items).sort()).toEqual(["Alex Brooks", "Mia Ward"]);
  });
});

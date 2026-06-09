import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({ prisma: {} }));
vi.mock("@/lib/feature-flags", () => ({ isActionTrackerEnabled: () => true }));

import {
  deriveInitiativeMilestones,
  deriveMilestone,
  summarizeMilestones,
} from "@/lib/people-strategy/strategic-milestones";
import type {
  InitiativeMilestoneDef,
  StrategicInitiativeDef,
} from "@/lib/people-strategy/strategic-initiatives";

import { action, NOW } from "./strategic-helpers";

const pilotDone = () =>
  action({ title: "Run the pilot session", status: "COMPLETE", completedAt: new Date("2026-06-02") });
const pilotOpen = () =>
  action({ title: "Prep the pilot run", status: "IN_PROGRESS", deadlineStart: new Date("2026-06-10") });
const pilotOverdue = () =>
  action({ title: "Book pilot venue", status: "IN_PROGRESS", deadlineStart: new Date("2026-06-01") });

const milestoneDef: InitiativeMilestoneDef = {
  id: "run-pilot",
  title: "Run pilot",
  order: 1,
  match: { keywords: ["pilot"] },
};

describe("deriveMilestone", () => {
  it("aggregates only the matching actions and computes completion %", () => {
    const m = deriveMilestone({
      def: milestoneDef,
      actions: [pilotDone(), pilotOpen(), action({ title: "Unrelated task" })],
      meetings: [],
      decisions: [],
      now: NOW,
    });
    expect(m.totalActions).toBe(2); // unrelated excluded
    expect(m.completedActions).toBe(1);
    expect(m.openActions).toBe(1);
    expect(m.percent).toBe(50);
    expect(m.status).toBe("in_progress");
  });

  it("is complete when all matched work is done", () => {
    const m = deriveMilestone({ def: milestoneDef, actions: [pilotDone()], meetings: [], decisions: [], now: NOW });
    expect(m.status).toBe("complete");
    expect(m.percent).toBe(100);
  });

  it("is at risk with overdue work", () => {
    const m = deriveMilestone({ def: milestoneDef, actions: [pilotOverdue()], meetings: [], decisions: [], now: NOW });
    expect(m.status).toBe("at_risk");
    expect(m.overdueActions).toBe(1);
  });

  it("flags behind-schedule when the target date has passed and it is not done", () => {
    const m = deriveMilestone({
      def: { ...milestoneDef, targetDateISO: "2026-06-01T00:00:00.000Z" },
      actions: [pilotOpen()],
      meetings: [],
      decisions: [],
      now: NOW,
    });
    expect(m.behindSchedule).toBe(true);
    expect(m.status).toBe("at_risk");
  });

  it("is not_started with no matched work", () => {
    const m = deriveMilestone({ def: milestoneDef, actions: [action({ title: "x" })], meetings: [], decisions: [], now: NOW });
    expect(m.status).toBe("not_started");
    expect(m.totalActions).toBe(0);
  });
});

describe("deriveInitiativeMilestones + summarize", () => {
  const def: StrategicInitiativeDef = {
    id: "i",
    title: "I",
    description: "",
    area: "CLASSES",
    status: "active",
    priority: "high",
    match: { keywords: ["camp"] },
    milestones: [
      { id: "b", title: "B", order: 2, match: { keywords: ["pilot"] } },
      { id: "a", title: "A", order: 1, match: { keywords: ["partner"] } },
    ],
  };

  it("returns milestones in roadmap order and summarizes completion", () => {
    const ms = deriveInitiativeMilestones({
      def,
      actions: [
        action({ title: "Secure camp partner", status: "COMPLETE", completedAt: new Date("2026-06-02") }),
        action({ title: "Plan camp pilot", status: "IN_PROGRESS", deadlineStart: new Date("2026-06-10") }),
      ],
      meetings: [],
      decisions: [],
      now: NOW,
    });
    expect(ms.map((m) => m.id)).toEqual(["a", "b"]); // order ascending
    const sum = summarizeMilestones(ms);
    expect(sum.total).toBe(2);
    expect(sum.completed).toBe(1); // "A" (partner) complete
  });
});

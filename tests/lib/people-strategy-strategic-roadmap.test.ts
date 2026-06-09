import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({ prisma: {} }));
vi.mock("@/lib/feature-flags", () => ({ isActionTrackerEnabled: () => true }));

import { deriveInitiativeRoadmap } from "@/lib/people-strategy/strategic-roadmap";
import type { InitiativeMilestoneSummary } from "@/lib/people-strategy/strategic-milestones";
import type { StrategicInitiativeDef } from "@/lib/people-strategy/strategic-initiatives";

import { NOW } from "./strategic-helpers";

function ms(overrides: Partial<InitiativeMilestoneSummary>): InitiativeMilestoneSummary {
  return {
    id: "m",
    title: "M",
    description: null,
    order: 1,
    targetDateISO: null,
    status: "not_started",
    statusLabel: "Not started",
    percent: 0,
    totalActions: 0,
    openActions: 0,
    completedActions: 0,
    blockedActions: 0,
    overdueActions: 0,
    unassignedActions: 0,
    meetingCount: 0,
    decisionCount: 0,
    health: { level: "healthy", label: "Healthy", tone: "success", score: 100, reasons: [] },
    ownerName: null,
    behindSchedule: false,
    actionIds: [],
    ...overrides,
  };
}

const def: StrategicInitiativeDef = {
  id: "summer",
  title: "Summer Camps",
  description: "",
  area: "CLASSES",
  status: "active",
  priority: "flagship",
  targetDateISO: "2027-06-01T00:00:00.000Z",
  match: { keywords: ["camp"] },
  milestones: [
    { id: "done", title: "Done", order: 1, match: { keywords: ["x"] } },
    { id: "now", title: "Current", order: 2, match: { keywords: ["x"] } },
    { id: "late", title: "Late", order: 3, match: { keywords: ["x"] } },
    { id: "future", title: "Future", order: 4, match: { keywords: ["x"] } },
  ],
};

describe("deriveInitiativeRoadmap", () => {
  const milestones = [
    ms({ id: "done", title: "Done", order: 1, status: "complete", percent: 100, targetDateISO: "2026-05-01T00:00:00.000Z" }),
    ms({ id: "now", title: "Current", order: 2, status: "in_progress", percent: 40, targetDateISO: "2026-07-01T00:00:00.000Z" }),
    ms({ id: "late", title: "Late", order: 3, status: "at_risk", percent: 20, behindSchedule: true, targetDateISO: "2026-05-20T00:00:00.000Z" }),
    ms({ id: "future", title: "Future", order: 4, status: "not_started", percent: 0 }),
  ];

  it("maps milestone status to roadmap phases", () => {
    const r = deriveInitiativeRoadmap({ def, milestones, now: NOW });
    expect(r.counts.completed).toBe(1);
    expect(r.counts.inProgress).toBe(1);
    expect(r.counts.atRisk).toBe(1);
    // upcoming = the not_started milestone + the (not-all-complete) initiative target.
    expect(r.counts.upcoming).toBe(2);
  });

  it("buckets a behind-schedule milestone into the overdue horizon", () => {
    const r = deriveInitiativeRoadmap({ def, milestones, now: NOW });
    expect(r.byHorizon.overdue.map((i) => i.title)).toContain("Late");
    expect(r.counts.overdue).toBe(1);
  });

  it("adds the initiative target as a final roadmap item", () => {
    const r = deriveInitiativeRoadmap({ def, milestones, now: NOW });
    const target = r.items.find((i) => i.kind === "initiative_target");
    expect(target).toBeTruthy();
    expect(target?.title).toContain("target");
  });

  it("is empty + safe with no milestones and no target", () => {
    const r = deriveInitiativeRoadmap({
      def: { ...def, targetDateISO: undefined, milestones: [] },
      milestones: [],
      now: NOW,
    });
    expect(r.items).toEqual([]);
  });
});

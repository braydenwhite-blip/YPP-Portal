import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({ prisma: {} }));
vi.mock("@/lib/feature-flags", () => ({ isActionTrackerEnabled: () => true }));

import {
  computeInitiativeWorkSignals,
  deriveInitiativeHealth,
  deriveInitiativeMomentum,
  deriveInitiativeOwnership,
  deriveInitiativeRisk,
} from "@/lib/people-strategy/strategic-initiative-health";
import {
  buildInitiativeActionPrefill,
  deriveInitiativeRecommendations,
  initiativePrimaryGoalCategory,
} from "@/lib/people-strategy/strategic-recommendations";
import type { StrategicInitiativeDef } from "@/lib/people-strategy/strategic-initiatives";

import { action, assignment, NOW } from "./strategic-helpers";

const def: StrategicInitiativeDef = {
  id: "summer-camps-2026",
  title: "Summer Camps 2026",
  description: "",
  area: "CLASSES",
  status: "active",
  priority: "flagship",
  match: { goalCategories: ["Summer Camps"], keywords: ["camp"] },
  milestones: [],
};

function reads(actions: ReturnType<typeof action>[], owner?: string) {
  const signals = computeInitiativeWorkSignals({ actions, meetings: [], decisions: [], now: NOW });
  const momentum = deriveInitiativeMomentum(signals, NOW);
  const ownership = deriveInitiativeOwnership(actions, { owner }, NOW);
  const risk = deriveInitiativeRisk(signals, { momentum });
  const health = deriveInitiativeHealth({ status: "active", signals, risk, momentum, ownership });
  return { signals, momentum, ownership, risk, health };
}

describe("deriveInitiativeRecommendations", () => {
  it("recommends clearing overdue work first, linked to the overdue queue", () => {
    const overdue = action({ status: "IN_PROGRESS", deadlineStart: new Date("2026-06-01") });
    const r = reads([overdue, overdue]);
    const recs = deriveInitiativeRecommendations({ def, milestones: [], ...r });
    expect(recs[0].kind).toBe("action");
    expect(recs[0].href).toBe("/actions/all?status=OVERDUE");
    expect(recs.every((x) => x.detail.length > 0)).toBe(true);
  });

  it("recommends assigning an owner when work is unowned", () => {
    const unowned = action({ status: "IN_PROGRESS", assignments: [assignment("alice", "LEAD")] });
    const r = reads([unowned]);
    const recs = deriveInitiativeRecommendations({ def, milestones: [], ...r });
    expect(recs.some((x) => x.kind === "ownership")).toBe(true);
  });

  it("recommends seeding the first action when there is no work, with a prefilled link", () => {
    const r = reads([]);
    const recs = deriveInitiativeRecommendations({ def, milestones: [], ...r });
    const seed = recs.find((x) => x.id.endsWith(":seed"));
    expect(seed).toBeTruthy();
    expect(seed?.href).toContain("/actions/new");
  });

  it("only suggests a wrap-up review for a completed initiative", () => {
    const signals = computeInitiativeWorkSignals({ actions: [], meetings: [], decisions: [], now: NOW });
    const momentum = deriveInitiativeMomentum(signals, NOW);
    const ownership = deriveInitiativeOwnership([], {}, NOW);
    const risk = deriveInitiativeRisk(signals, { momentum });
    const health = deriveInitiativeHealth({ status: "completed", signals, risk, momentum, ownership });
    const recs = deriveInitiativeRecommendations({ def, milestones: [], signals, momentum, ownership, risk, health });
    expect(recs).toHaveLength(1);
    expect(recs[0].kind).toBe("review");
  });

  it("is sorted by score (most impactful first) and respects the limit", () => {
    const overdue = action({ status: "IN_PROGRESS", deadlineStart: new Date("2026-06-01"), assignments: [assignment("alice", "LEAD")] });
    const r = reads([overdue, overdue, overdue]);
    const recs = deriveInitiativeRecommendations({ def, milestones: [], limit: 2, ...r });
    expect(recs.length).toBeLessThanOrEqual(2);
    for (let i = 1; i < recs.length; i++) {
      expect(recs[i - 1].score).toBeGreaterThanOrEqual(recs[i].score);
    }
  });
});

describe("prefill helpers", () => {
  it("uses the initiative's primary goal category so new actions rejoin it", () => {
    expect(initiativePrimaryGoalCategory(def)).toBe("Summer Camps");
    const href = buildInitiativeActionPrefill(def, { title: "Book venue" });
    expect(href).toContain("/actions/new");
    // URLSearchParams encodes spaces as "+"; normalize before asserting.
    expect(decodeURIComponent(href.replace(/\+/g, " "))).toContain("Summer Camps");
  });
});

import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({ prisma: {} }));
vi.mock("@/lib/feature-flags", () => ({ isActionTrackerEnabled: () => true }));

import {
  charterHasContent,
  getInitiativeProfile,
  knowledgeHasContent,
} from "@/lib/people-strategy/strategic-initiative-profile";
import {
  getWorkstreamDef,
  listInitiativeDefs,
  listWorkstreamDefs,
} from "@/lib/people-strategy/strategic-initiatives";

describe("getInitiativeProfile", () => {
  it("returns a fully-defaulted profile for an unknown initiative", () => {
    const p = getInitiativeProfile("does-not-exist");
    expect(p.charter.mission).toBeNull();
    expect(p.charter.targetOutcomes).toEqual([]);
    expect(p.scenarios).toEqual([]);
    expect(p.dependencies).toEqual([]);
    expect(charterHasContent(p.charter)).toBe(false);
    expect(knowledgeHasContent(p.knowledge)).toBe(false);
  });

  it("returns the authored charter, scenarios, and dependencies for the flagship", () => {
    const p = getInitiativeProfile("summer-camps-2026");
    expect(p.charter.mission).toBeTruthy();
    expect(charterHasContent(p.charter)).toBe(true);
    expect(knowledgeHasContent(p.knowledge)).toBe(true);
    // best / expected / risk / stretch
    expect(p.scenarios.map((s) => s.kind).sort()).toEqual(["best", "expected", "risk", "stretch"]);
    expect(p.dependencies.length).toBeGreaterThanOrEqual(2);
  });
});

describe("workstream registry integrity", () => {
  it("the flagship declares seven ordered workstreams", () => {
    const ws = listWorkstreamDefs("summer-camps-2026");
    expect(ws).toHaveLength(7);
    const orders = ws.map((w) => w.order);
    expect([...orders].sort((a, b) => a - b)).toEqual(orders); // already sorted
    expect(getWorkstreamDef("summer-camps-2026", "partnership-development")).not.toBeNull();
  });

  it("every milestone workstreamId references a real workstream", () => {
    for (const def of listInitiativeDefs()) {
      const wsIds = new Set((def.workstreams ?? []).map((w) => w.id));
      for (const m of def.milestones) {
        if (m.workstreamId) {
          expect(wsIds.has(m.workstreamId)).toBe(true);
        }
      }
    }
  });

  it("relatedInitiatives reference real initiative ids", () => {
    const ids = new Set(listInitiativeDefs().map((d) => d.id));
    for (const def of listInitiativeDefs()) {
      for (const rel of def.relatedInitiatives ?? []) {
        expect(ids.has(rel)).toBe(true);
      }
    }
  });
});

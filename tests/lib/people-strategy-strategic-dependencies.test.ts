import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({ prisma: {} }));
vi.mock("@/lib/feature-flags", () => ({ isActionTrackerEnabled: () => true }));

import {
  deriveDependencyGraph,
  selectInitiativeDependencies,
  type DependencyInitiativeInput,
} from "@/lib/people-strategy/strategic-dependencies";
import type { InitiativeDependencyDef } from "@/lib/people-strategy/strategic-initiative-profile";

function node(id: string, overrides: Partial<DependencyInitiativeInput> = {}): DependencyInitiativeInput {
  return {
    id,
    title: id,
    healthLevel: "healthy",
    healthLabel: "Healthy",
    healthTone: "success",
    progressPercent: 50,
    status: "active",
    ...overrides,
  };
}

describe("deriveDependencyGraph", () => {
  it("normalizes a depends_on into an enabling edge and records blocked-by / unlocks", () => {
    const deps: Record<string, InitiativeDependencyDef[]> = {
      camps: [{ type: "depends_on", targetInitiativeId: "partners", reason: "needs sites" }],
      partners: [],
    };
    const graph = deriveDependencyGraph({
      initiatives: [node("camps"), node("partners", { healthLevel: "at_risk", healthLabel: "At risk", healthTone: "warning" })],
      getDependencies: (id) => deps[id] ?? [],
    });

    const edge = graph.edges.find((e) => e.fromId === "partners" && e.toId === "camps");
    expect(edge).toBeTruthy();
    expect(edge?.blocking).toBe(true); // upstream partners is unhealthy

    const view = selectInitiativeDependencies(graph, "camps");
    expect(view.blockedBy.map((e) => e.fromId)).toEqual(["partners"]);
    expect(view.atRisk).toBe(true);

    const partnersView = selectInitiativeDependencies(graph, "partners");
    expect(partnersView.unlocks.map((e) => e.toId)).toEqual(["camps"]);
  });

  it("normalizes a blocks into the opposite direction", () => {
    const deps: Record<string, InitiativeDependencyDef[]> = {
      training: [{ type: "blocks", targetInitiativeId: "recruiting" }],
    };
    const graph = deriveDependencyGraph({
      initiatives: [node("training"), node("recruiting")],
      getDependencies: (id) => deps[id] ?? [],
    });
    expect(graph.edges.some((e) => e.fromId === "training" && e.toId === "recruiting")).toBe(true);
  });

  it("computes the critical path through the enabling chain", () => {
    const deps: Record<string, InitiativeDependencyDef[]> = {
      b: [{ type: "depends_on", targetInitiativeId: "a" }],
      c: [{ type: "depends_on", targetInitiativeId: "b" }],
    };
    const graph = deriveDependencyGraph({
      initiatives: [node("a"), node("b"), node("c")],
      getDependencies: (id) => deps[id] ?? [],
    });
    expect(graph.criticalPath).toEqual(["a", "b", "c"]);
  });

  it("keeps relates_to out of the enabling DAG", () => {
    const deps: Record<string, InitiativeDependencyDef[]> = {
      a: [{ type: "relates_to", targetInitiativeId: "b" }],
    };
    const graph = deriveDependencyGraph({
      initiatives: [node("a"), node("b")],
      getDependencies: (id) => deps[id] ?? [],
    });
    expect(graph.edges).toHaveLength(0);
    expect(graph.relations).toHaveLength(1);
  });
});

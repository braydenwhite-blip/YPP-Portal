import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({ prisma: {} }));
vi.mock("@/lib/feature-flags", () => ({ isActionTrackerEnabled: () => true }));

import {
  deriveScenarioBoard,
  scenarioReadiness,
  type ScenarioContext,
} from "@/lib/people-strategy/strategic-scenarios";
import type { InitiativeScenarioDef } from "@/lib/people-strategy/strategic-initiative-profile";

const expected = (overrides: Partial<InitiativeScenarioDef> = {}): InitiativeScenarioDef => ({
  kind: "expected",
  headline: "4 camps",
  requirements: ["4 sites"],
  blockers: [],
  unlockingDecisions: [],
  ...overrides,
});

const ctx = (overrides: Partial<ScenarioContext> = {}): ScenarioContext => ({
  healthLevel: "healthy",
  momentumLevel: "steady",
  riskLevel: "low",
  progressPercent: 50,
  ...overrides,
});

describe("scenarioReadiness", () => {
  it("reads the base plan from current health", () => {
    expect(scenarioReadiness(expected(), ctx({ healthLevel: "healthy" })).readiness).toBe("on_track");
    expect(scenarioReadiness(expected(), ctx({ healthLevel: "drifting" })).readiness).toBe("within_reach");
    expect(scenarioReadiness(expected(), ctx({ healthLevel: "at_risk" })).readiness).toBe("at_risk");
  });

  it("only calls an upside scenario within reach when the path is clear", () => {
    const stretch = expected({ kind: "stretch", headline: "8 camps", blockers: [] });
    expect(scenarioReadiness(stretch, ctx({ momentumLevel: "accelerating", healthLevel: "healthy" })).readiness).toBe("within_reach");
    const blocked = expected({ kind: "stretch", headline: "8 camps", blockers: ["thin pipeline"] });
    expect(scenarioReadiness(blocked, ctx()).readiness).toBe("aspirational");
  });

  it("treats the risk case as a downside to avoid", () => {
    const risk = expected({ kind: "risk", headline: "2 camps" });
    expect(scenarioReadiness(risk, ctx({ riskLevel: "high" })).readiness).toBe("at_risk");
    expect(scenarioReadiness(risk, ctx({ riskLevel: "low" })).readiness).toBe("avoiding");
  });
});

describe("deriveScenarioBoard", () => {
  it("orders best → expected → stretch → risk and surfaces the expected case", () => {
    const board = deriveScenarioBoard(
      [
        expected({ kind: "risk", headline: "2" }),
        expected({ kind: "best", headline: "12" }),
        expected({ kind: "expected", headline: "4" }),
        expected({ kind: "stretch", headline: "8" }),
      ],
      ctx()
    );
    expect(board.scenarios.map((s) => s.kind)).toEqual(["best", "expected", "stretch", "risk"]);
    expect(board.expected?.headline).toBe("4");
    expect(board.hasScenarios).toBe(true);
  });

  it("is empty + safe with no scenarios", () => {
    const board = deriveScenarioBoard([], ctx());
    expect(board.hasScenarios).toBe(false);
    expect(board.expected).toBeNull();
  });
});

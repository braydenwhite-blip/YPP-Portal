import { describe, expect, it } from "vitest";

import type { InitiativeHealthLevel } from "@/lib/people-strategy/strategic-initiative-health";
import {
  groupInitiativesByHealth,
  groupInitiativesByOwner,
  summarizeInitiativeAreas,
  summarizeInitiativeHealth,
} from "@/lib/people-strategy/initiatives-hub-grouping";

const h = (level: InitiativeHealthLevel) => ({ health: { level } });

describe("summarizeInitiativeHealth", () => {
  it("counts by level with a total", () => {
    const b = summarizeInitiativeHealth([h("healthy"), h("healthy"), h("critical")]);
    expect(b.total).toBe(3);
    expect(b.counts.healthy).toBe(2);
    expect(b.counts.critical).toBe(1);
    expect(b.counts.drifting).toBe(0);
  });
});

describe("summarizeInitiativeAreas", () => {
  it("totals per area, biggest first", () => {
    const bars = summarizeInitiativeAreas([
      { areaLabel: "Classes" },
      { areaLabel: "Classes" },
      { areaLabel: "Partnerships" },
    ]);
    expect(bars).toEqual([
      { label: "Classes", total: 2 },
      { label: "Partnerships", total: 1 },
    ]);
  });
});

describe("groupInitiativesByHealth", () => {
  it("orders groups worst-first and drops empty levels", () => {
    const groups = groupInitiativesByHealth([h("healthy"), h("critical"), h("drifting")]);
    expect(groups.map((g) => g.level)).toEqual(["critical", "drifting", "healthy"]);
    expect(groups[0].items).toHaveLength(1);
  });
});

describe("groupInitiativesByOwner", () => {
  it("groups alphabetically with Unassigned last", () => {
    const groups = groupInitiativesByOwner([
      { owner: "Sam" },
      { owner: null },
      { owner: "Ada" },
      { owner: "Sam" },
    ]);
    expect(groups.map((g) => g.owner)).toEqual(["Ada", "Sam", "Unassigned"]);
    expect(groups.find((g) => g.owner === "Sam")?.items).toHaveLength(2);
  });
});

import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({ prisma: {} }));
vi.mock("@/lib/feature-flags", () => ({ isActionTrackerEnabled: () => true }));

import { deriveStrategicEntityContext } from "@/lib/people-strategy/strategic-entity-context";

import { action, NOW } from "./strategic-helpers";

describe("deriveStrategicEntityContext", () => {
  it("ladders an entity's camp work up to the initiative and project", () => {
    const ctx = deriveStrategicEntityContext({
      actions: [
        action({ id: "a1", title: "Sign the Beth El pilot camp agreement", goalCategory: "Summer Camps" }),
      ],
      meetings: [],
      now: NOW,
    });
    expect(ctx.isStrategic).toBe(true);
    expect(ctx.initiatives.some((i) => i.id === "summer-camps-2026")).toBe(true);
    expect(ctx.projects.some((p) => p.id === "beth-el-pilot")).toBe(true);
  });

  it("reports not strategic for unrelated work", () => {
    const ctx = deriveStrategicEntityContext({
      actions: [action({ id: "a1", title: "Order more pencils for the supply closet" })],
      now: NOW,
    });
    expect(ctx.isStrategic).toBe(false);
    expect(ctx.projects).toEqual([]);
  });

  it("builds a timeline and open-action count from the entity's own work", () => {
    const ctx = deriveStrategicEntityContext({
      actions: [
        action({ id: "a1", title: "Beth El camp supplies", status: "IN_PROGRESS", deadlineStart: new Date("2026-05-20") }),
        action({ id: "a2", title: "Beth El camp recap", status: "COMPLETE", completedAt: new Date("2026-06-02") }),
      ],
      now: NOW,
    });
    expect(ctx.timeline.counts.total).toBeGreaterThan(0);
    expect(ctx.openActionCount).toBe(1);
  });

  it("dedupes initiatives and projects across many actions", () => {
    const ctx = deriveStrategicEntityContext({
      actions: [
        action({ id: "a1", title: "Beth El camp agreement", goalCategory: "Summer Camps" }),
        action({ id: "a2", title: "Beth El camp logistics", goalCategory: "Summer Camps" }),
      ],
      now: NOW,
    });
    const ids = ctx.initiatives.map((i) => i.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

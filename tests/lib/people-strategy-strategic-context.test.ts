import { describe, expect, it } from "vitest";

import {
  deriveStrategicContext,
  deriveStrategicContextForAction,
} from "@/lib/people-strategy/strategic-context";

describe("deriveStrategicContextForAction", () => {
  it("ladders a camp action up to Summer Camps and the Beth El Pilot project", () => {
    const ctx = deriveStrategicContextForAction({
      title: "Sign the Beth El pilot camp agreement",
      goalCategory: "Summer Camps",
    });
    expect(ctx.isStrategic).toBe(true);
    expect(ctx.initiatives.some((i) => i.id === "summer-camps-2026")).toBe(true);
    expect(ctx.projects.some((p) => p.id === "beth-el-pilot")).toBe(true);
    expect(ctx.primaryInitiative?.id).toBe("summer-camps-2026");
  });

  it("matches an initiative without a project when no project keyword fires", () => {
    const ctx = deriveStrategicContextForAction({
      title: "General summer camp logistics review",
      goalCategory: "Summer Camps",
    });
    expect(ctx.initiatives.some((i) => i.id === "summer-camps-2026")).toBe(true);
    // "logistics review" doesn't contain a Beth El / Mohawk keyword.
    expect(ctx.projects.some((p) => p.id === "beth-el-pilot")).toBe(false);
  });

  it("returns a non-strategic context for unrelated work", () => {
    const ctx = deriveStrategicContext({
      text: "buy office snacks for the break room",
      area: null,
      actionType: null,
      entityType: null,
      entityId: null,
      goalCategory: null,
    });
    expect(ctx.isStrategic).toBe(false);
    expect(ctx.primaryInitiative).toBeNull();
    expect(ctx.projects).toEqual([]);
  });

  it("surfaces the match reason for explainability", () => {
    // goalCategory laddders it to the initiative (the gate); the title keyword then
    // reaches the Mohawk project — mirroring classifyInitiativeWork → classifyProjectWork.
    const ctx = deriveStrategicContextForAction({
      title: "Mohawk expansion site scouting",
      goalCategory: "Summer Camps",
    });
    const summer = ctx.initiatives.find((i) => i.id === "summer-camps-2026");
    expect(summer?.reasons.length ?? 0).toBeGreaterThan(0);
    expect(ctx.projects.some((p) => p.id === "mohawk-expansion")).toBe(true);
  });

  it("does not reach a project when the initiative gate doesn't fire", () => {
    // No camp keyword and no goalCategory → not in the initiative pool, so no project.
    const ctx = deriveStrategicContextForAction({ title: "Mohawk expansion site scouting" });
    expect(ctx.projects.some((p) => p.id === "mohawk-expansion")).toBe(false);
  });
});

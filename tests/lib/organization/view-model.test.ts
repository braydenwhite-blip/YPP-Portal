import { describe, it, expect } from "vitest";
import { buildOrganizationGraph, toGraphViewModel } from "@/lib/organization";
import { richInput, NOW } from "./fixtures";

describe("toGraphViewModel", () => {
  it("produces a fully serializable payload (no Maps, no Dates)", () => {
    const vm = toGraphViewModel(buildOrganizationGraph(richInput()), NOW);
    // A structuredClone-able / JSON-round-trippable payload proves it's safe to
    // hand from a server component to a client component.
    expect(() => JSON.parse(JSON.stringify(vm))).not.toThrow();
    const round = JSON.parse(JSON.stringify(vm));
    expect(round).toEqual(vm);
  });

  it("includes a summary for every node and stable counts", () => {
    const g = buildOrganizationGraph(richInput());
    const vm = toGraphViewModel(g, NOW);
    expect(Object.keys(vm.summaries)).toHaveLength(g.nodes.length);
    expect(vm.counts.class).toBe(4);
    expect(vm.counts.partner).toBe(2);
  });

  it("focuses the worst-health, non-chapter node first", () => {
    const vm = toGraphViewModel(buildOrganizationGraph(richInput()), NOW);
    const focus = vm.summaries[vm.focusId];
    expect(focus.node.kind).not.toBe("chapter");
    // p2 (open issue) / cl3 (critical blocker) are the unhealthy ones.
    expect(["danger", "warning"]).toContain(focus.node.tone);
  });

  it("formats timeline timestamps as human strings", () => {
    const vm = toGraphViewModel(buildOrganizationGraph(richInput()), NOW);
    const cl1 = vm.summaries["class:cl1"];
    const ev = cl1.timeline.find((e) => e.id === "ev-class-cl1");
    expect(ev?.when).toMatch(/ago|yesterday|just now|[A-Z][a-z]{2} \d+/);
  });

  it("is deterministic", () => {
    const a = toGraphViewModel(buildOrganizationGraph(richInput()), NOW);
    const b = toGraphViewModel(buildOrganizationGraph(richInput()), NOW);
    expect(a).toEqual(b);
  });
});

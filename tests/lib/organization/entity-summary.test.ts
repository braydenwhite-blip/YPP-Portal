import { describe, it, expect } from "vitest";
import { buildOrganizationGraph, summarizeEntity, summarizeAll } from "@/lib/organization";
import { richInput } from "./fixtures";

describe("summarizeEntity", () => {
  it("returns null for a node that doesn't exist", () => {
    const g = buildOrganizationGraph(richInput());
    expect(summarizeEntity(g, "partner:nope")).toBeNull();
  });

  it("answers where am I / what I depend on / what I enable for a class", () => {
    const g = buildOrganizationGraph(richInput());
    const s = summarizeEntity(g, "class:cl1")!;
    expect(s.purpose.length).toBeGreaterThan(0);
    expect(s.dependsOn.map((n) => n.id).sort()).toEqual(["curriculum:cur1", "instructor:i1", "partner:p1"]);
    expect(s.enables.map((n) => n.id)).toEqual(["student:s2"]);
    expect(s.health.label).toBe("Healthy");
  });

  it("rolls up a partner's connected reach (classes, students, instructors)", () => {
    const g = buildOrganizationGraph(richInput());
    const s = summarizeEntity(g, "partner:p1")!;
    const reach = Object.fromEntries(s.rollup.map((m) => [m.label, m.value]));
    expect(reach).toEqual({ Classes: 3, Students: 2, Instructors: 2 });
    expect(s.parents.map((n) => n.id)).toEqual(["chapter:ch1"]);
  });

  it("surfaces what a node blocks and what it would unblock", () => {
    const g = buildOrganizationGraph(richInput());
    const cur2 = summarizeEntity(g, "curriculum:cur2")!;
    expect(cur2.blockedBy.length).toBeGreaterThan(0); // it's stuck (unsubmitted)
    expect(cur2.unblocks.map((n) => n.id)).toContain("class:cl2");
  });

  it("includes recent changes and recommendations", () => {
    const g = buildOrganizationGraph(richInput());
    const cl1 = summarizeEntity(g, "class:cl1")!;
    expect(cl1.timeline.some((e) => e.id === "ev-class-cl1")).toBe(true);
    const cl3 = summarizeEntity(g, "class:cl3")!;
    expect(cl3.recommendations.length).toBeGreaterThan(0);
  });
});

describe("summarizeAll", () => {
  it("produces a summary for every node", () => {
    const g = buildOrganizationGraph(richInput());
    expect(summarizeAll(g)).toHaveLength(g.nodes.length);
  });
});

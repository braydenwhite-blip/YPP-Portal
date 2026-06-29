import { describe, it, expect } from "vitest";
import { buildOrganizationGraph, timelineForNode, mergeEvents, groupByKind, recentChanges } from "@/lib/organization";
import { richInput, event } from "./fixtures";

describe("timeline projection (one feed, every entity consumes it)", () => {
  it("sorts the whole feed newest-first", () => {
    const g = buildOrganizationGraph(richInput());
    const times = g.events.map((e) => e.occurredAt.getTime());
    expect(times).toEqual([...times].sort((a, b) => b - a));
  });

  it("projects a class event onto the class's instructor, partner, curriculum and chapter", () => {
    const g = buildOrganizationGraph(richInput());
    for (const id of ["class:cl1", "instructor:i1", "partner:p1", "curriculum:cur1", "chapter:ch1"]) {
      expect(timelineForNode(g, id).some((e) => e.id === "ev-class-cl1")).toBe(true);
    }
  });

  it("does not project a class event onto an unrelated partner", () => {
    const g = buildOrganizationGraph(richInput());
    // cl1 is at p1, not p2.
    expect(timelineForNode(g, "partner:p2").some((e) => e.id === "ev-class-cl1")).toBe(false);
  });

  it("orders a node's timeline newest-first and respects the limit", () => {
    const g = buildOrganizationGraph(richInput());
    const chapterFeed = timelineForNode(g, "chapter:ch1");
    expect(chapterFeed.map((e) => e.id)).toEqual(["ev-class-cl1", "ev-curriculum-cur1", "ev-enroll"]);
    expect(recentChanges(g, "chapter:ch1", 1)).toHaveLength(1);
  });
});

describe("mergeEvents / groupByKind", () => {
  it("merges, dedupes by id, and sorts newest-first", () => {
    const a = [event("x", [], { occurredAt: new Date("2026-01-01") })];
    const b = [
      event("x", [], { occurredAt: new Date("2026-01-01") }), // dup id
      event("y", [], { occurredAt: new Date("2026-02-01") }),
    ];
    const merged = mergeEvents(a, b);
    expect(merged.map((e) => e.id)).toEqual(["y", "x"]);
  });

  it("groups events by kind", () => {
    const grouped = groupByKind([
      event("a", [], { kind: "attendance" }),
      event("b", [], { kind: "feedback" }),
      event("c", [], { kind: "attendance" }),
    ]);
    expect(grouped.attendance).toHaveLength(2);
    expect(grouped.feedback).toHaveLength(1);
  });
});

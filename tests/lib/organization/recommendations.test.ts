import { describe, it, expect } from "vitest";
import { buildOrganizationGraph, recommendForNode, recommendAcrossChapter } from "@/lib/organization";
import { buildInput, klass, partner, curriculum, person, richInput } from "./fixtures";

function withClasses(classes: ReturnType<typeof klass>[], extra = {}) {
  return buildOrganizationGraph(
    buildInput({
      partners: [partner("p1")],
      curricula: [curriculum("cur1")],
      instructors: [person("i1"), person("i2")],
      classes,
      ...extra,
    })
  );
}

describe("recommendForNode — always evidence-backed and deterministic", () => {
  it("never returns a recommendation without evidence", () => {
    const g = buildOrganizationGraph(richInput());
    for (const node of g.nodes) {
      for (const rec of recommendForNode(g, node.id)) {
        expect(rec.evidence.length).toBeGreaterThan(0);
      }
    }
  });

  it("is deterministic", () => {
    const g = buildOrganizationGraph(richInput());
    expect(recommendForNode(g, "partner:p1")).toEqual(recommendForNode(g, "partner:p1"));
  });
});

describe("partner recommendations", () => {
  it("recommends expansion when every class at a partner is healthy", () => {
    const g = withClasses([
      klass("cl1", { partnerId: "p1", curriculumId: "cur1", instructorId: "i1", health: "healthy" }),
      klass("cl2", { partnerId: "p1", curriculumId: "cur1", instructorId: "i1", health: "healthy" }),
    ]);
    const recs = recommendForNode(g, "partner:p1");
    expect(recs.some((r) => r.kind === "expansion" && r.key === "partner-expand")).toBe(true);
  });

  it("does not recommend expansion when a class is unhealthy", () => {
    const g = buildOrganizationGraph(richInput()); // p1 has a draft class
    expect(recommendForNode(g, "partner:p1").some((r) => r.key === "partner-expand")).toBe(false);
  });
});

describe("curriculum recommendations", () => {
  it("recommends approval to unblock dependent classes", () => {
    const g = buildOrganizationGraph(richInput());
    const rec = recommendForNode(g, "curriculum:cur2").find((r) => r.key === "curriculum-approve");
    expect(rec).toBeTruthy();
    expect(rec!.kind).toBe("next_step");
  });

  it("recognizes a succeeding curriculum", () => {
    const g = withClasses([klass("cl1", { partnerId: "p1", curriculumId: "cur1", instructorId: "i1", health: "healthy" })]);
    expect(recommendForNode(g, "curriculum:cur1").some((r) => r.key === "curriculum-reuse")).toBe(true);
  });
});

describe("instructor recommendations", () => {
  it("flags a heavy teaching load", () => {
    const g = withClasses(
      ["a", "b", "c", "d"].map((s) =>
        klass(`cl${s}`, { partnerId: "p1", curriculumId: "cur1", instructorId: "i1", health: "healthy" })
      )
    );
    expect(recommendForNode(g, "instructor:i1").some((r) => r.key === "instructor-load")).toBe(true);
  });

  it("offers a lightly-loaded instructor an unstaffed class", () => {
    const g = buildOrganizationGraph(richInput()); // i2 teaches 1 class; cl3 is unstaffed
    const rec = recommendForNode(g, "instructor:i2").find((r) => r.key === "instructor-available");
    expect(rec).toBeTruthy();
    expect(rec!.relatedNodeId).toBe("class:cl3");
  });
});

describe("class & student recommendations", () => {
  it("gives a blocked class a concrete next step", () => {
    const g = buildOrganizationGraph(richInput());
    const rec = recommendForNode(g, "class:cl3").find((r) => r.kind === "next_step");
    expect(rec).toBeTruthy();
  });

  it("marks a healthy completed class as a renewal candidate", () => {
    const g = buildOrganizationGraph(richInput());
    expect(recommendForNode(g, "class:cl4").some((r) => r.key === "class-renew")).toBe(true);
  });

  it("recommends a next class to a student who finished one", () => {
    const g = buildOrganizationGraph(richInput());
    const rec = recommendForNode(g, "student:s1").find((r) => r.key === "student-next");
    expect(rec).toBeTruthy();
    expect(rec!.relatedNodeId).toBe("class:cl1");
  });
});

describe("recommendAcrossChapter", () => {
  it("returns the top recommendation per node, interventions first", () => {
    const g = buildOrganizationGraph(richInput());
    const all = recommendAcrossChapter(g);
    expect(all.length).toBeGreaterThan(0);
    // sorted by kind rank — the first item's kind ranks <= the last item's kind.
    const rank = { intervention: 0, retention: 1, next_step: 2, assignment: 3, expansion: 4, recognition: 5 } as const;
    const kinds = all.map((a) => rank[a.recommendation.kind]);
    expect(kinds).toEqual([...kinds].sort((a, b) => a - b));
  });
});

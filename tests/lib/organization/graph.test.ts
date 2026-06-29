import { describe, it, expect } from "vitest";
import {
  buildOrganizationGraph,
  parentsOf,
  childrenOf,
  ancestorsOf,
  descendantsOf,
  getNode,
} from "@/lib/organization";
import { buildInput, klass, partner, person, curriculum, enrollment, richInput } from "./fixtures";

describe("buildOrganizationGraph — structure", () => {
  it("creates one node per entity with stable `${kind}:${id}` ids", () => {
    const g = buildOrganizationGraph(richInput());
    const ids = g.nodes.map((n) => n.id);
    // chapter + 2 partners + 2 curricula + 2 instructors + 3 students + 1 family + 4 classes
    expect(g.nodes).toHaveLength(1 + 2 + 2 + 2 + 3 + 1 + 4);
    expect(new Set(ids).size).toBe(ids.length); // no duplicate nodes
    expect(getNode(g, "partner:p1")).toBeTruthy();
    expect(getNode(g, "class:cl1")).toBeTruthy();
  });

  it("never creates duplicate nodes even with duplicate inputs", () => {
    const g = buildOrganizationGraph(buildInput({ partners: [partner("p1"), partner("p1", { name: "Dup" })] }));
    expect(g.nodes.filter((n) => n.id === "partner:p1")).toHaveLength(1);
    // First write wins.
    expect(getNode(g, "partner:p1")?.label).toBe("Partner p1");
  });

  it("wires edges in the ENABLES direction", () => {
    const g = buildOrganizationGraph(richInput());
    // class parents are its enablers: partner + curriculum + instructor.
    expect(parentsOf(g, "class:cl1").map((n) => n.id).sort()).toEqual([
      "curriculum:cur1",
      "instructor:i1",
      "partner:p1",
    ]);
    // a partner enables (is parent of) its classes.
    expect(childrenOf(g, "partner:p1").map((n) => n.id).sort()).toEqual(["class:cl1", "class:cl2", "class:cl4"]);
    // chapter hosts everything one level down.
    expect(childrenOf(g, "chapter:ch1").every((n) => n.kind !== "class")).toBe(true);
  });

  it("excludes dropped enrollments from ENROLLS edges", () => {
    const g = buildOrganizationGraph(richInput());
    const served = childrenOf(g, "class:cl1").filter((n) => n.kind === "student");
    // s2 is enrolled, s3 dropped → only s2 is served.
    expect(served.map((n) => n.id)).toEqual(["student:s2"]);
  });

  it("only connects edges between nodes that exist", () => {
    const g = buildOrganizationGraph(
      buildInput({ classes: [klass("cl1", { partnerId: "ghost", curriculumId: null, instructorId: null })] })
    );
    expect(parentsOf(g, "class:cl1").filter((n) => n.kind === "partner")).toHaveLength(0);
  });

  it("dedupes edges", () => {
    const g = buildOrganizationGraph(
      buildInput({
        students: [person("s1")],
        classes: [klass("cl1")],
        enrollments: [enrollment("e1", "s1", "cl1"), enrollment("e2", "s1", "cl1")],
      })
    );
    expect(g.edges.filter((e) => e.kind === "ENROLLS")).toHaveLength(1);
  });

  it("links families to students", () => {
    const g = buildOrganizationGraph(richInput());
    expect(childrenOf(g, "family:f1").map((n) => n.id)).toEqual(["student:s1"]);
  });

  it("walks ancestors up to the chapter root", () => {
    const g = buildOrganizationGraph(richInput());
    const anc = ancestorsOf(g, "class:cl1").map((n) => n.id);
    expect(anc).toContain("chapter:ch1");
    expect(anc).toContain("partner:p1");
    expect(anc).toContain("curriculum:cur1");
    expect(anc).toContain("instructor:i1");
  });

  it("walks descendants down to students", () => {
    const g = buildOrganizationGraph(richInput());
    expect(descendantsOf(g, "chapter:ch1").some((n) => n.id === "student:s2")).toBe(true);
  });
});

describe("buildOrganizationGraph — rollups", () => {
  it("rolls connected-count metrics onto a partner", () => {
    const g = buildOrganizationGraph(richInput());
    const p1 = getNode(g, "partner:p1")!;
    expect(p1.metrics.find((m) => m.label === "Classes")?.value).toBe(3);
    // cl1←s2, cl4←s1 (cl2 has none) → 2 distinct students.
    expect(p1.metrics.find((m) => m.label === "Students")?.value).toBe(2);
  });

  it("reads a student's health from the classes they're in", () => {
    const g = buildOrganizationGraph(richInput());
    expect(getNode(g, "student:s1")!.health.tone).toBe("success");
    // s3 only had a dropped enrollment → no active classes.
    expect(getNode(g, "student:s3")!.health.label).toBe("Not Enrolled");
  });

  it("maps a class's runtime health bucket onto node health", () => {
    const g = buildOrganizationGraph(richInput());
    expect(getNode(g, "class:cl1")!.health.label).toBe("Healthy");
  });
});

describe("buildOrganizationGraph — determinism", () => {
  it("produces identical output for identical input", () => {
    const a = buildOrganizationGraph(richInput());
    const b = buildOrganizationGraph(richInput());
    expect(a.nodes).toEqual(b.nodes);
    expect(a.edges).toEqual(b.edges);
    expect([...a.dependencies.entries()]).toEqual([...b.dependencies.entries()]);
    expect(a.events).toEqual(b.events);
  });

  it("sorts nodes and edges by a stable key", () => {
    const g = buildOrganizationGraph(richInput());
    const edgeIds = g.edges.map((e) => e.id);
    expect(edgeIds).toEqual([...edgeIds].sort());
  });
});

import { describe, it, expect } from "vitest";
import {
  buildOrganizationGraph,
  classDependencies,
  partnerDependencies,
  curriculumDependencies,
  blockedByOf,
  unblocksOf,
} from "@/lib/organization";
import { klass, partner, curriculum, richInput } from "./fixtures";

describe("classDependencies", () => {
  it("marks a fully-ready class as having no blocking dependencies", () => {
    expect(blockedByOf(classDependencies(klass("cl1")))).toHaveLength(0);
  });

  it("flags a missing instructor as blocking", () => {
    const deps = classDependencies(klass("cl3", { hasInstructor: false, isLive: false }));
    expect(blockedByOf(deps).some((d) => d.key === "instructor")).toBe(true);
  });

  it("flags an unsubmitted curriculum as blocking and points at the curriculum node", () => {
    const deps = classDependencies(
      klass("cl2", { curriculumApproved: false, curriculumSubmitted: false, curriculumId: "cur2", isLive: false })
    );
    const dep = deps.find((d) => d.key === "curriculum")!;
    expect(dep.state).toBe("blocked");
    expect(dep.blocking).toBe(true);
    expect(dep.nodeId).toBe("curriculum:cur2");
  });

  it("does not treat a submitted-but-not-approved curriculum on a live class as blocked", () => {
    const deps = classDependencies(klass("cl1", { curriculumApproved: false, curriculumSubmitted: true, isLive: true }));
    expect(blockedByOf(deps).some((d) => d.key === "curriculum")).toBe(false);
  });
});

describe("partnerDependencies / curriculumDependencies", () => {
  it("surfaces open issues as a blocking partner dependency", () => {
    const deps = partnerDependencies(partner("p2", { confirmed: false, openIssues: 2 }));
    expect(blockedByOf(deps).some((d) => d.key === "open-issues")).toBe(true);
  });

  it("treats an unapproved curriculum as blocking its classes", () => {
    const deps = curriculumDependencies(curriculum("cur2", { approved: false, submitted: false }));
    expect(deps[0].blocking).toBe(true);
    expect(curriculumDependencies(curriculum("cur1", { approved: true }))).toHaveLength(0);
  });
});

describe("blocker folding", () => {
  it("attaches an entity blocker to its matching node", () => {
    const g = buildOrganizationGraph(richInput());
    const p2 = g.dependencies.get("partner:p2") ?? [];
    expect(p2.some((d) => d.key === "blocker:partner-issue:p2")).toBe(true);
  });

  it("attaches an unmappable blocker (instructor application) to the chapter", () => {
    const g = buildOrganizationGraph(richInput());
    const chapter = g.dependencies.get("chapter:ch1") ?? [];
    expect(chapter.some((d) => d.key === "blocker:applicant-decision:a1")).toBe(true);
  });

  it("a class with both an own gap and a folded blocker reports both", () => {
    const g = buildOrganizationGraph(richInput());
    const cl3 = g.dependencies.get("class:cl3") ?? [];
    const blocked = blockedByOf(cl3);
    expect(blocked.some((d) => d.key === "instructor")).toBe(true);
    expect(blocked.some((d) => d.key === "blocker:class-setup:cl3")).toBe(true);
  });
});

describe("unblocks (cascade)", () => {
  it("an unapproved curriculum unblocks the classes that depend on it", () => {
    const g = buildOrganizationGraph(richInput());
    // cur2 is unsubmitted; cl2 depends on it and is therefore blocked.
    expect(unblocksOf(g, "curriculum:cur2").map((n) => n.id)).toContain("class:cl2");
  });

  it("an approved curriculum unblocks nothing", () => {
    const g = buildOrganizationGraph(richInput());
    expect(unblocksOf(g, "curriculum:cur1")).toHaveLength(0);
  });

  it("blocking is sorted to the top of a node's dependency list", () => {
    const g = buildOrganizationGraph(richInput());
    const cl3 = g.dependencies.get("class:cl3") ?? [];
    expect(cl3[0].blocking && cl3[0].state === "blocked").toBe(true);
  });
});

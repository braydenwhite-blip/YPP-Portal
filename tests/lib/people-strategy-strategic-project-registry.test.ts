import { describe, expect, it } from "vitest";

import { getInitiativeDef } from "@/lib/people-strategy/strategic-initiatives";
import {
  countProjectsByInitiative,
  getParentInitiative,
  getProjectDef,
  listProjectDefs,
  listProjectsForInitiative,
  listProjectsForWorkstream,
  projectConfigIsValid,
  projectHref,
} from "@/lib/people-strategy/strategic-project-registry";

describe("strategic project registry", () => {
  it("every project references a real initiative and real workstreams", () => {
    for (const project of listProjectDefs()) {
      expect(projectConfigIsValid(project), `${project.id} config`).toBe(true);
      const init = getParentInitiative(project);
      expect(init, `${project.id} parent`).not.toBeNull();
    }
  });

  it("project ids are unique", () => {
    const ids = listProjectDefs().map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("getProjectDef resolves by id and returns null for unknown", () => {
    const first = listProjectDefs()[0];
    expect(getProjectDef(first.id)?.id).toBe(first.id);
    expect(getProjectDef("nope-not-real")).toBeNull();
  });

  it("listProjectsForInitiative returns only that initiative's projects", () => {
    const projects = listProjectsForInitiative("summer-camps-2026");
    expect(projects.length).toBeGreaterThan(0);
    expect(projects.every((p) => p.initiativeId === "summer-camps-2026")).toBe(true);
  });

  it("listProjectsForWorkstream filters by declared workstream membership", () => {
    const init = getInitiativeDef("summer-camps-2026");
    expect(init).not.toBeNull();
    const ws = init!.workstreams![0].id;
    const projects = listProjectsForWorkstream("summer-camps-2026", ws);
    expect(projects.every((p) => (p.workstreamIds ?? []).includes(ws))).toBe(true);
  });

  it("projectConfigIsValid rejects a bad initiative or workstream", () => {
    expect(
      projectConfigIsValid({
        id: "x",
        title: "X",
        initiativeId: "does-not-exist",
        status: "active",
        priority: "low",
        summary: "",
        charter: {
          purpose: "",
          whyItMatters: "",
          targetOutcome: "",
          successCriteria: [],
          inScope: [],
          outOfScope: [],
          assumptions: [],
          risks: [],
        },
        match: {},
      })
    ).toBe(false);

    expect(
      projectConfigIsValid({
        id: "x",
        title: "X",
        initiativeId: "summer-camps-2026",
        workstreamIds: ["not-a-real-workstream"],
        status: "active",
        priority: "low",
        summary: "",
        charter: {
          purpose: "",
          whyItMatters: "",
          targetOutcome: "",
          successCriteria: [],
          inScope: [],
          outOfScope: [],
          assumptions: [],
          risks: [],
        },
        match: {},
      })
    ).toBe(false);
  });

  it("countProjectsByInitiative totals to the registry size", () => {
    const counts = countProjectsByInitiative();
    const total = [...counts.values()].reduce((a, b) => a + b, 0);
    expect(total).toBe(listProjectDefs().length);
  });

  it("projectHref points at the detail route", () => {
    expect(projectHref("beth-el-pilot")).toBe("/operations/projects/beth-el-pilot");
  });
});

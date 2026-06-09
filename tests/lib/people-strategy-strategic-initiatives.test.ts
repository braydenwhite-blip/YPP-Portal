import { describe, expect, it } from "vitest";

import {
  actionToMatchable,
  decisionToMatchable,
  getInitiativeDef,
  getMilestoneDef,
  INITIATIVE_PRIORITY_VALUES,
  INITIATIVE_STATUS_VALUES,
  isTerminalStatus,
  listInitiativeDefs,
  matchesInitiative,
  matchWork,
  meetingToMatchable,
  STRATEGIC_INITIATIVES,
  type StrategicInitiativeDef,
} from "@/lib/people-strategy/strategic-initiatives";

describe("strategic initiative registry", () => {
  it("ships a curated set with unique ids and valid metadata", () => {
    expect(STRATEGIC_INITIATIVES.length).toBeGreaterThanOrEqual(8);
    const ids = STRATEGIC_INITIATIVES.map((i) => i.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const def of STRATEGIC_INITIATIVES) {
      expect(INITIATIVE_STATUS_VALUES).toContain(def.status);
      expect(INITIATIVE_PRIORITY_VALUES).toContain(def.priority);
      expect(def.title.length).toBeGreaterThan(0);
      // Milestone ids unique within the initiative.
      const msIds = def.milestones.map((m) => m.id);
      expect(new Set(msIds).size).toBe(msIds.length);
    }
  });

  it("resolves initiatives and milestones by id", () => {
    expect(getInitiativeDef("summer-camps-2026")?.title).toBe("Summer Camps 2026");
    expect(getInitiativeDef("nope")).toBeNull();
    expect(getMilestoneDef("summer-camps-2026", "run-pilot")?.title).toBe("Run pilot");
    expect(getMilestoneDef("summer-camps-2026", "nope")).toBeNull();
    expect(listInitiativeDefs()).toBe(STRATEGIC_INITIATIVES);
  });

  it("treats completed / archived as terminal", () => {
    expect(isTerminalStatus("completed")).toBe(true);
    expect(isTerminalStatus("archived")).toBe(true);
    expect(isTerminalStatus("active")).toBe(false);
    expect(isTerminalStatus("planning")).toBe(false);
  });
});

describe("matchWork", () => {
  const work = actionToMatchable({
    title: "Reach out to summer camp partner",
    description: "intro email",
    goalCategory: "Summer Camps",
    actionType: "OUTREACH",
    relatedEntityType: "PARTNER",
    relatedEntityId: "p1",
  });

  it("fires the strong goal-category signal and explains it", () => {
    const r = matchWork(work, { goalCategories: ["Summer Camps"] });
    expect(r.matched).toBe(true);
    expect(r.signals).toContain("goalCategory");
    expect(r.score).toBe(3);
    expect(r.reasons.join(" ")).toMatch(/Summer Camps/);
  });

  it("fires keyword + entityType + area and sums weights", () => {
    const r = matchWork(work, {
      keywords: ["camp"],
      entityTypes: ["PARTNER"],
      areas: ["PARTNERSHIPS"],
    });
    expect(r.signals).toEqual(expect.arrayContaining(["keyword", "entityType", "area"]));
    // keyword 2 + entityType 1 + area 1
    expect(r.score).toBe(4);
  });

  it("matches an exact entity ref", () => {
    const r = matchWork(work, { entityRefs: [{ type: "PARTNER", id: "p1" }] });
    expect(r.matched).toBe(true);
    expect(r.signals).toContain("entityRef");
  });

  it("returns no match when nothing fires", () => {
    const r = matchWork(work, { keywords: ["mentorship"], actionTypes: ["CURRICULUM"] });
    expect(r.matched).toBe(false);
    expect(r.score).toBe(0);
  });
});

describe("matchesInitiative dilution guard", () => {
  const keywordInitiative: StrategicInitiativeDef = {
    id: "t",
    title: "T",
    description: "",
    area: "CLASSES",
    status: "active",
    priority: "medium",
    match: { areas: ["CLASSES"], keywords: ["retention"] },
    milestones: [],
  };

  it("excludes a contextual-only (area) hit when the initiative declares stronger signals", () => {
    const classesWork = actionToMatchable({
      title: "Plan a class",
      relatedEntityType: "CLASS_OFFERING",
      relatedEntityId: "c1",
    });
    // Only the area would fire — but the initiative has a keyword signal, so it
    // must not be diluted by every CLASSES action.
    const r = matchesInitiative(classesWork, keywordInitiative);
    expect(r.matched).toBe(false);
  });

  it("includes work that fires the strong keyword signal", () => {
    const retentionWork = actionToMatchable({
      title: "Improve student retention",
      relatedEntityType: "CLASS_OFFERING",
      relatedEntityId: "c1",
    });
    const r = matchesInitiative(retentionWork, keywordInitiative);
    expect(r.matched).toBe(true);
    expect(r.signals).toContain("keyword");
  });

  it("includes a contextual hit when the initiative declares only contextual signals", () => {
    const areaOnly: StrategicInitiativeDef = {
      ...keywordInitiative,
      match: { areas: ["CLASSES"] },
    };
    const classesWork = actionToMatchable({
      title: "Plan a class",
      relatedEntityType: "CLASS_OFFERING",
      relatedEntityId: "c1",
    });
    expect(matchesInitiative(classesWork, areaOnly).matched).toBe(true);
  });
});

describe("matchable adapters", () => {
  it("normalizes an action's loosely-typed fields", () => {
    const m = actionToMatchable({
      title: "Onboard Instructor",
      description: "set up",
      goalCategory: "Instructor Growth",
      actionType: "INSTRUCTOR_ONBOARDING",
      relatedEntityType: "USER",
      relatedEntityId: "u1",
    });
    expect(m.text).toContain("onboard instructor");
    expect(m.text).toContain("instructor growth");
    expect(m.actionType).toBe("INSTRUCTOR_ONBOARDING");
    expect(m.entityType).toBe("USER");
    expect(m.area).toBe("LEADERSHIP"); // USER rolls up to LEADERSHIP
    expect(m.goalCategory).toBe("Instructor Growth");
  });

  it("drops unknown enum-ish values", () => {
    const m = actionToMatchable({ title: "x", actionType: "NOPE", relatedEntityType: "WAT" });
    expect(m.actionType).toBeNull();
    expect(m.entityType).toBeNull();
  });

  it("derives a meeting's area from its category", () => {
    const m = meetingToMatchable({ title: "Mentor sync", category: "MENTORSHIP" });
    expect(m.area).toBe("MENTORSHIP");
    expect(m.text).toContain("mentor sync");
  });

  it("derives a decision's area from its meeting category", () => {
    const m = decisionToMatchable({ decision: "Expand camps", meetingCategory: "PARTNERSHIPS" });
    expect(m.area).toBe("PARTNERSHIPS");
    expect(m.text).toContain("expand camps");
  });
});

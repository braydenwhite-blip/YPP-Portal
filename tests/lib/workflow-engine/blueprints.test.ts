import { describe, it, expect } from "vitest";
import { RoleType, AdminSubtype } from "@prisma/client";

import {
  WORKFLOW_BLUEPRINTS,
  blueprintByKey,
  blueprintTransitions,
  validateBlueprint,
} from "@/lib/workflow-engine/blueprints";
import { WORKFLOW_DOMAINS } from "@/lib/workflow-engine/constants";

const ROLE_TYPES = new Set<string>(Object.values(RoleType));
const ADMIN_SUBTYPES = new Set<string>(Object.values(AdminSubtype));

describe("workflow-engine blueprints", () => {
  it("ships the full catalog of reusable business processes", () => {
    // Leadership (5), Chapters (8), Partners (5), Instructors (7),
    // Students (7), Programs (6), Meetings (5), Operations (6).
    expect(WORKFLOW_BLUEPRINTS.length).toBe(50);
  });

  it("has unique blueprint keys", () => {
    const keys = WORKFLOW_BLUEPRINTS.map((b) => b.key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("every blueprint is structurally valid", () => {
    for (const bp of WORKFLOW_BLUEPRINTS) {
      expect(validateBlueprint(bp)).toEqual([]);
    }
  });

  it("every blueprint has exactly one start stage and at least one final stage", () => {
    for (const bp of WORKFLOW_BLUEPRINTS) {
      expect(bp.stages.filter((s) => s.isInitial).length).toBe(1);
      expect(bp.stages.some((s) => s.isTerminal)).toBe(true);
    }
  });

  it("derives linear transitions when none are declared", () => {
    const bp = blueprintByKey("partner-acquisition")!;
    const edges = blueprintTransitions(bp);
    expect(edges.length).toBe(bp.stages.length - 1);
    expect(edges[0].fromStageKey).toBe(bp.stages[0].key);
  });

  it("automation rules only reference real stages and the reuse vocabulary", () => {
    const actions = new Set([
      "CREATE_ACTION",
      "CREATE_MEETING",
      "SEND_NOTIFICATION",
      "CREATE_WORKFLOW_ITEM",
      "SCHEDULE_FOLLOW_UP",
      "ESCALATE",
      "ADVANCE_STAGE",
      "START_WORKFLOW",
    ]);
    for (const bp of WORKFLOW_BLUEPRINTS) {
      const stageKeys = new Set(bp.stages.map((s) => s.key));
      for (const a of bp.automations ?? []) {
        expect(actions.has(a.action)).toBe(true);
        if (a.stageKey) expect(stageKeys.has(a.stageKey)).toBe(true);
      }
    }
  });

  it("every blueprint's domain is a real, curated WORKFLOW_DOMAINS value", () => {
    const domains = new Set<string>(WORKFLOW_DOMAINS);
    for (const bp of WORKFLOW_BLUEPRINTS) {
      if (bp.domain) expect(domains.has(bp.domain)).toBe(true);
    }
  });

  it("every blueprint's default owner role/subtype is a real enum value", () => {
    for (const bp of WORKFLOW_BLUEPRINTS) {
      if (bp.defaultOwnerRole) expect(ROLE_TYPES.has(bp.defaultOwnerRole)).toBe(true);
      if (bp.defaultOwnerSubtype) expect(ADMIN_SUBTYPES.has(bp.defaultOwnerSubtype)).toBe(true);
    }
  });

  it("entity-status triggers carry a subjectType and matchStatus", () => {
    for (const bp of WORKFLOW_BLUEPRINTS) {
      for (const t of bp.triggers ?? []) {
        expect(t.event).toBe("ENTITY_STATUS_CHANGED");
        expect(t.subjectType.length).toBeGreaterThan(0);
        expect(t.matchStatus.length).toBeGreaterThan(0);
      }
    }
  });

  it("START_WORKFLOW automations target a real blueprint key in the catalog", () => {
    const keys = new Set(WORKFLOW_BLUEPRINTS.map((b) => b.key));
    for (const bp of WORKFLOW_BLUEPRINTS) {
      for (const a of bp.automations ?? []) {
        if (a.action !== "START_WORKFLOW") continue;
        const target = a.config?.targetBlueprintKey;
        expect(typeof target).toBe("string");
        expect(keys.has(target as string)).toBe(true);
      }
    }
  });
});

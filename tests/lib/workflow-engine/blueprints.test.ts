import { describe, it, expect } from "vitest";

import {
  WORKFLOW_BLUEPRINTS,
  blueprintByKey,
  blueprintTransitions,
  validateBlueprint,
} from "@/lib/workflow-engine/blueprints";

describe("workflow-engine blueprints", () => {
  it("ships the full catalog of reusable business processes", () => {
    // Partner acquisition, instructor hiring, volunteer onboarding, student
    // advising, program launch, chapter launch, curriculum approval, board prep,
    // mentorship, event planning, grant application, fundraising campaign.
    expect(WORKFLOW_BLUEPRINTS.length).toBe(12);
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
    ]);
    for (const bp of WORKFLOW_BLUEPRINTS) {
      const stageKeys = new Set(bp.stages.map((s) => s.key));
      for (const a of bp.automations ?? []) {
        expect(actions.has(a.action)).toBe(true);
        if (a.stageKey) expect(stageKeys.has(a.stageKey)).toBe(true);
      }
    }
  });
});

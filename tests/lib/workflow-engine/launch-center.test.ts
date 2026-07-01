import { describe, it, expect } from "vitest";

import { computeLaunchPreview } from "@/lib/workflow-engine/launch-center";
import type {
  AutomationRuleDefinition,
  WorkflowTemplateDefinition,
} from "@/lib/workflow-engine/types";
import { stage, step, twoStageTemplate } from "./_fixtures";

function rule(over: Partial<AutomationRuleDefinition> & { action: AutomationRuleDefinition["action"] }): AutomationRuleDefinition {
  return {
    id: over.id ?? `${over.action}-${Math.random()}`,
    name: over.name ?? over.action,
    trigger: over.trigger ?? "ON_INSTANCE_START",
    stageKey: over.stageKey ?? null,
    stepKey: over.stepKey ?? null,
    enabled: over.enabled ?? true,
    config: over.config ?? null,
    order: over.order ?? 0,
    ...over,
  };
}

describe("computeLaunchPreview", () => {
  it("reflects the isInitial stage's name and steps in order, and counts automation rules by action", () => {
    const template = twoStageTemplate({
      automationRules: [
        rule({ action: "CREATE_ACTION" }),
        rule({ action: "CREATE_ACTION" }),
        rule({ action: "CREATE_MEETING" }),
        rule({ action: "ESCALATE" }),
        rule({ action: "SEND_NOTIFICATION" }),
      ],
    });

    const preview = computeLaunchPreview(template);

    expect(preview.templateName).toBe(template.name);
    expect(preview.stageCount).toBe(2);
    expect(preview.firstStageName).toBe("Stage A");
    expect(preview.firstStepNames).toEqual(["a1", "a2"]);
    expect(preview.estimatedActionsCount).toBe(2);
    expect(preview.estimatedMeetingsCount).toBe(1);
    expect(preview.hasEscalation).toBe(true);
  });

  it("has no escalation and zero counts when there are no matching automation rules", () => {
    const template = twoStageTemplate({
      automationRules: [rule({ action: "SEND_NOTIFICATION" }), rule({ action: "ADVANCE_STAGE" })],
    });

    const preview = computeLaunchPreview(template);

    expect(preview.estimatedActionsCount).toBe(0);
    expect(preview.estimatedMeetingsCount).toBe(0);
    expect(preview.hasEscalation).toBe(false);
  });

  it("falls back to the lowest-order stage when no stage is flagged isInitial (matches engine.ts's startInstance tie-break)", () => {
    const stageB = stage({
      key: "b",
      name: "Stage B",
      order: 1,
      steps: [step({ key: "b1", order: 0 })],
    });
    const stageA = stage({
      key: "a",
      name: "Stage A",
      order: 0,
      steps: [step({ key: "a2", order: 1 }), step({ key: "a1", order: 0 })],
    });
    const template: WorkflowTemplateDefinition = {
      ...twoStageTemplate(),
      stages: [stageB, stageA], // deliberately out of order; none isInitial
    };

    const preview = computeLaunchPreview(template);

    expect(preview.firstStageName).toBe("Stage A");
    expect(preview.firstStepNames).toEqual(["a1", "a2"]); // steps sorted by order too
  });

  it("returns empty/placeholder values gracefully when the template has no stages", () => {
    const template: WorkflowTemplateDefinition = { ...twoStageTemplate(), stages: [], automationRules: [] };

    const preview = computeLaunchPreview(template);

    expect(preview.stageCount).toBe(0);
    expect(preview.firstStageName).toBe("—");
    expect(preview.firstStepNames).toEqual([]);
  });
});

import { describe, expect, it } from "vitest";

import {
  ENTITY_360_TYPES,
  ENTITY_360_WORKFLOW_SUBJECT,
  WORKFLOW_HEALTH_LABELS,
  WORKFLOW_HEALTH_TONES,
  sortWorkflowsWorstFirst,
  workflowProgressLabel,
  type Entity360Workflow,
} from "@/lib/operations/entity-360";
import { WORKFLOW_ENTITY_TYPE_VALUES } from "@/lib/workflow-engine/entity-types";

function wf(overrides: Partial<Entity360Workflow>): Entity360Workflow {
  return {
    id: "wf1",
    title: "Partner acquisition",
    templateName: "Partner acquisition",
    healthStatus: "ON_TRACK",
    healthLabel: "On track",
    tone: "success",
    reasons: [],
    stageName: "Outreach",
    progressLabel: "40% complete",
    ownerName: "Maya",
    dueISO: null,
    nextStepTitle: null,
    href: "/workflows/wf1",
    ...overrides,
  };
}

describe("ENTITY_360_WORKFLOW_SUBJECT", () => {
  it("maps every drawer type onto a valid workflow entity type", () => {
    for (const type of ENTITY_360_TYPES) {
      const subject = ENTITY_360_WORKFLOW_SUBJECT[type];
      expect(WORKFLOW_ENTITY_TYPE_VALUES).toContain(subject);
    }
  });
});

describe("workflow health labels and tones", () => {
  it("covers every health status the engine can produce", () => {
    const statuses = [
      "BLOCKED",
      "OVERDUE",
      "STALLED",
      "NEEDS_ATTENTION",
      "ON_TRACK",
      "COMPLETE",
      "ARCHIVED",
    ];
    for (const status of statuses) {
      expect(WORKFLOW_HEALTH_LABELS[status]).toBeTruthy();
      expect(WORKFLOW_HEALTH_TONES[status]).toBeTruthy();
    }
  });

  it("renders blocked/overdue as the overdue tone and on-track as success", () => {
    expect(WORKFLOW_HEALTH_TONES.BLOCKED).toBe("overdue");
    expect(WORKFLOW_HEALTH_TONES.OVERDUE).toBe("overdue");
    expect(WORKFLOW_HEALTH_TONES.ON_TRACK).toBe("success");
  });
});

describe("workflowProgressLabel", () => {
  it("reads 0 as not started and 100 as complete", () => {
    expect(workflowProgressLabel(0)).toBe("Not started");
    expect(workflowProgressLabel(100)).toBe("Complete");
  });

  it("rounds and clamps intermediate values", () => {
    expect(workflowProgressLabel(61.6)).toBe("62% complete");
    expect(workflowProgressLabel(140)).toBe("Complete");
    expect(workflowProgressLabel(-5)).toBe("Not started");
  });
});

describe("sortWorkflowsWorstFirst", () => {
  it("puts blocked before overdue before on-track, regardless of input order", () => {
    const sorted = sortWorkflowsWorstFirst([
      wf({ id: "a", healthStatus: "ON_TRACK" }),
      wf({ id: "b", healthStatus: "BLOCKED" }),
      wf({ id: "c", healthStatus: "OVERDUE" }),
    ]);
    expect(sorted.map((w) => w.id)).toEqual(["b", "c", "a"]);
  });

  it("breaks health ties by earliest due date, undated last", () => {
    const sorted = sortWorkflowsWorstFirst([
      wf({ id: "undated", healthStatus: "OVERDUE", dueISO: null }),
      wf({ id: "later", healthStatus: "OVERDUE", dueISO: "2026-07-20T00:00:00.000Z" }),
      wf({ id: "sooner", healthStatus: "OVERDUE", dueISO: "2026-07-05T00:00:00.000Z" }),
    ]);
    expect(sorted.map((w) => w.id)).toEqual(["sooner", "later", "undated"]);
  });

  it("does not mutate the input array", () => {
    const input = [wf({ id: "a", healthStatus: "ON_TRACK" }), wf({ id: "b", healthStatus: "BLOCKED" })];
    sortWorkflowsWorstFirst(input);
    expect(input.map((w) => w.id)).toEqual(["a", "b"]);
  });
});

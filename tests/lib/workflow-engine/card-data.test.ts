import { describe, it, expect, vi, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// Mocks (must be declared before importing the module under test — vi.mock
// factories are hoisted above top-level consts, so any fn referenced inside
// one is wrapped in vi.hoisted()).
// ---------------------------------------------------------------------------

const prismaMocks = vi.hoisted(() => ({
  workflowInstanceFindUnique: vi.fn(),
  workflowEventFindFirst: vi.fn(),
  userFindUnique: vi.fn(),
  workflowStepExecutionFindMany: vi.fn(),
  actionItemFindMany: vi.fn(),
  meetingFindMany: vi.fn(),
}));

const attachmentMocks = vi.hoisted(() => ({
  getPrimaryWorkflowForEntity: vi.fn(),
  getWorkflowsForEntity: vi.fn(),
}));

const queriesMocks = vi.hoisted(() => ({
  getInstanceDetail: vi.fn(),
}));

vi.mock("server-only", () => ({}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    workflowInstance: { findUnique: prismaMocks.workflowInstanceFindUnique },
    workflowEvent: { findFirst: prismaMocks.workflowEventFindFirst },
    user: { findUnique: prismaMocks.userFindUnique },
    workflowStepExecution: { findMany: prismaMocks.workflowStepExecutionFindMany },
    actionItem: { findMany: prismaMocks.actionItemFindMany },
    meeting: { findMany: prismaMocks.meetingFindMany },
  },
}));

vi.mock("@/lib/workflow-engine/attachment", () => ({
  getPrimaryWorkflowForEntity: attachmentMocks.getPrimaryWorkflowForEntity,
  getWorkflowsForEntity: attachmentMocks.getWorkflowsForEntity,
}));

vi.mock("@/lib/workflow-engine/queries", () => ({
  getInstanceDetail: queriesMocks.getInstanceDetail,
}));

import {
  getEntityWorkflowSummary,
  getWorkflowLinkedActionsData,
  getWorkflowLinkedMeetingsData,
  getWorkflowTimelineData,
  pickNextStepExecution,
} from "@/lib/workflow-engine/card-data";
import type { StepExecutionView } from "@/lib/workflow-engine/types";

function exec(over: Partial<StepExecutionView>): StepExecutionView {
  return {
    id: "exec-1",
    stepId: "step-1",
    stageKey: "stage-a",
    stepKey: "step-a",
    title: "Do the thing",
    kind: "TASK",
    state: "PENDING",
    isRequired: true,
    ownerId: null,
    dueAt: null,
    startedAt: null,
    completedAt: null,
    blockedReason: null,
    linkedActionItemId: null,
    linkedMeetingId: null,
    linkedWorkflowItemId: null,
    ...over,
  };
}

// ---------------------------------------------------------------------------
// pickNextStepExecution — pure logic, the part worth getting exactly right.
// ---------------------------------------------------------------------------

describe("pickNextStepExecution", () => {
  it("returns null when there are no executions", () => {
    expect(pickNextStepExecution([], new Map())).toBeNull();
  });

  it("returns null when every execution is terminal", () => {
    const execs = [
      exec({ id: "e1", stepKey: "a", state: "COMPLETE" }),
      exec({ id: "e2", stepKey: "b", state: "SKIPPED" }),
    ];
    expect(pickNextStepExecution(execs, new Map())).toBeNull();
  });

  it("picks the first non-terminal REQUIRED execution in template step order", () => {
    const execs = [
      exec({ id: "e-second", stepKey: "b", state: "PENDING", isRequired: true }),
      exec({ id: "e-first", stepKey: "a", state: "IN_PROGRESS", isRequired: true }),
      exec({ id: "e-optional", stepKey: "c", state: "PENDING", isRequired: false }),
    ];
    const order = new Map([
      ["a", 1],
      ["b", 2],
      ["c", 3],
    ]);
    const result = pickNextStepExecution(execs, order);
    expect(result?.id).toBe("e-first");
  });

  it("ignores step order values that don't matter when required steps are out of declared array order", () => {
    const execs = [
      exec({ id: "e-b", stepKey: "b", state: "PENDING", isRequired: true }),
      exec({ id: "e-a", stepKey: "a", state: "PENDING", isRequired: true }),
    ];
    // "b" declared before "a" in the template's order map.
    const order = new Map([
      ["b", 1],
      ["a", 2],
    ]);
    const result = pickNextStepExecution(execs, order);
    expect(result?.id).toBe("e-b");
  });

  it("falls back to the first non-terminal execution when none are required", () => {
    const execs = [
      exec({ id: "e-opt-2", stepKey: "b", state: "PENDING", isRequired: false }),
      exec({ id: "e-opt-1", stepKey: "a", state: "PENDING", isRequired: false }),
    ];
    const order = new Map([
      ["a", 1],
      ["b", 2],
    ]);
    const result = pickNextStepExecution(execs, order);
    expect(result?.id).toBe("e-opt-1");
  });

  it("treats a required execution missing from the order map as ordered last", () => {
    const execs = [
      exec({ id: "e-unordered", stepKey: "z", state: "PENDING", isRequired: true }),
      exec({ id: "e-ordered", stepKey: "a", state: "PENDING", isRequired: true }),
    ];
    const order = new Map([["a", 1]]);
    const result = pickNextStepExecution(execs, order);
    expect(result?.id).toBe("e-ordered");
  });
});

// ---------------------------------------------------------------------------
// getEntityWorkflowSummary
// ---------------------------------------------------------------------------

describe("getEntityWorkflowSummary", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns null when there's no primary workflow", async () => {
    attachmentMocks.getPrimaryWorkflowForEntity.mockResolvedValue(null);

    const result = await getEntityWorkflowSummary("PARTNER", "p1");

    expect(result).toBeNull();
    expect(queriesMocks.getInstanceDetail).not.toHaveBeenCalled();
  });

  function baseDetail(executions: StepExecutionView[]) {
    return {
      instance: {
        id: "inst-1",
        templateId: "tmpl-1",
        title: "Partner Acquisition",
        status: "ACTIVE",
        currentStageKey: "stage-a",
        subjectType: "PARTNER",
        subjectId: "p1",
        chapterId: null,
        ownerId: "owner-1",
        completionPercent: 40,
        startedAt: "2026-06-01T00:00:00.000Z",
        dueAt: null,
        followUpAt: null,
        completedAt: null,
      },
      definition: {
        id: "tmpl-1",
        key: "partner-acquisition",
        name: "Partner Acquisition",
        description: null,
        domain: null,
        status: "PUBLISHED" as const,
        version: 1,
        defaultOwnerRole: null,
        defaultOwnerSubtype: null,
        followUpCadenceHours: null,
        escalateAfterHours: null,
        config: null,
        stages: [
          {
            id: "stage-a-id",
            key: "stage-a",
            name: "Stage A",
            description: null,
            order: 1,
            slaHours: null,
            isInitial: true,
            isTerminal: false,
            exitCriteria: null,
            steps: [
              { id: "s1", key: "step-a", name: "Step A", description: null, order: 1, kind: "TASK" as const, isRequired: true, assigneeMode: null, assigneeRole: null, assigneeSubtype: null, dueOffsetHours: null, config: null },
            ],
          },
        ],
        transitions: [],
        automationRules: [],
      },
      executions,
      runtime: {
        instanceId: "inst-1",
        status: "ACTIVE" as const,
        currentStageKey: "stage-a",
        completedStageKeys: [],
        pendingStageKeys: [],
        blockedExecutionIds: [],
        completionPercent: 40,
        isOverdue: false,
        isBlocked: false,
        nextAction: { kind: "COMPLETE_STEP" as const, label: "Complete: Step A" },
        stages: [],
        canAdvance: false,
        advanceTargetStageKey: null,
        exitCriteria: { met: false, missing: ["Step A"] },
      },
      templateName: "Partner Acquisition",
      ownerName: "Jordan Owner",
      events: [],
    };
  }

  it("derives nextStep as the first non-terminal required execution of the current stage", async () => {
    attachmentMocks.getPrimaryWorkflowForEntity.mockResolvedValue({ id: "inst-1" });
    const execs = [
      exec({ id: "e1", stageKey: "stage-a", stepKey: "step-a", state: "PENDING", isRequired: true, ownerId: "u1" }),
    ];
    queriesMocks.getInstanceDetail.mockResolvedValue(baseDetail(execs));
    prismaMocks.workflowInstanceFindUnique.mockResolvedValue({ escalatedAt: null });
    prismaMocks.workflowEventFindFirst.mockResolvedValue(null);
    prismaMocks.userFindUnique.mockResolvedValue({ name: "Alex Owner" });
    attachmentMocks.getWorkflowsForEntity.mockResolvedValue([{ id: "inst-1" }]);

    const result = await getEntityWorkflowSummary("PARTNER", "p1");

    expect(result).not.toBeNull();
    expect(result?.nextStep?.executionId).toBe("e1");
    expect(result?.nextStep?.ownerId).toBe("u1");
    expect(result?.nextStep?.ownerName).toBe("Alex Owner");
    expect(result?.otherActiveCount).toBe(0);
  });

  it("falls back to the first non-terminal execution when none in the stage are required", async () => {
    attachmentMocks.getPrimaryWorkflowForEntity.mockResolvedValue({ id: "inst-1" });
    const execs = [
      exec({ id: "e-optional", stageKey: "stage-a", stepKey: "step-a", state: "IN_PROGRESS", isRequired: false, ownerId: null }),
    ];
    queriesMocks.getInstanceDetail.mockResolvedValue(baseDetail(execs));
    prismaMocks.workflowInstanceFindUnique.mockResolvedValue({ escalatedAt: null });
    prismaMocks.workflowEventFindFirst.mockResolvedValue(null);
    attachmentMocks.getWorkflowsForEntity.mockResolvedValue([{ id: "inst-1" }]);

    const result = await getEntityWorkflowSummary("PARTNER", "p1");

    expect(result?.nextStep?.executionId).toBe("e-optional");
    expect(result?.nextStep?.ownerName).toBeNull();
  });

  it("otherActiveCount is 0 when only the primary workflow is active", async () => {
    attachmentMocks.getPrimaryWorkflowForEntity.mockResolvedValue({ id: "inst-1" });
    queriesMocks.getInstanceDetail.mockResolvedValue(baseDetail([]));
    prismaMocks.workflowInstanceFindUnique.mockResolvedValue({ escalatedAt: null });
    prismaMocks.workflowEventFindFirst.mockResolvedValue(null);
    attachmentMocks.getWorkflowsForEntity.mockResolvedValue([{ id: "inst-1" }]);

    const result = await getEntityWorkflowSummary("PARTNER", "p1");

    expect(result?.otherActiveCount).toBe(0);
  });

  it("otherActiveCount is >0 when getWorkflowsForEntity returns more than the primary", async () => {
    attachmentMocks.getPrimaryWorkflowForEntity.mockResolvedValue({ id: "inst-1" });
    queriesMocks.getInstanceDetail.mockResolvedValue(baseDetail([]));
    prismaMocks.workflowInstanceFindUnique.mockResolvedValue({ escalatedAt: null });
    prismaMocks.workflowEventFindFirst.mockResolvedValue(null);
    attachmentMocks.getWorkflowsForEntity.mockResolvedValue([
      { id: "inst-1" },
      { id: "inst-2" },
      { id: "inst-3" },
    ]);

    const result = await getEntityWorkflowSummary("PARTNER", "p1");

    expect(result?.otherActiveCount).toBe(2);
  });

  it("returns null when getInstanceDetail can't find the primary instance", async () => {
    attachmentMocks.getPrimaryWorkflowForEntity.mockResolvedValue({ id: "inst-1" });
    queriesMocks.getInstanceDetail.mockResolvedValue(null);

    const result = await getEntityWorkflowSummary("PARTNER", "p1");

    expect(result).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// getWorkflowLinkedActionsData / getWorkflowLinkedMeetingsData / getWorkflowTimelineData
// (light — shape/branching only, not exhaustive Prisma correctness)
// ---------------------------------------------------------------------------

describe("getWorkflowLinkedActionsData", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns an empty array when no executions link to an action item", async () => {
    prismaMocks.workflowStepExecutionFindMany.mockResolvedValue([]);

    const result = await getWorkflowLinkedActionsData("inst-1");

    expect(result).toEqual([]);
    expect(prismaMocks.actionItemFindMany).not.toHaveBeenCalled();
  });

  it("maps ActionItem rows, preferring deadlineEnd over deadlineStart, and orders open/overdue first", async () => {
    prismaMocks.workflowStepExecutionFindMany.mockResolvedValue([
      { linkedActionItemId: "a1" },
      { linkedActionItemId: "a2" },
    ]);
    prismaMocks.actionItemFindMany.mockResolvedValue([
      {
        id: "a1",
        title: "Complete task",
        status: "COMPLETE",
        deadlineStart: new Date("2026-01-01T00:00:00.000Z"),
        deadlineEnd: null,
        lead: { name: "Lead One" },
      },
      {
        id: "a2",
        title: "Overdue task",
        status: "OVERDUE",
        deadlineStart: new Date("2026-01-01T00:00:00.000Z"),
        deadlineEnd: new Date("2026-01-05T00:00:00.000Z"),
        lead: { name: "Lead Two" },
      },
    ]);

    const result = await getWorkflowLinkedActionsData("inst-1");

    expect(result).toHaveLength(2);
    expect(result[0].id).toBe("a2"); // OVERDUE ranks before COMPLETE
    expect(result[0].dueDate).toBe("2026-01-05T00:00:00.000Z"); // deadlineEnd preferred
    expect(result[0].ownerName).toBe("Lead Two");
    expect(result[1].id).toBe("a1");
    expect(result[1].dueDate).toBe("2026-01-01T00:00:00.000Z"); // falls back to deadlineStart
  });
});

describe("getWorkflowLinkedMeetingsData", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns an empty array when no executions link to a meeting", async () => {
    prismaMocks.workflowStepExecutionFindMany.mockResolvedValue([]);

    const result = await getWorkflowLinkedMeetingsData("inst-1");

    expect(result).toEqual([]);
    expect(prismaMocks.meetingFindMany).not.toHaveBeenCalled();
  });

  it("maps Meeting rows to the expected shape", async () => {
    prismaMocks.workflowStepExecutionFindMany.mockResolvedValue([{ linkedMeetingId: "m1" }]);
    prismaMocks.meetingFindMany.mockResolvedValue([
      {
        id: "m1",
        title: "Kickoff",
        status: "SCHEDULED",
        scheduledAt: new Date("2026-07-10T00:00:00.000Z"),
        type: "GENERIC",
      },
    ]);

    const result = await getWorkflowLinkedMeetingsData("inst-1");

    expect(result).toEqual([
      {
        id: "m1",
        title: "Kickoff",
        status: "SCHEDULED",
        scheduledAt: "2026-07-10T00:00:00.000Z",
        type: "GENERIC",
      },
    ]);
  });
});

describe("getWorkflowTimelineData", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns an empty array when the instance can't be found", async () => {
    queriesMocks.getInstanceDetail.mockResolvedValue(null);

    const result = await getWorkflowTimelineData("inst-1");

    expect(result).toEqual([]);
  });

  it("slices getInstanceDetail's events to the limit without re-querying WorkflowEvent", async () => {
    const events = Array.from({ length: 10 }, (_, i) => ({
      id: `ev-${i}`,
      kind: "NOTE_ADDED",
      summary: `Event ${i}`,
      actorName: null,
      createdAt: "2026-06-01T00:00:00.000Z",
    }));
    queriesMocks.getInstanceDetail.mockResolvedValue({
      instance: {},
      definition: {},
      executions: [],
      runtime: {},
      templateName: "T",
      ownerName: null,
      events,
    });

    const result = await getWorkflowTimelineData("inst-1", 3);

    expect(result).toHaveLength(3);
    expect(result[0].id).toBe("ev-0");
  });
});

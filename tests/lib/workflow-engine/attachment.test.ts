import { describe, it, expect, vi } from "vitest";

// Declare mocks BEFORE importing the module under test (matches
// tests/lib/partners-permissions.test.ts's convention). vi.mock factories are
// hoisted above imports, so the fns must be created via vi.hoisted().
const { workflowInstanceFindUnique, workflowAttachmentUpsert } = vi.hoisted(() => ({
  workflowInstanceFindUnique: vi.fn(),
  workflowAttachmentUpsert: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    workflowInstance: {
      findUnique: workflowInstanceFindUnique,
    },
    workflowAttachment: {
      upsert: workflowAttachmentUpsert,
    },
  },
}));

vi.mock("@/lib/workflow-engine/engine", () => ({
  startInstance: vi.fn(),
}));

import {
  WORKFLOW_ENTITY_TYPE_VALUES,
  WORKFLOW_ENTITY_TYPE_LABELS,
  isWorkflowEntityType,
} from "@/lib/workflow-engine/entity-types";
import {
  attachWorkflowToEntity,
  dedupeWorkflowSummaries,
  getPrimaryWorkflowForEntity,
  type WorkflowSummaryForEntity,
} from "@/lib/workflow-engine/attachment";

describe("WORKFLOW_ENTITY_TYPE_VALUES / labels / guard", () => {
  it("has a label for every value", () => {
    for (const value of WORKFLOW_ENTITY_TYPE_VALUES) {
      expect(WORKFLOW_ENTITY_TYPE_LABELS[value]).toBeTruthy();
      expect(typeof WORKFLOW_ENTITY_TYPE_LABELS[value]).toBe("string");
    }
  });

  it("has exactly one label per value (no extras, no gaps)", () => {
    const labelKeys = Object.keys(WORKFLOW_ENTITY_TYPE_LABELS).sort();
    const values = [...WORKFLOW_ENTITY_TYPE_VALUES].sort();
    expect(labelKeys).toEqual(values);
  });

  it("isWorkflowEntityType accepts every known value and rejects garbage", () => {
    for (const value of WORKFLOW_ENTITY_TYPE_VALUES) {
      expect(isWorkflowEntityType(value)).toBe(true);
    }
    expect(isWorkflowEntityType("NOT_A_REAL_TYPE")).toBe(false);
    expect(isWorkflowEntityType(null)).toBe(false);
    expect(isWorkflowEntityType(undefined)).toBe(false);
    expect(isWorkflowEntityType(42)).toBe(false);
  });
});

describe("getPrimaryWorkflowForEntity — falsy entityId guard", () => {
  it("returns null for an empty entityId instead of dropping the subjectId filter and matching a wrong entity", async () => {
    // A CHAPTER card fed an unresolved (null/undefined) chapter id must not
    // surface some other chapter's workflow — nor 500 downstream when
    // getInstanceDetail receives an undefined id.
    const result = await getPrimaryWorkflowForEntity("CHAPTER", "");
    expect(result).toBeNull();
  });

  it("still validates the entity type before the entityId guard", async () => {
    await expect(getPrimaryWorkflowForEntity("NOT_A_REAL_TYPE", "")).rejects.toThrow();
  });
});

function summary(over: Partial<WorkflowSummaryForEntity> & { id: string }): WorkflowSummaryForEntity {
  return {
    title: "Test Workflow",
    status: "ACTIVE",
    templateId: "tmpl-1",
    currentStageKey: "a",
    completionPercent: 0,
    dueAt: null,
    ownerId: null,
    startedAt: "2026-06-01T00:00:00.000Z",
    ...over,
  };
}

describe("dedupeWorkflowSummaries", () => {
  it("dedupes by id, keeping the union of entries", () => {
    const list = [
      summary({ id: "w1", startedAt: "2026-06-01T00:00:00.000Z" }),
      summary({ id: "w1", startedAt: "2026-06-01T00:00:00.000Z" }), // duplicate (primary + attachment path)
      summary({ id: "w2", startedAt: "2026-06-05T00:00:00.000Z" }),
    ];
    const result = dedupeWorkflowSummaries(list);
    expect(result).toHaveLength(2);
    expect(result.map((r) => r.id).sort()).toEqual(["w1", "w2"]);
  });

  it("sorts by startedAt descending", () => {
    const list = [
      summary({ id: "old", startedAt: "2026-01-01T00:00:00.000Z" }),
      summary({ id: "new", startedAt: "2026-06-01T00:00:00.000Z" }),
      summary({ id: "mid", startedAt: "2026-03-01T00:00:00.000Z" }),
    ];
    const result = dedupeWorkflowSummaries(list);
    expect(result.map((r) => r.id)).toEqual(["new", "mid", "old"]);
  });

  it("filters by opts.statuses when given", () => {
    const list = [
      summary({ id: "active", status: "ACTIVE" }),
      summary({ id: "completed", status: "COMPLETED" }),
      summary({ id: "blocked", status: "BLOCKED" }),
    ];
    const result = dedupeWorkflowSummaries(list, { statuses: ["ACTIVE", "BLOCKED"] });
    expect(result.map((r) => r.id).sort()).toEqual(["active", "blocked"]);
  });

  it("applies no status filter when opts.statuses is omitted or empty", () => {
    const list = [summary({ id: "a", status: "ACTIVE" }), summary({ id: "b", status: "CANCELLED" })];
    expect(dedupeWorkflowSummaries(list)).toHaveLength(2);
    expect(dedupeWorkflowSummaries(list, { statuses: [] })).toHaveLength(2);
  });
});

describe("attachWorkflowToEntity", () => {
  it("throws on an invalid entityType before touching prisma", async () => {
    await expect(
      attachWorkflowToEntity({
        instanceId: "inst-1",
        entityType: "NOT_A_REAL_TYPE",
        entityId: "e1",
      })
    ).rejects.toThrow(/invalid workflow entity type/i);
    expect(workflowInstanceFindUnique).not.toHaveBeenCalled();
  });

  it("throws when the instance does not exist", async () => {
    workflowInstanceFindUnique.mockResolvedValueOnce(null);
    await expect(
      attachWorkflowToEntity({ instanceId: "missing", entityType: "CHAPTER", entityId: "c1" })
    ).rejects.toThrow(/workflow instance not found/i);
  });

  it("is a no-op and does not insert a WorkflowAttachment row when the entity is the instance's own primary subject", async () => {
    workflowInstanceFindUnique.mockResolvedValueOnce({ subjectType: "CHAPTER", subjectId: "c1" });

    const result = await attachWorkflowToEntity({
      instanceId: "inst-1",
      entityType: "CHAPTER",
      entityId: "c1",
    });

    expect(result).toEqual({ attached: false, alreadyPrimary: true });
    expect(workflowAttachmentUpsert).not.toHaveBeenCalled();
  });

  it("upserts a SECONDARY attachment when the entity is not the primary subject", async () => {
    workflowInstanceFindUnique.mockResolvedValueOnce({ subjectType: "CHAPTER", subjectId: "c1" });
    workflowAttachmentUpsert.mockResolvedValueOnce({ id: "att-1" });

    const result = await attachWorkflowToEntity({
      instanceId: "inst-1",
      entityType: "PARTNER",
      entityId: "p1",
      createdById: "user-1",
    });

    expect(result).toEqual({ attached: true, alreadyPrimary: false, attachmentId: "att-1" });
    expect(workflowAttachmentUpsert).toHaveBeenCalledTimes(1);
    const call = workflowAttachmentUpsert.mock.calls[0][0];
    expect(call.where.workflowInstanceId_entityType_entityId_relationship).toEqual({
      workflowInstanceId: "inst-1",
      entityType: "PARTNER",
      entityId: "p1",
      relationship: "SECONDARY",
    });
    expect(call.create).toMatchObject({
      workflowInstanceId: "inst-1",
      entityType: "PARTNER",
      entityId: "p1",
      relationship: "SECONDARY",
      createdById: "user-1",
    });
  });
});

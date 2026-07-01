import { describe, it, expect, vi, beforeEach } from "vitest";

// Declare mocks BEFORE importing the module under test — vi.mock factories are
// hoisted above imports, so fns referenced inside them must come from
// vi.hoisted() (matches tests/lib/partners-permissions.test.ts /
// tests/lib/workflow-engine/attachment.test.ts's convention).
const {
  startInstanceCore,
  attachWorkflowToEntityCore,
  detachWorkflowFromEntityCore,
  getWorkflowsForEntityMock,
  requireWorkflowRunnerMock,
  requireWorkflowViewerMock,
  workflowTemplateFindMany,
  workflowInstanceFindMany,
  getTemplateDefinitionMock,
} = vi.hoisted(() => ({
  startInstanceCore: vi.fn(),
  attachWorkflowToEntityCore: vi.fn(),
  detachWorkflowFromEntityCore: vi.fn(),
  getWorkflowsForEntityMock: vi.fn(),
  requireWorkflowRunnerMock: vi.fn(),
  requireWorkflowViewerMock: vi.fn(),
  workflowTemplateFindMany: vi.fn(),
  workflowInstanceFindMany: vi.fn(),
  getTemplateDefinitionMock: vi.fn(),
}));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    workflowTemplate: { findMany: workflowTemplateFindMany },
    workflowInstance: { findMany: workflowInstanceFindMany },
  },
}));

vi.mock("@/lib/workflow-engine/engine", () => ({
  startInstance: startInstanceCore,
}));

vi.mock("@/lib/workflow-engine/attachment", () => ({
  attachWorkflowToEntity: attachWorkflowToEntityCore,
  detachWorkflowFromEntity: detachWorkflowFromEntityCore,
  getWorkflowsForEntity: getWorkflowsForEntityMock,
}));

vi.mock("@/lib/workflow-engine/permissions", () => ({
  requireWorkflowRunner: requireWorkflowRunnerMock,
  requireWorkflowViewer: requireWorkflowViewerMock,
}));

vi.mock("@/lib/workflow-engine/queries", () => ({
  getTemplateDefinition: getTemplateDefinitionMock,
}));

import {
  attachWorkflowToEntityAction,
  detachWorkflowFromEntityAction,
  getTemplatePreview,
  listActiveWorkflowsForEntity,
  listAttachableWorkflowCandidates,
  startWorkflowForEntity,
} from "@/lib/workflow-engine/entity-actions";
import { twoStageTemplate } from "./_fixtures";

const VIEWER = { id: "viewer-1", roles: ["STAFF"], primaryRole: "STAFF", adminSubtypes: [] };

beforeEach(() => {
  vi.clearAllMocks();
  requireWorkflowRunnerMock.mockResolvedValue(VIEWER);
  requireWorkflowViewerMock.mockResolvedValue(VIEWER);
});

describe("startWorkflowForEntity", () => {
  it("rejects an invalid entityType before calling startInstance", async () => {
    await expect(
      startWorkflowForEntity({
        templateId: "tmpl-1",
        entityType: "NOT_A_REAL_TYPE",
        entityId: "e1",
      })
    ).rejects.toThrow(/invalid workflow entity type/i);
    expect(startInstanceCore).not.toHaveBeenCalled();
  });

  it("authorizes via requireWorkflowRunner and starts a new instance from the chosen template", async () => {
    startInstanceCore.mockResolvedValueOnce({ id: "inst-1" });

    const result = await startWorkflowForEntity({
      templateId: "tmpl-1",
      entityType: "PARTNER",
      entityId: "p1",
    });

    expect(requireWorkflowRunnerMock).toHaveBeenCalledTimes(1);
    expect(result).toEqual({ ok: true, instanceId: "inst-1", created: true });
    expect(startInstanceCore).toHaveBeenCalledTimes(1);
    const call = startInstanceCore.mock.calls[0][0];
    expect(call.templateId).toBe("tmpl-1");
    expect(call.subjectType).toBe("PARTNER");
    expect(call.subjectId).toBe("p1");
    expect(call.ownerId).toBe("viewer-1"); // defaults to the viewer
    expect(call.startedById).toBe("viewer-1");
  });

  it("honors an explicit ownerId instead of defaulting to the viewer", async () => {
    startInstanceCore.mockResolvedValueOnce({ id: "inst-2" });

    await startWorkflowForEntity({
      templateId: "tmpl-1",
      entityType: "CHAPTER",
      entityId: "c1",
      ownerId: "owner-9",
    });

    const call = startInstanceCore.mock.calls[0][0];
    expect(call.ownerId).toBe("owner-9");
  });

  it("rejects an invalid dueAt", async () => {
    await expect(
      startWorkflowForEntity({
        templateId: "tmpl-1",
        entityType: "PARTNER",
        entityId: "p1",
        dueAt: "not-a-date",
      })
    ).rejects.toThrow(/invalid due date/i);
    expect(startInstanceCore).not.toHaveBeenCalled();
  });
});

describe("attachWorkflowToEntityAction", () => {
  it("authorizes via requireWorkflowRunner and calls attachWorkflowToEntity with the right args", async () => {
    attachWorkflowToEntityCore.mockResolvedValueOnce({ attached: true, alreadyPrimary: false, attachmentId: "att-1" });

    const result = await attachWorkflowToEntityAction({
      instanceId: "inst-1",
      entityType: "PARTNER",
      entityId: "p1",
      relationship: "SECONDARY",
    });

    expect(requireWorkflowRunnerMock).toHaveBeenCalledTimes(1);
    expect(result).toEqual({ ok: true });
    expect(attachWorkflowToEntityCore).toHaveBeenCalledTimes(1);
    expect(attachWorkflowToEntityCore).toHaveBeenCalledWith({
      instanceId: "inst-1",
      entityType: "PARTNER",
      entityId: "p1",
      relationship: "SECONDARY",
    });
    expect(detachWorkflowFromEntityCore).not.toHaveBeenCalled();
  });
});

describe("detachWorkflowFromEntityAction", () => {
  it("authorizes via requireWorkflowRunner and calls detachWorkflowFromEntity with the right args", async () => {
    detachWorkflowFromEntityCore.mockResolvedValueOnce({ detachedCount: 1 });

    const result = await detachWorkflowFromEntityAction({
      instanceId: "inst-1",
      entityType: "CHAPTER",
      entityId: "c1",
    });

    expect(requireWorkflowRunnerMock).toHaveBeenCalledTimes(1);
    expect(result).toEqual({ ok: true });
    expect(detachWorkflowFromEntityCore).toHaveBeenCalledTimes(1);
    expect(detachWorkflowFromEntityCore).toHaveBeenCalledWith({
      instanceId: "inst-1",
      entityType: "CHAPTER",
      entityId: "c1",
      relationship: undefined,
    });
    expect(attachWorkflowToEntityCore).not.toHaveBeenCalled();
  });
});

describe("listActiveWorkflowsForEntity", () => {
  it("authorizes via requireWorkflowViewer (read-only) and shapes results with template names", async () => {
    getWorkflowsForEntityMock.mockResolvedValueOnce([
      { id: "w1", title: "Workflow One", status: "ACTIVE", templateId: "tmpl-1" },
      { id: "w2", title: "Workflow Two", status: "BLOCKED", templateId: "tmpl-2" },
    ]);
    workflowTemplateFindMany.mockResolvedValueOnce([
      { id: "tmpl-1", name: "Template One" },
      { id: "tmpl-2", name: "Template Two" },
    ]);

    const result = await listActiveWorkflowsForEntity({ entityType: "PARTNER", entityId: "p1" });

    expect(requireWorkflowViewerMock).toHaveBeenCalledTimes(1);
    expect(requireWorkflowRunnerMock).not.toHaveBeenCalled();
    expect(result).toEqual([
      { id: "w1", title: "Workflow One", status: "ACTIVE", templateName: "Template One" },
      { id: "w2", title: "Workflow Two", status: "BLOCKED", templateName: "Template Two" },
    ]);
  });

  it("rejects an invalid entityType before querying", async () => {
    await expect(
      listActiveWorkflowsForEntity({ entityType: "NOT_A_REAL_TYPE", entityId: "e1" })
    ).rejects.toThrow(/invalid workflow entity type/i);
    expect(getWorkflowsForEntityMock).not.toHaveBeenCalled();
  });

  it("returns an empty array without a template lookup when there are no workflows", async () => {
    getWorkflowsForEntityMock.mockResolvedValueOnce([]);

    const result = await listActiveWorkflowsForEntity({ entityType: "PARTNER", entityId: "p1" });

    expect(result).toEqual([]);
    expect(workflowTemplateFindMany).not.toHaveBeenCalled();
  });
});

describe("getTemplatePreview", () => {
  it("authorizes via requireWorkflowViewer (read-only) and shapes the loaded definition into a launch preview", async () => {
    const template = twoStageTemplate();
    getTemplateDefinitionMock.mockResolvedValueOnce(template);

    const result = await getTemplatePreview({ id: "tmpl-1" });

    expect(requireWorkflowViewerMock).toHaveBeenCalledTimes(1);
    expect(requireWorkflowRunnerMock).not.toHaveBeenCalled();
    expect(getTemplateDefinitionMock).toHaveBeenCalledWith("tmpl-1");
    expect(result).toEqual({
      templateName: template.name,
      stageCount: 2,
      firstStageName: "Stage A",
      firstStepNames: ["a1", "a2"],
      estimatedActionsCount: 0,
      estimatedMeetingsCount: 0,
      hasEscalation: false,
    });
  });

  it("returns null when the template no longer exists", async () => {
    getTemplateDefinitionMock.mockResolvedValueOnce(null);

    const result = await getTemplatePreview({ id: "missing" });

    expect(result).toBeNull();
  });

  it("rejects a missing id before loading the definition", async () => {
    await expect(getTemplatePreview({})).rejects.toThrow();
    expect(getTemplateDefinitionMock).not.toHaveBeenCalled();
  });
});

describe("listAttachableWorkflowCandidates", () => {
  it("authorizes via requireWorkflowViewer (read-only) and shapes results with template names", async () => {
    workflowInstanceFindMany.mockResolvedValueOnce([
      { id: "w1", title: "Hire an Instructor", status: "ACTIVE", template: { name: "Instructor Hiring" } },
      { id: "w2", title: "Hire Another One", status: "BLOCKED", template: { name: "Instructor Hiring" } },
    ]);

    const result = await listAttachableWorkflowCandidates({ query: "hire" });

    expect(requireWorkflowViewerMock).toHaveBeenCalledTimes(1);
    expect(requireWorkflowRunnerMock).not.toHaveBeenCalled();
    expect(result).toEqual([
      { id: "w1", title: "Hire an Instructor", status: "ACTIVE", templateName: "Instructor Hiring" },
      { id: "w2", title: "Hire Another One", status: "BLOCKED", templateName: "Instructor Hiring" },
    ]);
  });

  it("returns an empty list without querying prisma when the query is empty or whitespace", async () => {
    const empty = await listAttachableWorkflowCandidates({ query: "" });
    const whitespace = await listAttachableWorkflowCandidates({ query: "   " });
    const missing = await listAttachableWorkflowCandidates({});

    expect(empty).toEqual([]);
    expect(whitespace).toEqual([]);
    expect(missing).toEqual([]);
    expect(workflowInstanceFindMany).not.toHaveBeenCalled();
  });

  it("excludes excludeInstanceId from the query", async () => {
    workflowInstanceFindMany.mockResolvedValueOnce([]);

    await listAttachableWorkflowCandidates({ query: "hire", excludeInstanceId: "w1" });

    expect(workflowInstanceFindMany).toHaveBeenCalledTimes(1);
    const call = workflowInstanceFindMany.mock.calls[0][0];
    expect(call.where.id).toEqual({ not: "w1" });
  });

  it("caps results at the candidate limit", async () => {
    workflowInstanceFindMany.mockResolvedValueOnce([]);

    await listAttachableWorkflowCandidates({ query: "hire" });

    const call = workflowInstanceFindMany.mock.calls[0][0];
    expect(call.take).toBe(20);
  });

  it("only searches active/blocked/on-hold instances", async () => {
    workflowInstanceFindMany.mockResolvedValueOnce([]);

    await listAttachableWorkflowCandidates({ query: "hire" });

    const call = workflowInstanceFindMany.mock.calls[0][0];
    expect(call.where.status).toEqual({ in: ["ACTIVE", "BLOCKED", "ON_HOLD"] });
  });
});

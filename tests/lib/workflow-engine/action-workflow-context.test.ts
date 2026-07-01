import { describe, it, expect, vi, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// Mocks (must be declared before importing the module under test — vi.mock
// factories are hoisted above top-level consts, so any fn referenced inside
// one is wrapped in vi.hoisted()).
// ---------------------------------------------------------------------------

const prismaMocks = vi.hoisted(() => ({
  workflowStepExecutionFindMany: vi.fn(),
  workflowTemplateStageFindMany: vi.fn(),
}));

vi.mock("server-only", () => ({}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    workflowStepExecution: { findMany: prismaMocks.workflowStepExecutionFindMany },
    workflowTemplateStage: { findMany: prismaMocks.workflowTemplateStageFindMany },
  },
}));

import { getWorkflowContextForActionItems } from "@/lib/workflow-engine/card-data";

describe("getWorkflowContextForActionItems", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns an empty Map for an empty input array without querying", async () => {
    const result = await getWorkflowContextForActionItems([]);

    expect(result).toEqual(new Map());
    expect(prismaMocks.workflowStepExecutionFindMany).not.toHaveBeenCalled();
    expect(prismaMocks.workflowTemplateStageFindMany).not.toHaveBeenCalled();
  });

  it("resolves multiple ids in one batched findMany query", async () => {
    prismaMocks.workflowStepExecutionFindMany.mockResolvedValue([
      {
        linkedActionItemId: "a1",
        stageKey: "stage-a",
        instance: { id: "inst-1", title: "Partner Acquisition", templateId: "tmpl-1" },
      },
      {
        linkedActionItemId: "a2",
        stageKey: "stage-b",
        instance: { id: "inst-2", title: "Instructor Hiring", templateId: "tmpl-2" },
      },
    ]);
    prismaMocks.workflowTemplateStageFindMany.mockResolvedValue([
      { templateId: "tmpl-1", key: "stage-a", name: "Stage A" },
      { templateId: "tmpl-2", key: "stage-b", name: "Stage B" },
    ]);

    const result = await getWorkflowContextForActionItems(["a1", "a2", "a3"]);

    expect(prismaMocks.workflowStepExecutionFindMany).toHaveBeenCalledTimes(1);
    expect(prismaMocks.workflowStepExecutionFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { linkedActionItemId: { in: ["a1", "a2", "a3"] } },
      })
    );
    // batched, not findFirst-per-id
    expect(prismaMocks.workflowStepExecutionFindMany).not.toHaveBeenCalledWith(
      expect.objectContaining({ where: { linkedActionItemId: "a1" } })
    );

    expect(result.size).toBe(2);
    expect(result.get("a1")).toEqual({
      instanceId: "inst-1",
      instanceTitle: "Partner Acquisition",
      stageName: "Stage A",
    });
    expect(result.get("a2")).toEqual({
      instanceId: "inst-2",
      instanceTitle: "Instructor Hiring",
      stageName: "Stage B",
    });
  });

  it("omits ids with no linked execution from the returned Map", async () => {
    prismaMocks.workflowStepExecutionFindMany.mockResolvedValue([
      {
        linkedActionItemId: "a1",
        stageKey: "stage-a",
        instance: { id: "inst-1", title: "Partner Acquisition", templateId: "tmpl-1" },
      },
    ]);
    prismaMocks.workflowTemplateStageFindMany.mockResolvedValue([
      { templateId: "tmpl-1", key: "stage-a", name: "Stage A" },
    ]);

    const result = await getWorkflowContextForActionItems(["a1", "a2"]);

    expect(result.has("a1")).toBe(true);
    expect(result.has("a2")).toBe(false);
    expect(result.size).toBe(1);
  });

  it("returns stageName null when no matching WorkflowTemplateStage is found", async () => {
    prismaMocks.workflowStepExecutionFindMany.mockResolvedValue([
      {
        linkedActionItemId: "a1",
        stageKey: "stage-unknown",
        instance: { id: "inst-1", title: "Partner Acquisition", templateId: "tmpl-1" },
      },
    ]);
    prismaMocks.workflowTemplateStageFindMany.mockResolvedValue([]);

    const result = await getWorkflowContextForActionItems(["a1"]);

    expect(result.get("a1")?.stageName).toBeNull();
  });
});

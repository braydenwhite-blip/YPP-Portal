/**
 * Covers the Part 2 + Part 11 activation-layer additions:
 *  (a) the six newly-triggered blueprints carry the expected
 *      ENTITY_STATUS_CHANGED auto-start triggers,
 *  (b)-(d) syncBlueprintTriggersAndAutomations only creates rows that are
 *      actually missing on an already-installed template, is idempotent, and
 *      never touches WorkflowTemplateStage.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

const { prisma } = vi.hoisted(() => ({
  prisma: {
    workflowTemplateStage: {
      findMany: vi.fn(),
      deleteMany: vi.fn(),
      create: vi.fn(),
    },
    workflowAutomationRule: {
      findMany: vi.fn(),
      create: vi.fn(),
    },
    workflowTrigger: {
      findMany: vi.fn(),
      create: vi.fn(),
    },
  },
}));

vi.mock("@/lib/prisma", () => ({ prisma }));

import { blueprintByKey } from "@/lib/workflow-engine/blueprints";
import { syncBlueprintTriggersAndAutomations } from "@/lib/workflow-engine/seed";

describe("blueprint auto-start triggers (Part 2 + Part 11)", () => {
  it("partner-acquisition triggers on PARTNER NOT_STARTED and RESEARCHING", () => {
    const bp = blueprintByKey("partner-acquisition")!;
    expect(bp.triggers).toEqual([
      { event: "ENTITY_STATUS_CHANGED", subjectType: "PARTNER", matchStatus: "NOT_STARTED" },
      { event: "ENTITY_STATUS_CHANGED", subjectType: "PARTNER", matchStatus: "RESEARCHING" },
    ]);
  });

  it("instructor-hiring triggers on INSTRUCTOR_APPLICATION SUBMITTED", () => {
    const bp = blueprintByKey("instructor-hiring")!;
    expect(bp.triggers).toEqual([
      { event: "ENTITY_STATUS_CHANGED", subjectType: "INSTRUCTOR_APPLICATION", matchStatus: "SUBMITTED" },
    ]);
  });

  it("mentorship triggers on MENTORSHIP ACTIVE", () => {
    const bp = blueprintByKey("mentorship")!;
    expect(bp.triggers).toEqual([
      { event: "ENTITY_STATUS_CHANGED", subjectType: "MENTORSHIP", matchStatus: "ACTIVE" },
    ]);
  });

  it("curriculum-approval triggers on CURRICULUM_DRAFT SUBMITTED", () => {
    const bp = blueprintByKey("curriculum-approval")!;
    expect(bp.triggers).toEqual([
      { event: "ENTITY_STATUS_CHANGED", subjectType: "CURRICULUM_DRAFT", matchStatus: "SUBMITTED" },
    ]);
  });

  it("class-weekly-operations triggers on CLASS_OFFERING IN_PROGRESS", () => {
    const bp = blueprintByKey("class-weekly-operations")!;
    expect(bp.triggers).toEqual([
      { event: "ENTITY_STATUS_CHANGED", subjectType: "CLASS_OFFERING", matchStatus: "IN_PROGRESS" },
    ]);
  });

  it("program-final-evaluation triggers on CLASS_OFFERING COMPLETED", () => {
    const bp = blueprintByKey("program-final-evaluation")!;
    expect(bp.triggers).toEqual([
      { event: "ENTITY_STATUS_CHANGED", subjectType: "CLASS_OFFERING", matchStatus: "COMPLETED" },
    ]);
  });
});

describe("syncBlueprintTriggersAndAutomations", () => {
  const bp = blueprintByKey("partner-acquisition")!;

  beforeEach(() => {
    vi.clearAllMocks();
    prisma.workflowTemplateStage.findMany.mockResolvedValue([]);
    prisma.workflowAutomationRule.findMany.mockResolvedValue([]);
    prisma.workflowTrigger.findMany.mockResolvedValue([]);
  });

  it("creates only the triggers missing from the existing rows", async () => {
    // Already has the NOT_STARTED trigger; RESEARCHING is missing.
    prisma.workflowTrigger.findMany.mockResolvedValue([
      {
        event: "ENTITY_STATUS_CHANGED",
        subjectType: "PARTNER",
        matchConfig: { status: "NOT_STARTED" },
      },
    ]);

    const result = await syncBlueprintTriggersAndAutomations(bp, "tmpl-1");

    expect(prisma.workflowTrigger.create).toHaveBeenCalledTimes(1);
    expect(prisma.workflowTrigger.create).toHaveBeenCalledWith({
      data: {
        templateId: "tmpl-1",
        name: "Auto-start on PARTNER -> RESEARCHING",
        event: "ENTITY_STATUS_CHANGED",
        subjectType: "PARTNER",
        matchConfig: { status: "RESEARCHING" },
      },
    });
    expect(result.addedTriggers).toBe(1);
  });

  it("creates only the automations missing from the existing rows", async () => {
    // Pre-populate one existing rule that matches the blueprint's first
    // ON_STAGE_ENTER/SEND_NOTIFICATION automation on the "research" stage so
    // it's skipped, while the rest of the blueprint's automations are new.
    prisma.workflowTemplateStage.findMany.mockResolvedValue([
      { id: "stage-research", key: "research" },
      { id: "stage-outreach", key: "outreach" },
      { id: "stage-response-and-meeting", key: "response-and-meeting" },
      { id: "stage-logistics", key: "logistics" },
      { id: "stage-active", key: "active" },
    ]);

    const firstAutomation = bp.automations![0];
    const firstStageId = firstAutomation.stageKey === "research" ? "stage-research" : null;

    prisma.workflowAutomationRule.findMany.mockResolvedValue([
      {
        trigger: firstAutomation.trigger,
        action: firstAutomation.action,
        stageId: firstStageId,
        stepKey: firstAutomation.stepKey ?? null,
        name: firstAutomation.name,
      },
    ]);

    const result = await syncBlueprintTriggersAndAutomations(bp, "tmpl-1");

    expect(result.addedAutomations).toBe((bp.automations?.length ?? 0) - 1);
    // The already-existing automation must not be recreated.
    expect(prisma.workflowAutomationRule.create).not.toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ name: firstAutomation.name, stageId: firstStageId }),
      })
    );
  });

  it("is idempotent: running twice against an already-complete state creates nothing the second time", async () => {
    prisma.workflowTemplateStage.findMany.mockResolvedValue([
      { id: "stage-research", key: "research" },
      { id: "stage-outreach", key: "outreach" },
      { id: "stage-response-and-meeting", key: "response-and-meeting" },
      { id: "stage-logistics", key: "logistics" },
      { id: "stage-active", key: "active" },
    ]);

    const stageIdByKey: Record<string, string> = {
      research: "stage-research",
      outreach: "stage-outreach",
      "response-and-meeting": "stage-response-and-meeting",
      logistics: "stage-logistics",
      active: "stage-active",
    };

    prisma.workflowAutomationRule.findMany.mockResolvedValue(
      (bp.automations ?? []).map((a) => ({
        trigger: a.trigger,
        action: a.action,
        stageId: a.stageKey ? stageIdByKey[a.stageKey] : null,
        stepKey: a.stepKey ?? null,
        name: a.name,
      }))
    );
    prisma.workflowTrigger.findMany.mockResolvedValue(
      (bp.triggers ?? []).map((t) => ({
        event: t.event,
        subjectType: t.subjectType,
        matchConfig: { status: t.matchStatus },
      }))
    );

    const first = await syncBlueprintTriggersAndAutomations(bp, "tmpl-1");
    expect(first).toEqual({ addedTriggers: 0, addedAutomations: 0 });
    expect(prisma.workflowAutomationRule.create).not.toHaveBeenCalled();
    expect(prisma.workflowTrigger.create).not.toHaveBeenCalled();

    const second = await syncBlueprintTriggersAndAutomations(bp, "tmpl-1");
    expect(second).toEqual({ addedTriggers: 0, addedAutomations: 0 });
    expect(prisma.workflowAutomationRule.create).not.toHaveBeenCalled();
    expect(prisma.workflowTrigger.create).not.toHaveBeenCalled();
  });

  it("never touches WorkflowTemplateStage (no deleteMany/create)", async () => {
    prisma.workflowTrigger.findMany.mockResolvedValue([]);
    prisma.workflowAutomationRule.findMany.mockResolvedValue([]);

    await syncBlueprintTriggersAndAutomations(bp, "tmpl-1");

    expect(prisma.workflowTemplateStage.deleteMany).not.toHaveBeenCalled();
    expect(prisma.workflowTemplateStage.create).not.toHaveBeenCalled();
  });
});

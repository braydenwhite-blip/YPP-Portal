import { describe, it, expect, vi, beforeEach } from "vitest";

// vi.mock factories are hoisted above imports — any fn referenced inside one
// must come from vi.hoisted() (matches tests/lib/workflow-engine/entity-actions.test.ts
// and tests/lib/partners-permissions.test.ts's convention).
const {
  requireWorkflowRunnerMock,
  workflowInstanceFindUnique,
  workflowInstanceUpdate,
  workflowEventCreate,
  workflowStepExecutionFindUnique,
  workflowStepExecutionUpdate,
  actionItemCreate,
  addInstanceNoteCore,
  createMeetingFromWorkflowStepMock,
} = vi.hoisted(() => ({
  requireWorkflowRunnerMock: vi.fn(),
  workflowInstanceFindUnique: vi.fn(),
  workflowInstanceUpdate: vi.fn(),
  workflowEventCreate: vi.fn(),
  workflowStepExecutionFindUnique: vi.fn(),
  workflowStepExecutionUpdate: vi.fn(),
  actionItemCreate: vi.fn(),
  addInstanceNoteCore: vi.fn(),
  createMeetingFromWorkflowStepMock: vi.fn(),
}));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    workflowInstance: { findUnique: workflowInstanceFindUnique, update: workflowInstanceUpdate },
    workflowEvent: { create: workflowEventCreate },
    workflowStepExecution: {
      findUnique: workflowStepExecutionFindUnique,
      update: workflowStepExecutionUpdate,
    },
    actionItem: { create: actionItemCreate },
  },
}));

vi.mock("@/lib/workflow-engine/permissions", () => ({
  requireWorkflowRunner: requireWorkflowRunnerMock,
}));

vi.mock("@/lib/workflow-engine/engine", () => ({
  addInstanceNote: addInstanceNoteCore,
  // Unused by these three actions, but instance-actions.ts imports them at
  // module top-level so they must exist on the mock to avoid an import error.
  advanceInstance: vi.fn(),
  blockStep: vi.fn(),
  cancelInstance: vi.fn(),
  completeStep: vi.fn(),
  reassignStep: vi.fn(),
  setInstanceOwner: vi.fn(),
  skipStep: vi.fn(),
  startInstance: vi.fn(),
  unblockStep: vi.fn(),
}));

vi.mock("@/lib/workflow-engine/meeting-sync", () => ({
  createMeetingFromWorkflowStep: createMeetingFromWorkflowStepMock,
}));

import {
  createManualActionForStep,
  escalateWorkflow,
  scheduleMeetingForStep,
} from "@/lib/workflow-engine/instance-actions";

const VIEWER = { id: "viewer-1" };

function resetAll() {
  requireWorkflowRunnerMock.mockReset().mockResolvedValue(VIEWER);
  workflowInstanceFindUnique.mockReset();
  workflowInstanceUpdate.mockReset();
  workflowEventCreate.mockReset();
  workflowStepExecutionFindUnique.mockReset();
  workflowStepExecutionUpdate.mockReset();
  actionItemCreate.mockReset();
  addInstanceNoteCore.mockReset();
  createMeetingFromWorkflowStepMock.mockReset();
}

describe("escalateWorkflow", () => {
  beforeEach(resetAll);

  it("authorizes via requireWorkflowRunner, validates input, and escalates the instance", async () => {
    workflowInstanceFindUnique.mockResolvedValue({ title: "Chapter Launch", escalatedAt: null });
    workflowInstanceUpdate.mockResolvedValue({});
    workflowEventCreate.mockResolvedValue({});

    const result = await escalateWorkflow({ instanceId: "inst-1" });

    expect(requireWorkflowRunnerMock).toHaveBeenCalledTimes(1);
    expect(workflowInstanceFindUnique).toHaveBeenCalledWith({
      where: { id: "inst-1" },
      select: { title: true, escalatedAt: true },
    });
    expect(workflowInstanceUpdate).toHaveBeenCalledWith({
      where: { id: "inst-1" },
      data: { escalatedAt: expect.any(Date), lastEscalationAt: expect.any(Date) },
    });
    expect(workflowEventCreate).toHaveBeenCalledWith({
      data: {
        instanceId: "inst-1",
        kind: "ESCALATED",
        summary: "Escalated to leadership.",
        actorId: "viewer-1",
      },
    });
    expect(result).toEqual({ ok: true });
  });

  it("does not overwrite an existing escalatedAt", async () => {
    const firstEscalation = new Date("2026-01-01T00:00:00.000Z");
    workflowInstanceFindUnique.mockResolvedValue({ title: "X", escalatedAt: firstEscalation });
    workflowInstanceUpdate.mockResolvedValue({});
    workflowEventCreate.mockResolvedValue({});

    await escalateWorkflow({ instanceId: "inst-1" });

    expect(workflowInstanceUpdate).toHaveBeenCalledWith({
      where: { id: "inst-1" },
      data: { escalatedAt: firstEscalation, lastEscalationAt: expect.any(Date) },
    });
  });

  it("rejects invalid input before authorizing side effects", async () => {
    await expect(escalateWorkflow({})).rejects.toThrow();
    expect(workflowInstanceUpdate).not.toHaveBeenCalled();
  });

  it("throws when the instance doesn't exist", async () => {
    workflowInstanceFindUnique.mockResolvedValue(null);
    await expect(escalateWorkflow({ instanceId: "missing" })).rejects.toThrow(
      "Workflow instance not found."
    );
    expect(workflowInstanceUpdate).not.toHaveBeenCalled();
  });
});

describe("createManualActionForStep", () => {
  beforeEach(resetAll);

  it("authorizes, validates, creates the action the way effectCreateAction does, and links it back", async () => {
    workflowStepExecutionFindUnique.mockResolvedValue({
      id: "exec-1",
      title: "Draft the agenda",
      instanceId: "inst-1",
      linkedActionItemId: null,
    });
    workflowInstanceFindUnique.mockResolvedValue({
      id: "inst-1",
      title: "Chapter Launch",
      chapterId: "chapter-1",
    });
    actionItemCreate.mockResolvedValue({ id: "action-1" });
    workflowStepExecutionUpdate.mockResolvedValue({});
    addInstanceNoteCore.mockResolvedValue(undefined);

    const result = await createManualActionForStep({ executionId: "exec-1" });

    expect(requireWorkflowRunnerMock).toHaveBeenCalledTimes(1);
    expect(actionItemCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          title: 'Complete "Draft the agenda"',
          leadId: "viewer-1",
          createdById: "viewer-1",
          chapterId: "chapter-1",
          sourceType: "WORKFLOW_STEP",
          sourceId: "exec-1",
        }),
      })
    );
    expect(workflowStepExecutionUpdate).toHaveBeenCalledWith({
      where: { id: "exec-1" },
      data: { linkedActionItemId: "action-1" },
    });
    expect(addInstanceNoteCore).toHaveBeenCalledWith(
      "inst-1",
      expect.stringContaining("Draft the agenda"),
      "viewer-1"
    );
    expect(result).toEqual({ ok: true, actionItemId: "action-1" });
  });

  it("uses a custom title when given", async () => {
    workflowStepExecutionFindUnique.mockResolvedValue({
      id: "exec-1",
      title: "Draft the agenda",
      instanceId: "inst-1",
      linkedActionItemId: null,
    });
    workflowInstanceFindUnique.mockResolvedValue({
      id: "inst-1",
      title: "Chapter Launch",
      chapterId: null,
    });
    actionItemCreate.mockResolvedValue({ id: "action-2" });

    await createManualActionForStep({ executionId: "exec-1", title: "Custom title" });

    expect(actionItemCreate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ title: "Custom title" }) })
    );
  });

  it("throws when the step already has a linked action", async () => {
    workflowStepExecutionFindUnique.mockResolvedValue({
      id: "exec-1",
      title: "Draft the agenda",
      instanceId: "inst-1",
      linkedActionItemId: "existing-action",
    });

    await expect(createManualActionForStep({ executionId: "exec-1" })).rejects.toThrow(
      "This step already has a linked action."
    );
    expect(actionItemCreate).not.toHaveBeenCalled();
  });

  it("throws when the step doesn't exist", async () => {
    workflowStepExecutionFindUnique.mockResolvedValue(null);
    await expect(createManualActionForStep({ executionId: "missing" })).rejects.toThrow(
      "Step not found."
    );
  });
});

describe("scheduleMeetingForStep", () => {
  beforeEach(resetAll);

  it("authorizes, validates, and calls through to createMeetingFromWorkflowStep", async () => {
    createMeetingFromWorkflowStepMock.mockResolvedValue({ meetingId: "meeting-1" });
    workflowStepExecutionFindUnique.mockResolvedValue({ instanceId: "inst-1" });

    const scheduledAt = "2026-07-10T15:00:00.000Z";
    const result = await scheduleMeetingForStep({
      executionId: "exec-1",
      scheduledAt,
      meetingType: "GENERIC",
    });

    expect(requireWorkflowRunnerMock).toHaveBeenCalledTimes(1);
    expect(createMeetingFromWorkflowStepMock).toHaveBeenCalledWith({
      stepExecutionId: "exec-1",
      meetingType: "GENERIC",
      scheduledAt: new Date(scheduledAt),
      actorId: "viewer-1",
    });
    expect(result).toEqual({ ok: true, meetingId: "meeting-1" });
  });

  it("defaults to ~3 days from now when no scheduledAt is given", async () => {
    createMeetingFromWorkflowStepMock.mockResolvedValue({ meetingId: "meeting-2" });
    workflowStepExecutionFindUnique.mockResolvedValue({ instanceId: "inst-1" });

    const before = Date.now();
    await scheduleMeetingForStep({ executionId: "exec-1" });
    const after = Date.now();

    const call = createMeetingFromWorkflowStepMock.mock.calls[0][0];
    const threeDaysMs = 3 * 24 * 60 * 60 * 1000;
    expect(call.scheduledAt.getTime()).toBeGreaterThanOrEqual(before + threeDaysMs - 5000);
    expect(call.scheduledAt.getTime()).toBeLessThanOrEqual(after + threeDaysMs + 5000);
  });

  it("rejects invalid input before calling the meeting-sync effect", async () => {
    await expect(scheduleMeetingForStep({})).rejects.toThrow();
    expect(createMeetingFromWorkflowStepMock).not.toHaveBeenCalled();
  });
});

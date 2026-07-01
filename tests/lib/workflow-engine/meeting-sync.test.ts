import { describe, it, expect, vi, beforeEach } from "vitest";

const {
  executionFindFirst,
  executionFindUnique,
  executionUpdate,
  instanceFindUnique,
  meetingFindUnique,
  meetingCreate,
  actionItemCount,
  templateStepFindUnique,
  meetingFollowUpFindMany,
  officerTopicFindMany,
  completeStep,
  addInstanceNote,
} = vi.hoisted(() => ({
  executionFindFirst: vi.fn(),
  executionFindUnique: vi.fn(),
  executionUpdate: vi.fn(),
  instanceFindUnique: vi.fn(),
  meetingFindUnique: vi.fn(),
  meetingCreate: vi.fn(),
  actionItemCount: vi.fn(),
  templateStepFindUnique: vi.fn(),
  meetingFollowUpFindMany: vi.fn(),
  officerTopicFindMany: vi.fn(),
  completeStep: vi.fn(),
  addInstanceNote: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    workflowStepExecution: {
      findFirst: executionFindFirst,
      findUnique: executionFindUnique,
      update: executionUpdate,
    },
    workflowInstance: { findUnique: instanceFindUnique },
    meeting: { findUnique: meetingFindUnique, create: meetingCreate },
    actionItem: { count: actionItemCount },
    workflowTemplateStep: { findUnique: templateStepFindUnique },
    meetingFollowUp: { findMany: meetingFollowUpFindMany },
    officerTopic: { findMany: officerTopicFindMany },
  },
}));

vi.mock("@/lib/workflow-engine/engine", () => ({
  completeStep,
  addInstanceNote,
}));

import {
  getWorkflowContextForMeeting,
  createMeetingFromWorkflowStep,
  syncMeetingOutcomeToWorkflow,
  carryForwardWorkflowItems,
} from "@/lib/workflow-engine/meeting-sync";

const MEETING_ID = "meeting-1";

function resetAll() {
  executionFindFirst.mockReset();
  executionFindUnique.mockReset();
  executionUpdate.mockReset();
  instanceFindUnique.mockReset();
  meetingFindUnique.mockReset();
  meetingCreate.mockReset();
  actionItemCount.mockReset();
  templateStepFindUnique.mockReset();
  meetingFollowUpFindMany.mockReset();
  officerTopicFindMany.mockReset();
  completeStep.mockReset();
  addInstanceNote.mockReset();
}

function instanceRow(over: Partial<Record<string, unknown>> = {}) {
  return {
    id: "instance-1",
    title: "Chapter Launch",
    template: { name: "Chapter Launch Template" },
    currentStage: { key: "stage-1", name: "Kickoff" },
    executions: [],
    ...over,
  };
}

describe("getWorkflowContextForMeeting", () => {
  beforeEach(resetAll);

  it("resolves via linkedMeetingId first", async () => {
    executionFindFirst.mockResolvedValue({
      id: "exec-1",
      title: "Kickoff meeting",
      stageKey: "stage-1",
      stepId: "step-1",
      instanceId: "instance-1",
    });
    instanceFindUnique.mockResolvedValue(instanceRow());
    actionItemCount.mockResolvedValue(0);
    templateStepFindUnique.mockResolvedValue({ description: "Bring the launch checklist." });

    const context = await getWorkflowContextForMeeting(MEETING_ID);

    expect(meetingFindUnique).not.toHaveBeenCalled();
    expect(context).toEqual({
      instanceId: "instance-1",
      instanceTitle: "Chapter Launch",
      templateName: "Chapter Launch Template",
      stageKey: "stage-1",
      stageName: "Kickoff",
      stepExecutionId: "exec-1",
      stepTitle: "Kickoff meeting",
      openActionsCount: 0,
      blockedStepsCount: 0,
      guidance: "Bring the launch checklist.",
    });
  });

  it("falls back to Meeting.sourceType/sourceId when no execution is linked", async () => {
    executionFindFirst.mockResolvedValue(null);
    meetingFindUnique.mockResolvedValue({ sourceType: "WorkflowInstance", sourceId: "instance-2" });
    instanceFindUnique.mockResolvedValue(
      instanceRow({ id: "instance-2", currentStage: null })
    );
    actionItemCount.mockResolvedValue(0);

    const context = await getWorkflowContextForMeeting(MEETING_ID);

    expect(templateStepFindUnique).not.toHaveBeenCalled();
    expect(context).toMatchObject({
      instanceId: "instance-2",
      stepExecutionId: null,
      stepTitle: null,
      guidance: null,
      stageKey: null,
      stageName: null,
    });
  });

  it("returns null when the meeting isn't workflow-linked at all", async () => {
    executionFindFirst.mockResolvedValue(null);
    meetingFindUnique.mockResolvedValue({ sourceType: null, sourceId: null });

    const context = await getWorkflowContextForMeeting(MEETING_ID);

    expect(context).toBeNull();
    expect(instanceFindUnique).not.toHaveBeenCalled();
  });

  it("counts only non-COMPLETE linked action items and BLOCKED steps", async () => {
    executionFindFirst.mockResolvedValue({
      id: "exec-1",
      title: "Kickoff meeting",
      stageKey: "stage-1",
      stepId: null,
      instanceId: "instance-1",
    });
    instanceFindUnique.mockResolvedValue(
      instanceRow({
        executions: [
          { linkedActionItemId: "a1", state: "COMPLETE" },
          { linkedActionItemId: "a2", state: "BLOCKED" },
          { linkedActionItemId: null, state: "PENDING" },
        ],
      })
    );
    actionItemCount.mockResolvedValue(1);

    const context = await getWorkflowContextForMeeting(MEETING_ID);

    expect(actionItemCount).toHaveBeenCalledWith({
      where: { id: { in: ["a1", "a2"] }, status: { not: "COMPLETE" } },
    });
    expect(context?.blockedStepsCount).toBe(1);
    expect(context?.openActionsCount).toBe(1);
  });
});

describe("createMeetingFromWorkflowStep", () => {
  beforeEach(resetAll);

  it("creates a meeting linked to the instance and updates the step execution", async () => {
    executionFindUnique.mockResolvedValue({
      id: "exec-1",
      title: "Board sync",
      instanceId: "instance-1",
    });
    instanceFindUnique.mockResolvedValue({
      id: "instance-1",
      title: "Chapter Launch",
      chapterId: "chapter-1",
      ownerId: "owner-1",
    });
    meetingCreate.mockResolvedValue({ id: "meeting-new" });

    const scheduledAt = new Date("2026-07-10T15:00:00.000Z");
    const result = await createMeetingFromWorkflowStep({
      stepExecutionId: "exec-1",
      scheduledAt,
      actorId: "actor-1",
    });

    expect(result).toEqual({ meetingId: "meeting-new" });
    expect(meetingCreate).toHaveBeenCalledWith({
      data: {
        type: "GENERIC",
        status: "SCHEDULED",
        title: "Board sync",
        scheduledAt,
        facilitatorId: "owner-1",
        chapterId: "chapter-1",
        sourceType: "WorkflowInstance",
        sourceId: "instance-1",
        createdById: "actor-1",
      },
      select: { id: true },
    });
    expect(executionUpdate).toHaveBeenCalledWith({
      where: { id: "exec-1" },
      data: { linkedMeetingId: "meeting-new" },
    });
    expect(addInstanceNote).toHaveBeenCalledWith(
      "instance-1",
      expect.stringContaining("Board sync"),
      "actor-1"
    );
  });

  it("throws when the step execution doesn't exist", async () => {
    executionFindUnique.mockResolvedValue(null);
    await expect(
      createMeetingFromWorkflowStep({ stepExecutionId: "missing", scheduledAt: new Date() })
    ).rejects.toThrow("Step execution not found.");
  });
});

describe("syncMeetingOutcomeToWorkflow", () => {
  beforeEach(resetAll);

  it("calls completeStep exactly once when a step is linked, then notes the instance", async () => {
    executionFindFirst.mockResolvedValue({
      id: "exec-1",
      title: "Kickoff meeting",
      stageKey: "stage-1",
      stepId: null,
      instanceId: "instance-1",
    });
    instanceFindUnique.mockResolvedValue(instanceRow());
    actionItemCount.mockResolvedValue(0);
    meetingFindUnique.mockResolvedValue({ title: "Weekly Officer Sync" });

    await syncMeetingOutcomeToWorkflow(MEETING_ID, "actor-1");

    expect(completeStep).toHaveBeenCalledTimes(1);
    expect(completeStep).toHaveBeenCalledWith("exec-1", { actorId: "actor-1", now: undefined });
    expect(addInstanceNote).toHaveBeenCalledWith(
      "instance-1",
      expect.stringContaining("Weekly Officer Sync"),
      "actor-1"
    );
  });

  it("does nothing (no throw) when the meeting isn't workflow-linked", async () => {
    executionFindFirst.mockResolvedValue(null);
    meetingFindUnique.mockResolvedValue({ sourceType: null, sourceId: null });

    await expect(syncMeetingOutcomeToWorkflow(MEETING_ID, "actor-1")).resolves.toBeUndefined();
    expect(completeStep).not.toHaveBeenCalled();
    expect(addInstanceNote).not.toHaveBeenCalled();
  });

  it("does not call completeStep when the fallback context has no linked step", async () => {
    executionFindFirst.mockResolvedValue(null);
    meetingFindUnique
      .mockResolvedValueOnce({ sourceType: "WorkflowInstance", sourceId: "instance-2" })
      .mockResolvedValueOnce({ title: "Fallback meeting" });
    instanceFindUnique.mockResolvedValue(instanceRow({ id: "instance-2", currentStage: null }));
    actionItemCount.mockResolvedValue(0);

    await syncMeetingOutcomeToWorkflow(MEETING_ID, "actor-1");

    expect(completeStep).not.toHaveBeenCalled();
    expect(addInstanceNote).toHaveBeenCalledWith(
      "instance-2",
      expect.stringContaining("Fallback meeting"),
      "actor-1"
    );
  });

  it("swallows a thrown error inside completeStep and never propagates", async () => {
    executionFindFirst.mockResolvedValue({
      id: "exec-1",
      title: "Kickoff meeting",
      stageKey: "stage-1",
      stepId: null,
      instanceId: "instance-1",
    });
    instanceFindUnique.mockResolvedValue(instanceRow());
    actionItemCount.mockResolvedValue(0);
    meetingFindUnique.mockResolvedValue({ title: "Weekly Officer Sync" });
    completeStep.mockRejectedValue(new Error("boom"));

    await expect(syncMeetingOutcomeToWorkflow(MEETING_ID, "actor-1")).resolves.toBeUndefined();
  });

  it("swallows an error thrown while resolving context", async () => {
    executionFindFirst.mockRejectedValue(new Error("db down"));

    await expect(syncMeetingOutcomeToWorkflow(MEETING_ID, "actor-1")).resolves.toBeUndefined();
    expect(completeStep).not.toHaveBeenCalled();
  });
});

describe("carryForwardWorkflowItems", () => {
  beforeEach(resetAll);

  it("notes each open follow-up and topic on the workflow instance", async () => {
    executionFindFirst.mockResolvedValue({
      id: "exec-1",
      title: "Kickoff meeting",
      stageKey: "stage-1",
      stepId: null,
      instanceId: "instance-1",
    });
    instanceFindUnique.mockResolvedValue(instanceRow());
    actionItemCount.mockResolvedValue(0);
    meetingFollowUpFindMany.mockResolvedValue([{ id: "f1", title: "Send onboarding packet" }]);
    officerTopicFindMany.mockResolvedValue([{ id: "t1", title: "Budget approval" }]);

    const result = await carryForwardWorkflowItems(MEETING_ID);

    expect(result).toEqual({ carriedCount: 2 });
    expect(meetingFollowUpFindMany).toHaveBeenCalledWith({
      where: { meetingId: MEETING_ID, status: { in: ["OPEN", "IN_PROGRESS"] } },
      select: { id: true, title: true },
    });
    expect(officerTopicFindMany).toHaveBeenCalledWith({
      where: { meetingId: MEETING_ID, status: { in: ["OPEN", "DEFERRED"] } },
      select: { id: true, title: true },
    });
    expect(addInstanceNote).toHaveBeenCalledTimes(2);
    expect(addInstanceNote).toHaveBeenCalledWith(
      "instance-1",
      expect.stringContaining("Send onboarding packet"),
      null
    );
    expect(addInstanceNote).toHaveBeenCalledWith(
      "instance-1",
      expect.stringContaining("Budget approval"),
      null
    );
  });

  it("returns carriedCount 0 and does not query rows when the meeting isn't workflow-linked", async () => {
    executionFindFirst.mockResolvedValue(null);
    meetingFindUnique.mockResolvedValue({ sourceType: null, sourceId: null });

    const result = await carryForwardWorkflowItems(MEETING_ID);

    expect(result).toEqual({ carriedCount: 0 });
    expect(meetingFollowUpFindMany).not.toHaveBeenCalled();
    expect(officerTopicFindMany).not.toHaveBeenCalled();
  });
});

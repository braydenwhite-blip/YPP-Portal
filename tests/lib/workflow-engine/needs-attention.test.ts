import { describe, expect, it } from "vitest";

import {
  workflowAttention,
  type AttentionWorkflow,
} from "@/lib/people-strategy/needs-attention";

import { exec, NOW } from "./_fixtures";

function daysAgo(days: number): string {
  return new Date(new Date(NOW).getTime() - days * 24 * 60 * 60 * 1000).toISOString();
}

function daysFromNow(days: number): string {
  return new Date(new Date(NOW).getTime() + days * 24 * 60 * 60 * 1000).toISOString();
}

function baseWorkflow(over: Partial<AttentionWorkflow> = {}): AttentionWorkflow {
  return {
    id: "wf-1",
    title: "Chapter Launch — Test Chapter",
    href: "/workflows/wf-1",
    chapterId: "chapter-1",
    ownerId: "user-1",
    ownerName: "Jordan Lee",
    instance: {
      status: "ACTIVE",
      dueAt: null,
      followUpAt: null,
      escalatedAt: null,
      startedAt: NOW,
      completionPercent: 0,
    },
    currentStage: null,
    currentStageEnteredAt: null,
    executions: [],
    ...over,
  };
}

describe("workflowAttention", () => {
  it("on-track workflow with no health reasons produces no attention items", () => {
    const items = workflowAttention(
      [
        baseWorkflow({
          executions: [
            exec({
              stageKey: "a",
              stepKey: "a1",
              state: "COMPLETE",
              startedAt: daysAgo(2),
              completedAt: daysAgo(1),
            }),
          ],
        }),
      ],
      new Date(NOW)
    );
    expect(items).toEqual([]);
  });

  it("maps a blocked step to WORKFLOW_BLOCKED / high, non-confidential", () => {
    const items = workflowAttention(
      [
        baseWorkflow({
          instance: {
            status: "BLOCKED",
            dueAt: null,
            followUpAt: null,
            escalatedAt: null,
            startedAt: NOW,
            completionPercent: 0,
          },
          executions: [
            exec({
              stageKey: "a",
              stepKey: "a1",
              title: "Confirm partner meeting",
              state: "BLOCKED",
              blockedReason: "no response from partner",
            }),
          ],
        }),
      ],
      new Date(NOW)
    );
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({
      category: "WORKFLOW_BLOCKED",
      severity: "high",
      subjectKind: "workflow",
      subjectId: "wf-1",
      subjectLabel: "Chapter Launch — Test Chapter",
      confidential: false,
      reason: '"Confirm partner meeting" is blocked: no response from partner',
    });
  });

  it("maps an overdue required step to WORKFLOW_STEP_OVERDUE / high", () => {
    const items = workflowAttention(
      [
        baseWorkflow({
          executions: [
            exec({
              stageKey: "a",
              stepKey: "a1",
              state: "PENDING",
              isRequired: true,
              dueAt: daysAgo(2),
            }),
          ],
        }),
      ],
      new Date(NOW)
    );
    expect(items).toHaveLength(1);
    expect(items[0].category).toBe("WORKFLOW_STEP_OVERDUE");
    expect(items[0].severity).toBe("high");
    expect(items[0].reason).toBe("1 required step overdue");
  });

  it("maps no-activity to WORKFLOW_INSTANCE_STALLED / medium", () => {
    const items = workflowAttention(
      [
        baseWorkflow({
          instance: {
            status: "ACTIVE",
            dueAt: null,
            followUpAt: null,
            escalatedAt: null,
            startedAt: daysAgo(11),
            completionPercent: 0,
          },
          executions: [exec({ stageKey: "a", stepKey: "a1", state: "PENDING" })],
        }),
      ],
      new Date(NOW)
    );
    expect(items).toHaveLength(1);
    expect(items[0].category).toBe("WORKFLOW_INSTANCE_STALLED");
    expect(items[0].severity).toBe("medium");
    expect(items[0].reason).toBe("No activity in 11 days");
  });

  it("maps a stage past its SLA window to WORKFLOW_STAGE_DURATION_EXCEEDED / medium", () => {
    const items = workflowAttention(
      [
        baseWorkflow({
          currentStage: { key: "a", slaHours: 7 * 24, name: "Outreach" },
          currentStageEnteredAt: daysAgo(10),
          executions: [
            exec({
              stageKey: "a",
              stepKey: "a1",
              state: "IN_PROGRESS",
              startedAt: daysAgo(10),
            }),
          ],
        }),
      ],
      new Date(NOW)
    );
    expect(items).toHaveLength(1);
    expect(items[0].category).toBe("WORKFLOW_STAGE_DURATION_EXCEEDED");
    expect(items[0].severity).toBe("medium");
    expect(items[0].reason).toContain('"Outreach" has run');
  });

  it("maps an unscheduled required meeting step to WORKFLOW_MEETING_MISSING / medium", () => {
    const items = workflowAttention(
      [
        baseWorkflow({
          executions: [
            exec({
              stageKey: "a",
              stepKey: "a1",
              kind: "MEETING",
              state: "PENDING",
              isRequired: true,
              dueAt: daysFromNow(1),
              linkedMeetingId: null,
            }),
          ],
        }),
      ],
      new Date(NOW)
    );
    expect(items).toHaveLength(1);
    expect(items[0].category).toBe("WORKFLOW_MEETING_MISSING");
    expect(items[0].severity).toBe("medium");
    expect(items[0].reason).toBe("Meeting not scheduled");
  });

  it("maps a step with no owner to WORKFLOW_OWNER_MISSING / medium", () => {
    const items = workflowAttention(
      [
        baseWorkflow({
          executions: [
            exec({ stageKey: "a", stepKey: "a1", state: "PENDING", ownerId: null }),
          ],
        }),
      ],
      new Date(NOW)
    );
    expect(items).toHaveLength(1);
    expect(items[0].category).toBe("WORKFLOW_OWNER_MISSING");
    expect(items[0].severity).toBe("medium");
    expect(items[0].reason).toBe("1 step has no owner");
  });

  it("maps an escalated instance to WORKFLOW_ESCALATED / critical", () => {
    const items = workflowAttention(
      [
        baseWorkflow({
          instance: {
            status: "ACTIVE",
            dueAt: null,
            followUpAt: null,
            escalatedAt: daysAgo(1),
            startedAt: NOW,
            completionPercent: 0,
          },
          executions: [
            exec({
              stageKey: "a",
              stepKey: "a1",
              state: "COMPLETE",
              startedAt: daysAgo(2),
              completedAt: daysAgo(1),
            }),
          ],
        }),
      ],
      new Date(NOW)
    );
    expect(items).toHaveLength(1);
    expect(items[0].category).toBe("WORKFLOW_ESCALATED");
    expect(items[0].severity).toBe("critical");
    expect(items[0].reason).toBe("Escalated to leadership");
  });

  it("emits one distinct AttentionItem per reason when a workflow has multiple problems", () => {
    const items = workflowAttention(
      [
        baseWorkflow({
          instance: {
            status: "BLOCKED",
            dueAt: null,
            followUpAt: null,
            escalatedAt: daysAgo(1),
            startedAt: NOW,
            completionPercent: 0,
          },
          executions: [
            exec({
              stageKey: "a",
              stepKey: "a1",
              title: "Confirm partner meeting",
              state: "BLOCKED",
              blockedReason: "no response from partner",
            }),
            exec({
              stageKey: "a",
              stepKey: "a2",
              state: "PENDING",
              isRequired: true,
              dueAt: daysAgo(3),
              ownerId: null,
            }),
          ],
        }),
      ],
      new Date(NOW)
    );

    const categories = items.map((i) => i.category).sort();
    expect(categories).toEqual(
      [
        "WORKFLOW_BLOCKED",
        "WORKFLOW_ESCALATED",
        "WORKFLOW_OWNER_MISSING",
        "WORKFLOW_STEP_OVERDUE",
      ].sort()
    );
    // Every item shares the workflow's subject identity but carries its own reason.
    for (const item of items) {
      expect(item.subjectKind).toBe("workflow");
      expect(item.subjectId).toBe("wf-1");
      expect(item.confidential).toBe(false);
    }
    expect(new Set(items.map((i) => i.reason)).size).toBe(items.length);
  });

  it("skips COMPLETED/CANCELLED instances (no reasons from computeWorkflowHealth)", () => {
    const items = workflowAttention(
      [
        baseWorkflow({
          instance: {
            status: "COMPLETED" as never,
            dueAt: null,
            followUpAt: null,
            escalatedAt: null,
            startedAt: NOW,
            completionPercent: 100,
          },
        }),
      ],
      new Date(NOW)
    );
    expect(items).toEqual([]);
  });
});

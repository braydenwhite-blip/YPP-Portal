import { describe, expect, it } from "vitest";

import {
  computeWorkflowHealth,
  MEETING_SCHEDULING_LEAD_DAYS,
  STALLED_NO_ACTIVITY_DAYS,
} from "@/lib/workflow-engine/health";
import type { StepExecutionView, WorkflowInstanceStatusValue } from "@/lib/workflow-engine/types";

import { exec, NOW } from "./_fixtures";

type HealthInstance = {
  status: WorkflowInstanceStatusValue;
  dueAt: string | null;
  followUpAt: string | null;
  escalatedAt: string | null;
  startedAt: string;
  completionPercent: number;
};

function baseInstance(over: Partial<HealthInstance> = {}): HealthInstance {
  return {
    status: "ACTIVE",
    dueAt: null,
    followUpAt: null,
    escalatedAt: null,
    startedAt: NOW,
    completionPercent: 0,
    ...over,
  };
}

const CURRENT_STAGE = { key: "a", slaHours: 7 * 24, name: "Outreach" };

function daysAgo(days: number): string {
  return new Date(new Date(NOW).getTime() - days * 24 * 60 * 60 * 1000).toISOString();
}

function daysFromNow(days: number): string {
  return new Date(new Date(NOW).getTime() + days * 24 * 60 * 60 * 1000).toISOString();
}

function run(args: {
  instance?: Partial<HealthInstance>;
  currentStage?: { key: string; slaHours: number | null; name: string } | null;
  currentStageEnteredAt?: string | null;
  executions?: StepExecutionView[];
}) {
  return computeWorkflowHealth({
    instance: baseInstance(args.instance),
    currentStage: args.currentStage ?? null,
    currentStageEnteredAt: args.currentStageEnteredAt ?? null,
    executions: args.executions ?? [],
    now: NOW,
  });
}

describe("computeWorkflowHealth", () => {
  it("COMPLETED instance -> COMPLETE with no reasons", () => {
    const result = run({ instance: { status: "COMPLETED" } });
    expect(result.status).toBe("COMPLETE");
    expect(result.reasons).toEqual([]);
  });

  it("CANCELLED instance -> ARCHIVED with no reasons", () => {
    const result = run({ instance: { status: "CANCELLED" } });
    expect(result.status).toBe("ARCHIVED");
    expect(result.reasons).toEqual([]);
  });

  it("on-track: active instance, everything fine, no current stage SLA", () => {
    const result = run({
      executions: [
        exec({
          stageKey: "a",
          stepKey: "a1",
          state: "COMPLETE",
          startedAt: daysAgo(2),
          completedAt: daysAgo(1),
        }),
      ],
    });
    expect(result.status).toBe("ON_TRACK");
    expect(result.reasons).toEqual([]);
  });

  it("blocked: instance BLOCKED status + blocked executions each get their own reason", () => {
    const result = run({
      instance: { status: "BLOCKED" },
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
          title: "Send contract",
          state: "BLOCKED",
          blockedReason: null,
        }),
      ],
    });
    expect(result.status).toBe("BLOCKED");
    expect(result.reasons).toContain(
      '"Confirm partner meeting" is blocked: no response from partner'
    );
    expect(result.reasons).toContain('"Send contract" is blocked');
    expect(result.reasons).toHaveLength(2);
  });

  it("overdue: required non-terminal execution with a past dueAt", () => {
    const result = run({
      executions: [
        exec({
          stageKey: "a",
          stepKey: "a1",
          state: "PENDING",
          isRequired: true,
          dueAt: daysAgo(2),
        }),
        exec({
          stageKey: "a",
          stepKey: "a2",
          state: "PENDING",
          isRequired: true,
          dueAt: daysAgo(5),
        }),
      ],
    });
    expect(result.status).toBe("OVERDUE");
    expect(result.reasons).toContain("2 required steps overdue");
  });

  it("overdue: singular phrasing for exactly one overdue step", () => {
    const result = run({
      executions: [
        exec({
          stageKey: "a",
          stepKey: "a1",
          state: "IN_PROGRESS",
          isRequired: true,
          dueAt: daysAgo(1),
        }),
      ],
    });
    expect(result.status).toBe("OVERDUE");
    expect(result.reasons).toContain("1 required step overdue");
  });

  it("stalled: no execution has any activity and instance started long ago", () => {
    const result = run({
      instance: { startedAt: daysAgo(STALLED_NO_ACTIVITY_DAYS + 1) },
      executions: [
        exec({ stageKey: "a", stepKey: "a1", state: "PENDING" }),
        exec({ stageKey: "a", stepKey: "a2", state: "PENDING" }),
      ],
    });
    expect(result.status).toBe("STALLED");
    expect(result.reasons).toContain(`No activity in ${STALLED_NO_ACTIVITY_DAYS + 1} days`);
  });

  it("not stalled when under the threshold", () => {
    const result = run({
      instance: { startedAt: daysAgo(STALLED_NO_ACTIVITY_DAYS - 1) },
      executions: [exec({ stageKey: "a", stepKey: "a1", state: "PENDING" })],
    });
    expect(result.status).toBe("ON_TRACK");
    expect(result.reasons).toEqual([]);
  });

  it("stage-duration-exceeded: current stage past its SLA window", () => {
    const result = run({
      currentStage: CURRENT_STAGE,
      currentStageEnteredAt: daysAgo(10),
      executions: [
        exec({
          stageKey: "a",
          stepKey: "a1",
          state: "IN_PROGRESS",
          startedAt: daysAgo(10),
        }),
      ],
    });
    expect(result.status).toBe("NEEDS_ATTENTION");
    expect(result.reasons.some((r) => r.includes('"Outreach" has run'))).toBe(true);
    expect(result.reasons.some((r) => r.includes("expected 7-day window"))).toBe(true);
  });

  it("meeting-not-scheduled: required MEETING step due within the lead window with no linked meeting", () => {
    const result = run({
      executions: [
        exec({
          stageKey: "a",
          stepKey: "a1",
          kind: "MEETING",
          state: "PENDING",
          isRequired: true,
          dueAt: daysFromNow(MEETING_SCHEDULING_LEAD_DAYS - 1),
          linkedMeetingId: null,
        }),
      ],
    });
    expect(result.status).toBe("NEEDS_ATTENTION");
    expect(result.reasons).toContain("Meeting not scheduled");
  });

  it("no meeting-not-scheduled reason once a meeting is linked", () => {
    const result = run({
      executions: [
        exec({
          stageKey: "a",
          stepKey: "a1",
          kind: "MEETING",
          state: "PENDING",
          isRequired: true,
          dueAt: daysFromNow(1),
          linkedMeetingId: "meeting-1",
        }),
      ],
    });
    expect(result.reasons).not.toContain("Meeting not scheduled");
  });

  it("owner-missing: summarizes N steps with no owner, singular vs plural", () => {
    const single = run({
      executions: [
        exec({ stageKey: "a", stepKey: "a1", state: "PENDING", ownerId: null }),
      ],
    });
    expect(single.status).toBe("NEEDS_ATTENTION");
    expect(single.reasons).toContain("1 step has no owner");

    const multiple = run({
      executions: [
        exec({ stageKey: "a", stepKey: "a1", state: "PENDING", ownerId: null }),
        exec({ stageKey: "a", stepKey: "a2", state: "IN_PROGRESS", ownerId: null }),
      ],
    });
    expect(multiple.reasons).toContain("2 steps have no owner");
  });

  it("escalated: adds an informational reason without forcing a worse status", () => {
    const result = run({
      instance: { escalatedAt: daysAgo(1) },
      executions: [
        exec({
          stageKey: "a",
          stepKey: "a1",
          state: "COMPLETE",
          startedAt: daysAgo(2),
          completedAt: daysAgo(1),
        }),
      ],
    });
    expect(result.status).toBe("ON_TRACK");
    expect(result.reasons).toEqual(["Escalated to leadership"]);
  });

  it("precedence: overdue AND blocked together report BLOCKED with both reasons present", () => {
    const result = run({
      instance: { status: "BLOCKED" },
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
        }),
      ],
    });
    expect(result.status).toBe("BLOCKED");
    expect(result.reasons).toContain(
      '"Confirm partner meeting" is blocked: no response from partner'
    );
    expect(result.reasons).toContain("1 required step overdue");
  });
});

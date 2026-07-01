import { describe, it, expect, vi, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// Mocks (must be declared before importing the module under test — vi.mock
// factories are hoisted above top-level consts, so any fn referenced inside
// one is wrapped in vi.hoisted()).
// ---------------------------------------------------------------------------

const prismaMocks = vi.hoisted(() => ({
  workflowStepExecutionFindMany: vi.fn(),
  workflowInstanceFindMany: vi.fn(),
}));

vi.mock("server-only", () => ({}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    workflowStepExecution: { findMany: prismaMocks.workflowStepExecutionFindMany },
    workflowInstance: { findMany: prismaMocks.workflowInstanceFindMany },
  },
}));

import { countQueueUrgency, getMyWorkflowQueue } from "@/lib/workflow-engine/my-queue";

// ---------------------------------------------------------------------------
// countQueueUrgency — pure date-math logic, the part worth getting exactly
// right.
// ---------------------------------------------------------------------------

describe("countQueueUrgency", () => {
  const now = new Date("2026-07-01T12:00:00.000Z");

  it("returns zero counts for an empty list", () => {
    expect(countQueueUrgency([], now)).toEqual({ overdueCount: 0, dueThisWeekCount: 0 });
  });

  it("ignores rows with no dueAt", () => {
    expect(countQueueUrgency([{ dueAt: null }, { dueAt: null }], now)).toEqual({
      overdueCount: 0,
      dueThisWeekCount: 0,
    });
  });

  it("counts a past dueAt as overdue", () => {
    const rows = [{ dueAt: "2026-06-01T00:00:00.000Z" }];
    expect(countQueueUrgency(rows, now)).toEqual({ overdueCount: 1, dueThisWeekCount: 0 });
  });

  it("counts a dueAt within the next 7 days as due this week", () => {
    const rows = [{ dueAt: "2026-07-03T00:00:00.000Z" }];
    expect(countQueueUrgency(rows, now)).toEqual({ overdueCount: 0, dueThisWeekCount: 1 });
  });

  it("counts a dueAt exactly 7 days out as due this week (inclusive boundary)", () => {
    const rows = [{ dueAt: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString() }];
    expect(countQueueUrgency(rows, now)).toEqual({ overdueCount: 0, dueThisWeekCount: 1 });
  });

  it("does not count a dueAt more than 7 days out", () => {
    const rows = [{ dueAt: "2026-07-20T00:00:00.000Z" }];
    expect(countQueueUrgency(rows, now)).toEqual({ overdueCount: 0, dueThisWeekCount: 0 });
  });

  it("handles a mix of past / near / far dueAt values", () => {
    const rows = [
      { dueAt: "2026-06-01T00:00:00.000Z" }, // overdue
      { dueAt: "2026-06-30T00:00:00.000Z" }, // overdue (yesterday)
      { dueAt: "2026-07-02T00:00:00.000Z" }, // due this week
      { dueAt: "2026-07-06T00:00:00.000Z" }, // due this week
      { dueAt: "2026-08-01T00:00:00.000Z" }, // far future — neither
      { dueAt: null }, // no date — neither
    ];
    expect(countQueueUrgency(rows, now)).toEqual({ overdueCount: 2, dueThisWeekCount: 2 });
  });

  it("treats a dueAt exactly equal to now as not overdue and due this week", () => {
    const rows = [{ dueAt: now.toISOString() }];
    expect(countQueueUrgency(rows, now)).toEqual({ overdueCount: 0, dueThisWeekCount: 1 });
  });
});

// ---------------------------------------------------------------------------
// getMyWorkflowQueue — shape + separation of assignedToMe / instancesIOwn,
// plus the overdue/blocked-first ordering.
// ---------------------------------------------------------------------------

describe("getMyWorkflowQueue", () => {
  beforeEach(() => vi.clearAllMocks());

  const now = new Date("2026-07-01T12:00:00.000Z");

  it("maps executions and instances into the expected shape", async () => {
    prismaMocks.workflowStepExecutionFindMany.mockResolvedValue([
      {
        id: "exec-1",
        stageKey: "stage-a",
        title: "Review draft",
        kind: "TASK",
        state: "PENDING",
        dueAt: new Date("2026-07-02T00:00:00.000Z"),
        instance: {
          id: "inst-1",
          title: "Partner Acquisition",
          subjectType: "PARTNER",
          subjectId: "p1",
          currentStage: { name: "Stage A" },
        },
      },
    ]);
    prismaMocks.workflowInstanceFindMany.mockResolvedValue([
      {
        id: "inst-2",
        title: "Instructor Hiring",
        status: "ACTIVE",
        completionPercent: 60,
        currentStage: { name: "Onboarding" },
      },
    ]);

    const result = await getMyWorkflowQueue("user-1", now);

    expect(result.assignedToMe).toHaveLength(1);
    expect(result.assignedToMe[0]).toEqual({
      executionId: "exec-1",
      instanceId: "inst-1",
      instanceTitle: "Partner Acquisition",
      stageKey: "stage-a",
      stageName: "Stage A",
      stepTitle: "Review draft",
      kind: "TASK",
      dueAt: "2026-07-02T00:00:00.000Z",
      isOverdue: false,
      isBlocked: false,
      entityType: "PARTNER",
      entityId: "p1",
    });

    expect(result.instancesIOwn).toEqual([
      {
        instanceId: "inst-2",
        title: "Instructor Hiring",
        status: "ACTIVE",
        completionPercent: 60,
        currentStageName: "Onboarding",
      },
    ]);

    expect(result.overdueCount).toBe(0);
    expect(result.dueThisWeekCount).toBe(1);
  });

  it("marks BLOCKED-state executions as isBlocked and sorts overdue/blocked first", async () => {
    prismaMocks.workflowStepExecutionFindMany.mockResolvedValue([
      {
        id: "exec-soon",
        stageKey: "s",
        title: "Due soon",
        kind: "TASK",
        state: "PENDING",
        dueAt: new Date("2026-07-02T00:00:00.000Z"),
        instance: { id: "i1", title: "T1", subjectType: null, subjectId: null, currentStage: null },
      },
      {
        id: "exec-overdue",
        stageKey: "s",
        title: "Overdue step",
        kind: "TASK",
        state: "PENDING",
        dueAt: new Date("2026-06-01T00:00:00.000Z"),
        instance: { id: "i2", title: "T2", subjectType: null, subjectId: null, currentStage: null },
      },
      {
        id: "exec-blocked",
        stageKey: "s",
        title: "Blocked step",
        kind: "TASK",
        state: "BLOCKED",
        dueAt: new Date("2026-07-15T00:00:00.000Z"), // not overdue, but blocked
        instance: { id: "i3", title: "T3", subjectType: null, subjectId: null, currentStage: null },
      },
      {
        id: "exec-no-due",
        stageKey: "s",
        title: "No due date",
        kind: "TASK",
        state: "PENDING",
        dueAt: null,
        instance: { id: "i4", title: "T4", subjectType: null, subjectId: null, currentStage: null },
      },
    ]);
    prismaMocks.workflowInstanceFindMany.mockResolvedValue([]);

    const result = await getMyWorkflowQueue("user-1", now);

    const ids = result.assignedToMe.map((item) => item.executionId);
    // Overdue and blocked come first (in some order), then due-soon, then no-due-date last.
    expect(ids.slice(0, 2).sort()).toEqual(["exec-blocked", "exec-overdue"].sort());
    expect(ids[2]).toBe("exec-soon");
    expect(ids[3]).toBe("exec-no-due");

    expect(result.overdueCount).toBe(1);
    expect(result.dueThisWeekCount).toBe(1); // only exec-soon; exec-blocked's due date is 14 days out
  });

  it("returns empty lists and zero counts when there is nothing assigned or owned", async () => {
    prismaMocks.workflowStepExecutionFindMany.mockResolvedValue([]);
    prismaMocks.workflowInstanceFindMany.mockResolvedValue([]);

    const result = await getMyWorkflowQueue("user-1", now);

    expect(result).toEqual({
      assignedToMe: [],
      instancesIOwn: [],
      overdueCount: 0,
      dueThisWeekCount: 0,
    });
  });
});

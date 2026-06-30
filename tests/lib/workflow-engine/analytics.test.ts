import { describe, it, expect } from "vitest";

import {
  averageCycleHours,
  buildPortfolioAnalytics,
  completionRate,
  identifyBottlenecks,
  overdueCount,
  velocityPerWeek,
  type InstanceAnalyticsRecord,
  type StageDwellRecord,
} from "@/lib/workflow-engine/analytics";

const NOW = "2026-06-30T12:00:00.000Z";

function inst(over: Partial<InstanceAnalyticsRecord> & { id: string }): InstanceAnalyticsRecord {
  return {
    templateId: "t",
    status: "ACTIVE",
    startedAt: "2026-06-01T00:00:00.000Z",
    completedAt: null,
    dueAt: null,
    ...over,
  };
}

describe("workflow-engine analytics", () => {
  const instances: InstanceAnalyticsRecord[] = [
    inst({ id: "1", status: "COMPLETED", completedAt: "2026-06-25T00:00:00.000Z" }),
    inst({ id: "2", status: "COMPLETED", completedAt: "2026-06-28T00:00:00.000Z" }),
    inst({ id: "3", status: "ACTIVE" }),
    inst({ id: "4", status: "BLOCKED" }),
    inst({ id: "5", status: "ACTIVE", dueAt: "2026-06-10T00:00:00.000Z" }), // overdue
  ];

  it("computes completion rate over all instances", () => {
    expect(completionRate(instances)).toBe(40); // 2 of 5
    expect(completionRate([])).toBe(0);
  });

  it("counts overdue active instances only", () => {
    expect(overdueCount(instances, NOW)).toBe(1);
  });

  it("averages cycle time over completed instances", () => {
    const avg = averageCycleHours(instances);
    // (24d + 27d) / 2 = 25.5d = 612h
    expect(avg).toBeGreaterThan(600);
    expect(avg).toBeLessThan(620);
  });

  it("computes weekly velocity from recent completions", () => {
    const v = velocityPerWeek(instances, NOW, 28);
    expect(v).toBeGreaterThan(0); // 2 completed within 28 days
  });

  it("ranks bottlenecks by dwell + in-progress count", () => {
    const dwell: StageDwellRecord[] = [
      {
        templateId: "t",
        stageKey: "slow",
        stageName: "Slow",
        enteredAt: "2026-06-01T00:00:00.000Z",
        exitedAt: "2026-06-05T00:00:00.000Z", // 96h
      },
      {
        templateId: "t",
        stageKey: "fast",
        stageName: "Fast",
        enteredAt: "2026-06-01T00:00:00.000Z",
        exitedAt: "2026-06-01T02:00:00.000Z", // 2h
      },
      {
        templateId: "t",
        stageKey: "slow",
        stageName: "Slow",
        enteredAt: "2026-06-10T00:00:00.000Z",
        exitedAt: null, // still open
      },
    ];
    const b = identifyBottlenecks(dwell);
    expect(b[0].stageKey).toBe("slow");
    expect(b[0].score).toBeGreaterThan(b[1].score);
  });

  it("rolls up the whole portfolio in one call", () => {
    const a = buildPortfolioAnalytics(instances, [], NOW);
    expect(a.total).toBe(5);
    expect(a.byStatus.COMPLETED).toBe(2);
    expect(a.activeCount).toBe(3); // ACTIVE + BLOCKED + ON_HOLD
    expect(a.blockedCount).toBe(1);
    expect(a.overdueCount).toBe(1);
  });
});

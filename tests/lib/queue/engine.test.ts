import { describe, expect, it } from "vitest";

import { buildQueueEngine, getEngineQueue } from "@/lib/queue/engine";
import type { WorkHubData } from "@/lib/work/work-hub";

import {
  makeAttentionItem,
  makeDecision,
  makeInitiativeCard,
  makeWorkHubRow,
} from "./fixtures";

const NOW = new Date("2026-06-15T12:00:00.000Z");

function makeWorkHubData(overrides: Partial<WorkHubData> = {}): WorkHubData {
  return {
    generatedAtISO: NOW.toISOString(),
    stats: {
      overdue: 1,
      dueSoon: 0,
      blocked: 1,
      unowned: 1,
      needsAttention: 1,
      upcomingMeetings: 2,
      ...overrides.stats,
    },
    rows: overrides.rows ?? [
      makeWorkHubRow({ id: "action:1", overdue: true, mine: true, tone: "danger" }),
      makeWorkHubRow({ id: "action:2", blocked: true, ownerName: "Bob", tone: "warning" }),
      makeWorkHubRow({ id: "action:3", unassigned: true, ownerName: null }),
    ],
    meetingRows: overrides.meetingRows ?? [
      makeWorkHubRow({
        id: "meeting:1",
        kind: "meeting",
        kindLabel: "Meeting",
        status: "Starts Jun 20",
        previewType: "meeting",
        previewId: "1",
      }),
    ],
    initiatives: overrides.initiatives ?? [
      makeInitiativeCard({ id: "init-1", owner: null, nextStep: null, overdueActions: 0 }),
    ],
    attention: overrides.attention ?? [
      makeAttentionItem({ id: "review:1", category: "urgent" }),
      makeAttentionItem({ id: "review:2", category: "missing_owner", severity: "warning" }),
    ],
    accountability: overrides.accountability ?? [],
    weeklyReview: overrides.weeklyReview ?? {
      completedThisWeek: 5,
      createdThisWeek: 3,
      fromMeetingsThisWeek: 1,
      overdue: 1,
      unowned: 1,
      blockedNeedingEscalation: [],
    },
    decisionsWithoutActions: overrides.decisionsWithoutActions ?? [
      makeDecision({ id: "decision-1" }),
    ],
  };
}

describe("buildQueueEngine", () => {
  it("folds every source into one ranked queue", () => {
    const engine = buildQueueEngine(makeWorkHubData(), NOW);
    // 3 rows + 1 meeting + 1 initiative + 1 decision = 6 loops.
    expect(engine.items).toHaveLength(6);
    // Worst-first: the overdue+danger action leads.
    expect(engine.items[0].id).toBe("wh:action:1");
    // Every item carries a non-zero rank score and a reason string.
    for (const item of engine.items) {
      expect(item.score).toBeGreaterThan(0);
      expect(item.reason.length).toBeGreaterThan(0);
    }
  });

  it("computes a headline summary from concrete counts", () => {
    const engine = buildQueueEngine(makeWorkHubData(), NOW);
    expect(engine.summary.openLoops).toBe(6);
    expect(engine.summary.overdue).toBe(1);
    expect(engine.summary.blocked).toBe(1);
    expect(engine.summary.unowned).toBeGreaterThanOrEqual(2); // unassigned row + initiative
    expect(engine.summary.upcomingMeetings).toBe(2);
    expect(engine.summary.clearedThisWeek).toBe(5);
  });

  it("projects every named lane with a count and preview", () => {
    const engine = buildQueueEngine(makeWorkHubData(), NOW);
    expect(engine.lanes.my.count).toBe(1);
    expect(engine.lanes.unblock.count).toBe(1);
    expect(engine.lanes["meeting-prep"].count).toBe(1);
    expect(engine.lanes["initiative-cleanup"].count).toBe(1);
    expect(engine.lanes.decisions.count).toBeGreaterThanOrEqual(1);
    expect(engine.lanes["owner-accountability"].count).toBeGreaterThanOrEqual(1);
  });

  it("builds owner lanes and triage groups", () => {
    const engine = buildQueueEngine(makeWorkHubData(), NOW);
    expect(engine.ownerLanes.length).toBeGreaterThan(0);
    expect(engine.ownerLanes.some((l) => l.unowned)).toBe(true);
    // Attention items are grouped into triage categories.
    expect(engine.triageGroups.length).toBeGreaterThan(0);
    expect(engine.triageGroups.every((g) => g.items.length > 0)).toBe(true);
  });

  it("is deterministic — identical input yields an identical queue", () => {
    const a = buildQueueEngine(makeWorkHubData(), NOW);
    const b = buildQueueEngine(makeWorkHubData(), NOW);
    expect(a.items.map((i) => i.id)).toEqual(b.items.map((i) => i.id));
    expect(a.items.map((i) => i.score)).toEqual(b.items.map((i) => i.score));
  });

  it("getEngineQueue re-selects a named queue from the assembled engine", () => {
    const engine = buildQueueEngine(makeWorkHubData(), NOW);
    const mine = getEngineQueue(engine, "my", NOW);
    expect(mine.every((i) => i.signals.mine)).toBe(true);
  });
});

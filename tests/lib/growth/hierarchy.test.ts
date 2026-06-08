import { describe, expect, it } from "vitest";

import {
  milestoneProgress,
  goalProgress,
  visionProgress,
  goalActions,
  nextActions,
  blockedActions,
  recentlyCompleted,
  pastDueGoals,
  summarizeHierarchy,
  type HierarchyGoal,
  type HierarchyVision,
} from "@/lib/growth/hierarchy";

function action(id: string, status: string, extra: Record<string, unknown> = {}) {
  return { id, status, ...extra };
}

describe("hierarchy — milestone progress", () => {
  it("counts done over non-DROPPED actions", () => {
    const p = milestoneProgress({
      id: "m1",
      actions: [
        action("a", "DONE"),
        action("b", "DONE"),
        action("c", "TODO"),
        action("d", "DROPPED"), // excluded from denominator
      ],
    });
    expect(p.total).toBe(3);
    expect(p.done).toBe(2);
    expect(p.ratio).toBeCloseTo(2 / 3);
  });

  it("an ACHIEVED milestone reads as fully complete", () => {
    const p = milestoneProgress({
      id: "m1",
      status: "ACHIEVED",
      actions: [action("a", "TODO"), action("b", "TODO")],
    });
    expect(p.ratio).toBe(1);
    expect(p.done).toBe(p.total);
  });

  it("an empty milestone is 0", () => {
    expect(milestoneProgress({ id: "m1", actions: [] }).ratio).toBe(0);
  });
});

describe("hierarchy — goal progress pools all leaf actions", () => {
  const flat: HierarchyGoal = {
    id: "g",
    milestones: [],
    directActions: [
      action("a", "DONE"),
      action("b", "DONE"),
      action("c", "TODO"),
      action("d", "TODO"),
    ],
  };
  const nested: HierarchyGoal = {
    id: "g",
    milestones: [
      {
        id: "m",
        actions: [
          action("a", "DONE"),
          action("b", "DONE"),
          action("c", "TODO"),
          action("d", "TODO"),
        ],
      },
    ],
    directActions: [],
  };

  it("reads identically whether modeled flat or nested", () => {
    expect(goalProgress(flat).ratio).toBe(0.5);
    expect(goalProgress(nested).ratio).toBe(0.5);
    expect(goalActions(nested)).toHaveLength(4);
  });

  it("an ACHIEVED goal reads as 1", () => {
    expect(goalProgress({ ...flat, status: "ACHIEVED" }).ratio).toBe(1);
  });
});

describe("hierarchy — vision progress is the mean of goal ratios", () => {
  it("averages its non-archived goals", () => {
    const vision: HierarchyVision = {
      id: "v",
      goals: [
        { id: "g1", milestones: [], directActions: [action("a", "DONE")] }, // 1.0
        { id: "g2", milestones: [], directActions: [action("b", "TODO")] }, // 0.0
        {
          id: "g3",
          status: "ARCHIVED", // excluded
          milestones: [],
          directActions: [action("c", "TODO")],
        },
      ],
    };
    expect(visionProgress(vision).ratio).toBe(0.5);
  });

  it("an empty vision is 0 unless ACHIEVED", () => {
    expect(visionProgress({ id: "v", goals: [] }).ratio).toBe(0);
    expect(visionProgress({ id: "v", status: "ACHIEVED", goals: [] }).ratio).toBe(1);
  });
});

describe("hierarchy — selection helpers", () => {
  const actions = [
    action("a", "TODO", { order: 2 }),
    action("b", "IN_PROGRESS", { order: 5 }),
    action("c", "TODO", { order: 1 }),
    action("d", "BLOCKED"),
    action("e", "DONE", { completedAt: "2026-01-02T00:00:00Z" }),
    action("f", "DONE", { completedAt: "2026-03-02T00:00:00Z" }),
  ];

  it("nextActions ranks IN_PROGRESS ahead of TODO, then by order", () => {
    const next = nextActions(actions, 5);
    expect(next.map((a) => a.id)).toEqual(["b", "c", "a"]);
  });

  it("nextActions respects the limit", () => {
    expect(nextActions(actions, 1).map((a) => a.id)).toEqual(["b"]);
  });

  it("blockedActions returns only BLOCKED", () => {
    expect(blockedActions(actions).map((a) => a.id)).toEqual(["d"]);
  });

  it("recentlyCompleted returns DONE newest-first", () => {
    expect(recentlyCompleted(actions).map((a) => a.id)).toEqual(["f", "e"]);
  });
});

describe("hierarchy — pastDueGoals", () => {
  const now = new Date("2026-06-08T00:00:00Z");

  it("flags active, incomplete goals past their target date", () => {
    const goals: HierarchyGoal[] = [
      {
        id: "overdue",
        targetDate: "2026-01-01T00:00:00Z",
        milestones: [],
        directActions: [action("a", "TODO")],
      },
      {
        id: "future",
        targetDate: "2026-12-01T00:00:00Z",
        milestones: [],
        directActions: [action("b", "TODO")],
      },
      {
        id: "done-overdue",
        targetDate: "2026-01-01T00:00:00Z",
        milestones: [],
        directActions: [action("c", "DONE")], // complete -> not stalled
      },
      {
        id: "no-date",
        milestones: [],
        directActions: [action("d", "TODO")],
      },
    ];
    const stalled = pastDueGoals(goals, now);
    expect(stalled.map((s) => s.goal.id)).toEqual(["overdue"]);
    expect(stalled[0].ratio).toBe(0);
  });
});

describe("hierarchy — summarizeHierarchy", () => {
  it("aggregates visions + loose goals into one summary", () => {
    const visions: HierarchyVision[] = [
      {
        id: "v",
        goals: [
          {
            id: "g1",
            milestones: [
              { id: "m", actions: [action("a", "DONE"), action("b", "TODO")] },
            ],
            directActions: [action("c", "BLOCKED")],
          },
        ],
      },
    ];
    const loose: HierarchyGoal[] = [
      {
        id: "g2",
        status: "ACHIEVED",
        milestones: [],
        directActions: [action("d", "DONE"), action("x", "DROPPED")],
      },
    ];
    const s = summarizeHierarchy(visions, loose);
    expect(s.visionCount).toBe(1);
    expect(s.goalCount).toBe(2);
    expect(s.achievedGoalCount).toBe(1);
    expect(s.milestoneCount).toBe(1);
    // countable leaf actions: a(DONE), b(TODO), c(BLOCKED), d(DONE) => 4; x DROPPED excluded
    expect(s.totalActions).toBe(4);
    expect(s.doneActions).toBe(2);
    expect(s.openActions).toBe(1); // only b is TODO/IN_PROGRESS
    expect(s.blockedActions).toBe(1);
    expect(s.overallRatio).toBe(0.5);
  });

  it("is safe on an empty tree", () => {
    const s = summarizeHierarchy([], []);
    expect(s.overallRatio).toBe(0);
    expect(s.totalActions).toBe(0);
  });
});

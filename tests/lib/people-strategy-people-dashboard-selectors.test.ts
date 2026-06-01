import { describe, expect, it } from "vitest";
import type { ActionItemStatus, GoalRatingColor } from "@prisma/client";

import {
  computeTrend,
  isActionOverdue,
  lastCheckIns,
  splitActiveActions,
  workloadWarning,
  type DashboardAction,
} from "@/lib/people-strategy/people-dashboard-selectors";

const NOW = new Date("2026-06-01T12:00:00Z");

function action(
  id: string,
  status: ActionItemStatus,
  deadline: string,
  deadlineEnd: string | null = null
): DashboardAction {
  return {
    id,
    title: `Action ${id}`,
    status,
    deadlineStart: new Date(deadline),
    deadlineEnd: deadlineEnd ? new Date(deadlineEnd) : null,
    departmentName: "Instruction",
  };
}

function checkIn(month: string, rating: GoalRatingColor | null) {
  return { month: new Date(month), performanceRating: rating };
}

describe("splitActiveActions", () => {
  it("drops COMPLETE items and keeps lead/executing separate", () => {
    const split = splitActiveActions({
      led: [action("a", "IN_PROGRESS", "2026-07-01"), action("b", "COMPLETE", "2026-05-01")],
      executing: [action("c", "NOT_STARTED", "2026-06-15")],
    });
    expect(split.lead.map((a) => a.id)).toEqual(["a"]);
    expect(split.executing.map((a) => a.id)).toEqual(["c"]);
  });

  it("sorts each list by effective deadline (earliest first)", () => {
    const split = splitActiveActions({
      led: [action("late", "IN_PROGRESS", "2026-09-01"), action("soon", "IN_PROGRESS", "2026-06-10")],
      executing: [],
    });
    expect(split.lead.map((a) => a.id)).toEqual(["soon", "late"]);
  });
});

describe("isActionOverdue", () => {
  it("treats explicit OVERDUE status as overdue", () => {
    expect(isActionOverdue(action("a", "OVERDUE", "2026-12-01"), NOW)).toBe(true);
  });
  it("flags a passed deadline that is not complete", () => {
    expect(isActionOverdue(action("a", "IN_PROGRESS", "2026-05-01"), NOW)).toBe(true);
  });
  it("never flags a COMPLETE item", () => {
    expect(isActionOverdue(action("a", "COMPLETE", "2026-01-01"), NOW)).toBe(false);
  });
  it("uses deadlineEnd when present", () => {
    expect(isActionOverdue(action("a", "IN_PROGRESS", "2026-01-01", "2026-12-01"), NOW)).toBe(false);
  });
});

describe("computeTrend", () => {
  it("returns Insufficient Data with fewer than two rated check-ins", () => {
    expect(computeTrend([checkIn("2026-05-01", "ACHIEVED")])).toBe("Insufficient Data");
    expect(computeTrend([checkIn("2026-05-01", null), checkIn("2026-04-01", "ACHIEVED")])).toBe(
      "Insufficient Data"
    );
  });
  it("detects Improving from earliest to latest", () => {
    expect(
      computeTrend([
        checkIn("2026-05-01", "ACHIEVED"),
        checkIn("2026-03-01", "BEHIND_SCHEDULE"),
      ])
    ).toBe("Improving");
  });
  it("detects Declining", () => {
    expect(
      computeTrend([
        checkIn("2026-03-01", "ABOVE_AND_BEYOND"),
        checkIn("2026-05-01", "GETTING_STARTED"),
      ])
    ).toBe("Declining");
  });
  it("detects Stable when endpoints match", () => {
    expect(
      computeTrend([
        checkIn("2026-03-01", "ACHIEVED"),
        checkIn("2026-04-01", "BEHIND_SCHEDULE"),
        checkIn("2026-05-01", "ACHIEVED"),
      ])
    ).toBe("Stable");
  });
});

describe("lastCheckIns", () => {
  it("returns the most recent first, capped at count", () => {
    const result = lastCheckIns(
      [
        checkIn("2026-03-01", "ACHIEVED"),
        checkIn("2026-05-01", "ABOVE_AND_BEYOND"),
        checkIn("2026-04-01", "GETTING_STARTED"),
        checkIn("2026-01-01", "BEHIND_SCHEDULE"),
      ],
      3
    );
    expect(result.map((c) => c.month.toISOString().slice(0, 7))).toEqual([
      "2026-05",
      "2026-04",
      "2026-03",
    ]);
  });
});

describe("workloadWarning", () => {
  it("warns on overdue actions first", () => {
    const split = splitActiveActions({
      led: [action("a", "IN_PROGRESS", "2026-05-01")],
      executing: [],
    });
    expect(workloadWarning(split, NOW)).toBe("1 overdue action");
  });
  it("warns on heavy load when at the threshold", () => {
    const led = Array.from({ length: 5 }, (_, i) => action(`a${i}`, "IN_PROGRESS", "2026-08-01"));
    const split = splitActiveActions({ led, executing: [] });
    expect(workloadWarning(split, NOW)).toBe("Heavy load · 5 active actions");
  });
  it("returns null for a light, on-time load", () => {
    const split = splitActiveActions({
      led: [action("a", "IN_PROGRESS", "2026-08-01")],
      executing: [],
    });
    expect(workloadWarning(split, NOW)).toBeNull();
  });
});

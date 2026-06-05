import { describe, expect, it } from "vitest";

import {
  buildPulseTrend,
  PULSE_METRICS,
  type PulseSnapshot,
} from "@/lib/people-strategy/pulse-trend";
import type { WeeklyPulse } from "@/lib/people-strategy/command-center-selectors";

const weekStart = new Date("2026-06-08T00:00:00.000Z"); // this Monday
const priorWeekStart = new Date("2026-06-01T00:00:00.000Z"); // last Monday

function pulse(over: Partial<WeeklyPulse> = {}): WeeklyPulse {
  return {
    weekStart,
    openTotal: 12,
    completedThisWeek: 5,
    overdue: 3,
    flagged: 1,
    blocked: 2,
    dueThisWeek: 4,
    unowned: 1,
    ...over,
  };
}

function snapshot(over: Partial<PulseSnapshot> = {}): PulseSnapshot {
  return {
    weekStart: priorWeekStart,
    openTotal: 10,
    completedThisWeek: 2,
    overdue: 5,
    flagged: 2,
    blocked: 2,
    dueThisWeek: 6,
    unowned: 3,
    ...over,
  };
}

describe("buildPulseTrend", () => {
  it("computes current - prior per metric and carries the prior week", () => {
    const trend = buildPulseTrend(pulse(), snapshot());

    expect(trend.priorWeekStart).toEqual(priorWeekStart);
    expect(trend.deltas).toEqual({
      openTotal: 2, // 12 - 10
      completedThisWeek: 3, // 5 - 2
      overdue: -2, // 3 - 5
      flagged: -1, // 1 - 2
      blocked: 0, // 2 - 2
      dueThisWeek: -2, // 4 - 6
      unowned: -2, // 1 - 3
    });
  });

  it("returns a delta for every tracked metric", () => {
    const trend = buildPulseTrend(pulse(), snapshot());
    for (const metric of PULSE_METRICS) {
      expect(trend.deltas[metric]).toBeTypeOf("number");
    }
  });

  it("is all-zero when nothing moved week over week", () => {
    const same = pulse();
    const trend = buildPulseTrend(
      same,
      snapshot({
        openTotal: same.openTotal,
        completedThisWeek: same.completedThisWeek,
        overdue: same.overdue,
        flagged: same.flagged,
        blocked: same.blocked,
        dueThisWeek: same.dueThisWeek,
        unowned: same.unowned,
      })
    );
    expect(Object.values(trend.deltas).every((d) => d === 0)).toBe(true);
  });
});

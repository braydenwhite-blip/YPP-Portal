import { beforeEach, describe, expect, it, vi } from "vitest";

const isProvisionalClockEnabled = vi.fn(() => true);
vi.mock("@/lib/feature-flags", () => ({
  isProvisionalClockEnabled: () => isProvisionalClockEnabled(),
}));

vi.mock("@/lib/prisma", () => ({ prisma: {} }));

import {
  PROVISIONAL_WINDOW_DAYS,
  computeProvisionalStatus,
  startProvisionalClock,
  clearProvisionalClock,
} from "@/lib/people-strategy/provisional";

const NOW = new Date("2026-06-01T12:00:00Z");

function daysAgo(d: number): Date {
  return new Date(NOW.getTime() - d * 86_400_000);
}

beforeEach(() => {
  isProvisionalClockEnabled.mockReturnValue(true);
});

describe("computeProvisionalStatus", () => {
  it("window is 90 days", () => {
    expect(PROVISIONAL_WINDOW_DAYS).toBe(90);
  });

  it("no start, no confirm → not provisional", () => {
    const s = computeProvisionalStatus(null, null, NOW);
    expect(s).toMatchObject({ isProvisional: false, confirmed: false, atMonthThree: false });
    expect(s.monthThreeDate).toBeNull();
  });

  it("a fresh hire is provisional with a countdown and Month-3 date", () => {
    const start = daysAgo(10);
    const s = computeProvisionalStatus(start, null, NOW);
    expect(s.isProvisional).toBe(true);
    expect(s.confirmed).toBe(false);
    expect(s.atMonthThree).toBe(false);
    expect(s.daysRemaining).toBe(80); // 90 - 10
    expect(s.monthThreeDate?.getTime()).toBe(start.getTime() + 90 * 86_400_000);
    expect(s.percentElapsed).toBe(11); // round(10/90*100)
  });

  it("at/after 90 days the Month-3 review is due (overdue countdown)", () => {
    const s = computeProvisionalStatus(daysAgo(95), null, NOW);
    expect(s.isProvisional).toBe(true);
    expect(s.atMonthThree).toBe(true);
    expect(s.daysRemaining).toBeLessThan(0);
    expect(s.percentElapsed).toBe(100);
  });

  it("exactly at the boundary (90 days) is due", () => {
    const s = computeProvisionalStatus(daysAgo(90), null, NOW);
    expect(s.atMonthThree).toBe(true);
    expect(s.daysRemaining).toBe(0);
  });

  it("confirmed clears provisional regardless of start age", () => {
    const s = computeProvisionalStatus(daysAgo(120), daysAgo(5), NOW);
    expect(s.confirmed).toBe(true);
    expect(s.isProvisional).toBe(false);
    expect(s.atMonthThree).toBe(false);
    expect(s.confirmedAt).toEqual(daysAgo(5));
  });
});

describe("startProvisionalClock", () => {
  it("sets a fresh clock when the flag is on", async () => {
    const update = vi.fn().mockResolvedValue({});
    await startProvisionalClock({ user: { update } } as any, "u1", NOW);
    expect(update).toHaveBeenCalledWith({
      where: { id: "u1" },
      data: { provisionalStart: NOW, provisionalConfirmedAt: null },
    });
  });

  it("is a no-op when the flag is off", async () => {
    isProvisionalClockEnabled.mockReturnValue(false);
    const update = vi.fn().mockResolvedValue({});
    await startProvisionalClock({ user: { update } } as any, "u1", NOW);
    expect(update).not.toHaveBeenCalled();
  });
});

describe("clearProvisionalClock", () => {
  it("clears both timestamps regardless of the flag", async () => {
    isProvisionalClockEnabled.mockReturnValue(false);
    const update = vi.fn().mockResolvedValue({});
    await clearProvisionalClock({ user: { update } } as any, "u1");
    expect(update).toHaveBeenCalledWith({
      where: { id: "u1" },
      data: { provisionalStart: null, provisionalConfirmedAt: null },
    });
  });
});

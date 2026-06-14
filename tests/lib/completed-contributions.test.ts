import { describe, expect, it } from "vitest";

import {
  summarizeCompletedContributions,
  type CompletedContributionRecord,
} from "@/lib/people-strategy/completed-contributions";

const NOW = new Date("2026-06-14T12:00:00.000Z");

function rec(daysAgo: number, asLead = false): CompletedContributionRecord {
  return {
    completedAt: new Date(NOW.getTime() - daysAgo * 24 * 60 * 60 * 1000),
    asLead,
  };
}

describe("summarizeCompletedContributions", () => {
  it("returns an empty, null-labelled summary with no records", () => {
    const s = summarizeCompletedContributions([], NOW);
    expect(s.total).toBe(0);
    expect(s.thisWeek).toBe(0);
    expect(s.thisMonth).toBe(0);
    expect(s.label).toBeNull();
    expect(s.lastCompletedAtISO).toBeNull();
  });

  it("counts week / month / quarter windows and leans to the most recent label", () => {
    const s = summarizeCompletedContributions(
      [rec(1, true), rec(2), rec(20), rec(60)],
      NOW
    );
    expect(s.total).toBe(4);
    expect(s.thisWeek).toBe(2);
    expect(s.thisMonth).toBe(3);
    expect(s.asLead).toBe(1);
    // Prefers the week phrasing when there is week activity.
    expect(s.label).toBe("2 completed actions this week");
  });

  it("falls back to month phrasing when nothing happened this week", () => {
    const s = summarizeCompletedContributions([rec(15), rec(20)], NOW);
    expect(s.thisWeek).toBe(0);
    expect(s.label).toBe("2 completed actions this month");
  });

  it("falls back to quarter phrasing for older completions", () => {
    const s = summarizeCompletedContributions([rec(45)], NOW);
    expect(s.thisMonth).toBe(0);
    expect(s.label).toBe("1 completed action this quarter");
  });

  it("uses singular 'action' for a single completion", () => {
    const s = summarizeCompletedContributions([rec(1)], NOW);
    expect(s.label).toBe("1 completed action this week");
  });

  it("records the most recent completion timestamp", () => {
    const s = summarizeCompletedContributions([rec(10), rec(2), rec(40)], NOW);
    expect(s.lastCompletedAtISO).toBe(rec(2).completedAt.toISOString());
  });
});

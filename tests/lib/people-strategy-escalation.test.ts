import { afterEach, describe, expect, it } from "vitest";

import {
  BOARD_ROLLUP_THRESHOLD_MS,
  ESCALATION_THRESHOLD_MS,
  boardRollupThresholdMs,
  escalationReason,
  escalationSince,
  escalationThresholdMs,
  formatEscalationAge,
  isBoardRollupEligible,
  isEscalationEligible,
  type BoardRollupItem,
  type EscalationItem,
} from "@/lib/people-strategy/escalation";

const NOW = new Date("2026-06-10T12:00:00Z");

function hoursAgo(h: number): Date {
  return new Date(NOW.getTime() - h * 3_600_000);
}

function item(over: Partial<EscalationItem>): EscalationItem {
  return {
    status: over.status ?? "IN_PROGRESS",
    flaggedAt: over.flaggedAt ?? null,
    deadlineStart: over.deadlineStart ?? hoursAgo(1),
    deadlineEnd: over.deadlineEnd ?? null,
    resolvedAt: over.resolvedAt ?? null,
  };
}

describe("escalation eligibility (48h rule)", () => {
  it("threshold is exactly 48 hours", () => {
    expect(ESCALATION_THRESHOLD_MS).toBe(48 * 60 * 60 * 1000);
  });

  it("flagged < 48h is NOT eligible", () => {
    expect(isEscalationEligible(item({ flaggedAt: hoursAgo(47) }), NOW)).toBe(false);
  });

  it("flagged >= 48h IS eligible", () => {
    expect(isEscalationEligible(item({ flaggedAt: hoursAgo(49) }), NOW)).toBe(true);
  });

  it("overdue with deadline > 48h ago IS eligible", () => {
    expect(
      isEscalationEligible(
        item({ status: "OVERDUE", deadlineStart: hoursAgo(72) }),
        NOW
      )
    ).toBe(true);
  });

  it("overdue but deadline only 10h ago is NOT eligible", () => {
    expect(
      isEscalationEligible(
        item({ status: "OVERDUE", deadlineStart: hoursAgo(10) }),
        NOW
      )
    ).toBe(false);
  });

  it("resolved items are never eligible, even when long overdue", () => {
    expect(
      isEscalationEligible(
        item({
          status: "OVERDUE",
          deadlineStart: hoursAgo(200),
          flaggedAt: hoursAgo(200),
          resolvedAt: hoursAgo(1),
        }),
        NOW
      )
    ).toBe(false);
  });

  it("neither flagged nor overdue is never eligible", () => {
    expect(isEscalationEligible(item({ status: "IN_PROGRESS" }), NOW)).toBe(false);
  });

  it("uses the OLDEST trigger: flagged 100h + just-overdue is eligible", () => {
    expect(
      isEscalationEligible(
        item({ status: "OVERDUE", flaggedAt: hoursAgo(100), deadlineStart: hoursAgo(1) }),
        NOW
      )
    ).toBe(true);
  });

  it("deadlineEnd drives the overdue clock when present", () => {
    const i = item({
      status: "OVERDUE",
      deadlineStart: hoursAgo(200),
      deadlineEnd: hoursAgo(10),
    });
    expect(isEscalationEligible(i, NOW)).toBe(false); // end is only 10h ago
  });
});

describe("configurable thresholds (env overrides)", () => {
  afterEach(() => {
    delete process.env.ACTION_ESCALATION_HOURS;
    delete process.env.ACTION_BOARD_ROLLUP_DAYS;
  });

  it("defaults match the resolved module constants", () => {
    expect(escalationThresholdMs()).toBe(ESCALATION_THRESHOLD_MS);
    expect(boardRollupThresholdMs()).toBe(BOARD_ROLLUP_THRESHOLD_MS);
  });

  it("ACTION_ESCALATION_HOURS overrides the escalation threshold", () => {
    process.env.ACTION_ESCALATION_HOURS = "24";
    expect(escalationThresholdMs()).toBe(24 * 60 * 60 * 1000);
  });

  it("ACTION_BOARD_ROLLUP_DAYS overrides the board roll-up threshold", () => {
    process.env.ACTION_BOARD_ROLLUP_DAYS = "5";
    expect(boardRollupThresholdMs()).toBe(5 * 24 * 60 * 60 * 1000);
  });

  it("ignores invalid (non-positive / non-numeric) overrides", () => {
    process.env.ACTION_ESCALATION_HOURS = "0";
    process.env.ACTION_BOARD_ROLLUP_DAYS = "not-a-number";
    expect(escalationThresholdMs()).toBe(ESCALATION_THRESHOLD_MS);
    expect(boardRollupThresholdMs()).toBe(BOARD_ROLLUP_THRESHOLD_MS);
  });
});

describe("escalationReason", () => {
  it("flagged only", () => {
    expect(escalationReason(item({ flaggedAt: hoursAgo(50) }))).toBe("Flagged");
  });
  it("overdue only", () => {
    expect(escalationReason(item({ status: "OVERDUE" }))).toBe("Overdue");
  });
  it("both", () => {
    expect(
      escalationReason(item({ status: "OVERDUE", flaggedAt: hoursAgo(50) }))
    ).toBe("Flagged & Overdue");
  });
  it("neither", () => {
    expect(escalationReason(item({}))).toBeNull();
  });
});

describe("Board roll-up eligibility (3-day rule)", () => {
  function rollupItem(over: Partial<BoardRollupItem>): BoardRollupItem {
    return {
      escalatedToCpoAt: over.escalatedToCpoAt ?? null,
      resolvedAt: over.resolvedAt ?? null,
      boardRolledUpAt: over.boardRolledUpAt ?? null,
    };
  }

  it("default threshold is 3 days", () => {
    expect(BOARD_ROLLUP_THRESHOLD_MS).toBe(3 * 24 * 60 * 60 * 1000);
  });

  it("not eligible until 3 days past Leadership escalation", () => {
    expect(
      isBoardRollupEligible(rollupItem({ escalatedToCpoAt: hoursAgo(24 * 2) }), NOW)
    ).toBe(false);
  });

  it("eligible at 3+ days past Leadership escalation", () => {
    expect(
      isBoardRollupEligible(rollupItem({ escalatedToCpoAt: hoursAgo(24 * 4) }), NOW)
    ).toBe(true);
  });

  it("never eligible if not CPO-escalated", () => {
    expect(isBoardRollupEligible(rollupItem({ escalatedToCpoAt: null }), NOW)).toBe(false);
  });

  it("never eligible once resolved", () => {
    expect(
      isBoardRollupEligible(
        rollupItem({ escalatedToCpoAt: hoursAgo(24 * 30), resolvedAt: hoursAgo(1) }),
        NOW
      )
    ).toBe(false);
  });

  it("never eligible once already rolled up", () => {
    expect(
      isBoardRollupEligible(
        rollupItem({ escalatedToCpoAt: hoursAgo(24 * 30), boardRolledUpAt: hoursAgo(1) }),
        NOW
      )
    ).toBe(false);
  });
});

describe("escalationSince + formatEscalationAge", () => {
  it("returns the oldest active trigger time", () => {
    const since = escalationSince(
      item({ status: "OVERDUE", flaggedAt: hoursAgo(100), deadlineStart: hoursAgo(10) })
    );
    expect(since?.getTime()).toBe(hoursAgo(100).getTime());
  });

  it("formats days and hours", () => {
    expect(formatEscalationAge(hoursAgo(72), NOW)).toBe("3 days");
    expect(formatEscalationAge(hoursAgo(49), NOW)).toBe("2 days");
    expect(formatEscalationAge(hoursAgo(5), NOW)).toBe("5 hours");
    expect(formatEscalationAge(hoursAgo(1), NOW)).toBe("1 hour");
  });
});

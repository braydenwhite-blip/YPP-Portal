import { describe, expect, it } from "vitest";

import {
  ESCALATION_THRESHOLD_MS,
  escalationReason,
  escalationSince,
  formatEscalationAge,
  isEscalationEligible,
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

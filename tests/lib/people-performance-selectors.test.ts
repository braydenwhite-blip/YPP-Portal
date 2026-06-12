import { describe, expect, it } from "vitest";

import {
  allowedFeedbackMonths,
  asPerformanceFilter,
  buildCheckInCalendarDots,
  buildSignals,
  computePerformanceStats,
  currentQuarterLabel,
  factsMatchFilter,
  monthKeyUTC,
  monthLabelUTC,
  monthStartUTC,
  parseMonthKey,
  type PerformanceRowFacts,
} from "@/lib/people-strategy/people-performance-selectors";

const NOW = new Date("2026-06-12T15:00:00Z");

function makeFacts(overrides: Partial<PerformanceRowFacts> = {}): PerformanceRowFacts {
  return {
    workloadWarning: null,
    hasOverdueAction: false,
    trend: "Stable",
    successor: false,
    needsCheckIn: false,
    reviewDue: false,
    feedback: { outstanding: 0, submitted: 0, lastRequestedMonthKey: "2026-06" },
    currentMonthKey: "2026-06",
    ...overrides,
  };
}

describe("month & quarter keys", () => {
  it("derives UTC month starts, keys, and labels", () => {
    expect(monthStartUTC(NOW).toISOString()).toBe("2026-06-01T00:00:00.000Z");
    expect(monthKeyUTC(NOW)).toBe("2026-06");
    expect(monthLabelUTC(monthStartUTC(NOW))).toBe("June 2026");
  });

  it("parses month keys and rejects malformed ones", () => {
    expect(parseMonthKey("2026-06")?.toISOString()).toBe("2026-06-01T00:00:00.000Z");
    expect(parseMonthKey("2026-13")).toBeNull();
    expect(parseMonthKey("June 2026")).toBeNull();
  });

  it("labels the quarter the QuarterlyReview key uses", () => {
    expect(currentQuarterLabel(NOW)).toBe("2026-Q2");
    expect(currentQuarterLabel(new Date("2026-01-02T00:00:00Z"))).toBe("2026-Q1");
    expect(currentQuarterLabel(new Date("2026-12-31T00:00:00Z"))).toBe("2026-Q4");
  });

  it("offers the current month plus the two before it, across year boundaries", () => {
    expect(allowedFeedbackMonths(NOW).map((m) => m.key)).toEqual([
      "2026-06",
      "2026-05",
      "2026-04",
    ]);
    expect(
      allowedFeedbackMonths(new Date("2026-01-15T00:00:00Z")).map((m) => m.key)
    ).toEqual(["2026-01", "2025-12", "2025-11"]);
  });
});

describe("buildCheckInCalendarDots", () => {
  it("anchors dots to the last three calendar months, oldest first, with explicit missing states", () => {
    const dots = buildCheckInCalendarDots(
      [
        { monthKey: "2026-06", rating: "ACHIEVED" },
        { monthKey: "2026-04", rating: null },
      ],
      NOW
    );
    expect(dots.map((d) => d.monthKey)).toEqual(["2026-04", "2026-05", "2026-06"]);
    expect(dots.map((d) => d.state)).toEqual(["completed", "missing", "rated"]);
    expect(dots[2].rating).toBe("ACHIEVED");
  });

  it("renders all-missing when the member has no check-ins", () => {
    const dots = buildCheckInCalendarDots([], NOW);
    expect(dots).toHaveLength(3);
    expect(dots.every((d) => d.state === "missing")).toBe(true);
  });
});

describe("buildSignals", () => {
  it("returns no flags for a quiet member with current-month feedback requested", () => {
    expect(buildSignals(makeFacts())).toEqual([]);
  });

  it("carries the concrete workload warning, danger when something is overdue", () => {
    expect(
      buildSignals(makeFacts({ workloadWarning: "2 overdue actions", hasOverdueAction: true }))
    ).toContainEqual({ label: "2 overdue actions", tone: "danger" });
    expect(
      buildSignals(makeFacts({ workloadWarning: "Heavy load · 6 active actions" }))
    ).toContainEqual({ label: "Heavy load · 6 active actions", tone: "warning" });
  });

  it("flags trend, succession, and pending feedback replies", () => {
    const signals = buildSignals(
      makeFacts({
        trend: "Declining",
        successor: true,
        feedback: { outstanding: 2, submitted: 1, lastRequestedMonthKey: "2026-06" },
      })
    );
    expect(signals).toContainEqual({ label: "Check-ins declining", tone: "danger" });
    expect(signals).toContainEqual({ label: "Succession candidate", tone: "brand" });
    expect(signals).toContainEqual({ label: "2 feedback replies pending", tone: "info" });
  });

  it("marks members with no feedback request targeting the current month", () => {
    const signals = buildSignals(
      makeFacts({
        feedback: { outstanding: 0, submitted: 3, lastRequestedMonthKey: "2026-04" },
      })
    );
    expect(signals).toContainEqual({
      label: "No feedback requested this month",
      tone: "neutral",
    });
  });
});

describe("filters and stats", () => {
  it("normalizes unknown filter params to all", () => {
    expect(asPerformanceFilter("workload")).toBe("workload");
    expect(asPerformanceFilter("nonsense")).toBe("all");
    expect(asPerformanceFilter(undefined)).toBe("all");
  });

  it("matches each filter against the corresponding fact", () => {
    expect(factsMatchFilter(makeFacts({ needsCheckIn: true }), "needs-checkin")).toBe(true);
    expect(factsMatchFilter(makeFacts(), "needs-checkin")).toBe(false);
    expect(
      factsMatchFilter(
        makeFacts({ feedback: { outstanding: 1, submitted: 0, lastRequestedMonthKey: "2026-06" } }),
        "feedback-pending"
      )
    ).toBe(true);
    expect(factsMatchFilter(makeFacts({ reviewDue: true }), "reviews-due")).toBe(true);
    expect(factsMatchFilter(makeFacts({ workloadWarning: "x" }), "workload")).toBe(true);
    expect(factsMatchFilter(makeFacts({ successor: true }), "succession")).toBe(true);
    expect(factsMatchFilter(makeFacts(), "all")).toBe(true);
  });

  it("counts the stat strip from the same facts the filters use", () => {
    const rows = [
      { facts: makeFacts({ needsCheckIn: true, reviewDue: true }) },
      {
        facts: makeFacts({
          workloadWarning: "1 overdue action",
          hasOverdueAction: true,
          feedback: { outstanding: 3, submitted: 0, lastRequestedMonthKey: "2026-06" },
        }),
      },
      { facts: makeFacts({ successor: true }) },
    ];
    expect(computePerformanceStats(rows)).toEqual({
      needsCheckIn: 1,
      feedbackPending: 1,
      reviewsDue: 1,
      workloadFlagged: 1,
      succession: 1,
    });
  });
});

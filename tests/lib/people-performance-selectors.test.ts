import { describe, expect, it } from "vitest";

import {
  allowedFeedbackMonths,
  asPerformanceFilter,
  buildCheckInCalendarDots,
  buildMonthSnapshot,
  buildNeedsActionList,
  buildSignals,
  checkInCellStatus,
  computePerformanceStats,
  currentQuarterLabel,
  deriveNextAction,
  describeCompileResult,
  factsMatchFilter,
  feedbackCellStatus,
  monthKeyUTC,
  monthLabelUTC,
  monthStartUTC,
  parseMonthKey,
  quarterlyCellStatus,
  workloadCellStatus,
  type CurrentMonthFeedback,
  type PerformanceRowFacts,
} from "@/lib/people-strategy/people-performance-selectors";

const NOW = new Date("2026-06-12T15:00:00Z");
const CTX = { monthLabel: "June 2026", quarter: "2026-Q2" };

function makeMonthFeedback(
  overrides: Partial<CurrentMonthFeedback> = {}
): CurrentMonthFeedback {
  return { requested: 0, submitted: 0, pending: 0, newSinceCheckIn: false, ...overrides };
}

function makeFacts(overrides: Partial<PerformanceRowFacts> = {}): PerformanceRowFacts {
  return {
    workloadWarning: null,
    hasOverdueAction: false,
    trend: "Stable",
    successor: false,
    needsCheckIn: false,
    reviewDue: false,
    hasAnyReview: true,
    feedback: { outstanding: 0, submitted: 0, lastRequestedMonthKey: "2026-06" },
    monthFeedback: makeMonthFeedback(),
    activeActionCount: 0,
    overdueActionCount: 0,
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
  it("normalizes unknown filter params to needs-attention", () => {
    expect(asPerformanceFilter("workload")).toBe("workload");
    expect(asPerformanceFilter("nonsense")).toBe("needs-attention");
    expect(asPerformanceFilter(undefined)).toBe("needs-attention");
  });

  it("matches each filter against the corresponding fact", () => {
    expect(
      factsMatchFilter(
        makeFacts({ needsCheckIn: true, reviewDue: true }),
        "needs-attention"
      )
    ).toBe(true);
    expect(factsMatchFilter(makeFacts(), "needs-attention")).toBe(false);
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
      needsAttention: 2,
      needsCheckIn: 1,
      feedbackPending: 1,
      reviewsDue: 1,
      workloadFlagged: 1,
      succession: 1,
    });
  });
});

describe("plain-English cell statuses", () => {
  it("derives feedback text from the current month's workflow position", () => {
    expect(feedbackCellStatus(makeFacts()).text).toBe("No request this month");
    expect(
      feedbackCellStatus(
        makeFacts({
          needsCheckIn: true,
          monthFeedback: makeMonthFeedback({ requested: 5, submitted: 3, pending: 2 }),
        })
      ).text
    ).toBe("3 in, 2 waiting");
    expect(
      feedbackCellStatus(
        makeFacts({
          needsCheckIn: true,
          monthFeedback: makeMonthFeedback({ requested: 3, submitted: 3, pending: 0 }),
        })
      ).text
    ).toBe("Ready to review");
    expect(
      feedbackCellStatus(
        makeFacts({
          needsCheckIn: true,
          monthFeedback: makeMonthFeedback({ requested: 2, submitted: 0, pending: 2 }),
        })
      ).text
    ).toBe("Waiting on 2");
    expect(
      feedbackCellStatus(
        makeFacts({
          needsCheckIn: false,
          monthFeedback: makeMonthFeedback({ requested: 2, submitted: 2, newSinceCheckIn: true }),
        })
      ).text
    ).toBe("New feedback since check-in");
  });

  it("derives check-in text including ready-to-compile and missing states", () => {
    expect(checkInCellStatus(makeFacts({ needsCheckIn: false }), "Jun").text).toBe(
      "Jun compiled"
    );
    expect(checkInCellStatus(makeFacts({ needsCheckIn: true }), "Jun").text).toBe(
      "Missing Jun"
    );
    expect(
      checkInCellStatus(
        makeFacts({
          needsCheckIn: true,
          monthFeedback: makeMonthFeedback({ requested: 2, submitted: 2 }),
        }),
        "Jun"
      ).text
    ).toBe("Ready to compile");
  });

  it("derives workload text from active and overdue counts", () => {
    expect(workloadCellStatus(makeFacts({ activeActionCount: 0 })).text).toBe(
      "No active items"
    );
    expect(
      workloadCellStatus(
        makeFacts({ activeActionCount: 4, overdueActionCount: 1 })
      ).text
    ).toBe("4 active, 1 overdue");
    expect(
      workloadCellStatus(makeFacts({ activeActionCount: 3, overdueActionCount: 0 })).text
    ).toBe("3 active");
  });

  it("derives quarterly text from review presence and the feature flag", () => {
    expect(quarterlyCellStatus(makeFacts({ reviewDue: false })).text).toBe("Complete");
    expect(quarterlyCellStatus(makeFacts({ reviewDue: true })).text).toBe("Missing");
    expect(quarterlyCellStatus(makeFacts({ reviewDue: true }), false).text).toBe("Not due");
  });
});

describe("deriveNextAction priority", () => {
  it("1 — reviews feedback that is in and not yet reflected in a check-in", () => {
    const action = deriveNextAction(
      makeFacts({
        needsCheckIn: true,
        monthFeedback: makeMonthFeedback({ requested: 3, submitted: 3 }),
      }),
      CTX
    );
    expect(action.kind).toBe("review-feedback");
    expect(action.reason).toBe("3 responses ready to review");
  });

  it("1 — flags new feedback that arrived after the check-in was compiled", () => {
    const action = deriveNextAction(
      makeFacts({
        needsCheckIn: false,
        monthFeedback: makeMonthFeedback({ requested: 2, submitted: 1, newSinceCheckIn: true }),
      }),
      CTX
    );
    expect(action.kind).toBe("review-feedback");
    expect(action.reason).toBe("1 new response since check-in");
  });

  it("2/3 — compiles the check-in when the month is missing and no feedback is in", () => {
    const action = deriveNextAction(makeFacts({ needsCheckIn: true }), CTX);
    expect(action.kind).toBe("compile-check-in");
    expect(action.reason).toBe("June 2026 check-in not compiled");
  });

  it("4 — requests feedback when none was sent this month", () => {
    const action = deriveNextAction(
      makeFacts({ needsCheckIn: false, monthFeedback: makeMonthFeedback({ requested: 0 }) }),
      CTX
    );
    expect(action.kind).toBe("request-feedback");
  });

  it("5 — waits on outstanding responses", () => {
    const action = deriveNextAction(
      makeFacts({
        needsCheckIn: false,
        monthFeedback: makeMonthFeedback({ requested: 3, submitted: 1, pending: 2 }),
      }),
      CTX
    );
    expect(action.kind).toBe("await-feedback");
    expect(action.reason).toBe("Waiting on 2 responses");
  });

  it("6 — opens a missing quarterly review", () => {
    const action = deriveNextAction(
      makeFacts({
        needsCheckIn: false,
        reviewDue: true,
        monthFeedback: makeMonthFeedback({ requested: 1, submitted: 1, pending: 0 }),
      }),
      CTX
    );
    expect(action.kind).toBe("open-review");
    expect(action.reason).toBe("No 2026-Q2 review");
  });

  it("7 — surfaces overdue work items", () => {
    const action = deriveNextAction(
      makeFacts({
        needsCheckIn: false,
        reviewDue: false,
        overdueActionCount: 4,
        hasOverdueAction: true,
        workloadWarning: "4 overdue actions",
        monthFeedback: makeMonthFeedback({ requested: 1, submitted: 1, pending: 0 }),
      }),
      CTX
    );
    expect(action.kind).toBe("view-overdue");
    expect(action.reason).toBe("4 overdue actions");
  });

  it("8 — falls back to view-details when nothing is pressing", () => {
    const action = deriveNextAction(
      makeFacts({
        needsCheckIn: false,
        reviewDue: false,
        monthFeedback: makeMonthFeedback({ requested: 1, submitted: 1, pending: 0 }),
      }),
      CTX
    );
    expect(action.kind).toBe("view-details");
  });
});

describe("buildMonthSnapshot", () => {
  it("sums concrete workflow counts across rows", () => {
    const rows = [
      {
        facts: makeFacts({
          needsCheckIn: true,
          monthFeedback: makeMonthFeedback({ requested: 3, submitted: 3, pending: 0 }),
        }),
      },
      {
        facts: makeFacts({
          needsCheckIn: false,
          reviewDue: true,
          monthFeedback: makeMonthFeedback({ requested: 2, submitted: 1, pending: 1 }),
        }),
      },
    ];
    expect(buildMonthSnapshot(rows)).toEqual({
      feedbackRequested: 5,
      feedbackReceived: 4,
      feedbackToReview: 1,
      checkInsCompleted: 1,
      checkInsMissing: 1,
      reviewsToAttend: 1,
    });
  });
});

describe("buildNeedsActionList", () => {
  it("orders by urgency, drops up-to-date people, and caps the list", () => {
    const rows = [
      {
        id: "calm",
        name: "Calm Person",
        email: "calm@example.com",
        facts: makeFacts({
          needsCheckIn: false,
          monthFeedback: makeMonthFeedback({ requested: 1, submitted: 1, pending: 0 }),
        }),
      },
      {
        id: "missing",
        name: "Missing Checkin",
        email: "m@example.com",
        facts: makeFacts({ needsCheckIn: true }),
      },
      {
        id: "review",
        name: "Has Feedback",
        email: "h@example.com",
        facts: makeFacts({
          needsCheckIn: true,
          monthFeedback: makeMonthFeedback({ requested: 2, submitted: 2 }),
        }),
      },
    ];
    const list = buildNeedsActionList(rows, CTX);
    expect(list.map((i) => i.id)).toEqual(["review", "missing"]);
    expect(list[0].action.kind).toBe("review-feedback");
  });
});

describe("describeCompileResult", () => {
  it("reports a first compile that used feedback", () => {
    expect(
      describeCompileResult("May 2026", {
        feedbackResponses: 3,
        isRecompile: false,
        newResponses: 3,
      })
    ).toBe("Compiled May 2026 check-in using 3 feedback responses.");
  });

  it("reports a compile with no feedback available", () => {
    expect(
      describeCompileResult("May 2026", {
        feedbackResponses: 0,
        isRecompile: false,
        newResponses: 0,
      })
    ).toBe("Compiled May 2026 check-in. No collaborator feedback was available yet.");
  });

  it("reports a recompile that picked up new responses", () => {
    expect(
      describeCompileResult("May 2026", {
        feedbackResponses: 4,
        isRecompile: true,
        newResponses: 1,
      })
    ).toBe("Recompiled May 2026 check-in with 1 new response.");
  });
});

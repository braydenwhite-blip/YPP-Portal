import { describe, expect, it } from "vitest";

import {
  buildPeopleCockpit,
  performanceCockpitItems,
  type CockpitInput,
  type CockpitPerformanceRow,
} from "@/lib/people-strategy/people-cockpit";
import type {
  CurrentMonthFeedback,
  PerformanceRowFacts,
} from "@/lib/people-strategy/people-performance-selectors";

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
    hasMentor: true,
    mentorEligible: false,
    needsMentor: false,
    growthOpportunity: false,
    disengagementRisk: false,
    ...overrides,
  };
}

function perfRow(
  id: string,
  name: string,
  facts: Partial<PerformanceRowFacts> = {}
): CockpitPerformanceRow {
  return {
    id,
    name,
    email: `${id}@ypp.org`,
    role: "INSTRUCTOR",
    context: "Instructor",
    // Default to "feedback already handled this month" so a row falls through to
    // whatever specific signal a test sets — otherwise deriveNextAction surfaces
    // "no feedback requested this month" for everyone.
    facts: makeFacts({ monthFeedback: makeMonthFeedback({ requested: 1, submitted: 1 }), ...facts }),
  };
}

function lane(input: CockpitInput, laneId: string) {
  return buildPeopleCockpit(input).lanes.find((l) => l.id === laneId);
}

describe("performanceCockpitItems", () => {
  it("routes feedback ready to review into the review lane with a reason", () => {
    const items = performanceCockpitItems(
      [perfRow("a", "Maya", { needsCheckIn: true, monthFeedback: makeMonthFeedback({ requested: 2, submitted: 2 }) })],
      CTX
    );
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({
      lane: "review",
      type: "feedback-review",
      person: { id: "a", name: "Maya" },
      primaryAction: { kind: "review-feedback" },
    });
    expect(items[0].reason).toMatch(/ready to review/i);
  });

  it("routes a person awaiting feedback into the waiting lane", () => {
    const [item] = performanceCockpitItems(
      [perfRow("b", "Alex", { monthFeedback: makeMonthFeedback({ requested: 3, submitted: 0, pending: 3 }) })],
      CTX
    );
    expect(item.lane).toBe("waiting");
    expect(item.reason).toMatch(/waiting on 3/i);
  });

  it("routes a missing quarterly review into the decide lane", () => {
    const [item] = performanceCockpitItems([perfRow("c", "Sam", { reviewDue: true })], CTX);
    expect(item.lane).toBe("decide");
    expect(item.type).toBe("review-due");
  });

  it("routes an overdue carrier into follow-up with high severity", () => {
    const [item] = performanceCockpitItems(
      [perfRow("d", "Jo", { overdueActionCount: 2, hasOverdueAction: true, workloadWarning: "2 overdue actions" })],
      CTX
    );
    expect(item.lane).toBe("follow-up");
    expect(item.severity).toBe("high");
  });

  it("drops people who are up to date (no pending step)", () => {
    expect(performanceCockpitItems([perfRow("e", "Up To Date")], CTX)).toHaveLength(0);
  });
});

describe("buildPeopleCockpit", () => {
  it("returns no lanes and no chips when nothing is pending", () => {
    const cockpit = buildPeopleCockpit({ performance: { rows: [perfRow("e", "Clear")], ctx: CTX } });
    expect(cockpit.lanes).toHaveLength(0);
    expect(cockpit.chips).toHaveLength(0);
    expect(cockpit.total).toBe(0);
  });

  it("surfaces meetings with unresolved follow-ups in the meeting lane", () => {
    const meetingLane = lane(
      {
        meetingsWithOpenFollowups: [
          { id: "m1", title: "Officer sync", unresolvedCount: 2, metLabel: "Met Jun 12", href: "/meetings/m1" },
        ],
      },
      "meeting"
    );
    expect(meetingLane?.items).toHaveLength(1);
    expect(meetingLane?.items[0]).toMatchObject({
      person: { id: null, name: "Officer sync" },
      primaryAction: { kind: "navigate", href: "/meetings/m1" },
    });
    expect(meetingLane?.items[0].reason).toMatch(/2 unresolved follow-ups/i);
  });

  it("flags an accepted applicant with no class pairing as high severity", () => {
    const pairLane = lane(
      {
        acceptedApplicantsNeedingClass: [
          { id: "ap1", name: "Ava", role: "New instructor", acceptedLabel: "Accepted 4 days ago", href: "/x" },
        ],
      },
      "pair-class"
    );
    expect(pairLane?.items[0]).toMatchObject({ severity: "high", type: "applicant-class-pairing" });
    expect(pairLane?.items[0].reason).toMatch(/not paired with a class/i);
  });

  it("orders items within a lane by severity then rank", () => {
    const followUp = lane(
      {
        performance: {
          rows: [
            perfRow("low", "Low", { needsMentor: true, mentorEligible: true, hasMentor: false }),
            perfRow("high", "High", { overdueActionCount: 1, hasOverdueAction: true }),
          ],
          ctx: CTX,
        },
      },
      "follow-up"
    );
    // High-severity overdue carrier sorts above the low-severity mentor gap.
    expect(followUp?.items[0].person.name).toBe("High");
  });

  it("dedupes items that share a stable id", () => {
    const cockpit = buildPeopleCockpit({
      meetingsWithOpenFollowups: [
        { id: "m1", title: "Sync", unresolvedCount: 1, metLabel: null, href: "/a" },
        { id: "m1", title: "Sync", unresolvedCount: 1, metLabel: null, href: "/a" },
      ],
    });
    const meetingLane = cockpit.lanes.find((l) => l.id === "meeting");
    expect(meetingLane?.items).toHaveLength(1);
  });

  it("builds plain-English chips that lead with the count, excluding recent", () => {
    const cockpit = buildPeopleCockpit({
      performance: {
        rows: [perfRow("a", "Maya", { needsCheckIn: true, monthFeedback: makeMonthFeedback({ requested: 1, submitted: 1 }) })],
        ctx: CTX,
      },
      recentChanges: [{ id: "r1", label: "Something changed", changedAtISO: "2026-06-10T00:00:00Z", href: null }],
    });
    expect(cockpit.chips.some((c) => /feedback/i.test(c.label))).toBe(true);
    expect(cockpit.chips.some((c) => c.laneId === "recent")).toBe(false);
  });

  it("orders the recently-changed lane newest first and caps it", () => {
    const cockpit = buildPeopleCockpit({
      recentChanges: Array.from({ length: 9 }, (_, i) => ({
        id: `r${i}`,
        label: `Change ${i}`,
        changedAtISO: `2026-06-${String(i + 1).padStart(2, "0")}T00:00:00Z`,
        href: null,
      })),
    });
    const recent = cockpit.lanes.find((l) => l.id === "recent");
    expect(recent?.items.length).toBeLessThanOrEqual(6);
    expect(recent?.items[0].reason).toBe("Change 8");
  });
});

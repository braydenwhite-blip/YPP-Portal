import { describe, expect, it } from "vitest";

import {
  buildDevelopmentCockpit,
  daysSinceLastTouch,
  deriveDevelopmentSignals,
  EMPTY_DEVELOPMENT_FACTS,
  primaryLane,
  recommendNextStep,
  NO_RECENT_TOUCH_DAYS,
  RECENTLY_SUPPORTED_DAYS,
  type DevelopmentPersonFacts,
} from "@/lib/development/signals";

function person(
  overrides: Partial<DevelopmentPersonFacts> = {}
): DevelopmentPersonFacts {
  return {
    ...EMPTY_DEVELOPMENT_FACTS,
    id: "user-1",
    name: "Maya Chen",
    email: "maya@ypp.org",
    role: "INSTRUCTOR",
    contextLabel: "Instructor · Scarsdale",
    population: "instructor",
    mentorName: "Jordan Lee",
    mentorEligible: true,
    daysSinceLastCheckIn: 5,
    hasCurrentMonthCheckIn: true,
    ...overrides,
  };
}

describe("deriveDevelopmentSignals", () => {
  it("raises a concern for a disengagement-risk flag", () => {
    const signals = deriveDevelopmentSignals(
      person({ growthTags: ["AT_RISK_OF_DISENGAGING"] })
    );
    expect(signals.some((s) => s.kind === "disengagement-risk")).toBe(true);
    expect(primaryLane(signals)).toBe("concern");
  });

  it("raises a concern for a red check-in rating with the month in the label", () => {
    const signals = deriveDevelopmentSignals(
      person({
        lastCheckInRating: "BEHIND_SCHEDULE",
        lastCheckInMonthLabel: "June",
      })
    );
    const concern = signals.find((s) => s.kind === "rated-behind");
    expect(concern?.label).toBe("Rated At Risk in June check-in");
    expect(primaryLane(signals)).toBe("concern");
  });

  it("flags a mentor-eligible person with no mentor as needing a coach", () => {
    const signals = deriveDevelopmentSignals(person({ mentorName: null }));
    expect(signals.some((s) => s.kind === "no-mentor")).toBe(true);
    expect(primaryLane(signals)).toBe("needs-coach");
  });

  it("treats a new person without a mentor as more urgent, with their tenure in the label", () => {
    const signals = deriveDevelopmentSignals(
      person({ mentorName: null, daysSinceJoined: 12 })
    );
    const signal = signals.find((s) => s.kind === "new-without-mentor");
    expect(signal?.label).toBe("New — joined 12 days ago, no mentor yet");
    expect(signal?.tone).toBe("danger");
  });

  it("never flags a missing mentor for roles the program does not pair", () => {
    const signals = deriveDevelopmentSignals(
      person({ mentorName: null, mentorEligible: false, role: "STAFF" })
    );
    expect(signals.some((s) => s.lane === "needs-coach")).toBe(false);
  });

  it("says review overdue when a prior review exists but the quarter lapsed", () => {
    const signals = deriveDevelopmentSignals(
      person({ reviewDue: true, hasAnyReview: true, lastReviewQuarter: "2026-Q1" })
    );
    const signal = signals.find((s) => s.kind === "review-overdue");
    expect(signal?.label).toBe("Review overdue — last review 2026-Q1");
    expect(signal?.tone).toBe("danger");
  });

  it("says review due (not overdue) for a first-ever review", () => {
    const signals = deriveDevelopmentSignals(
      person({ reviewDue: true, hasAnyReview: false })
    );
    expect(signals.some((s) => s.kind === "review-due")).toBe(true);
    expect(signals.some((s) => s.kind === "review-overdue")).toBe(false);
  });

  it("flags overload from overdue actions and from stacked leadership roles", () => {
    const overdue = deriveDevelopmentSignals(
      person({ openActionCount: 4, overdueActionCount: 3 })
    );
    expect(overdue.some((s) => s.kind === "overdue-actions")).toBe(true);

    const stacked = deriveDevelopmentSignals(
      person({
        population: "officer",
        teamsLeadingCount: 2,
        committeesChairedCount: 1,
        openActionCount: 2,
      })
    );
    const heavy = stacked.find((s) => s.kind === "heavy-load");
    expect(heavy?.label).toBe(
      "Leads 2 teams · chairs 1 committee · 2 open actions"
    );
  });

  it("flags a mentor carrying more mentees than the cap", () => {
    const signals = deriveDevelopmentSignals(
      person({ activeMenteeCount: 5, mentorCap: 3 })
    );
    const signal = signals.find((s) => s.kind === "mentor-over-cap");
    expect(signal?.label).toBe("Mentors 5 — over the cap of 3");
  });

  it("flags no recent check-in once the touch window lapses", () => {
    const signals = deriveDevelopmentSignals(
      person({
        daysSinceLastCheckIn: NO_RECENT_TOUCH_DAYS + 7,
        hasCurrentMonthCheckIn: false,
      })
    );
    const signal = signals.find((s) => s.kind === "no-recent-checkin");
    expect(signal?.label).toBe(`No check-in for ${NO_RECENT_TOUCH_DAYS + 7} days`);
  });

  it("a recent mentorship session counts as a touch even without a check-in", () => {
    const facts = person({
      daysSinceLastCheckIn: null,
      hasCurrentMonthCheckIn: false,
      daysSinceLastSession: 3,
    });
    expect(daysSinceLastTouch(facts)).toBe(3);
    const signals = deriveDevelopmentSignals(facts);
    expect(signals.some((s) => s.lane === "no-recent-checkin")).toBe(false);
    expect(signals.some((s) => s.kind === "recently-supported")).toBe(true);
  });

  it("flags someone never checked in on", () => {
    const signals = deriveDevelopmentSignals(
      person({
        daysSinceLastCheckIn: null,
        daysSinceLastSession: null,
        hasCurrentMonthCheckIn: false,
      })
    );
    expect(signals.some((s) => s.kind === "never-checked-in")).toBe(true);
  });

  it("flags an officer with no open work and no recent touch as inactive", () => {
    const signals = deriveDevelopmentSignals(
      person({
        population: "officer",
        mentorEligible: false,
        daysSinceLastCheckIn: null,
        daysSinceLastSession: null,
        hasCurrentMonthCheckIn: false,
        openActionCount: 0,
        openFollowUpCount: 0,
        teamsLeadingCount: 0,
        committeesChairedCount: 0,
      })
    );
    expect(signals.some((s) => s.kind === "officer-inactive")).toBe(true);
  });

  it("collects ready-for-more evidence from tags, succession, and strong reviews", () => {
    const signals = deriveDevelopmentSignals(
      person({
        growthTags: ["READY_FOR_MORE", "POTENTIAL_TEAM_LEAD"],
        successionFlag: true,
        lastMentorReviewRating: "ABOVE_AND_BEYOND",
        meetsLeadExpectations: true,
      })
    );
    expect(signals.filter((s) => s.lane === "ready-for-more")).toHaveLength(5);
    expect(primaryLane(signals)).toBe("ready-for-more");
  });

  it("reports only the higher expectation level met", () => {
    const signals = deriveDevelopmentSignals(
      person({ meetsSeniorExpectations: true, meetsLeadExpectations: true })
    );
    const labels = signals
      .filter((s) => s.kind === "meets-expectations")
      .map((s) => s.label);
    expect(labels).toEqual(["Meets Lead Instructor leadership expectations"]);
  });

  it("marks a recent touch as recently supported", () => {
    const signals = deriveDevelopmentSignals(
      person({ daysSinceLastCheckIn: RECENTLY_SUPPORTED_DAYS - 1 })
    );
    expect(signals.some((s) => s.kind === "recently-supported")).toBe(true);
  });
});

describe("primaryLane priority", () => {
  it("a concern outranks readiness — the concern lane wins", () => {
    const signals = deriveDevelopmentSignals(
      person({
        growthTags: ["READY_FOR_MORE", "AT_RISK_OF_DISENGAGING"],
      })
    );
    expect(primaryLane(signals)).toBe("concern");
  });

  it("overload outranks a due review", () => {
    const signals = deriveDevelopmentSignals(
      person({
        overdueActionCount: 2,
        openActionCount: 3,
        reviewDue: true,
        hasAnyReview: true,
        lastReviewQuarter: "2026-Q1",
      })
    );
    expect(primaryLane(signals)).toBe("overloaded");
  });

  it("returns null for a steady person with no signals", () => {
    const signals = deriveDevelopmentSignals(
      person({ daysSinceLastCheckIn: 20 })
    );
    expect(primaryLane(signals)).toBeNull();
  });
});

describe("recommendNextStep", () => {
  it("routes a missing mentor to the assignment board", () => {
    const facts = person({ mentorName: null });
    const step = recommendNextStep(facts, deriveDevelopmentSignals(facts));
    expect(step.label).toBe("Assign a mentor");
    expect(step.href).toBe(
      "/admin/mentorship?tab=assignments&menteeId=user-1&supportRole=PRIMARY_MENTOR"
    );
  });

  it("routes an overdue review to the quarterly reviews queue", () => {
    const facts = person({
      reviewDue: true,
      hasAnyReview: true,
      lastReviewQuarter: "2026-Q1",
    });
    const step = recommendNextStep(facts, deriveDevelopmentSignals(facts));
    expect(step.label).toBe("Record the review");
    expect(step.reason).toBe("Review overdue — last review 2026-Q1");
    expect(step.href).toBe("/people/quarterly-reviews");
  });

  it("routes a stuck chair approval to the approvals tab", () => {
    const facts = person({ pendingChairReviewDays: 10 });
    const step = recommendNextStep(facts, deriveDevelopmentSignals(facts));
    expect(step.label).toBe("Unblock the approval");
    expect(step.href).toBe("/admin/mentorship?tab=approvals");
  });

  it("uses the person's first name for a concern check-in", () => {
    const facts = person({ growthTags: ["AT_RISK_OF_DISENGAGING"] });
    const step = recommendNextStep(facts, deriveDevelopmentSignals(facts));
    expect(step.label).toBe("Check in with Maya");
    expect(step.href).toBe("/people/user-1");
  });

  it("routes readiness to the development record for planning", () => {
    const facts = person({ growthTags: ["READY_FOR_MORE"] });
    const step = recommendNextStep(facts, deriveDevelopmentSignals(facts));
    expect(step.label).toBe("Plan their next step");
    expect(step.href).toBe("/mentorship/people/user-1");
  });
});

describe("buildDevelopmentCockpit", () => {
  it("places each person in exactly one lane and counts the steady", () => {
    const cockpit = buildDevelopmentCockpit([
      person({ id: "a", name: "Ada", growthTags: ["AT_RISK_OF_DISENGAGING"] }),
      person({ id: "b", name: "Ben", mentorName: null }),
      person({ id: "c", name: "Cal", daysSinceLastCheckIn: 20 }), // steady
      person({ id: "d", name: "Dee", daysSinceLastCheckIn: 3 }), // recently supported
    ]);

    const laneIds = cockpit.lanes.map((lane) => lane.id);
    expect(laneIds).toEqual(["concern", "needs-coach", "recently-supported"]);
    expect(cockpit.steadyCount).toBe(1);
    expect(cockpit.total).toBe(3);

    const allIds = cockpit.lanes.flatMap((lane) => lane.cards.map((c) => c.facts.id));
    expect(new Set(allIds).size).toBe(allIds.length);
  });

  it("orders lanes most-pressing-first and leads cards with the lane's own signals", () => {
    const cockpit = buildDevelopmentCockpit([
      person({
        id: "a",
        name: "Ada",
        mentorName: null,
        growthTags: ["READY_FOR_MORE"],
      }),
    ]);
    expect(cockpit.lanes[0]?.id).toBe("needs-coach");
    const card = cockpit.lanes[0]?.cards[0];
    expect(card?.signals[0]?.lane).toBe("needs-coach");
  });

  it("keeps recently-supported out of the briefing chips", () => {
    const cockpit = buildDevelopmentCockpit([
      person({ id: "d", name: "Dee", daysSinceLastCheckIn: 3 }),
    ]);
    expect(cockpit.chips).toHaveLength(0);
    expect(cockpit.lanes[0]?.id).toBe("recently-supported");
  });

  it("writes plain-english chip labels with real counts", () => {
    const cockpit = buildDevelopmentCockpit([
      person({ id: "a", name: "Ada", mentorName: null }),
      person({ id: "b", name: "Ben", mentorName: null }),
      person({
        id: "c",
        name: "Cal",
        reviewDue: true,
        hasAnyReview: true,
        lastReviewQuarter: "2026-Q1",
      }),
    ]);
    const labels = cockpit.chips.map((chip) => chip.label);
    expect(labels).toContain("2 need a coach");
    expect(labels).toContain("1 review due");
  });
});

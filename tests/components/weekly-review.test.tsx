import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type {
  ActionTriage,
  WeeklyOperationalDigest,
} from "@/lib/people-strategy/operational-digest";
import {
  isWeeklyReviewStep,
  nextReviewDate,
  resolveWeeklyReviewStep,
  WeeklyReviewNav,
  WeeklyReviewStepper,
  WeeklyReviewWrapUp,
} from "@/components/people-strategy/weekly-review";

describe("weekly review step helpers", () => {
  it("validates and resolves the active step", () => {
    expect(isWeeklyReviewStep("triage")).toBe(true);
    expect(isWeeklyReviewStep("nope")).toBe(false);
    expect(resolveWeeklyReviewStep(undefined)).toBe("triage");
    expect(resolveWeeklyReviewStep("decisions")).toBe("decisions");
    expect(resolveWeeklyReviewStep("garbage")).toBe("triage");
  });

  it("recommends a next review one week out", () => {
    const next = nextReviewDate(new Date("2026-06-04T00:00:00"));
    expect(next.toISOString().slice(0, 10)).toBe("2026-06-11");
  });
});

describe("WeeklyReviewStepper", () => {
  it("marks the active step and links every step", () => {
    render(<WeeklyReviewStepper activeKey="meetings" counts={{ triage: 3, meetings: 2 }} />);
    const active = screen.getByRole("link", { name: /Meetings/ });
    expect(active).toHaveAttribute("aria-current", "step");
    expect(screen.getByRole("link", { name: /Triage/ })).toHaveAttribute(
      "href",
      "/operations/weekly-review?step=triage"
    );
    expect(screen.getByText("3 to review")).toBeInTheDocument();
  });
});

describe("WeeklyReviewNav", () => {
  it("shows prev/next within the flow", () => {
    render(<WeeklyReviewNav activeKey="meetings" />);
    expect(screen.getByRole("link", { name: /Triage/ })).toHaveAttribute(
      "href",
      "/operations/weekly-review?step=triage"
    );
    expect(screen.getByRole("link", { name: /Health/ })).toHaveAttribute(
      "href",
      "/operations/weekly-review?step=entities"
    );
  });

  it("ends on the last step with a return to the Command Center", () => {
    render(<WeeklyReviewNav activeKey="wrap" />);
    expect(screen.getByRole("link", { name: /Back to Command Center/ })).toHaveAttribute(
      "href",
      "/operations/command-center"
    );
  });
});

describe("WeeklyReviewWrapUp", () => {
  const emptyDigest: WeeklyOperationalDigest = {
    generatedAt: new Date("2026-06-04T00:00:00"),
    window: { start: new Date("2026-06-01"), end: new Date("2026-06-07") },
    counts: {
      openActions: 3,
      overdueActions: 2,
      dueTodayActions: 0,
      dueSoonActions: 0,
      blockedActions: 1,
      unassignedActions: 0,
      meetingsThisWeek: 0,
      upcomingMeetings: 0,
      meetingsWithoutActions: 0,
      unresolvedFollowUps: 0,
      unconvertedFollowUps: 0,
      criticalEntities: 1,
      warningEntities: 0,
      recentDecisions: 0,
      decisionsNeedingAction: 0,
      recentlyCompletedActions: 4,
    },
    urgentActions: [],
    triage: { overdue: [], blocked: [], unassigned: [], dueSoon: [] },
    upcomingMeetings: [],
    recentMeetings: [],
    staleEntities: [],
    criticalEntities: [],
    decisionsNeedingAction: [],
    unresolvedMeetingFollowUps: [],
    meetingsNeedingFollowThrough: [],
    recentlyCompletedActions: [],
    areaHealth: [],
    recommendedReviewOrder: [],
  };
  const triage: ActionTriage = { overdue: [], blocked: [], unassigned: [], dueSoon: [] };

  it("summarizes the review and recommends a next date", () => {
    render(
      <WeeklyReviewWrapUp digest={emptyDigest} triage={triage} nextReviewISO="2026-06-11T12:00:00.000Z" />
    );
    expect(screen.getByText(/still need a decision/i)).toBeInTheDocument();
    expect(screen.getByText(/Jun 11, 2026/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Back to Command Center/ })).toBeInTheDocument();
  });
});

import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({ prisma: {} }));
vi.mock("@/lib/feature-flags", () => ({ isActionTrackerEnabled: () => true }));

import { deriveOperatingReview } from "@/lib/people-strategy/strategic-operating-reviews";
import {
  computeInitiativeWorkSignals,
  deriveInitiativeHealth,
  deriveInitiativeMomentum,
  deriveInitiativeOwnership,
  deriveInitiativeRisk,
} from "@/lib/people-strategy/strategic-initiative-health";
import { deriveTimelineEvents } from "@/lib/people-strategy/strategic-timeline";
import { deriveDecisionCenter } from "@/lib/people-strategy/strategic-decision-center";
import type { StrategicInitiativeDef } from "@/lib/people-strategy/strategic-initiatives";
import type { InitiativeDependencyView } from "@/lib/people-strategy/strategic-dependencies";

import { action, NOW } from "./strategic-helpers";

const def: StrategicInitiativeDef = {
  id: "i",
  title: "Camps",
  description: "",
  area: "CLASSES",
  status: "active",
  priority: "high",
  match: { keywords: ["camp"] },
  milestones: [],
};

const EMPTY_DEPS: InitiativeDependencyView = {
  blockedBy: [],
  unlocks: [],
  relatedTo: [],
  onCriticalPath: false,
  atRisk: false,
};

describe("deriveOperatingReview", () => {
  const actions = [
    action({ title: "Book the venue", status: "IN_PROGRESS", deadlineStart: new Date("2026-06-01") }), // overdue
    action({ title: "Confirm instructors", status: "COMPLETE", completedAt: new Date("2026-06-02"), createdAt: new Date("2026-05-01") }),
  ];

  function build(cadence: "weekly" | "monthly" | "quarterly") {
    const signals = computeInitiativeWorkSignals({ actions, meetings: [], decisions: [], now: NOW });
    const momentum = deriveInitiativeMomentum(signals, NOW);
    const ownership = deriveInitiativeOwnership(actions, { owner: undefined }, NOW);
    const risk = deriveInitiativeRisk(signals, { momentum });
    const health = deriveInitiativeHealth({ status: "active", signals, risk, momentum, ownership });
    const timelineEvents = deriveTimelineEvents({ def, actions, meetings: [], decisions: [], milestones: [], now: NOW }).filter((e) => !e.upcoming);
    return deriveOperatingReview({
      cadence,
      initiativeTitle: def.title,
      health,
      momentum,
      risk,
      ownership,
      counts: {
        overdueActions: signals.overdueActions,
        blockedActions: signals.blockedActions,
        openActions: signals.openActions,
        completedActions: signals.completedActions,
        unassignedActions: signals.unassignedActions,
        openFollowUps: 0,
        milestonesBehind: 0,
      },
      milestones: [],
      recommendations: [],
      timelineEvents,
      decisionCenter: deriveDecisionCenter([], NOW),
      dependencies: EMPTY_DEPS,
      now: NOW,
    });
  }

  it("captures a recent completion as a win", () => {
    const review = build("weekly");
    expect(review.wins).toContain("Completed: Confirm instructors");
  });

  it("captures overdue work as a loss", () => {
    const review = build("weekly");
    expect(review.losses.some((l) => l.includes("overdue"))).toBe(true);
  });

  it("headlines with the health label and cadence framing", () => {
    const review = build("weekly");
    expect(review.headline).toContain("this week");
    expect(review.label).toBe("Weekly review");
  });

  it("supports monthly and quarterly cadences", () => {
    expect(build("monthly").label).toBe("Monthly review");
    expect(build("quarterly").headline).toContain("this quarter");
  });
});

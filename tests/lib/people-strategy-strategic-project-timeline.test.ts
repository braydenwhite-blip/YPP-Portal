import { describe, expect, it } from "vitest";

import {
  deriveProjectActionIntelligence,
  deriveProjectDependencyView,
  deriveProjectMeetingIntelligence,
} from "@/lib/people-strategy/strategic-project-timeline";

import { action, meetingCard, NOW } from "./strategic-helpers";

describe("deriveProjectActionIntelligence", () => {
  it("slices actions into open / overdue / completed / unowned / undated", () => {
    const intel = deriveProjectActionIntelligence(
      [
        action({ id: "done", status: "COMPLETE", completedAt: new Date("2026-06-01") }),
        action({ id: "overdue", status: "IN_PROGRESS", deadlineStart: new Date("2026-05-20") }),
        action({ id: "nodue", status: "IN_PROGRESS", deadlineStart: null }),
        action({ id: "unowned", status: "NOT_STARTED", lead: null, deadlineStart: new Date("2026-06-20") }),
        action({ id: "frommtg", status: "IN_PROGRESS", officerMeetingId: "m1", deadlineStart: new Date("2026-06-15") }),
      ],
      NOW
    );
    expect(intel.counts.completed).toBe(1);
    expect(intel.counts.overdue).toBe(1);
    expect(intel.counts.noDueDate).toBe(1);
    expect(intel.counts.unowned).toBe(1);
    expect(intel.counts.fromMeetings).toBe(1);
  });

  it("recommends the overdue action first", () => {
    const intel = deriveProjectActionIntelligence(
      [
        action({ id: "later", status: "IN_PROGRESS", priority: "LOW", deadlineStart: new Date("2026-06-30") }),
        action({ id: "overdue", status: "IN_PROGRESS", priority: "MEDIUM", deadlineStart: new Date("2026-05-20") }),
      ],
      NOW
    );
    expect(intel.recommendedNext?.id).toBe("overdue");
  });

  it("returns null recommendation when nothing is open", () => {
    const intel = deriveProjectActionIntelligence(
      [action({ id: "done", status: "COMPLETE", completedAt: new Date("2026-06-01") })],
      NOW
    );
    expect(intel.recommendedNext).toBeNull();
  });
});

describe("deriveProjectMeetingIntelligence", () => {
  it("separates meetings that produced follow-through from those that didn't", () => {
    const intel = deriveProjectMeetingIntelligence(
      [
        meetingCard({ id: "withDecisions", startISO: "2026-06-02T00:00:00.000Z", decisionCount: 2 }),
        meetingCard({ id: "withActions", startISO: "2026-06-01T00:00:00.000Z", linkedActionCount: 3 }),
        meetingCard({ id: "empty", startISO: "2026-05-30T00:00:00.000Z", decisionCount: 0, linkedActionCount: 0 }),
      ],
      0,
      NOW
    );
    expect(intel.counts.producedDecisions).toBe(1);
    expect(intel.counts.producedActions).toBe(1);
    expect(intel.counts.noFollowUp).toBe(1);
  });

  it("recommends a meeting when open work exists but nothing met recently", () => {
    const intel = deriveProjectMeetingIntelligence(
      [meetingCard({ id: "old", startISO: "2026-01-01T00:00:00.000Z" })],
      3, // open actions
      NOW
    );
    expect(intel.nextMeetingRecommended).toBe(true);
  });

  it("does not recommend a meeting when one happened recently", () => {
    const intel = deriveProjectMeetingIntelligence(
      [meetingCard({ id: "recent", startISO: "2026-06-02T00:00:00.000Z", decisionCount: 1 })],
      3,
      NOW
    );
    expect(intel.nextMeetingRecommended).toBe(false);
  });
});

describe("deriveProjectDependencyView", () => {
  it("renders declared upstream/downstream and flags blocked state", () => {
    const view = deriveProjectDependencyView(
      { dependsOn: ["Beth El Pilot"], unlocks: ["Full slate"] },
      { dependencyAtRisk: true, observedBlockers: 0 }
    );
    expect(view.dependsOn[0]).toEqual({ label: "Beth El Pilot", atRisk: true });
    expect(view.unlocks).toEqual(["Full slate"]);
    expect(view.hasDeclaredDependencies).toBe(true);
    expect(view.blocked).toBe(true);
  });

  it("is empty + unblocked with no declared deps and no observed blockers", () => {
    const view = deriveProjectDependencyView({}, {});
    expect(view.dependsOn).toEqual([]);
    expect(view.hasDeclaredDependencies).toBe(false);
    expect(view.blocked).toBe(false);
  });
});

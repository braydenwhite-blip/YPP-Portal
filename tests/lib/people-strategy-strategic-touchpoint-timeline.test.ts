import { describe, expect, it } from "vitest";

import type { InitiativeMilestoneSummary } from "@/lib/people-strategy/strategic-milestones";
import {
  deriveTouchpointTimeline,
  normalizeTouchpoints,
  partnerTouchpoint,
  type TouchpointGroup,
} from "@/lib/people-strategy/strategic-touchpoint-timeline";

import { action, classLabel, decision, meetingCard, NOW } from "./strategic-helpers";

function milestone(overrides: Partial<InitiativeMilestoneSummary> = {}): InitiativeMilestoneSummary {
  return {
    id: "m1",
    title: "Run pilot",
    description: null,
    order: 1,
    targetDateISO: null,
    status: "in_progress",
    statusLabel: "In progress",
    percent: 40,
    totalActions: 2,
    openActions: 1,
    completedActions: 1,
    blockedActions: 0,
    overdueActions: 0,
    unassignedActions: 0,
    meetingCount: 0,
    decisionCount: 0,
    health: { level: "healthy", label: "Healthy", tone: "success", score: 80, reasons: [] },
    ownerName: "Alice",
    behindSchedule: false,
    actionIds: [],
    ...overrides,
  };
}

const ctx = {
  initiativeId: "summer",
  initiativeTitle: "Summer Camps",
  projectId: "beth-el",
  projectTitle: "Beth El Pilot",
};

describe("touchpoint timeline normalization", () => {
  it("emits created + completed touchpoints for a completed action", () => {
    const events = normalizeTouchpoints({
      context: ctx,
      actions: [
        action({
          id: "a1",
          title: "Sign Beth El agreement",
          status: "COMPLETE",
          completedAt: new Date("2026-06-03T00:00:00"),
        }),
      ],
      now: NOW,
    });
    const types = events.map((e) => e.eventType).sort();
    expect(types).toContain("action_created");
    expect(types).toContain("action_completed");
    const completed = events.find((e) => e.eventType === "action_completed")!;
    expect(completed.projectId).toBe("beth-el");
    expect(completed.followUpStatus).toBe("done");
  });

  it("flags an open past-due action as an overdue touchpoint", () => {
    const events = normalizeTouchpoints({
      context: ctx,
      actions: [
        action({
          id: "a2",
          title: "Recruit instructors",
          status: "IN_PROGRESS",
          deadlineStart: new Date("2026-06-01T00:00:00"), // before NOW (Jun 4)
        }),
      ],
      now: NOW,
    });
    const due = events.find((e) => e.eventType === "action_due")!;
    expect(due.overdue).toBe(true);
    expect(due.upcoming).toBe(false);
    expect(due.importance).toBe("critical");
    expect(due.group).toBe<TouchpointGroup>("overdue");
  });

  it("marks a future-due action as upcoming, not overdue", () => {
    const events = normalizeTouchpoints({
      context: ctx,
      actions: [
        action({
          id: "a3",
          title: "Order supplies",
          status: "IN_PROGRESS",
          deadlineStart: new Date("2026-06-20T00:00:00"),
        }),
      ],
      now: NOW,
    });
    const due = events.find((e) => e.eventType === "action_due")!;
    expect(due.upcoming).toBe(true);
    expect(due.overdue).toBe(false);
    expect(due.group).toBe<TouchpointGroup>("upcoming");
  });

  it("normalizes a decision with no linked action as pending follow-up", () => {
    const events = normalizeTouchpoints({
      context: ctx,
      decisions: [decision({ id: "d1", hasLinkedAction: false })],
      now: NOW,
    });
    const ev = events[0];
    expect(ev.eventType).toBe("decision");
    expect(ev.followUpStatus).toBe("pending");
    expect(ev.importance).toBe("high");
  });

  it("resolves a related entity from the labels map", () => {
    const [, summary] = classLabel("c1", "Robotics 101");
    const events = normalizeTouchpoints({
      context: { ...ctx, entityLabels: new Map([classLabel("c1", "Robotics 101")]) },
      actions: [
        action({ id: "a4", title: "Plan", relatedEntityType: "CLASS_OFFERING", relatedEntityId: "c1" }),
      ],
      now: NOW,
    });
    const created = events.find((e) => e.eventType === "action_created")!;
    expect(created.entity?.label).toBe(summary.label);
    expect(created.entity?.href).toBe(summary.href);
  });

  it("builds a partner touchpoint that links back to the partner", () => {
    const ev = partnerTouchpoint(
      {
        id: "p1",
        kind: "FOLLOW_UP",
        kindLabel: "Follow-up",
        body: "Called the principal",
        createdISO: "2026-06-02T00:00:00.000Z",
        partnerId: "partner-7",
        partnerName: "Beth El",
      },
      ctx,
      NOW
    );
    expect(ev.sourceType).toBe("partner");
    expect(ev.entity?.type).toBe("PARTNER");
    expect(ev.sourceHref).toBe("/admin/partners/partner-7");
    expect(ev.followUpStatus).toBe("pending");
  });
});

describe("touchpoint timeline grouping", () => {
  it("groups events into overdue / upcoming / current / recent / past", () => {
    const timeline = deriveTouchpointTimeline({
      context: ctx,
      actions: [
        // overdue
        action({ id: "o", title: "Overdue", status: "IN_PROGRESS", deadlineStart: new Date("2026-05-20") }),
        // upcoming
        action({ id: "u", title: "Future", status: "IN_PROGRESS", deadlineStart: new Date("2026-06-25") }),
        // current completion (within 3 days)
        action({ id: "c", title: "Just done", status: "COMPLETE", completedAt: new Date("2026-06-03") }),
        // past created (older than 14 days)
        action({ id: "p", title: "Old", status: "COMPLETE", completedAt: new Date("2026-05-01"), createdAt: new Date("2026-04-20") }),
      ],
      milestones: [milestone({ targetDateISO: "2026-07-01T00:00:00.000Z" })],
      now: NOW,
    });

    expect(timeline.overdue.length).toBeGreaterThan(0);
    expect(timeline.upcoming.length).toBeGreaterThan(0);
    expect(timeline.current.length).toBeGreaterThan(0);
    expect(timeline.isEmpty).toBe(false);
    expect(timeline.counts.total).toBe(timeline.all.length);
    // Upcoming is sorted soonest-first; overdue group is ordered before upcoming.
    expect(timeline.all[0].group).toBe<TouchpointGroup>("overdue");
  });

  it("is gracefully empty with no sources", () => {
    const timeline = deriveTouchpointTimeline({ context: ctx, now: NOW });
    expect(timeline.isEmpty).toBe(true);
    expect(timeline.all).toEqual([]);
    expect(timeline.counts.total).toBe(0);
  });

  it("counts open follow-ups from meetings and decisions", () => {
    const timeline = deriveTouchpointTimeline({
      context: ctx,
      meetings: [meetingCard({ id: "mtg", title: "Sync", openFollowUps: 2, overdueFollowUps: 1 })],
      decisions: [decision({ id: "d", hasLinkedAction: false })],
      now: NOW,
    });
    expect(timeline.counts.openFollowUps).toBeGreaterThanOrEqual(1);
    expect(timeline.counts.decisions).toBe(1);
    expect(timeline.counts.meetings).toBe(1);
  });
});

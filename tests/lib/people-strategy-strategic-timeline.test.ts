import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({ prisma: {} }));
vi.mock("@/lib/feature-flags", () => ({ isActionTrackerEnabled: () => true }));

import {
  deriveStrategicTimeline,
  deriveTimelineEvents,
  explainTimelineEvent,
  mergeStrategicTimelines,
  rankTimelineImportance,
  timelineEventToHref,
} from "@/lib/people-strategy/strategic-timeline";
import type { InitiativeMilestoneSummary } from "@/lib/people-strategy/strategic-milestones";
import type { StrategicInitiativeDef } from "@/lib/people-strategy/strategic-initiatives";

import { action, decision, meetingCard, NOW } from "./strategic-helpers";

const def: StrategicInitiativeDef = {
  id: "summer-camps-2026",
  title: "Summer Camps 2026",
  description: "",
  area: "CLASSES",
  status: "active",
  priority: "flagship",
  startDateISO: "2026-05-01T00:00:00.000Z",
  targetDateISO: "2026-08-01T00:00:00.000Z",
  match: { keywords: ["camp"] },
  milestones: [],
};

const completeMilestone: InitiativeMilestoneSummary = {
  id: "secure-camp-partners",
  title: "Secure camp partners",
  description: null,
  order: 1,
  targetDateISO: null,
  status: "complete",
  statusLabel: "Complete",
  percent: 100,
  totalActions: 1,
  openActions: 0,
  completedActions: 1,
  blockedActions: 0,
  overdueActions: 0,
  unassignedActions: 0,
  meetingCount: 0,
  decisionCount: 0,
  health: { level: "healthy", label: "Healthy", tone: "success", score: 100, reasons: [] },
  ownerName: "Alice",
  behindSchedule: false,
  actionIds: ["a-complete"],
};

describe("deriveTimelineEvents", () => {
  const events = deriveTimelineEvents({
    def,
    actions: [
      action({ id: "a-complete", title: "Sign partner MOU", status: "COMPLETE", completedAt: new Date("2026-06-03"), createdAt: new Date("2026-05-10") }),
      action({ id: "a-open", title: "Draft curriculum", createdAt: new Date("2026-05-20") }),
    ],
    meetings: [meetingCard({ id: "m1", title: "Partner sync", startISO: new Date("2026-05-25").toISOString() })],
    decisions: [decision({ id: "d1", decision: "Run a July pilot", createdAt: new Date("2026-05-28") })],
    milestones: [completeMilestone],
    now: NOW,
  });

  it("emits created + completed + meeting + decision + milestone + targets", () => {
    const types = events.map((e) => e.type);
    expect(types).toContain("initiative_created");
    expect(types).toContain("action_created");
    expect(types).toContain("action_completed");
    expect(types).toContain("meeting");
    expect(types).toContain("decision");
    expect(types).toContain("milestone_reached");
    expect(types).toContain("target");
  });

  it("dates a milestone_reached by its last completed action", () => {
    const ms = events.find((e) => e.type === "milestone_reached");
    expect(ms?.occurredAtISO).toBe(new Date("2026-06-03").toISOString());
    expect(ms?.severity).toBe("positive");
  });

  it("carries initiative context and an explanation on every event", () => {
    for (const e of events) {
      expect(e.initiativeId).toBe("summer-camps-2026");
      expect(e.initiativeTitle).toBe("Summer Camps 2026");
      expect(e.explanation.length).toBeGreaterThan(0);
      expect(e.href.length).toBeGreaterThan(0);
    }
  });
});

describe("timelineEventToHref", () => {
  it("routes each source type to a useful target", () => {
    expect(timelineEventToHref({ type: "meeting", initiativeId: "i", meetingId: "m1" })).toBe("/actions/meetings/m1");
    expect(timelineEventToHref({ type: "action_completed", initiativeId: "i", sourceId: "a1" })).toBe("/actions/a1");
    expect(timelineEventToHref({ type: "milestone_reached", initiativeId: "i", milestoneId: "ms1" })).toBe("/operations/initiatives/i#milestone-ms1");
    expect(timelineEventToHref({ type: "initiative_created", initiativeId: "i" })).toBe("/operations/initiatives/i");
  });
});

describe("explainTimelineEvent", () => {
  it("produces deterministic copy per type", () => {
    expect(explainTimelineEvent({ type: "milestone_reached", title: "Run pilot", initiativeTitle: "Camps" })).toMatch(/Milestone .*reached/);
    expect(explainTimelineEvent({ type: "action_completed", title: "x", initiativeTitle: "Camps", ownerName: "Alice" })).toMatch(/completed by Alice/);
    expect(explainTimelineEvent({ type: "target", title: "Camps", initiativeTitle: "Camps", overdue: true })).toMatch(/target date passed/);
  });
});

describe("rankTimelineImportance", () => {
  it("ranks milestones above routine action churn", () => {
    const milestone = rankTimelineImportance({ type: "milestone_reached", severity: "positive" });
    const created = rankTimelineImportance({ type: "action_created", severity: "neutral" });
    expect(milestone).toBeGreaterThan(created);
  });
});

describe("deriveStrategicTimeline", () => {
  it("splits past from upcoming and selects key moments", () => {
    const tl = deriveStrategicTimeline({
      def,
      actions: [action({ id: "a-complete", title: "Sign MOU", status: "COMPLETE", completedAt: new Date("2026-06-03"), createdAt: new Date("2026-05-10") })],
      meetings: [],
      decisions: [],
      milestones: [completeMilestone],
      now: NOW,
      keyMomentsLimit: 3,
    });
    // The Aug 1 initiative target is in the future.
    expect(tl.upcoming.some((e) => e.type === "target")).toBe(true);
    // Past events newest-first.
    expect(tl.events.every((e) => !e.upcoming)).toBe(true);
    expect(tl.keyMoments.length).toBeGreaterThan(0);
    // A milestone_reached should rank into key moments.
    expect(tl.keyMoments.some((e) => e.type === "milestone_reached")).toBe(true);
  });

  it("merges multiple initiative timelines newest-first", () => {
    const a = deriveTimelineEvents({ def, actions: [action({ title: "Camp x", createdAt: new Date("2026-06-01") })], meetings: [], decisions: [], milestones: [], now: NOW });
    const b = deriveTimelineEvents({ def: { ...def, id: "other", title: "Other" }, actions: [action({ title: "Other y", createdAt: new Date("2026-06-02") })], meetings: [], decisions: [], milestones: [], now: NOW });
    const merged = mergeStrategicTimelines([a, b]);
    const past = merged.filter((e) => !e.upcoming);
    for (let i = 1; i < past.length; i++) {
      expect(new Date(past[i - 1].occurredAtISO).getTime()).toBeGreaterThanOrEqual(
        new Date(past[i].occurredAtISO).getTime()
      );
    }
  });
});

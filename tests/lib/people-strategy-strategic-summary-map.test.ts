import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({ prisma: {} }));
vi.mock("@/lib/feature-flags", () => ({ isActionTrackerEnabled: () => true }));

import {
  classifyInitiativeWork,
  deriveInitiativeSummary,
  derivePortfolioStats,
  selectFastestMovingInitiatives,
  selectInitiativesNeedingAttention,
  selectLeadershipPriorities,
  selectStrategicRisks,
  selectUpcomingMilestones,
} from "@/lib/people-strategy/strategic-initiative-summary";
import { deriveStrategicMap } from "@/lib/people-strategy/strategic-map";
import type { StrategicInitiativeDef } from "@/lib/people-strategy/strategic-initiatives";

import { action, classLabel, emptyLabels, meetingCard, NOW } from "./strategic-helpers";

const camps: StrategicInitiativeDef = {
  id: "summer-camps-2026",
  title: "Summer Camps 2026",
  description: "camps",
  area: "CLASSES",
  status: "active",
  priority: "flagship",
  targetDateISO: "2026-08-01T00:00:00.000Z",
  match: { keywords: ["camp"] },
  milestones: [{ id: "pilot", title: "Run pilot", order: 1, targetDateISO: "2026-06-20T00:00:00.000Z", match: { keywords: ["pilot"] } }],
};

const mentorship: StrategicInitiativeDef = {
  id: "mentorship-3",
  title: "Mentorship 3.0",
  description: "mentors",
  area: "MENTORSHIP",
  status: "active",
  priority: "high",
  match: { keywords: ["mentor"] },
  milestones: [],
};

describe("classifyInitiativeWork", () => {
  it("filters the pool to the initiative's matching work", () => {
    const pool = {
      actions: [action({ title: "Plan summer camp" }), action({ title: "Mentor sync notes" })],
      meetings: [meetingCard({ title: "Camp partner call" }), meetingCard({ title: "Budget review", category: "FINANCE" })],
      decisions: [],
    };
    const classified = classifyInitiativeWork(camps, pool);
    expect(classified.actions).toHaveLength(1);
    expect(classified.meetings).toHaveLength(1);
  });
});

describe("deriveInitiativeSummary", () => {
  it("assembles a coherent summary from classified work", () => {
    const summary = deriveInitiativeSummary({
      def: camps,
      actions: [
        action({ title: "Run camp pilot", status: "COMPLETE", completedAt: new Date("2026-06-02"), createdAt: new Date("2026-05-01") }),
        action({ title: "Camp curriculum", status: "IN_PROGRESS", deadlineStart: new Date("2026-06-10") }),
      ],
      meetings: [meetingCard({ title: "Camp sync", startISO: new Date("2026-06-01").toISOString() })],
      decisions: [],
      labels: emptyLabels(),
      now: NOW,
    });
    expect(summary.id).toBe("summer-camps-2026");
    expect(summary.counts.totalActions).toBe(2);
    expect(summary.progress.percent).toBe(50);
    expect(summary.milestones).toHaveLength(1);
    expect(summary.milestones[0].status).toBe("complete"); // "Run camp pilot"
    expect(summary.recommendations.length).toBeGreaterThan(0);
    // Aug 1 initiative target is upcoming.
    expect(summary.timeline.upcoming.some((e) => e.type === "target")).toBe(true);
  });

  it("counts critical related entities into the health context", () => {
    // A class with 3 overdue actions → critical entity.
    const overdueClassAction = (i: number) =>
      action({
        id: `oc${i}`,
        title: "Camp class fix",
        status: "IN_PROGRESS",
        deadlineStart: new Date("2026-06-01"),
        relatedEntityType: "CLASS_OFFERING",
        relatedEntityId: "c1",
      });
    const summary = deriveInitiativeSummary({
      def: camps,
      actions: [overdueClassAction(1), overdueClassAction(2), overdueClassAction(3)],
      meetings: [],
      decisions: [],
      labels: new Map([classLabel("c1", "Robotics Camp")]),
      now: NOW,
    });
    expect(summary.counts.criticalEntities).toBeGreaterThanOrEqual(1);
    expect(summary.relatedEntities.some((e) => e.label === "Robotics Camp")).toBe(true);
    expect(summary.health.level).toBe("critical");
  });
});

describe("cross-initiative selectors", () => {
  const healthyCamps = deriveInitiativeSummary({
    def: camps,
    actions: [
      // Pilot milestone still open (future target) so it shows as upcoming.
      action({ title: "Run camp pilot", status: "IN_PROGRESS", deadlineStart: new Date("2026-06-15"), updatedAt: new Date("2026-06-03"), createdAt: new Date("2026-05-01") }),
      action({ title: "Run camp setup", status: "COMPLETE", completedAt: new Date("2026-06-03"), createdAt: new Date("2026-05-01") }),
    ],
    meetings: [meetingCard({ title: "Camp sync", startISO: new Date("2026-06-01").toISOString() })],
    decisions: [],
    labels: emptyLabels(),
    now: NOW,
  });
  const riskyMentorship = deriveInitiativeSummary({
    def: mentorship,
    actions: [
      action({ title: "Mentor outreach", status: "IN_PROGRESS", deadlineStart: new Date("2026-06-01") }),
      action({ title: "Mentor follow up", status: "IN_PROGRESS", deadlineStart: new Date("2026-06-01") }),
    ],
    meetings: [],
    decisions: [],
    labels: emptyLabels(),
    now: NOW,
  });
  const all = [healthyCamps, riskyMentorship];

  it("surfaces initiatives needing attention worst-first", () => {
    const attention = selectInitiativesNeedingAttention(all);
    expect(attention[0].id).toBe("mentorship-3");
  });

  it("surfaces fastest-moving initiatives by momentum", () => {
    const moving = selectFastestMovingInitiatives(all);
    expect(moving.some((s) => s.id === "summer-camps-2026")).toBe(true);
  });

  it("ranks leadership priorities by configured weight", () => {
    const priorities = selectLeadershipPriorities(all);
    expect(priorities[0].id).toBe("summer-camps-2026"); // flagship > high
  });

  it("collects strategic risks for elevated/high initiatives", () => {
    const risks = selectStrategicRisks(all);
    expect(risks.some((r) => r.initiativeId === "mentorship-3")).toBe(true);
  });

  it("collects upcoming milestone targets", () => {
    const upcoming = selectUpcomingMilestones(all, NOW);
    expect(upcoming.some((u) => u.title === "Run pilot")).toBe(true);
  });

  it("derives portfolio stats", () => {
    const stats = derivePortfolioStats(all);
    expect(stats.total).toBe(2);
    expect(stats.overdueActions).toBeGreaterThanOrEqual(2);
  });
});

describe("deriveStrategicMap", () => {
  it("groups initiatives by area with rolled-up health and progress", () => {
    const summaries = [
      deriveInitiativeSummary({ def: camps, actions: [action({ title: "Camp pilot", status: "COMPLETE", completedAt: new Date("2026-06-02"), createdAt: new Date("2026-05-01") })], meetings: [], decisions: [], labels: emptyLabels(), now: NOW }),
      deriveInitiativeSummary({ def: mentorship, actions: [action({ title: "Mentor task", status: "IN_PROGRESS", deadlineStart: new Date("2026-06-01") })], meetings: [], decisions: [], labels: emptyLabels(), now: NOW }),
    ];
    const map = deriveStrategicMap(summaries, NOW);
    expect(map.totalInitiatives).toBe(2);
    const areas = map.areas.map((a) => a.area);
    expect(areas).toEqual(expect.arrayContaining(["CLASSES", "MENTORSHIP"]));
    const classesNode = map.areas.find((a) => a.area === "CLASSES");
    expect(classesNode?.initiatives[0].id).toBe("summer-camps-2026");
    expect(classesNode?.initiatives[0].milestones.length).toBeGreaterThanOrEqual(1);
    // Most-concerning area sorts first → Mentorship (at risk) before Classes.
    expect(map.areas[0].area).toBe("MENTORSHIP");
  });
});

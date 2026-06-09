import { describe, expect, it } from "vitest";

import type {
  InitiativeMomentum,
  InitiativeOwnership,
  InitiativeProgress,
  InitiativeRisk,
  InitiativeWorkSignals,
} from "@/lib/people-strategy/strategic-initiative-health";
import {
  deriveProjectBlockers,
  deriveProjectConfidence,
  deriveProjectFollowThrough,
  deriveProjectReviewNeed,
  explainProjectStatus,
} from "@/lib/people-strategy/strategic-project-health";

function signals(overrides: Partial<InitiativeWorkSignals> = {}): InitiativeWorkSignals {
  return {
    totalActions: 0,
    openActions: 0,
    completedActions: 0,
    droppedActions: 0,
    overdueActions: 0,
    blockedActions: 0,
    unassignedActions: 0,
    staleActions: 0,
    dueSoonActions: 0,
    highPriorityOpen: 0,
    recentlyCompletedActions: 0,
    recentlyCreatedActions: 0,
    lastActivityAt: null,
    lastCompletionAt: null,
    meetingCount: 0,
    recentMeetings: 0,
    upcomingMeetings: 0,
    openFollowUps: 0,
    overdueFollowUps: 0,
    daysSinceLastMeeting: null,
    decisionCount: 0,
    recentDecisions: 0,
    decisionsWithoutAction: 0,
    ...overrides,
  };
}

const progress = (percent: number): InitiativeProgress => ({
  percent,
  completedActions: 0,
  openActions: 0,
  totalTracked: 0,
  completedMilestones: 0,
  totalMilestones: 0,
  milestonePercent: null,
  basis: percent > 0 ? "actions" : "no_work",
});

const momentum = (level: InitiativeMomentum["level"]): InitiativeMomentum => ({
  level,
  score: 50,
  recentlyCompleted: 0,
  recentlyCreated: 0,
  recentMeetings: 0,
  daysSinceLastActivity: null,
  reasons: [],
});

const risk = (level: InitiativeRisk["level"]): InitiativeRisk => ({ level, score: 20, factors: [] });

const ownership = (clarity: InitiativeOwnership["clarity"]): InitiativeOwnership => ({
  clarity,
  ownerName: clarity === "unowned" ? null : "Alice",
  ownerDeclared: clarity === "clear",
  leadCount: 1,
  unassignedOpen: 0,
  topLeads: [],
  reason: "",
});

describe("deriveProjectConfidence", () => {
  it("returns 'unknown' when there is no work", () => {
    const c = deriveProjectConfidence({
      progress: progress(0),
      momentum: momentum("steady"),
      risk: risk("low"),
      ownership: ownership("clear"),
      hasWork: false,
    });
    expect(c.level).toBe("unknown");
    expect(c.score).toBeNull();
  });

  it("rates a moving, owned, low-risk project high", () => {
    const c = deriveProjectConfidence({
      progress: progress(80),
      momentum: momentum("accelerating"),
      risk: risk("low"),
      ownership: ownership("clear"),
      hasWork: true,
    });
    expect(c.level).toBe("high");
    expect(c.score!).toBeGreaterThan(67);
  });

  it("rates a stalled, unowned, high-risk project low", () => {
    const c = deriveProjectConfidence({
      progress: progress(10),
      momentum: momentum("stalled"),
      risk: risk("high"),
      ownership: ownership("unowned"),
      hasWork: true,
    });
    expect(c.level).toBe("low");
    expect(c.reasons.join(" ")).toContain("no owner");
  });
});

describe("deriveProjectBlockers", () => {
  it("labels overdue/blocked work as OBSERVED blockers, worst-first", () => {
    const blockers = deriveProjectBlockers({
      signals: signals({ blockedActions: 1, overdueActions: 4 }),
    });
    expect(blockers[0].kind).toBe("observed");
    expect(blockers[0].severity).toBe("critical"); // blocked outranks overdue
    expect(blockers.some((b) => b.label.includes("overdue"))).toBe(true);
  });

  it("labels config dependencies as DECLARED, not observed", () => {
    const blockers = deriveProjectBlockers({
      signals: signals(),
      declaredDependsOn: ["Beth El Pilot"],
    });
    expect(blockers).toHaveLength(1);
    expect(blockers[0].kind).toBe("declared");
    expect(blockers[0].detail).toContain("not an observed");
  });

  it("escalates a declared dependency when its upstream is at-risk", () => {
    const blockers = deriveProjectBlockers({
      signals: signals(),
      declaredDependsOn: ["Beth El Pilot"],
      dependencyAtRisk: true,
    });
    expect(blockers[0].severity).toBe("high");
    expect(blockers[0].detail).toContain("unhealthy");
  });
});

describe("deriveProjectFollowThrough", () => {
  it("computes decision follow-through and surfaces gaps", () => {
    const ft = deriveProjectFollowThrough({
      signals: signals({ decisionCount: 4, decisionsWithoutAction: 1, openFollowUps: 2 }),
    });
    expect(ft.decisionFollowThroughPct).toBe(75);
    expect(ft.reasons.join(" ")).toContain("without a linked action");
    expect(ft.reasons.join(" ")).toContain("open meeting follow-up");
  });

  it("reads cleanly when everything follows through", () => {
    const ft = deriveProjectFollowThrough({
      signals: signals({ decisionCount: 2, decisionsWithoutAction: 0, completedActions: 3 }),
    });
    expect(ft.decisionFollowThroughPct).toBe(100);
    expect(ft.reasons[0]).toContain("following through cleanly");
  });
});

describe("deriveProjectReviewNeed", () => {
  const health = (level: string) => ({ level, label: level, tone: "neutral", score: 50, reasons: [] }) as never;

  it("demands a review NOW when critical", () => {
    const r = deriveProjectReviewNeed({
      health: health("critical"),
      momentum: momentum("slowing"),
      signals: signals({ overdueActions: 2 }),
      pastTargetDate: false,
      hasWork: true,
    });
    expect(r.needed).toBe(true);
    expect(r.urgency).toBe("now");
  });

  it("recommends a soon review to kick off an empty project", () => {
    const r = deriveProjectReviewNeed({
      health: health("healthy"),
      momentum: momentum("steady"),
      signals: signals(),
      pastTargetDate: false,
      hasWork: false,
    });
    expect(r.needed).toBe(true);
    expect(r.urgency).toBe("soon");
  });

  it("is routine when healthy and moving", () => {
    const r = deriveProjectReviewNeed({
      health: health("healthy"),
      momentum: momentum("accelerating"),
      signals: signals({ totalActions: 3 }),
      pastTargetDate: false,
      hasWork: true,
    });
    expect(r.needed).toBe(false);
    expect(r.urgency).toBe("routine");
  });
});

describe("explainProjectStatus", () => {
  it("distinguishes no-data from a judged read", () => {
    const ex = explainProjectStatus({
      health: { level: "healthy", label: "Healthy", tone: "success", score: 80, reasons: [] },
      confidence: deriveProjectConfidence({
        progress: progress(0),
        momentum: momentum("steady"),
        risk: risk("low"),
        ownership: ownership("clear"),
        hasWork: false,
      }),
      blockers: [],
      hasWork: false,
    });
    expect(ex.basis).toBe("no_work");
    expect(ex.headline).toContain("No tracked work");
  });
});

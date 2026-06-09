import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({ prisma: {} }));
vi.mock("@/lib/feature-flags", () => ({ isActionTrackerEnabled: () => true }));

import {
  derivePortfolioBalance,
  deriveLeadershipFocusAreas,
  deriveStrategicPortfolio,
  selectBlocked,
  selectHighestImpact,
  selectMostResourceIntensive,
  selectStrategicOpportunities,
  selectUnderstaffed,
} from "@/lib/people-strategy/strategic-portfolio";
import type { InitiativeSummary } from "@/lib/people-strategy/strategic-initiative-summary";

type Deep = Record<string, unknown>;

function summary(overrides: Deep): InitiativeSummary {
  const base: Deep = {
    id: "x",
    title: "X",
    description: "",
    area: "CLASSES",
    areaLabel: "Classes",
    status: "active",
    statusLabel: "Active",
    priority: "medium",
    priorityLabel: "Medium priority",
    priorityWeight: 1,
    owner: null,
    ownerDeclared: false,
    startDateISO: null,
    targetDateISO: null,
    pastTargetDate: false,
    href: "/operations/initiatives/x",
    health: { level: "healthy", label: "Healthy", tone: "success", score: 100, reasons: [] },
    momentum: { level: "steady", score: 50, recentlyCompleted: 0, recentlyCreated: 0, recentMeetings: 0, daysSinceLastActivity: null, reasons: [] },
    risk: { level: "low", score: 0, factors: [] },
    progress: { percent: 0, completedActions: 0, openActions: 0, totalTracked: 0, completedMilestones: 0, totalMilestones: 0, milestonePercent: null, basis: "no_work" },
    ownership: { clarity: "clear", ownerName: null, ownerDeclared: false, leadCount: 0, unassignedOpen: 0, topLeads: [], reason: "" },
    counts: {
      totalActions: 0, openActions: 0, overdueActions: 0, blockedActions: 0, unassignedActions: 0,
      completedActions: 0, meetingCount: 0, upcomingMeetings: 0, openFollowUps: 0, decisionsWithoutAction: 0,
      milestonesTotal: 0, milestonesComplete: 0, milestonesBehind: 0, criticalEntities: 0,
    },
    milestones: [], recommendations: [], timeline: { events: [], upcoming: [], keyMoments: [] }, milestoneEvents: [], relatedEntities: [],
  };
  const merged = { ...base, ...overrides };
  if (overrides.counts) merged.counts = { ...(base.counts as Deep), ...(overrides.counts as Deep) };
  return merged as unknown as InitiativeSummary;
}

const camps = summary({
  id: "summer-camps-2026",
  title: "Summer Camps 2026",
  area: "CLASSES",
  priority: "flagship",
  priorityWeight: 3,
  health: { level: "at_risk", label: "At risk", tone: "warning", score: 50, reasons: [] },
  momentum: { level: "slowing", score: 40, recentlyCompleted: 1, recentlyCreated: 0, recentMeetings: 0, daysSinceLastActivity: 2, reasons: [] },
  risk: { level: "elevated", score: 30, factors: [{ key: "blocked", label: "2 blocked actions", weight: 16 }] },
  ownership: { clarity: "unclear", ownerName: null, ownerDeclared: false, leadCount: 3, unassignedOpen: 4, topLeads: [], reason: "spread" },
  counts: { openActions: 10, overdueActions: 3, blockedActions: 2, unassignedActions: 4, completedActions: 5, meetingCount: 6, totalActions: 15, milestonesComplete: 1, milestonesTotal: 6 },
});

const mentor = summary({
  id: "mentorship-3",
  title: "Mentorship 3.0",
  area: "MENTORSHIP",
  priority: "high",
  priorityWeight: 2,
  health: { level: "healthy", label: "Healthy", tone: "success", score: 95, reasons: [] },
  momentum: { level: "accelerating", score: 80, recentlyCompleted: 3, recentlyCreated: 1, recentMeetings: 1, daysSinceLastActivity: 1, reasons: [] },
  counts: { openActions: 2, completedActions: 8, meetingCount: 1, totalActions: 10, milestonesComplete: 3, milestonesTotal: 3 },
});

const tech = summary({
  id: "portal-modernization",
  title: "Portal Modernization",
  area: "TECHNOLOGY",
  priority: "medium",
  priorityWeight: 1,
  health: { level: "drifting", label: "Drifting", tone: "info", score: 70, reasons: [] },
  momentum: { level: "stalled", score: 20, recentlyCompleted: 0, recentlyCreated: 0, recentMeetings: 0, daysSinceLastActivity: 30, reasons: [] },
  counts: { openActions: 1, totalActions: 4, completedActions: 3, milestonesTotal: 3, milestonesComplete: 1 },
});

const all = [camps, mentor, tech];

describe("portfolio selectors", () => {
  it("ranks the most resource-intensive initiative first", () => {
    expect(selectMostResourceIntensive(all)[0].id).toBe("summer-camps-2026");
  });

  it("surfaces blocked + stalled initiatives", () => {
    const blocked = selectBlocked(all).map((s) => s.id);
    expect(blocked).toContain("summer-camps-2026"); // 2 blocked
    expect(blocked).toContain("portal-modernization"); // stalled with open work
    expect(blocked).not.toContain("mentorship-3");
  });

  it("surfaces understaffed initiatives", () => {
    expect(selectUnderstaffed(all)[0].id).toBe("summer-camps-2026");
  });

  it("ranks highest impact by priority × scale", () => {
    expect(selectHighestImpact(all)[0].id).toBe("summer-camps-2026");
  });

  it("derives portfolio balance by area / health / priority", () => {
    const balance = derivePortfolioBalance(all);
    expect(balance.byArea.map((a) => a.area).sort()).toEqual(["CLASSES", "MENTORSHIP", "TECHNOLOGY"]);
    expect(balance.byPriority.flagship).toBe(1);
    expect(balance.byHealth.at_risk).toBe(1);
  });

  it("ranks leadership focus areas worst-first", () => {
    expect(deriveLeadershipFocusAreas(all)[0].area).toBe("CLASSES");
  });

  it("surfaces strategic opportunities from authored profiles", () => {
    const opps = selectStrategicOpportunities(all);
    expect(opps.some((o) => o.initiativeId === "summer-camps-2026")).toBe(true);
  });

  it("assembles the whole portfolio read", () => {
    const p = deriveStrategicPortfolio(all);
    expect(p.stats.total).toBe(3);
    expect(p.mostImportant[0].id).toBe("summer-camps-2026");
    expect(p.fastestGrowing.some((s) => s.id === "mentorship-3")).toBe(true);
  });
});

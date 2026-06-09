import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({ prisma: {} }));
vi.mock("@/lib/feature-flags", () => ({ isActionTrackerEnabled: () => true }));

import {
  compareInitiativeHealth,
  computeInitiativeWorkSignals,
  deriveInitiativeHealth,
  deriveInitiativeMomentum,
  deriveInitiativeOwnership,
  deriveInitiativeProgress,
  deriveInitiativeRisk,
  explainInitiativeHealth,
  type InitiativeWorkSignals,
} from "@/lib/people-strategy/strategic-initiative-health";

import { action, decision, meetingCard, NOW, assignment } from "./strategic-helpers";

const overdue = () =>
  action({ status: "IN_PROGRESS", deadlineStart: new Date("2026-06-01T00:00:00") });
const blocked = () =>
  action({ status: "BLOCKED", deadlineStart: new Date("2026-06-10T00:00:00") });
const completedRecently = () =>
  action({
    status: "COMPLETE",
    completedAt: new Date("2026-06-02T00:00:00"),
    createdAt: new Date("2026-05-01T00:00:00"),
  });
const openFuture = () =>
  action({
    status: "IN_PROGRESS",
    deadlineStart: new Date("2026-06-10T00:00:00"),
    updatedAt: new Date("2026-06-03T00:00:00"),
    createdAt: new Date("2026-05-01T00:00:00"),
  });

describe("computeInitiativeWorkSignals", () => {
  it("counts open / overdue / blocked / completed and recency", () => {
    const s = computeInitiativeWorkSignals({
      actions: [overdue(), blocked(), completedRecently(), openFuture()],
      meetings: [meetingCard({ startISO: new Date("2026-06-02T00:00:00").toISOString(), openFollowUps: 2 })],
      decisions: [decision({ hasLinkedAction: false }), decision({ hasLinkedAction: true })],
      now: NOW,
    });
    expect(s.totalActions).toBe(4);
    expect(s.openActions).toBe(3);
    expect(s.overdueActions).toBe(1);
    expect(s.blockedActions).toBe(1);
    expect(s.completedActions).toBe(1);
    expect(s.recentlyCompletedActions).toBe(1);
    expect(s.openFollowUps).toBe(2);
    expect(s.decisionCount).toBe(2);
    expect(s.decisionsWithoutAction).toBe(1);
    expect(s.daysSinceLastMeeting).toBe(2);
  });
});

describe("deriveInitiativeProgress", () => {
  it("is the share of tracked work complete, excluding dropped", () => {
    const s = computeInitiativeWorkSignals({
      actions: [completedRecently(), completedRecently(), openFuture(), action({ status: "DROPPED" })],
      meetings: [],
      decisions: [],
      now: NOW,
    });
    const p = deriveInitiativeProgress(s, { completed: 1, total: 3 });
    expect(p.completedActions).toBe(2);
    expect(p.openActions).toBe(1);
    expect(p.percent).toBe(67); // 2 / 3
    expect(p.milestonePercent).toBe(33); // 1 / 3
    expect(p.basis).toBe("actions");
  });

  it("reports no_work when there is nothing tracked", () => {
    const s = computeInitiativeWorkSignals({ actions: [], meetings: [], decisions: [], now: NOW });
    const p = deriveInitiativeProgress(s, { completed: 0, total: 0 });
    expect(p.percent).toBe(0);
    expect(p.basis).toBe("no_work");
    expect(p.milestonePercent).toBeNull();
  });
});

describe("deriveInitiativeMomentum", () => {
  const sig = (over: Partial<InitiativeWorkSignals>): InitiativeWorkSignals => ({
    ...computeInitiativeWorkSignals({ actions: [], meetings: [], decisions: [], now: NOW }),
    ...over,
  });

  it("is stalled when open work has had no recent activity", () => {
    const s = computeInitiativeWorkSignals({
      actions: [action({ status: "IN_PROGRESS", updatedAt: new Date("2026-04-01T00:00:00"), createdAt: new Date("2026-04-01T00:00:00"), deadlineStart: new Date("2026-06-10") })],
      meetings: [],
      decisions: [],
      now: NOW,
    });
    expect(deriveInitiativeMomentum(s, NOW).level).toBe("stalled");
  });

  it("accelerates with two or more recent wins", () => {
    const s = computeInitiativeWorkSignals({
      actions: [completedRecently(), completedRecently()],
      meetings: [],
      decisions: [],
      now: NOW,
    });
    expect(deriveInitiativeMomentum(s, NOW).level).toBe("accelerating");
  });

  it("slows with open work but no completions", () => {
    const s = sig({ openActions: 2, recentlyCompletedActions: 0, recentlyCreatedActions: 2, recentMeetings: 0 });
    expect(deriveInitiativeMomentum(s, NOW).level).toBe("slowing");
  });

  it("is steady with a single recent completion", () => {
    const s = computeInitiativeWorkSignals({
      actions: [completedRecently(), openFuture()],
      meetings: [],
      decisions: [],
      now: NOW,
    });
    expect(deriveInitiativeMomentum(s, NOW).level).toBe("steady");
  });
});

describe("deriveInitiativeRisk", () => {
  it("escalates from moderate to high as factors stack", () => {
    const one = computeInitiativeWorkSignals({ actions: [overdue()], meetings: [], decisions: [], now: NOW });
    expect(deriveInitiativeRisk(one).level).toBe("moderate");

    const many = computeInitiativeWorkSignals({
      actions: [overdue(), overdue(), overdue(), overdue()],
      meetings: [],
      decisions: [],
      now: NOW,
    });
    const risk = deriveInitiativeRisk(many);
    expect(risk.level).toBe("high");
    expect(risk.factors[0].key).toBe("overdue");
  });

  it("adds schedule + critical-entity context factors", () => {
    const s = computeInitiativeWorkSignals({ actions: [openFuture()], meetings: [], decisions: [], now: NOW });
    const risk = deriveInitiativeRisk(s, { milestonesBehindSchedule: 1, criticalEntities: 1, pastTargetDate: true });
    expect(risk.factors.map((f) => f.key)).toEqual(
      expect.arrayContaining(["milestones", "criticalEntities", "pastTarget"])
    );
  });
});

describe("deriveInitiativeownership", () => {
  it("is unowned when open work has no executor and no declared owner", () => {
    const a = action({ status: "IN_PROGRESS", assignments: [assignment("alice", "LEAD")] });
    const o = deriveInitiativeOwnership([a], {}, NOW);
    expect(o.clarity).toBe("unowned");
    expect(o.ownerName).toBeNull();
  });

  it("is clear when an owner is declared", () => {
    const o = deriveInitiativeOwnership([openFuture()], { owner: "Carol" }, NOW);
    expect(o.clarity).toBe("clear");
    expect(o.ownerName).toBe("Carol");
    expect(o.ownerDeclared).toBe(true);
  });

  it("is shared across a couple of even leads", () => {
    const a1 = action({ leadId: "a", lead: { id: "a", name: "Ann", email: "a@x.org", primaryRole: "ADMIN", title: null, adminSubtypes: [], profile: null }, assignments: [assignment("a", "LEAD"), assignment("z", "EXECUTING")] });
    const a2 = action({ leadId: "b", lead: { id: "b", name: "Bo", email: "b@x.org", primaryRole: "ADMIN", title: null, adminSubtypes: [], profile: null }, assignments: [assignment("b", "LEAD"), assignment("z", "EXECUTING")] });
    const o = deriveInitiativeOwnership([a1, a2], {}, NOW);
    expect(o.clarity).toBe("shared");
    expect(o.leadCount).toBe(2);
  });
});

describe("deriveInitiativeHealth", () => {
  function full(actions: ReturnType<typeof action>[], meetings = [] as ReturnType<typeof meetingCard>[], decisions = [] as ReturnType<typeof decision>[], status: "active" | "completed" | "archived" = "active", extra: { milestonesBehindSchedule?: number; criticalEntities?: number } = {}) {
    const signals = computeInitiativeWorkSignals({ actions, meetings, decisions, now: NOW });
    const momentum = deriveInitiativeMomentum(signals, NOW);
    const ownership = deriveInitiativeOwnership(actions, { owner: "Carol" }, NOW);
    const risk = deriveInitiativeRisk(signals, { ...extra, momentum });
    return deriveInitiativeHealth({ status, signals, risk, momentum, ownership, ...extra });
  }

  it("short-circuits terminal statuses", () => {
    expect(full([], [], [], "completed").level).toBe("completed");
    expect(full([], [], [], "completed").score).toBe(100);
    expect(full([], [], [], "archived").level).toBe("archived");
  });

  it("is critical with 3+ overdue actions", () => {
    expect(full([overdue(), overdue(), overdue()]).level).toBe("critical");
  });

  it("is at risk with a single overdue action", () => {
    expect(full([overdue(), openFuture()]).level).toBe("at_risk");
  });

  it("drifts when active with no tracked work", () => {
    const h = full([], [], [], "active");
    expect(h.level).toBe("drifting");
    expect(h.reasons.join(" ")).toMatch(/no tracked work/);
  });

  it("is healthy when work is moving with a recent meeting", () => {
    const meeting = meetingCard({ startISO: new Date("2026-06-02T00:00:00").toISOString() });
    const h = full([completedRecently(), openFuture()], [meeting]);
    expect(h.level).toBe("healthy");
    expect(h.reasons).toEqual([]);
  });

  it("orders worst-first via compareInitiativeHealth", () => {
    const critical = full([overdue(), overdue(), overdue()]);
    const healthy = full([completedRecently(), openFuture()], [meetingCard({ startISO: new Date("2026-06-02T00:00:00").toISOString() })]);
    expect(compareInitiativeHealth(critical, healthy)).toBeLessThan(0);
  });
});

describe("explainInitiativeHealth", () => {
  it("produces a headline and next steps for a struggling initiative", () => {
    const signals = computeInitiativeWorkSignals({ actions: [overdue(), overdue(), overdue()], meetings: [], decisions: [], now: NOW });
    const momentum = deriveInitiativeMomentum(signals, NOW);
    const ownership = deriveInitiativeOwnership([overdue()], {}, NOW);
    const risk = deriveInitiativeRisk(signals, { momentum });
    const health = deriveInitiativeHealth({ status: "active", signals, risk, momentum, ownership });
    const exp = explainInitiativeHealth(health, { signals, risk, momentum, ownership });
    expect(exp.headline).toMatch(/Critical because/);
    expect(exp.suggestedNextSteps.length).toBeGreaterThan(0);
  });

  it("explains a completed initiative calmly", () => {
    const signals = computeInitiativeWorkSignals({ actions: [], meetings: [], decisions: [], now: NOW });
    const momentum = deriveInitiativeMomentum(signals, NOW);
    const ownership = deriveInitiativeOwnership([], {}, NOW);
    const risk = deriveInitiativeRisk(signals, { momentum });
    const health = deriveInitiativeHealth({ status: "completed", signals, risk, momentum, ownership });
    const exp = explainInitiativeHealth(health, { signals, risk, momentum, ownership });
    expect(exp.headline).toMatch(/Completed/);
  });
});

import { describe, expect, it } from "vitest";

import type {
  ActionLite,
  DecisionLite,
  MeetingFollowUpLite,
  MeetingLite,
  OperationalDigestCounts,
  WeeklyOperationalDigest,
} from "@/lib/people-strategy/operational-digest";
import type { InitiativeSummary } from "@/lib/people-strategy/strategic-initiative-summary";
import {
  deriveCommunicationNeeded,
  deriveInitiativeAgendaItems,
  deriveInitiativesNeedingAttention,
  deriveMeetingLooseEnds,
  deriveSuggestedDiscussionQuestion,
  deriveWeeklyAgenda,
  deriveWeeklyExecutionOS,
  deriveWeeklyRecap,
} from "@/lib/people-strategy/weekly-execution";

const NOW = new Date("2026-06-10T12:00:00.000Z");

const counts: OperationalDigestCounts = {
  openActions: 5,
  overdueActions: 1,
  dueTodayActions: 0,
  dueSoonActions: 1,
  blockedActions: 1,
  unassignedActions: 1,
  meetingsThisWeek: 1,
  upcomingMeetings: 1,
  meetingsWithoutActions: 0,
  unresolvedFollowUps: 1,
  unconvertedFollowUps: 1,
  criticalEntities: 0,
  warningEntities: 0,
  recentDecisions: 1,
  decisionsNeedingAction: 1,
  recentlyCompletedActions: 1,
  newActionsThisWeek: 1,
};

function action(overrides: Partial<ActionLite> = {}): ActionLite {
  return {
    id: "a1",
    title: "Clarify Lily STEM curriculum direction",
    status: "IN_PROGRESS",
    priority: "HIGH",
    dueISO: "2026-06-12T00:00:00.000Z",
    ownerName: "Brayden",
    overdue: false,
    daysOverdue: 0,
    blocked: false,
    unassigned: false,
    relatedType: "USER",
    relatedId: "lily",
    relatedLabel: "Lily",
    relatedTypeLabel: "Instructor",
    sourceMeetingId: "m1",
    sourceMeetingTitle: "Officer meeting",
    sourceMeetingStartISO: "2026-06-09T18:00:00.000Z",
    latestUpdate: null,
    nextStep: "Confirm whether STEM means rockets/planes or broader K-5 STEM.",
    contextSummary: "Instructor accepted but curriculum direction is unclear.",
    href: "/actions/a1",
    createdISO: "2026-06-09T00:00:00.000Z",
    ...overrides,
  };
}

function followUp(overrides: Partial<MeetingFollowUpLite> = {}): MeetingFollowUpLite {
  return {
    id: "f1",
    title: "Message Lily about Friday 4 PM and curriculum expectations",
    description: "Instructor accepted but needs final framing.",
    meetingId: "m1",
    meetingTitle: "Officer meeting",
    meetingStartISO: "2026-06-09T18:00:00.000Z",
    meetingCategory: "CLASSES",
    ownerName: null,
    ownerId: null,
    dueISO: null,
    priority: "HIGH",
    status: "open",
    areaLabel: "Classes",
    relatedType: "USER",
    relatedId: "lily",
    relatedLabel: "Lily",
    href: "/actions/meetings/m1",
    ...overrides,
  };
}

function meeting(overrides: Partial<MeetingLite> = {}): MeetingLite {
  return {
    id: "m1",
    title: "Officer meeting",
    startISO: "2026-06-11T18:00:00.000Z",
    category: "LEADERSHIP",
    categoryLabel: "Leadership",
    effectiveStatus: "upcoming",
    openFollowUps: 1,
    overdueFollowUps: 0,
    decisionCount: 1,
    linkedActionCount: 0,
    facilitatorName: "Brayden",
    attendeeCount: 4,
    recurrence: null,
    relatedType: null,
    relatedId: null,
    relatedLabel: null,
    keyDecisions: [],
    linkedActionTitles: [],
    unconvertedFollowUps: [],
    outcome: {
      level: "needs_follow_through",
      headline: "Needs follow-through.",
      reasons: ["1 open follow-up"],
      suggestedNextSteps: ["Convert open follow-ups into actions."],
    },
    href: "/actions/meetings/m1",
    ...overrides,
  };
}

function decision(overrides: Partial<DecisionLite> = {}): DecisionLite {
  return {
    id: "d1",
    decision: "Confirm broader K-5 STEM before instructor training",
    meetingId: "m1",
    meetingTitle: "Officer meeting",
    areaLabel: "Classes",
    decidedByName: "Brayden",
    createdISO: "2026-06-09T00:00:00.000Z",
    hasLinkedAction: false,
    relatedType: "USER",
    relatedId: "lily",
    href: "/actions/meetings/m1",
    ...overrides,
  };
}

function digest(overrides: Partial<WeeklyOperationalDigest> = {}): WeeklyOperationalDigest {
  const overdue = action({
    id: "overdue",
    title: "Email partner about STEM room setup",
    overdue: true,
    daysOverdue: 3,
    dueISO: "2026-06-07T00:00:00.000Z",
    href: "/actions/overdue",
  });
  const blocked = action({
    id: "blocked",
    title: "Blocked: clarify rockets or broader STEM",
    blocked: true,
    href: "/actions/blocked",
  });
  const dueSoon = action({ id: "due", title: "Draft instructor training plan", href: "/actions/due" });
  const done = action({ id: "done", title: "Accepted instructor onboarding note", status: "COMPLETE", href: "/actions/done" });
  const created = action({ id: "new", title: "Create STEM curriculum one-pager", href: "/actions/new-one-pager" });

  return {
    generatedAt: NOW,
    window: {
      start: new Date("2026-06-08T00:00:00.000Z"),
      end: new Date("2026-06-14T23:59:59.999Z"),
    },
    counts,
    urgentActions: [overdue, blocked],
    triage: {
      overdue: [overdue],
      blocked: [blocked],
      unassigned: [action({ id: "ownerless", title: "Assign applicant review follow-up", ownerName: null, unassigned: true })],
      dueSoon: [dueSoon],
    },
    upcomingMeetings: [meeting()],
    recentMeetings: [meeting({ effectiveStatus: "needs_follow_up" })],
    staleEntities: [],
    criticalEntities: [],
    decisionsNeedingAction: [decision()],
    unresolvedMeetingFollowUps: [followUp()],
    meetingsNeedingFollowThrough: [meeting({ effectiveStatus: "needs_follow_up" })],
    recentlyCompletedActions: [done],
    newActionsThisWeek: [created],
    areaHealth: [],
    recommendedReviewOrder: [],
    ...overrides,
  };
}

type Deep = Record<string, unknown>;

function initiative(overrides: Deep = {}): InitiativeSummary {
  const base: Deep = {
    id: "camp-stem",
    title: "Camp / STEM Curriculum Launch",
    description: "Instructor accepted but curriculum direction still needs clarity.",
    area: "CLASSES",
    areaLabel: "Classes",
    status: "active",
    statusLabel: "Active",
    priority: "flagship",
    priorityLabel: "Flagship",
    priorityWeight: 3,
    owner: "Brayden",
    ownerDeclared: true,
    startDateISO: null,
    targetDateISO: "2026-06-20T00:00:00.000Z",
    pastTargetDate: false,
    href: "/operations/initiatives/camp-stem",
    health: { level: "at_risk", label: "At risk", tone: "warning", score: 55, reasons: ["Curriculum direction unclear"] },
    healthExplanation: {
      headline: "Curriculum direction needs confirmation before instructor training.",
      reasons: ["Curriculum direction unclear"],
      suggestedNextSteps: ["Assign Brayden to confirm the class framing."],
    },
    momentum: { level: "slowing", score: 40, recentlyCompleted: 0, recentlyCreated: 1, recentMeetings: 1, daysSinceLastActivity: 2, reasons: [] },
    risk: { level: "elevated", score: 30, factors: [{ key: "blocked", label: "1 blocked action", weight: 12 }] },
    progress: { percent: 25, completedActions: 1, openActions: 3, totalTracked: 4, completedMilestones: 0, totalMilestones: 2, milestonePercent: 0, basis: "actions" },
    ownership: { clarity: "clear", ownerName: "Brayden", ownerDeclared: true, leadCount: 1, unassignedOpen: 0, topLeads: [], reason: "Declared owner" },
    counts: {
      totalActions: 4,
      openActions: 3,
      overdueActions: 1,
      blockedActions: 1,
      unassignedActions: 0,
      completedActions: 1,
      meetingCount: 1,
      upcomingMeetings: 0,
      openFollowUps: 1,
      decisionsWithoutAction: 1,
      milestonesTotal: 2,
      milestonesComplete: 0,
      milestonesBehind: 0,
      criticalEntities: 0,
    },
    milestones: [
      {
        id: "curriculum",
        title: "Confirm STEM class framing",
        description: null,
        order: 1,
        targetDateISO: null,
        status: "at_risk",
        statusLabel: "At risk",
        percent: 20,
        totalActions: 2,
        openActions: 2,
        completedActions: 0,
        blockedActions: 1,
        overdueActions: 1,
        unassignedActions: 0,
        meetingCount: 1,
        decisionCount: 1,
        health: { level: "warning", label: "Needs attention", reasons: [], suggestedNextSteps: [] },
        ownerName: "Brayden",
        behindSchedule: false,
        actionIds: [],
      },
    ],
    recommendations: [{ title: "Confirm curriculum direction", detail: "Ask whether Lily should build rockets/planes or broader K-5 STEM.", kind: "UNBLOCK", severity: "warning", href: "/actions/blocked" }],
    timeline: {
      events: [
        { id: "meeting:m1", type: "meeting", initiativeId: "camp-stem", title: "Officer meeting", occurredAtISO: "2026-06-09T00:00:00.000Z", summary: "Decision discussed", severity: "watch", upcoming: false },
        { id: "action:a1", type: "action_created", initiativeId: "camp-stem", title: "Create STEM action", occurredAtISO: "2026-06-08T00:00:00.000Z", summary: "Action created", severity: "neutral", upcoming: false },
      ],
      upcoming: [],
      keyMoments: [],
    },
    milestoneEvents: [],
    relatedEntities: [],
  };
  const merged = { ...base, ...overrides };
  if (overrides.counts) merged.counts = { ...(base.counts as Deep), ...(overrides.counts as Deep) };
  if (overrides.health) merged.health = { ...(base.health as Deep), ...(overrides.health as Deep) };
  if (overrides.healthExplanation) {
    merged.healthExplanation = { ...(base.healthExplanation as Deep), ...(overrides.healthExplanation as Deep) };
  }
  if (overrides.risk) merged.risk = { ...(base.risk as Deep), ...(overrides.risk as Deep) };
  return merged as unknown as InitiativeSummary;
}

describe("weekly execution agenda", () => {
  it("turns overdue and blocked actions into urgent agenda items", () => {
    const agenda = deriveWeeklyAgenda({ digest: digest(), now: NOW });
    const urgent = agenda.find((section) => section.id === "urgent_blockers")!;
    expect(urgent.items.map((item) => item.title)).toEqual(
      expect.arrayContaining(["Email partner about STEM room setup", "Blocked: clarify rockets or broader STEM"])
    );
  });

  it("turns unresolved follow-ups and decisions into loose ends", () => {
    const looseEnds = deriveMeetingLooseEnds(digest());
    expect(looseEnds.map((item) => item.kind)).toEqual(expect.arrayContaining(["decision", "missing_owner"]));
    expect(looseEnds.map((item) => item.title)).toContain("Confirm broader K-5 STEM before instructor training");
  });

  it("places communication-needed items into a communication group", () => {
    const communications = deriveCommunicationNeeded({ digest: digest(), initiatives: [initiative()] });
    expect(communications.some((item) => item.audience === "instructor")).toBe(true);
    expect(communications.some((item) => item.title === "Send weekly officer recap")).toBe(true);
  });

  it("builds a recap with completed, overdue, blocked, new, upcoming, and initiative updates", () => {
    const d = digest();
    const agenda = deriveWeeklyAgenda({ digest: d, initiatives: [initiative()], now: NOW });
    const recap = deriveWeeklyRecap({ digest: d, agendaSections: agenda, initiatives: [initiative()], now: NOW });
    expect(recap.draft).toContain("Wins / completed:");
    expect(recap.draft).toContain("Accepted instructor onboarding note");
    expect(recap.draft).toContain("Email partner about STEM room setup");
    expect(recap.draft).toContain("Blocked: clarify rockets or broader STEM");
    expect(recap.draft).toContain("Create STEM curriculum one-pager");
    expect(recap.draft).toContain("Officer meeting");
    expect(recap.draft).toContain("Initiative updates:");
    expect(recap.draft).toContain("Camp / STEM Curriculum Launch");
  });

  it("generates discussion questions for missing owner, missing due date, and missing context", () => {
    expect(deriveSuggestedDiscussionQuestion({ title: "Applicant review", owner: null })).toMatch(/Who should own/);
    expect(deriveSuggestedDiscussionQuestion({ title: "Partner reply", owner: "Brayden", dueISO: null })).toMatch(/What due date/);
    expect(deriveSuggestedDiscussionQuestion({ title: "STEM scope", owner: "Brayden", dueISO: "2026-06-12T00:00:00.000Z", missingContext: true })).toMatch(/concrete next step/);
  });
});

describe("weekly execution initiative logic", () => {
  it("flags blocked, overdue, ownerless, and unresolved-follow-up initiatives", () => {
    const items = deriveInitiativesNeedingAttention([
      initiative({ id: "blocked", counts: { blockedActions: 1 } }),
      initiative({ id: "overdue", counts: { overdueActions: 1 } }),
      initiative({ id: "ownerless", owner: null, ownerDeclared: false, counts: { openActions: 1 } }),
      initiative({ id: "followups", counts: { openFollowUps: 1 } }),
    ], NOW);
    expect(items.map((item) => item.id)).toEqual(expect.arrayContaining(["blocked", "overdue", "ownerless", "followups"]));
  });

  it("creates initiative agenda items with discussion questions and next actions", () => {
    const items = deriveInitiativeAgendaItems([initiative()], NOW);
    expect(items[0].suggestedDiscussionQuestion).toMatch(/unblock|move/);
    expect(items[0].suggestedNextAction).toContain("Confirm curriculum direction");
  });

  it("includes initiative attention in the full OS snapshot", () => {
    const os = deriveWeeklyExecutionOS({ digest: digest(), initiatives: [initiative()], now: NOW });
    expect(os.snapshot.initiativesNeedingAttention).toBe(1);
    expect(os.agendaSections.find((section) => section.id === "initiatives")?.items[0].title).toBe("Camp / STEM Curriculum Launch");
    expect(os.recap.draft).toContain("Initiative updates:");
  });
});

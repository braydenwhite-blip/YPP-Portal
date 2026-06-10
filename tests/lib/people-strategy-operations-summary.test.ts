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
  deriveNeedsAttention,
  deriveOperationsSummary,
  deriveOperationsTimeline,
  deriveRecentlyDecided,
  deriveThisWeek,
  deriveUpcomingMilestoneItems,
  meetingOutputSentence,
} from "@/lib/people-strategy/operations-summary";
import {
  deriveCommunicationNeeded,
  deriveInitiativeAgendaItems,
  deriveMeetingLooseEnds,
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
    decisionCount: 2,
    linkedActionCount: 3,
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

const overdueAction = action({
  id: "overdue",
  title: "Email partner about STEM room setup",
  overdue: true,
  daysOverdue: 3,
  dueISO: "2026-06-07T00:00:00.000Z",
  href: "/actions/overdue",
});
const blockedAction = action({
  id: "blocked",
  title: "Blocked: clarify rockets or broader STEM",
  blocked: true,
  href: "/actions/blocked",
});
const ownerlessAction = action({
  id: "ownerless",
  title: "Assign applicant review follow-up",
  ownerName: null,
  unassigned: true,
  href: "/actions/ownerless",
});
const dueSoonAction = action({ id: "due", title: "Draft instructor training plan", href: "/actions/due" });
const completedAction = action({
  id: "done",
  title: "Accepted instructor onboarding note",
  status: "COMPLETE",
  href: "/actions/done",
});
const createdAction = action({
  id: "new",
  title: "Create STEM curriculum one-pager",
  href: "/actions/new-one-pager",
  createdISO: "2026-06-10T00:00:00.000Z",
});

function digest(overrides: Partial<WeeklyOperationalDigest> = {}): WeeklyOperationalDigest {
  return {
    generatedAt: NOW,
    window: {
      start: new Date("2026-06-08T00:00:00.000Z"),
      end: new Date("2026-06-14T23:59:59.999Z"),
    },
    counts,
    urgentActions: [overdueAction, blockedAction],
    triage: {
      overdue: [overdueAction],
      blocked: [blockedAction],
      unassigned: [ownerlessAction],
      dueSoon: [dueSoonAction],
    },
    upcomingMeetings: [meeting()],
    recentMeetings: [meeting({ id: "m0", startISO: "2026-06-09T18:00:00.000Z", effectiveStatus: "needs_follow_up" })],
    staleEntities: [],
    criticalEntities: [],
    decisionsNeedingAction: [decision()],
    unresolvedMeetingFollowUps: [followUp()],
    meetingsNeedingFollowThrough: [],
    recentlyCompletedActions: [completedAction],
    newActionsThisWeek: [createdAction],
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
        targetDateISO: "2026-06-13T00:00:00.000Z",
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
        {
          id: "meeting:m1",
          type: "meeting",
          initiativeId: "camp-stem",
          initiativeTitle: "Camp / STEM Curriculum Launch",
          title: "Officer meeting",
          occurredAtISO: "2026-06-09T00:00:00.000Z",
          explanation: "Decision discussed",
          severity: "watch",
          upcoming: false,
          sourceType: "meeting",
          ownerName: "Brayden",
          entity: null,
          href: "/actions/meetings/m1",
        },
      ],
      upcoming: [],
      keyMoments: [],
    },
    milestoneEvents: [],
    relatedEntities: [],
  };
  const merged = { ...base, ...overrides };
  if (overrides.counts) merged.counts = { ...(base.counts as Deep), ...(overrides.counts as Deep) };
  return merged as unknown as InitiativeSummary;
}

function sharedInputs(initiatives: InitiativeSummary[] = [initiative()]) {
  const d = digest();
  return {
    digest: d,
    looseEnds: deriveMeetingLooseEnds(d),
    communications: deriveCommunicationNeeded({ digest: d, initiatives }),
    initiativeAttention: deriveInitiativeAgendaItems(initiatives, NOW),
  };
}

describe("deriveNeedsAttention", () => {
  it("surfaces overdue actions as needing attention", () => {
    const items = deriveNeedsAttention(sharedInputs());
    const item = items.find((i) => i.id === "action:overdue")!;
    expect(item.kind).toBe("action");
    expect(item.status).toBe("Overdue 3d");
    expect(item.tone).toBe("danger");
  });

  it("surfaces blocked actions as needing attention", () => {
    const items = deriveNeedsAttention(sharedInputs());
    const item = items.find((i) => i.id === "action:blocked")!;
    expect(item.status).toBe("Blocked");
    expect(item.tone).toBe("danger");
  });

  it("surfaces ownerless actions as needing attention", () => {
    const items = deriveNeedsAttention(sharedInputs());
    const item = items.find((i) => i.id === "action:ownerless")!;
    expect(item.status).toBe("No owner");
    expect(item.owner).toBeNull();
  });

  it("includes loose ends and at-risk initiatives", () => {
    const items = deriveNeedsAttention(sharedInputs());
    expect(items.some((i) => i.kind === "loose_end")).toBe(true);
    expect(items.some((i) => i.kind === "initiative" && i.title === "Camp / STEM Curriculum Launch")).toBe(true);
  });
});

describe("deriveThisWeek", () => {
  it("includes due-soon actions and upcoming meetings", () => {
    const items = deriveThisWeek({ digest: digest(), initiatives: [initiative()], now: NOW });
    expect(items.some((i) => i.id === "action:due")).toBe(true);
    expect(items.some((i) => i.kind === "meeting" && i.title === "Officer meeting")).toBe(true);
  });

  it("includes initiative milestones due in the window", () => {
    const items = deriveUpcomingMilestoneItems([initiative()], NOW);
    expect(items).toHaveLength(1);
    expect(items[0].title).toBe("Confirm STEM class framing");
    expect(items[0].initiativeTitle).toBe("Camp / STEM Curriculum Launch");
  });
});

describe("deriveRecentlyDecided", () => {
  it("includes completed actions, new actions, and meeting outputs", () => {
    const items = deriveRecentlyDecided(digest());
    expect(items.some((i) => i.id === "action:done" && i.status === "Completed")).toBe(true);
    expect(items.some((i) => i.id === "action:new")).toBe(true);
    const meetingItem = items.find((i) => i.kind === "meeting")!;
    expect(meetingItem.why).toBe("This meeting created 2 decisions, 3 actions, and 1 loose end.");
  });
});

describe("meetingOutputSentence", () => {
  it("pluralizes correctly", () => {
    expect(meetingOutputSentence(meeting({ decisionCount: 1, linkedActionCount: 1, openFollowUps: 1 }))).toBe(
      "This meeting created 1 decision, 1 action, and 1 loose end."
    );
  });
});

describe("deriveOperationsTimeline", () => {
  it("merges actions, meetings, decisions, and initiative events in date order", () => {
    const events = deriveOperationsTimeline({ digest: digest(), initiatives: [initiative()] });
    const kinds = new Set(events.map((e) => e.kind));
    expect(kinds.has("action_created")).toBe(true);
    expect(kinds.has("action_completed")).toBe(true);
    expect(kinds.has("meeting")).toBe(true);
    expect(kinds.has("decision")).toBe(true);
    expect(kinds.has("initiative")).toBe(true);
    const dates = events.map((e) => e.occurredAtISO);
    expect([...dates].sort().reverse()).toEqual(dates);
  });
});

describe("deriveOperationsSummary", () => {
  it("builds one integrated summary with consistent snapshot counts", () => {
    const summary = deriveOperationsSummary({ digest: digest(), initiatives: [initiative()], now: NOW });
    expect(summary.snapshot.openActions).toBe(5);
    expect(summary.snapshot.overdueActions).toBe(1);
    expect(summary.snapshot.blockedActions).toBe(1);
    expect(summary.snapshot.dueThisWeek).toBe(1);
    expect(summary.snapshot.meetingsThisWeek).toBe(1);
    expect(summary.snapshot.looseEnds).toBe(summary.looseEnds.length);
    expect(summary.snapshot.communicationsNeeded).toBe(summary.communicationsNeeded.length);
    expect(summary.snapshot.initiativesAtRisk).toBe(summary.initiativesNeedingAttention.length);
  });

  it("surfaces unresolved meeting follow-ups as loose ends", () => {
    const summary = deriveOperationsSummary({ digest: digest(), now: NOW });
    const looseEnd = summary.looseEnds.find((i) => i.id === "loose-end:follow-up:f1")!;
    expect(looseEnd.kind).toBe("loose_end");
    expect(looseEnd.status).toBe("No owner");
    expect(looseEnd.nextStep).toMatch(/Convert this into an action/);
  });

  it("surfaces unconverted decisions as loose ends with decision status", () => {
    const summary = deriveOperationsSummary({ digest: digest(), now: NOW });
    const looseEnd = summary.looseEnds.find((i) => i.id === "loose-end:decision:d1")!;
    expect(looseEnd.status).toBe("Decision without action");
    expect(looseEnd.nextStep).toMatch(/Convert this decision into an action/);
  });

  it("surfaces communication-needed items with a suggested message", () => {
    const summary = deriveOperationsSummary({ digest: digest(), initiatives: [initiative()], now: NOW });
    const communication = summary.communicationsNeeded.find((i) => i.title.includes("Lily"))!;
    expect(communication.kind).toBe("communication");
    expect(communication.nextStep).toMatch(/Suggested message:/);
  });

  it("surfaces at-risk initiatives with a leadership next step", () => {
    const summary = deriveOperationsSummary({ digest: digest(), initiatives: [initiative()], now: NOW });
    const item = summary.initiativesNeedingAttention[0];
    expect(item.kind).toBe("initiative");
    expect(item.title).toBe("Camp / STEM Curriculum Launch");
    expect(item.status).toBe("At risk");
    expect(item.nextStep).toContain("Confirm curriculum direction");
  });

  it("derives empty sections from an empty digest", () => {
    const empty = digest({
      counts: { ...counts, openActions: 0, overdueActions: 0, blockedActions: 0, dueSoonActions: 0, meetingsThisWeek: 0 },
      triage: { overdue: [], blocked: [], unassigned: [], dueSoon: [] },
      upcomingMeetings: [],
      recentMeetings: [],
      decisionsNeedingAction: [],
      unresolvedMeetingFollowUps: [],
      recentlyCompletedActions: [],
      newActionsThisWeek: [],
    });
    const summary = deriveOperationsSummary({ digest: empty, now: NOW });
    expect(summary.needsAttention).toEqual([]);
    expect(summary.thisWeek).toEqual([]);
    expect(summary.recentlyDecided).toEqual([]);
    expect(summary.looseEnds).toEqual([]);
    expect(summary.snapshot.looseEnds).toBe(0);
  });
});

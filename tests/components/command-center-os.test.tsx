import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { computeOperationalHealth } from "@/lib/people-strategy/operational-context";
import type {
  ActionLite,
  AreaHealthRow,
  DecisionLite,
  MeetingFollowUpLite,
  MeetingLite,
  OperationalDigestCounts,
  OperationalEntityLite,
  OperationalReviewItem,
  WeeklyOperationalDigest,
} from "@/lib/people-strategy/operational-digest";
import {
  ActionMeetings360Workboard,
  ActionUrgencyList,
  AreaHealthGrid,
  CommandCenterAllClear,
  DecisionFollowThroughCard,
  EntityHealthList,
  MeetingFollowThroughCard,
  NeedsAttentionList,
  OperationalDigestStats,
  UnresolvedMeetingFollowUpsList,
  decisionActionHref,
  meetingFollowUpActionHref,
} from "@/components/people-strategy/command-center-os";

const counts: OperationalDigestCounts = {
  openActions: 10,
  overdueActions: 4,
  dueTodayActions: 1,
  dueSoonActions: 3,
  blockedActions: 1,
  unassignedActions: 2,
  meetingsThisWeek: 4,
  upcomingMeetings: 2,
  meetingsWithoutActions: 1,
  unresolvedFollowUps: 5,
  unconvertedFollowUps: 2,
  criticalEntities: 1,
  warningEntities: 1,
  recentDecisions: 3,
  decisionsNeedingAction: 2,
  recentlyCompletedActions: 6,
};

function review(overrides: Partial<OperationalReviewItem> = {}): OperationalReviewItem {
  return {
    id: "entity:CLASS_OFFERING:cls1",
    kind: "class",
    title: "Algebra 101",
    reason: "3 overdue actions",
    reasons: ["3 overdue actions", "no meeting in 30 days"],
    score: 80,
    severity: "critical",
    href: "/admin/classes/cls1",
    ...overrides,
  };
}

function actionLite(overrides: Partial<ActionLite> = {}): ActionLite {
  return {
    id: "a1",
    title: "Confirm curriculum direction",
    status: "IN_PROGRESS",
    priority: "HIGH",
    dueISO: "2026-06-06T00:00:00.000Z",
    ownerName: "Bob",
    overdue: false,
    daysOverdue: 0,
    blocked: false,
    unassigned: false,
    relatedType: "CLASS_OFFERING",
    relatedId: "cls1",
    relatedLabel: "STEM pilot",
    relatedTypeLabel: "Class",
    sourceMeetingId: "m1",
    sourceMeetingTitle: "Curriculum sync",
    sourceMeetingStartISO: "2026-06-02T18:00:00.000Z",
    latestUpdate: "Waiting on partner preference.",
    nextStep: "Decide whether the class is rockets, planes, or broader STEM.",
    contextSummary: "Created from Curriculum sync",
    href: "/actions/a1",
    ...overrides,
  };
}

function followUpLite(overrides: Partial<MeetingFollowUpLite> = {}): MeetingFollowUpLite {
  return {
    id: "f1",
    title: "Confirm broader STEM direction before emailing partner",
    description: "Rockets and planes may be too narrow.",
    meetingId: "m1",
    meetingTitle: "Curriculum sync",
    meetingStartISO: "2026-06-02T18:00:00.000Z",
    meetingCategory: "CLASSES",
    ownerName: "Alice",
    ownerId: "u1",
    dueISO: "2026-06-07T00:00:00.000Z",
    priority: "HIGH",
    status: "open",
    areaLabel: "Classes",
    relatedType: "CLASS_OFFERING",
    relatedId: "cls1",
    relatedLabel: "STEM pilot",
    href: "/meetings/m1",
    ...overrides,
  };
}

function meetingLite(overrides: Partial<MeetingLite> = {}): MeetingLite {
  return {
    id: "m1",
    title: "Curriculum sync",
    startISO: "2026-06-02T18:00:00.000Z",
    category: "CLASSES",
    categoryLabel: "Classes",
    effectiveStatus: "needs_follow_up",
    openFollowUps: 1,
    overdueFollowUps: 0,
    decisionCount: 1,
    linkedActionCount: 1,
    facilitatorName: "Alice",
    attendeeCount: 3,
    recurrence: null,
    relatedType: "CLASS_OFFERING",
    relatedId: "cls1",
    relatedLabel: "STEM pilot",
    keyDecisions: ["Do not email the partner until the curriculum direction is clear."],
    linkedActionTitles: ["Draft STEM curriculum options"],
    unconvertedFollowUps: [followUpLite()],
    outcome: {
      level: "needs_follow_through",
      headline: "Needs follow-through on open items.",
      reasons: ["1 open follow-up"],
      suggestedNextSteps: ["Close out or convert the open follow-ups into tracked actions."],
    },
    href: "/meetings/m1",
    ...overrides,
  };
}

describe("OperationalDigestStats", () => {
  it("renders the headline counts with the overdue click-through", () => {
    render(<OperationalDigestStats counts={counts} />);
    expect(screen.getByText("Open actions")).toBeInTheDocument();
    expect(screen.getByText("Overdue actions")).toBeInTheDocument();
    const overdueTile = screen.getByText("Overdue actions").closest("a");
    expect(overdueTile).toHaveAttribute("href", "/actions/all?status=OVERDUE");
    expect(screen.getByText("Blocked items")).toBeInTheDocument();
    expect(screen.getByText("Meetings this week")).toBeInTheDocument();
    expect(screen.getByText("Uncaptured outputs")).toBeInTheDocument();
  });
});

describe("NeedsAttentionList", () => {
  it("renders ranked items worst-first with reason + kind + link", () => {
    render(
      <NeedsAttentionList
        items={[
          review({ id: "1", title: "Algebra 101", severity: "critical" }),
          review({ id: "2", kind: "partner", title: "Lincoln HS", reason: "1 overdue action", reasons: ["1 overdue action"], severity: "warning", href: "/admin/partners" }),
        ]}
      />
    );
    const items = screen.getAllByRole("listitem");
    expect(within(items[0]).getByText("Algebra 101")).toBeInTheDocument();
    expect(within(items[0]).getByText("Class")).toBeInTheDocument();
    expect(within(items[0]).getByText("3 overdue actions")).toBeInTheDocument();
    expect(within(items[1]).getByText("Lincoln HS")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Algebra 101/ })).toHaveAttribute("href", "/admin/classes/cls1");
  });

  it("renders a celebratory empty state when nothing is flagged", () => {
    render(<NeedsAttentionList items={[]} />);
    expect(screen.getByText(/Nothing needs leadership/i)).toBeInTheDocument();
  });
});

describe("AreaHealthGrid", () => {
  it("renders a health badge + counts per area", () => {
    const rows: AreaHealthRow[] = [
      {
        area: "CLASSES",
        areaLabel: "Classes",
        health: computeOperationalHealth({ overdueActions: 3 }),
        openActions: 5,
        overdueActions: 3,
        meetingCount: 2,
        upcomingMeetings: 1,
        unresolvedFollowUps: 1,
        criticalEntities: 1,
      },
    ];
    render(<AreaHealthGrid rows={rows} />);
    expect(screen.getByText("Classes")).toBeInTheDocument();
    expect(screen.getByText("Critical")).toBeInTheDocument();
    expect(screen.getByText("3 overdue")).toBeInTheDocument();
  });

  it("renders an empty state with no area activity", () => {
    render(<AreaHealthGrid rows={[]} />);
    expect(screen.getByText(/No area activity yet/i)).toBeInTheDocument();
  });

  it("drills an area with a primary entity into the filtered Action Tracker", () => {
    const rows: AreaHealthRow[] = [
      { area: "CLASSES", areaLabel: "Classes", health: computeOperationalHealth({ openActions: 1 }), openActions: 1, overdueActions: 0, meetingCount: 0, upcomingMeetings: 0, unresolvedFollowUps: 0, criticalEntities: 0 },
      { area: "FINANCE", areaLabel: "Finance", health: computeOperationalHealth({ openActions: 1 }), openActions: 1, overdueActions: 0, meetingCount: 0, upcomingMeetings: 0, unresolvedFollowUps: 0, criticalEntities: 0 },
    ];
    render(<AreaHealthGrid rows={rows} />);
    // Classes has a primary entity → clickable drilldown.
    expect(screen.getByRole("link", { name: /Classes/ })).toHaveAttribute("href", "/actions/all?rel=CLASS_OFFERING");
    // Finance has no shipped entity → not a link.
    expect(screen.queryByRole("link", { name: /Finance/ })).toBeNull();
  });
});

describe("MeetingFollowThroughCard", () => {
  it("renders the meeting header with facilitator context", () => {
    const meeting = meetingLite({ id: "m2", title: "Strong meeting" });
    render(<MeetingFollowThroughCard meeting={meeting} />);
    expect(screen.getByText("Strong meeting")).toBeInTheDocument();
    expect(screen.getByText(/Facilitator: Alice/)).toBeInTheDocument();
  });

  it("flags a meeting with decisions but no action and links to the workspace", () => {
    const meeting = meetingLite({
      title: "Ops Sync",
      openFollowUps: 0,
      decisionCount: 2,
      linkedActionCount: 0,
      unconvertedFollowUps: [],
      linkedActionTitles: [],
      outcome: {
        level: "needs_follow_through",
        headline: "Decisions made, but no action assigned.",
        reasons: ["2 decisions with no linked action"],
        suggestedNextSteps: ["Convert the decisions into tracked actions so they get done."],
      },
    });
    render(<MeetingFollowThroughCard meeting={meeting} />);
    expect(screen.getByText(/2 decisions, no action/i)).toBeInTheDocument();
    expect(screen.getByRole("link")).toHaveAttribute("href", "/meetings/m1");
  });
});

describe("DecisionFollowThroughCard", () => {
  const decision: DecisionLite = {
    id: "d1",
    decision: "Pilot the new onboarding",
    meetingId: "m1",
    meetingTitle: "Ops Sync",
    areaLabel: "Classes",
    decidedByName: "Alice",
    createdISO: "2026-06-02T00:00:00.000Z",
    hasLinkedAction: false,
    relatedType: "PARTNER",
    relatedId: "p1",
    href: "/meetings/m1",
  };

  it("builds a fully prefilled create-action href carrying the decision + meeting", () => {
    const href = decisionActionHref(decision);
    expect(href.startsWith("/actions/new?")).toBe(true);
    expect(href).toContain("title=Pilot+the+new+onboarding");
    expect(href).toContain("relatedType=PARTNER");
    expect(href).toContain("relatedId=p1");
    expect(href).toContain("fromMeeting=m1");
  });

  it("renders the decision with a create-action CTA and open-meeting link", () => {
    render(<DecisionFollowThroughCard decision={decision} />);
    expect(screen.getByText("Pilot the new onboarding")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Create action from decision" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Open meeting" })).toHaveAttribute("href", "/meetings/m1");
  });
});

describe("UnresolvedMeetingFollowUpsList", () => {
  it("builds a create-action link with meeting, owner, due date, and follow-up source", () => {
    const href = meetingFollowUpActionHref(followUpLite());
    expect(href.startsWith("/actions/new?")).toBe(true);
    expect(href).toContain("fromMeeting=m1");
    expect(href).toContain("sourceId=f1");
    expect(href).toContain("owner=u1");
    expect(href).toContain("due=2026-06-07");
    expect(href).toContain("relatedType=CLASS_OFFERING");
  });

  it("renders unresolved follow-ups with source meeting context and action CTA", () => {
    render(<UnresolvedMeetingFollowUpsList items={[followUpLite()]} />);
    expect(screen.getByText("Confirm broader STEM direction before emailing partner")).toBeInTheDocument();
    expect(screen.getByText(/Curriculum sync/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Create action" }).getAttribute("href")).toContain("/actions/new?");
    expect(screen.getByRole("link", { name: "Open meeting" })).toHaveAttribute("href", "/meetings/m1");
  });

  it("renders the empty state", () => {
    render(<UnresolvedMeetingFollowUpsList items={[]} />);
    expect(screen.getByText("No unresolved meeting follow-ups.")).toBeInTheDocument();
  });
});

describe("ActionUrgencyList", () => {
  it("renders overdue actions with day count + owner", () => {
    const actions: ActionLite[] = [
      actionLite({
        title: "Email partner",
        status: "OVERDUE",
        dueISO: "2026-05-20T00:00:00.000Z",
        overdue: true,
        daysOverdue: 5,
        relatedType: "PARTNER",
        relatedId: "p1",
        relatedLabel: "Lincoln HS",
        relatedTypeLabel: "Partner",
        sourceMeetingId: null,
        sourceMeetingTitle: null,
        sourceMeetingStartISO: null,
      }),
    ];
    render(<ActionUrgencyList actions={actions} />);
    expect(screen.getByText("Email partner")).toBeInTheDocument();
    expect(screen.getByText("Overdue 5d")).toBeInTheDocument();
    expect(screen.getByText(/Bob · Partner: Lincoln HS/)).toBeInTheDocument();
    expect(screen.getByText(/Partner: Lincoln HS/)).toBeInTheDocument();
    expect(screen.getByText(/Next:/)).toBeInTheDocument();
  });

  it("renders an empty state when nothing is urgent", () => {
    render(<ActionUrgencyList actions={[]} />);
    expect(screen.getByText(/No urgent actions/i)).toBeInTheDocument();
  });
});

describe("ActionMeetings360Workboard", () => {
  function digestFixture(): WeeklyOperationalDigest {
    const overdue = actionLite({
      id: "overdue",
      title: "Overdue partner reply",
      status: "OVERDUE",
      overdue: true,
      daysOverdue: 3,
      dueISO: "2026-06-01T00:00:00.000Z",
      href: "/actions/overdue",
    });
    const blocked = actionLite({
      id: "blocked",
      title: "Blocked curriculum call",
      status: "BLOCKED",
      blocked: true,
      href: "/actions/blocked",
    });
    const dueSoon = actionLite({
      id: "due-soon",
      title: "Due soon training plan",
      dueISO: "2026-06-06T00:00:00.000Z",
      href: "/actions/due-soon",
    });

    return {
      generatedAt: new Date("2026-06-04T12:00:00.000Z"),
      window: {
        start: new Date("2026-06-01T00:00:00.000Z"),
        end: new Date("2026-06-07T23:59:59.000Z"),
      },
      counts,
      urgentActions: [overdue, blocked],
      triage: {
        overdue: [overdue],
        blocked: [blocked],
        unassigned: [actionLite({ id: "unassigned", title: "Needs executor", unassigned: true })],
        dueSoon: [dueSoon],
      },
      upcomingMeetings: [meetingLite({ id: "upcoming", title: "Officer weekly sync", effectiveStatus: "upcoming" })],
      recentMeetings: [meetingLite({ id: "recent", title: "Curriculum sync" })],
      staleEntities: [],
      criticalEntities: [],
      decisionsNeedingAction: [
        {
          id: "d1",
          decision: "Hold external communication until STEM scope is clear",
          meetingId: "m1",
          meetingTitle: "Curriculum sync",
          areaLabel: "Classes",
          decidedByName: "Alice",
          createdISO: "2026-06-02T00:00:00.000Z",
          hasLinkedAction: false,
          relatedType: "CLASS_OFFERING",
          relatedId: "cls1",
          href: "/meetings/m1",
        },
      ],
      unresolvedMeetingFollowUps: [followUpLite()],
      meetingsNeedingFollowThrough: [meetingLite()],
      recentlyCompletedActions: [actionLite({ id: "done", title: "Completed instructor acceptance", status: "COMPLETE" })],
      areaHealth: [],
      recommendedReviewOrder: [review({ id: "meeting:upcoming", kind: "meeting", title: "Officer weekly sync", href: "/meetings/upcoming" })],
    };
  }

  it("renders the core 360 sections and places actions in the right groups", () => {
    render(<ActionMeetings360Workboard digest={digestFixture()} />);
    expect(screen.getByText("Needs attention")).toBeInTheDocument();
    expect(screen.getByText("This week")).toBeInTheDocument();
    expect(screen.getByText("Recently decided")).toBeInTheDocument();
    expect(screen.getByText("Overdue partner reply")).toBeInTheDocument();
    expect(screen.getByText("Blocked curriculum call")).toBeInTheDocument();
    expect(screen.getByText("Due soon training plan")).toBeInTheDocument();
  });

  it("shows unresolved meeting follow-ups and related meeting context", () => {
    render(<ActionMeetings360Workboard digest={digestFixture()} />);
    expect(screen.getByText("Unresolved meeting follow-ups")).toBeInTheDocument();
    expect(screen.getAllByText("Confirm broader STEM direction before emailing partner").length).toBeGreaterThan(0);
    expect(screen.getByText("Hold external communication until STEM scope is clear")).toBeInTheDocument();
  });

  it("does not surface XP or pathway language in the operational view", () => {
    const { container } = render(<ActionMeetings360Workboard digest={digestFixture()} />);
    expect(container.textContent).not.toMatch(/\bXP\b|pathway/i);
  });
});

describe("EntityHealthList", () => {
  it("renders a critical entity with a health badge and meeting staleness", () => {
    const entities: OperationalEntityLite[] = [
      {
        refKey: "CLASS_OFFERING:cls1",
        type: "CLASS_OFFERING",
        id: "cls1",
        label: "Algebra 101",
        typeLabel: "Class",
        area: "CLASSES",
        areaLabel: "Classes",
        href: "/admin/classes/cls1",
        health: computeOperationalHealth({ overdueActions: 3 }),
        openActions: 4,
        overdueActions: 3,
        blockedActions: 0,
        unassignedActions: 0,
        meetingCount: 1,
        upcomingMeetings: 0,
        daysSinceLastMeeting: 30,
        recentDecisions: 0,
        unresolvedFollowUps: 0,
      },
    ];
    render(<EntityHealthList entities={entities} emptyHint="all good" />);
    expect(screen.getByRole("link", { name: /Algebra 101/ })).toHaveAttribute("href", "/admin/classes/cls1");
    expect(screen.getByText("30d since meeting")).toBeInTheDocument();
    expect(screen.getByText("3 overdue")).toBeInTheDocument();
  });
});

describe("CommandCenterAllClear", () => {
  it("renders the motivating all-clear state with a weekly execution CTA", () => {
    render(<CommandCenterAllClear upcomingMeetings={[]} recentlyCompleted={[]} />);
    expect(screen.getByText(/Everything looks under control/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /weekly execution meeting/i })).toHaveAttribute(
      "href",
      "/operations/weekly-execution"
    );
  });
});

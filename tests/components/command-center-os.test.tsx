import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { computeOperationalHealth } from "@/lib/people-strategy/operational-context";
import type {
  ActionLite,
  AreaHealthRow,
  DecisionLite,
  MeetingLite,
  OperationalDigestCounts,
  OperationalEntityLite,
  OperationalReviewItem,
} from "@/lib/people-strategy/operational-digest";
import {
  ActionUrgencyList,
  AreaHealthGrid,
  CommandCenterAllClear,
  DecisionFollowThroughCard,
  EntityHealthList,
  MeetingFollowThroughCard,
  NeedsAttentionList,
  OperationalDigestStats,
  decisionActionHref,
} from "@/components/people-strategy/command-center-os";

const counts: OperationalDigestCounts = {
  overdueActions: 4,
  dueTodayActions: 1,
  dueSoonActions: 3,
  blockedActions: 1,
  unassignedActions: 2,
  upcomingMeetings: 2,
  meetingsWithoutActions: 1,
  unresolvedFollowUps: 5,
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

describe("OperationalDigestStats", () => {
  it("renders the headline counts with the overdue click-through", () => {
    render(<OperationalDigestStats counts={counts} />);
    expect(screen.getByText("Overdue actions")).toBeInTheDocument();
    const overdueTile = screen.getByText("Overdue actions").closest("a");
    expect(overdueTile).toHaveAttribute("href", "/actions/all?status=OVERDUE");
    expect(screen.getByText("Decisions to convert")).toBeInTheDocument();
    expect(screen.getByText("Done this week")).toBeInTheDocument();
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
});

describe("MeetingFollowThroughCard", () => {
  it("renders the meeting outcome quality badge", () => {
    const meeting: MeetingLite = {
      id: "m2",
      title: "Strong meeting",
      startISO: "2026-06-02T18:00:00.000Z",
      category: "CLASSES",
      categoryLabel: "Classes",
      effectiveStatus: "needs_follow_up",
      openFollowUps: 1,
      overdueFollowUps: 0,
      decisionCount: 1,
      linkedActionCount: 1,
      recurrence: null,
      relatedType: null,
      relatedId: null,
      outcome: {
        level: "needs_follow_through",
        headline: "Needs follow-through on open items.",
        reasons: ["1 open follow-up"],
        suggestedNextSteps: ["Close out or convert the open follow-ups into tracked actions."],
      },
      href: "/actions/meetings/m2",
    };
    render(<MeetingFollowThroughCard meeting={meeting} />);
    expect(screen.getByText("Needs follow-through")).toBeInTheDocument();
  });

  it("flags a meeting with decisions but no action and links to the workspace", () => {
    const meeting: MeetingLite = {
      id: "m1",
      title: "Ops Sync",
      startISO: "2026-06-02T18:00:00.000Z",
      category: "CLASSES",
      categoryLabel: "Classes",
      effectiveStatus: "needs_follow_up",
      openFollowUps: 0,
      overdueFollowUps: 0,
      decisionCount: 2,
      linkedActionCount: 0,
      recurrence: null,
      relatedType: "CLASS_OFFERING",
      relatedId: "cls1",
      outcome: {
        level: "needs_follow_through",
        headline: "Decisions made, but no action assigned.",
        reasons: ["2 decisions with no linked action"],
        suggestedNextSteps: ["Convert the decisions into tracked actions so they get done."],
      },
      href: "/actions/meetings/m1",
    };
    render(<MeetingFollowThroughCard meeting={meeting} />);
    expect(screen.getByText(/2 decisions, no action/i)).toBeInTheDocument();
    expect(screen.getByRole("link")).toHaveAttribute("href", "/actions/meetings/m1");
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
    href: "/actions/meetings/m1",
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
    expect(screen.getByRole("link", { name: "Open meeting" })).toHaveAttribute("href", "/actions/meetings/m1");
  });
});

describe("ActionUrgencyList", () => {
  it("renders overdue actions with day count + owner", () => {
    const actions: ActionLite[] = [
      {
        id: "a1",
        title: "Email partner",
        status: "OVERDUE",
        priority: "HIGH",
        dueISO: "2026-05-20T00:00:00.000Z",
        ownerName: "Bob",
        overdue: true,
        daysOverdue: 5,
        blocked: false,
        unassigned: false,
        relatedType: "PARTNER",
        relatedId: "p1",
        sourceMeetingId: null,
        href: "/actions/a1",
      },
    ];
    render(<ActionUrgencyList actions={actions} />);
    expect(screen.getByText("Email partner")).toBeInTheDocument();
    expect(screen.getByText("Overdue 5d")).toBeInTheDocument();
    expect(screen.getByText("Bob")).toBeInTheDocument();
  });

  it("renders an empty state when nothing is urgent", () => {
    render(<ActionUrgencyList actions={[]} />);
    expect(screen.getByText(/No urgent actions/i)).toBeInTheDocument();
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
  it("renders the motivating all-clear state with a weekly-review CTA", () => {
    render(<CommandCenterAllClear upcomingMeetings={[]} recentlyCompleted={[]} />);
    expect(screen.getByText(/Everything looks under control/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /weekly leadership review/i })).toHaveAttribute(
      "href",
      "/operations/weekly-review"
    );
  });
});

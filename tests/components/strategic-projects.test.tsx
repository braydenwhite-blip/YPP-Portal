import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({ prisma: {} }));
vi.mock("@/lib/feature-flags", () => ({ isActionTrackerEnabled: () => true }));

import { getInitiativeDef } from "@/lib/people-strategy/strategic-initiatives";
import { getProjectDef } from "@/lib/people-strategy/strategic-project-registry";
import {
  deriveProjectDossier,
  deriveProjectSummary,
  type ProjectSummary,
} from "@/lib/people-strategy/strategic-project-summary";
import type { StrategicCommandData } from "@/lib/people-strategy/strategic-project-queries";
import { deriveTouchpointTimeline } from "@/lib/people-strategy/strategic-touchpoint-timeline";
import {
  ProjectActionIntelligencePanel,
  ProjectBriefPanel,
  ProjectCard,
  ProjectCardGrid,
  ProjectExecutionSpine,
  ProjectReviewCard,
  ProjectStatStrip,
} from "@/components/people-strategy/strategic-projects";
import { StrategicCommandSection } from "@/components/people-strategy/strategic-command";
import { TouchpointTimelineView } from "@/components/people-strategy/touchpoint-timeline";

import { action, decision, emptyLabels, meetingCard, NOW } from "../lib/strategic-helpers";

const initiative = getInitiativeDef("summer-camps-2026")!;
const def = getProjectDef("beth-el-pilot")!;

function buildSummary(): ProjectSummary {
  return deriveProjectSummary({
    def,
    initiative,
    actions: [
      action({ title: "Beth El pilot agreement", status: "COMPLETE", completedAt: new Date("2026-06-02") }),
      action({ title: "Beth El pilot supplies", status: "IN_PROGRESS", deadlineStart: new Date("2026-05-25") }), // overdue
    ],
    meetings: [meetingCard({ title: "Beth El pilot sync", startISO: new Date("2026-06-02").toISOString(), decisionCount: 1 })],
    decisions: [decision({ decision: "Beth El pilot dates locked", hasLinkedAction: false })],
    labels: emptyLabels(),
    now: NOW,
  });
}

function buildDossier() {
  return deriveProjectDossier({
    def,
    initiative,
    actions: [
      action({ title: "Beth El pilot agreement", status: "COMPLETE", completedAt: new Date("2026-06-02") }),
      action({ title: "Beth El pilot supplies", status: "IN_PROGRESS", deadlineStart: new Date("2026-05-25") }),
    ],
    meetings: [meetingCard({ title: "Beth El pilot sync", startISO: new Date("2026-06-02").toISOString(), linkedActionCount: 1 })],
    decisions: [decision({ decision: "Beth El pilot dates locked", hasLinkedAction: false })],
    labels: emptyLabels(),
    now: NOW,
  });
}

describe("ProjectCard", () => {
  it("renders title, parent initiative, confidence, and the next move", () => {
    render(<ProjectCard project={buildSummary()} />);
    expect(screen.getByText("Beth El Pilot")).toBeInTheDocument();
    expect(screen.getByText("Summer Camps 2026")).toBeInTheDocument();
    expect(screen.getByText(/Next:/)).toBeInTheDocument();
  });
});

describe("ProjectCardGrid empty state", () => {
  it("renders a helpful empty hint when there are no projects", () => {
    render(<ProjectCardGrid projects={[]} emptyHint="No strategic projects defined yet." />);
    expect(screen.getByText("No strategic projects defined yet.")).toBeInTheDocument();
  });
});

describe("ProjectStatStrip", () => {
  it("renders the portfolio tiles", () => {
    render(
      <ProjectStatStrip
        stats={{
          total: 10,
          active: 8,
          healthy: 4,
          needsAttention: 3,
          atRisk: 1,
          critical: 1,
          blocked: 2,
          unowned: 1,
          noWork: 2,
          completed: 0,
          openActions: 12,
          overdueActions: 3,
        }}
      />
    );
    expect(screen.getByText("Projects")).toBeInTheDocument();
    expect(screen.getByText("Blocked")).toBeInTheDocument();
    expect(screen.getByText("No work yet")).toBeInTheDocument();
  });
});

describe("ProjectBriefPanel", () => {
  it("renders the charter sections including what could kill it", () => {
    render(<ProjectBriefPanel project={buildSummary()} />);
    expect(screen.getByText("What this is")).toBeInTheDocument();
    expect(screen.getByText("What success looks like")).toBeInTheDocument();
    expect(screen.getByText("What could kill it")).toBeInTheDocument();
  });
});

describe("ProjectExecutionSpine", () => {
  it("renders the Project → Workstreams → … → Outcomes chain", () => {
    const dossier = buildDossier();
    render(<ProjectExecutionSpine project={dossier.summary} milestones={dossier.linkedMilestones} />);
    expect(screen.getByText("Project")).toBeInTheDocument();
    expect(screen.getByText("Workstreams")).toBeInTheDocument();
    expect(screen.getByText("Outcomes")).toBeInTheDocument();
  });
});

describe("ProjectActionIntelligencePanel", () => {
  it("renders action stats and a recommended next action", () => {
    render(<ProjectActionIntelligencePanel intel={buildDossier().actionIntelligence} />);
    expect(screen.getByText("Open")).toBeInTheDocument();
    expect(screen.getByText("Overdue")).toBeInTheDocument();
    expect(screen.getByText(/Recommended next action/)).toBeInTheDocument();
  });

  it("shows an empty state with no actions", () => {
    render(
      <ProjectActionIntelligencePanel
        intel={{
          open: [],
          overdue: [],
          completed: [],
          unowned: [],
          noDueDate: [],
          fromMeetings: [],
          recommendedNext: null,
          counts: { total: 0, open: 0, overdue: 0, completed: 0, unowned: 0, noDueDate: 0, fromMeetings: 0 },
        }}
      />
    );
    expect(screen.getByText(/No actions are linked yet/)).toBeInTheDocument();
  });
});

describe("ProjectReviewCard", () => {
  it("renders the review columns", () => {
    const dossier = buildDossier();
    render(<ProjectReviewCard project={dossier.summary} meetingIntel={dossier.meetingIntelligence} />);
    expect(screen.getByText("Project review")).toBeInTheDocument();
    expect(screen.getByText("Wins")).toBeInTheDocument();
    expect(screen.getByText("Blockers")).toBeInTheDocument();
    expect(screen.getByText("Next moves")).toBeInTheDocument();
  });
});

describe("TouchpointTimelineView", () => {
  it("renders grouped touchpoints with type badges", () => {
    const timeline = deriveTouchpointTimeline({
      context: { initiativeId: "summer", projectId: "beth-el" },
      actions: [
        action({ id: "o", title: "Overdue task", status: "IN_PROGRESS", deadlineStart: new Date("2026-05-20") }),
        action({ id: "d", title: "Done task", status: "COMPLETE", completedAt: new Date("2026-06-03") }),
      ],
      now: NOW,
    });
    render(<TouchpointTimelineView timeline={timeline} />);
    expect(screen.getByText("Overdue / blocked")).toBeInTheDocument();
    // The overdue action surfaces as both a "created" and a "due" touchpoint.
    expect(screen.getAllByText("Overdue task").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Done task").length).toBeGreaterThan(0);
  });

  it("renders the empty state with no touchpoints", () => {
    const timeline = deriveTouchpointTimeline({ context: {}, now: NOW });
    render(<TouchpointTimelineView timeline={timeline} emptyHint="Nothing here yet." />);
    expect(screen.getByText("Nothing here yet.")).toBeInTheDocument();
  });
});

describe("StrategicCommandSection", () => {
  it("renders the cockpit lanes and recommended moves", () => {
    const summary = buildSummary();
    const data: StrategicCommandData = {
      generatedAt: NOW,
      snapshot: {
        initiatives: 10,
        projects: 10,
        projectsNeedingAttention: 1,
        blockedProjects: 1,
        overdueStrategicActions: 2,
        decisionsNeedingFollowThrough: 1,
      },
      initiativesNeedingAttention: [],
      projectsNeedingAttention: [summary],
      blockedProjects: [summary],
      staleProjects: [],
      unownedProjects: [],
      upcomingMilestones: [],
      decisionsNeedingFollowThrough: [
        {
          id: "d1",
          decision: "Lock Beth El dates",
          meetingId: "m1",
          meetingTitle: "Pilot sync",
          decidedByName: "Alice",
          href: "/actions/meetings/m1",
        },
      ],
      recommendedMoves: [
        { id: "mv1", title: "Unblock Beth El Pilot", detail: "Clear the blocker", href: "/x", severity: "critical" },
      ],
    };
    render(<StrategicCommandSection data={data} />);
    expect(screen.getByText("Initiatives needing attention")).toBeInTheDocument();
    expect(screen.getByText("Projects needing attention")).toBeInTheDocument();
    expect(screen.getByText("Decisions needing follow-through")).toBeInTheDocument();
    expect(screen.getByText("Unblock Beth El Pilot")).toBeInTheDocument();
    expect(screen.getByText("Lock Beth El dates")).toBeInTheDocument();
  });
});

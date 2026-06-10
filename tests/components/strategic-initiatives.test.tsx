import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({ prisma: {} }));
vi.mock("@/lib/feature-flags", () => ({ isActionTrackerEnabled: () => true }));

import { deriveInitiativeSummary } from "@/lib/people-strategy/strategic-initiative-summary";
import { deriveStrategicMap } from "@/lib/people-strategy/strategic-map";
import type { StrategicInitiativeDef } from "@/lib/people-strategy/strategic-initiatives";
import {
  InitiativeCard,
  InitiativeSummaryPanel,
  InitiativeWeeklyOperatingView,
  MilestoneList,
  ProgressBar,
  RecommendationsList,
  StrategicInitiativesSection,
  StrategicMapView,
  StrategicTimelineView,
} from "@/components/people-strategy/strategic-initiatives";

import { action, decision, emptyLabels, meetingCard, NOW } from "../lib/strategic-helpers";

const def: StrategicInitiativeDef = {
  id: "summer-camps-2026",
  title: "Summer Camps 2026",
  description: "Stand up the 2026 camp slate.",
  area: "CLASSES",
  status: "active",
  priority: "flagship",
  targetDateISO: "2026-08-01T00:00:00.000Z",
  match: { keywords: ["camp"] },
  milestones: [
    { id: "secure", title: "Secure camp partners", order: 1, match: { keywords: ["partner"] } },
    { id: "pilot", title: "Run pilot", order: 2, match: { keywords: ["pilot"] } },
  ],
};

function buildSummary() {
  return deriveInitiativeSummary({
    def,
    actions: [
      action({ title: "Secure camp partner MOU", status: "COMPLETE", completedAt: new Date("2026-06-02"), createdAt: new Date("2026-05-01") }),
      action({ title: "Plan camp pilot", status: "IN_PROGRESS", deadlineStart: new Date("2026-06-01") }), // overdue
    ],
    meetings: [meetingCard({ title: "Camp partner sync", startISO: new Date("2026-06-01").toISOString() })],
    decisions: [decision({ decision: "Run a July camp pilot", hasLinkedAction: false })],
    labels: emptyLabels(),
    now: NOW,
  });
}

describe("InitiativeCard", () => {
  it("renders the title, health, progress, and the next move", () => {
    const summary = buildSummary();
    render(<InitiativeCard initiative={summary} />);
    expect(screen.getByText("Summer Camps 2026")).toBeInTheDocument();
    expect(screen.getByText(/Stand up the 2026 camp slate/)).toBeInTheDocument();
    expect(screen.getByText("Classes")).toBeInTheDocument();
    expect(screen.getByText(/Next:/)).toBeInTheDocument();
    // Health badge text is present (At risk because of the overdue action).
    expect(screen.getByText("At risk")).toBeInTheDocument();
  });
});

describe("InitiativeSummaryPanel", () => {
  it("renders the health headline and the stat tiles", () => {
    const summary = buildSummary();
    render(<InitiativeSummaryPanel initiative={summary} />);
    expect(screen.getByText(summary.healthExplanation.headline)).toBeInTheDocument();
    expect(screen.getByText("Open actions")).toBeInTheDocument();
    expect(screen.getByText("Overdue")).toBeInTheDocument();
  });
});

describe("InitiativeWeeklyOperatingView", () => {
  it("shows actions, meetings, decisions, blockers, communication, and timeline", () => {
    const summary = buildSummary();
    render(<InitiativeWeeklyOperatingView initiative={summary} />);
    expect(screen.getByText("Current Focus")).toBeInTheDocument();
    expect(screen.getByText("Open Actions")).toBeInTheDocument();
    expect(screen.getByText("Meetings & Decisions")).toBeInTheDocument();
    expect(screen.getByText("Risks / Blockers")).toBeInTheDocument();
    expect(screen.getByText("Communication Needed")).toBeInTheDocument();
    expect(screen.getByText("Timeline")).toBeInTheDocument();
  });
});

describe("MilestoneList", () => {
  it("renders milestones with status and completion", () => {
    const summary = buildSummary();
    render(<MilestoneList milestones={summary.milestones} />);
    expect(screen.getByText("Secure camp partners")).toBeInTheDocument();
    expect(screen.getByText("Run pilot")).toBeInTheDocument();
    expect(screen.getAllByText("Complete").length).toBeGreaterThan(0);
  });

  it("shows an empty state with no milestones", () => {
    render(<MilestoneList milestones={[]} />);
    expect(screen.getByText(/No milestones defined/)).toBeInTheDocument();
  });
});

describe("StrategicTimelineView", () => {
  it("renders history events and the upcoming target", () => {
    const summary = buildSummary();
    render(<StrategicTimelineView timeline={summary.timeline} />);
    expect(screen.getByText("Coming up")).toBeInTheDocument();
    expect(screen.getByText("History")).toBeInTheDocument();
    // The decision shows up in history.
    expect(screen.getByText("Run a July camp pilot")).toBeInTheDocument();
  });
});

describe("RecommendationsList", () => {
  it("renders recommendations with their why", () => {
    const summary = buildSummary();
    render(<RecommendationsList recommendations={summary.recommendations} />);
    expect(screen.getAllByText("Do next").length).toBeGreaterThan(0);
  });

  it("renders a positive empty state", () => {
    render(<RecommendationsList recommendations={[]} />);
    expect(screen.getByText(/on track/)).toBeInTheDocument();
  });
});

describe("ProgressBar", () => {
  it("clamps and exposes an accessible value", () => {
    render(<ProgressBar percent={140} />);
    const bar = screen.getByRole("progressbar");
    expect(bar).toHaveAttribute("aria-valuenow", "100");
  });
});

describe("StrategicInitiativesSection (executive dashboard)", () => {
  it("renders the dashboard panels with content and empties", () => {
    const summary = buildSummary();
    render(
      <StrategicInitiativesSection
        needingAttention={[summary]}
        fastestMoving={[]}
        recentMilestones={[{ initiativeId: summary.id, initiativeTitle: summary.title, title: "Secure camp partners", occurredAtISO: "2026-06-02T00:00:00.000Z", href: summary.href }]}
        upcomingMilestones={[]}
        strategicRisks={[{ initiativeId: summary.id, initiativeTitle: summary.title, level: "elevated", score: 20, topFactor: "1 overdue action", href: summary.href }]}
        leadershipPriorities={[summary]}
      />
    );
    expect(screen.getByText("Initiatives needing attention")).toBeInTheDocument();
    expect(screen.getByText("Recently completed milestones")).toBeInTheDocument();
    expect(screen.getByText(/Secure camp partners/)).toBeInTheDocument();
    expect(screen.getByText("Strategic risks")).toBeInTheDocument();
  });
});

describe("StrategicMapView", () => {
  it("renders the YPP root, area node, and initiative node", () => {
    const summary = buildSummary();
    const map = deriveStrategicMap([summary], NOW);
    render(<StrategicMapView map={map} />);
    expect(screen.getByText("YPP")).toBeInTheDocument();
    expect(screen.getByText("Classes")).toBeInTheDocument();
    // Initiative node link.
    const link = screen.getByRole("link", { name: "Summer Camps 2026" });
    expect(link).toHaveAttribute("href", "/operations/initiatives/summer-camps-2026");
  });

  it("shows an empty state with no areas", () => {
    render(<StrategicMapView map={{ generatedAtISO: NOW.toISOString(), totalInitiatives: 0, areas: [] }} />);
    expect(screen.getByText(/No initiatives are populated/)).toBeInTheDocument();
  });
});

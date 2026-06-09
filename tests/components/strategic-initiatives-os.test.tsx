import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({ prisma: {} }));
vi.mock("@/lib/feature-flags", () => ({ isActionTrackerEnabled: () => true }));

import { deriveInitiativeDossier } from "@/lib/people-strategy/strategic-initiative-dossier";
import { deriveStrategicPortfolio } from "@/lib/people-strategy/strategic-portfolio";
import { deriveDependencyGraph } from "@/lib/people-strategy/strategic-dependencies";
import { getInitiativeDef } from "@/lib/people-strategy/strategic-initiatives";
import {
  DecisionCenterPanel,
  DependencyGraphBoard,
  ExecutionGraphView,
  InitiativeCharterPanel,
  PortfolioBoard,
  RoadmapView,
  ScenariosPanel,
  WorkstreamBoard,
} from "@/components/people-strategy/strategic-initiatives-os";

import { action, decision, emptyLabels, meetingCard, NOW } from "../lib/strategic-helpers";

function buildDossier() {
  const def = getInitiativeDef("summer-camps-2026")!;
  return deriveInitiativeDossier({
    def,
    actions: [
      action({ title: "Secure camp partner MOU", status: "COMPLETE", completedAt: new Date("2026-06-02"), createdAt: new Date("2026-05-01") }),
      action({ title: "Develop curriculum draft", status: "IN_PROGRESS", deadlineStart: new Date("2026-06-12") }),
      action({ title: "Recruit camp instructors", status: "IN_PROGRESS", deadlineStart: new Date("2026-06-01") }),
    ],
    meetings: [meetingCard({ title: "Camp partner sync", startISO: new Date("2026-06-01").toISOString() })],
    decisions: [decision({ decision: "Run a July camp pilot", hasLinkedAction: false, createdAt: new Date("2026-06-01") })],
    labels: emptyLabels(),
    now: NOW,
  });
}

describe("Strategic Initiatives 2.0 panels", () => {
  it("renders the workstream board with each program", () => {
    const d = buildDossier();
    render(<WorkstreamBoard workstreams={d.workstreams} />);
    expect(screen.getByText("Partnership Development")).toBeInTheDocument();
    expect(screen.getByText("Curriculum Development")).toBeInTheDocument();
  });

  it("renders the charter mission + outcomes", () => {
    const d = buildDossier();
    render(<InitiativeCharterPanel charter={d.profile.charter} />);
    expect(screen.getByText("Mission")).toBeInTheDocument();
    expect(screen.getByText(/transformative summer/i)).toBeInTheDocument();
  });

  it("renders the decision center with the recorded decision", () => {
    const d = buildDossier();
    render(<DecisionCenterPanel center={d.decisionCenter} />);
    // The decision is recent + unactioned, so it appears in both the
    // "Critical" and "Needs follow-through" sections.
    expect(screen.getAllByText("Run a July camp pilot").length).toBeGreaterThanOrEqual(1);
  });

  it("renders the scenario board with the expected case", () => {
    const d = buildDossier();
    render(<ScenariosPanel board={d.scenarios} />);
    expect(screen.getByText("4 camps")).toBeInTheDocument();
  });

  it("renders the roadmap with phase counts", () => {
    const d = buildDossier();
    render(<RoadmapView roadmap={d.roadmap} />);
    expect(screen.getByText("By horizon")).toBeInTheDocument();
    expect(screen.getByText("By phase")).toBeInTheDocument();
  });

  it("renders the execution graph layers", () => {
    const d = buildDossier();
    render(<ExecutionGraphView graph={d.executionGraph} />);
    expect(screen.getByText("Workstreams")).toBeInTheDocument();
  });

  it("renders the portfolio board headings even when empty", () => {
    const portfolio = deriveStrategicPortfolio([]);
    render(<PortfolioBoard portfolio={portfolio} />);
    expect(screen.getByText("Most important")).toBeInTheDocument();
    expect(screen.getByText("Strategic opportunities")).toBeInTheDocument();
  });

  it("shows an empty state for a dependency graph with no edges", () => {
    const graph = deriveDependencyGraph({ initiatives: [] });
    render(<DependencyGraphBoard graph={graph} />);
    expect(screen.getByText(/No cross-initiative dependencies/i)).toBeInTheDocument();
  });
});

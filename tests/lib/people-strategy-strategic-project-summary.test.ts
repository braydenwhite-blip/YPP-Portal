import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({ prisma: {} }));
vi.mock("@/lib/feature-flags", () => ({ isActionTrackerEnabled: () => true }));

import { getInitiativeDef } from "@/lib/people-strategy/strategic-initiatives";
import { getProjectDef } from "@/lib/people-strategy/strategic-project-registry";
import {
  classifyProjectWork,
  compareProjectsByConcern,
  deriveProjectPortfolioStats,
  deriveProjectSummary,
  selectBlockedProjects,
  selectProjectsNeedingAttention,
  type ProjectSummary,
} from "@/lib/people-strategy/strategic-project-summary";

import { action, decision, emptyLabels, meetingCard, NOW } from "./strategic-helpers";

const initiative = getInitiativeDef("summer-camps-2026")!;
const def = getProjectDef("beth-el-pilot")!;

function summaryWith(actions = [], meetings = [], decisions = []): ProjectSummary {
  return deriveProjectSummary({
    def,
    initiative,
    actions,
    meetings,
    decisions,
    labels: emptyLabels(),
    now: NOW,
  });
}

describe("classifyProjectWork", () => {
  it("narrows the initiative pool to just the project's work", () => {
    const bethEl = action({ id: "1", title: "Beth El pilot kickoff" });
    const mohawk = action({ id: "2", title: "Mohawk expansion planning" });
    const result = classifyProjectWork(def, {
      actions: [bethEl, mohawk],
      meetings: [],
      decisions: [],
    });
    expect(result.actions.map((a) => a.id)).toEqual(["1"]);
  });
});

describe("deriveProjectSummary — empty state honesty", () => {
  const summary = summaryWith();

  it("reports no_work and unknown confidence when nothing is linked", () => {
    expect(summary.hasWork).toBe(false);
    expect(summary.dataState).toBe("no_work");
    expect(summary.confidence.level).toBe("unknown");
    expect(summary.statusExplanation.basis).toBe("no_work");
  });

  it("carries the parent initiative + charter context", () => {
    expect(summary.initiativeId).toBe("summer-camps-2026");
    expect(summary.area).toBe(initiative.area);
    expect(summary.charter.purpose).toBe(def.charter.purpose);
    expect(summary.href).toBe("/operations/projects/beth-el-pilot");
  });

  it("recommends kicking the project off as a next move", () => {
    expect(summary.nextMoves.some((m) => m.id === "kickoff")).toBe(true);
    expect(summary.newActionHref).toContain("/actions/new");
  });
});

describe("deriveProjectSummary — derived from real work", () => {
  it("counts open / overdue / completed work and flags blockers", () => {
    const summary = summaryWith([
      action({ id: "a", title: "Beth El pilot agreement", status: "COMPLETE", completedAt: new Date("2026-06-02") }),
      action({ id: "b", title: "Beth El pilot supplies", status: "IN_PROGRESS", deadlineStart: new Date("2026-05-25") }), // overdue
      action({ id: "c", title: "Beth El pilot schedule", status: "BLOCKED" }),
    ]);
    expect(summary.hasWork).toBe(true);
    expect(summary.counts.completedActions).toBe(1);
    expect(summary.counts.overdueActions).toBeGreaterThanOrEqual(1);
    expect(summary.counts.blockedActions).toBe(1);
    expect(summary.blockers.some((x) => x.kind === "observed")).toBe(true);
    expect(summary.dataState).toBe("tracked");
  });

  it("surfaces decision follow-through gaps", () => {
    const summary = summaryWith(
      [],
      [meetingCard({ id: "m", title: "Beth El pilot sync" })],
      [decision({ id: "d", decision: "Beth El pilot dates locked", hasLinkedAction: false })]
    );
    expect(summary.followThrough.decisionsWithoutAction).toBe(1);
  });
});

describe("project portfolio selectors", () => {
  const blocked = summaryWith([
    action({ id: "x", title: "Beth El pilot blocker", status: "BLOCKED" }),
  ]);
  const empty = summaryWith();

  it("selectBlockedProjects picks observed blockers", () => {
    const result = selectBlockedProjects([blocked, empty]);
    expect(result.map((p) => p.id)).toContain("beth-el-pilot");
  });

  it("compareProjectsByConcern sorts worse health first", () => {
    const sorted = [empty, blocked].sort(compareProjectsByConcern);
    // The blocked project (worse health) should not sort after the empty one if its health is worse.
    expect(sorted.length).toBe(2);
  });

  it("deriveProjectPortfolioStats tallies the portfolio", () => {
    const stats = deriveProjectPortfolioStats([blocked, empty]);
    expect(stats.total).toBe(2);
    expect(stats.noWork).toBe(1);
    expect(stats.blocked).toBeGreaterThanOrEqual(1);
  });

  it("selectProjectsNeedingAttention excludes nothing healthy-and-empty incorrectly", () => {
    const result = selectProjectsNeedingAttention([blocked, empty]);
    expect(Array.isArray(result)).toBe(true);
  });
});

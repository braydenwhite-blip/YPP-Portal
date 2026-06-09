import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({ prisma: {} }));
vi.mock("@/lib/feature-flags", () => ({ isActionTrackerEnabled: () => true }));

import { getInitiativeDef } from "@/lib/people-strategy/strategic-initiatives";
import { getProjectDef } from "@/lib/people-strategy/strategic-project-registry";
import {
  deriveProjectSummary,
  type ProjectSummary,
} from "@/lib/people-strategy/strategic-project-summary";
import type { StrategicProjectDef } from "@/lib/people-strategy/strategic-projects";
import {
  deriveProjectAttentionItem,
  deriveProjectCta,
  deriveProjectStakes,
  selectProjectAttentionQueue,
} from "@/lib/people-strategy/strategic-project-attention";

import { action, emptyLabels, NOW } from "./strategic-helpers";

const initiative = getInitiativeDef("summer-camps-2026")!;
const bethEl = getProjectDef("beth-el-pilot")!;

function summaryFor(def: StrategicProjectDef, actions: ReturnType<typeof action>[] = []): ProjectSummary {
  return deriveProjectSummary({
    def,
    initiative,
    actions,
    meetings: [],
    decisions: [],
    labels: emptyLabels(),
    now: NOW,
  });
}

function overdueSummary(): ProjectSummary {
  return summaryFor(bethEl, [
    action({
      id: "a1",
      title: "Beth El pilot agreement",
      status: "IN_PROGRESS",
      deadlineStart: new Date("2026-05-01"),
    }),
  ]);
}

const SEVERITY_ORDER: Record<string, number> = { critical: 0, warning: 1, watch: 2 };

describe("deriveProjectCta", () => {
  it("asks for the first action when a project has no tracked work", () => {
    const cta = deriveProjectCta(summaryFor(bethEl));
    expect(cta.kind).toBe("create_next_action");
    expect(cta.label).toBe("Create next action");
    expect(cta.href).toContain("/actions/new");
  });

  it("sends leadership to clear the blocker when work is overdue", () => {
    const cta = deriveProjectCta(overdueSummary());
    expect(cta.kind).toBe("clear_blocker");
    expect(cta.label).toBe("Clear blocker");
    expect(cta.href.length).toBeGreaterThan(0);
  });

  it("never returns a generic label", () => {
    const cta = deriveProjectCta(overdueSummary());
    expect(cta.label).not.toBe("View");
    expect(cta.label).not.toBe("Details");
  });
});

describe("deriveProjectStakes", () => {
  it("explains that an untracked project is invisible until it has work", () => {
    expect(deriveProjectStakes(summaryFor(bethEl))).toMatch(/Nothing is tracked yet/);
  });

  it("warns that overdue work keeps slipping when nothing changes", () => {
    expect(deriveProjectStakes(overdueSummary())).toMatch(/slipping|slides/);
  });
});

describe("deriveProjectAttentionItem", () => {
  it("summarizes why a blocked project needs attention", () => {
    const item = deriveProjectAttentionItem(overdueSummary());
    expect(item.reason).toBe(overdueSummary().statusExplanation.headline);
    expect(item.blocker).toBeTruthy();
    expect(item.cta.kind).toBe("clear_blocker");
    expect(["critical", "warning"]).toContain(item.severity);
  });
});

describe("selectProjectAttentionQueue", () => {
  it("surfaces a blocked project", () => {
    const queue = selectProjectAttentionQueue([overdueSummary()]);
    expect(queue.map((entry) => entry.project.id)).toContain("beth-el-pilot");
  });

  it("respects the limit", () => {
    expect(selectProjectAttentionQueue([overdueSummary()], 0)).toHaveLength(0);
  });

  it("orders worst severity first", () => {
    const ranks = selectProjectAttentionQueue([overdueSummary()]).map(
      (entry) => SEVERITY_ORDER[entry.severity],
    );
    expect(ranks).toEqual([...ranks].sort((a, b) => a - b));
  });

  it("is deterministic across calls", () => {
    const first = selectProjectAttentionQueue([overdueSummary()]).map((entry) => entry.project.id);
    const second = selectProjectAttentionQueue([overdueSummary()]).map((entry) => entry.project.id);
    expect(first).toEqual(second);
  });
});

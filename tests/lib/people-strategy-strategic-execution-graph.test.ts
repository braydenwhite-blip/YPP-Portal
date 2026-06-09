import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({ prisma: {} }));
vi.mock("@/lib/feature-flags", () => ({ isActionTrackerEnabled: () => true }));

import { deriveExecutionGraph } from "@/lib/people-strategy/strategic-execution-graph";
import { deriveWorkstreams } from "@/lib/people-strategy/strategic-workstreams";
import { deriveInitiativeMilestones } from "@/lib/people-strategy/strategic-milestones";
import { deriveTimelineEvents } from "@/lib/people-strategy/strategic-timeline";
import { deriveDecisionCenter } from "@/lib/people-strategy/strategic-decision-center";
import type { StrategicInitiativeDef } from "@/lib/people-strategy/strategic-initiatives";

import { action, decision, NOW } from "./strategic-helpers";

const def: StrategicInitiativeDef = {
  id: "summer",
  title: "Summer Camps",
  description: "",
  area: "CLASSES",
  status: "active",
  priority: "flagship",
  match: { keywords: ["camp"] },
  workstreams: [
    { id: "partners", title: "Partnership Development", order: 1, match: { keywords: ["partner"] } },
    { id: "curriculum", title: "Curriculum Development", order: 2, match: { keywords: ["curriculum"] } },
  ],
  milestones: [
    { id: "secure", title: "Secure partners", order: 1, workstreamId: "partners", match: { keywords: ["partner"] } },
  ],
};

describe("deriveExecutionGraph", () => {
  const actions = [
    action({ title: "Secure camp partner", status: "COMPLETE", completedAt: new Date("2026-06-02") }),
    action({ title: "Write curriculum draft", status: "IN_PROGRESS", deadlineStart: new Date("2026-06-12") }),
  ];
  const decisions = [
    decision({ decision: "Lock host sites", hasLinkedAction: false, createdAt: new Date("2026-06-01"), meetingId: "m1", meetingTitle: "Camp Sync" }),
  ];

  function build() {
    const workstreams = deriveWorkstreams({ def, actions, meetings: [], decisions, labels: new Map(), now: NOW });
    const milestones = deriveInitiativeMilestones({ def, actions, meetings: [], decisions, now: NOW });
    const timelineEvents = deriveTimelineEvents({ def, actions, meetings: [], decisions, milestones, now: NOW }).filter((e) => !e.upcoming);
    const decisionCenter = deriveDecisionCenter(decisions, NOW);
    return deriveExecutionGraph({
      initiativeId: def.id,
      initiativeTitle: def.title,
      initiativeHealthLevel: "healthy",
      workstreams,
      timelineEvents,
      decisionCenter,
    });
  }

  it("builds the full Initiative → … → Outcome chain from real links", () => {
    const g = build();
    const layerNames = g.layers.map((l) => l.layer);
    expect(layerNames).toContain("initiative");
    expect(layerNames).toContain("workstream");
    expect(layerNames).toContain("milestone");
    expect(layerNames).toContain("decision");
    expect(layerNames).toContain("meeting");
    expect(layerNames).toContain("action");
    expect(layerNames).toContain("outcome");
  });

  it("counts the nodes in each layer", () => {
    const g = build();
    expect(g.stats.workstreams).toBe(2);
    expect(g.stats.milestones).toBe(1);
    expect(g.stats.decisions).toBe(1);
    expect(g.stats.meetings).toBe(1);
    expect(g.stats.actions).toBe(2);
    expect(g.stats.outcomes).toBe(1); // the completed partner action
  });

  it("connects the initiative to its workstreams and a decision to its meeting", () => {
    const g = build();
    expect(g.edges.some((e) => e.fromId === "initiative:summer" && e.kind === "contains")).toBe(true);
    expect(g.edges.some((e) => e.fromId.startsWith("decision:") && e.toId === "meeting:m1")).toBe(true);
  });
});

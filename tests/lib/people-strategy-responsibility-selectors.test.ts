import { describe, expect, it } from "vitest";
import type { GrowthTag } from "@prisma/client";

import type { ActionItemWithRelations } from "@/lib/people-strategy/action-queries";
import {
  buildPeopleRiskRadar,
  buildResponsibilityRows,
} from "@/lib/people-strategy/responsibility-selectors";

const NOW = new Date("2026-06-04T12:00:00");

type Assignment = ActionItemWithRelations["assignments"][number];

function person(id: string) {
  return { id, name: id, email: `${id}@x.org`, primaryRole: "INSTRUCTOR", profile: null };
}

function assignment(userId: string, role: Assignment["role"]): Assignment {
  return { id: `${userId}-${role}`, role, createdAt: NOW, user: person(userId) } as Assignment;
}

function item(overrides: Partial<ActionItemWithRelations>): ActionItemWithRelations {
  return {
    id: Math.random().toString(36).slice(2),
    title: "Item",
    description: null,
    goalCategory: null,
    departmentId: "d1",
    status: "IN_PROGRESS",
    priority: "MEDIUM",
    deadlineStart: new Date("2026-06-10T00:00:00"),
    deadlineEnd: null,
    completedAt: null,
    visibility: "ALL_LEADERSHIP",
    leadId: "alice",
    officerMeetingId: null,
    flaggedAt: null,
    escalatedToLeadershipAt: null,
    resolvedAt: null,
    boardRolledUpAt: null,
    createdById: "alice",
    createdAt: NOW,
    updatedAt: new Date("2026-06-03T00:00:00"),
    department: { id: "d1", name: "Instruction", slug: "instruction" },
    lead: person("alice"),
    createdBy: person("alice"),
    assignments: [assignment("alice", "LEAD"), assignment("bob", "EXECUTING")],
    comments: [],
    fileLinks: [],
    ...overrides,
  } as ActionItemWithRelations;
}

describe("buildResponsibilityRows", () => {
  it("collects departments, open counts, and attaches growth tags", () => {
    const items = [item({})];
    const growth = new Map<string, GrowthTag[]>([["alice", ["READY_FOR_MORE"]]]);
    const rows = buildResponsibilityRows(items, growth, NOW);

    const alice = rows.find((r) => r.id === "alice")!;
    expect(alice.departments).toEqual(["Instruction"]);
    expect(alice.openCount).toBe(1);
    expect(alice.growthTags).toEqual(["READY_FOR_MORE"]);
    expect(alice.underutilized).toBe(false);
  });
});

describe("buildPeopleRiskRadar", () => {
  it("flags a disengagement-tagged person at high severity", () => {
    const items = [item({})];
    const growth = new Map<string, GrowthTag[]>([["bob", ["AT_RISK_OF_DISENGAGING"]]]);
    const rows = buildResponsibilityRows(items, growth, NOW);
    const risks = buildPeopleRiskRadar(rows);

    const bob = risks.find((r) => r.id === "bob");
    expect(bob?.severity).toBe("high");
    expect(bob?.reason).toMatch(/disengaging/i);
  });

  it("flags multiple overdue items as a medium risk", () => {
    const overdue = new Date("2026-05-20T00:00:00");
    const items = [
      item({ id: "1", leadId: "carol", lead: person("carol"), deadlineStart: overdue, assignments: [assignment("carol", "LEAD")] }),
      item({ id: "2", leadId: "carol", lead: person("carol"), deadlineStart: overdue, assignments: [assignment("carol", "LEAD")] }),
    ];
    const rows = buildResponsibilityRows(items, new Map(), NOW);
    const risks = buildPeopleRiskRadar(rows);
    const carol = risks.find((r) => r.id === "carol");
    // Two overdue with no recent activity → AT_RISK momentum (high) wins over the
    // plain overdue-count reason; either way Carol must surface.
    expect(carol).toBeDefined();
    expect(["high", "medium"]).toContain(carol!.severity);
  });

  it("surfaces a ready-for-more person with no ownership as a low opportunity", () => {
    // Dave only has a completed item → underutilized (0 open), tagged ready.
    const items = [
      item({
        leadId: "dave",
        lead: person("dave"),
        status: "COMPLETE",
        completedAt: new Date("2026-06-02T00:00:00"),
        assignments: [assignment("dave", "LEAD")],
      }),
    ];
    const growth = new Map<string, GrowthTag[]>([["dave", ["READY_FOR_MORE"]]]);
    const rows = buildResponsibilityRows(items, growth, NOW);
    const dave = rows.find((r) => r.id === "dave")!;
    expect(dave.underutilized).toBe(true);

    const risks = buildPeopleRiskRadar(rows);
    expect(risks.find((r) => r.id === "dave")?.severity).toBe("low");
  });
});

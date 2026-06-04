import { describe, expect, it } from "vitest";

import type { ActionItemWithRelations } from "@/lib/people-strategy/action-queries";
import {
  buildAttentionQueue,
  buildPersonMomentum,
  buildTeamMomentum,
  buildWeeklyPulse,
  buildWinLog,
  daysOverdue,
} from "@/lib/people-strategy/command-center-selectors";

// Thursday of the operating week starting Mon Jun 1 2026.
const NOW = new Date("2026-06-04T12:00:00");

type Assignment = ActionItemWithRelations["assignments"][number];

function person(id: string) {
  return { id, name: id, email: `${id}@x.org`, primaryRole: "ADMIN", profile: null };
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
    deadlineStart: new Date("2026-06-10T00:00:00"),
    deadlineEnd: null,
    visibility: "ALL_LEADERSHIP",
    leadId: "alice",
    officerMeetingId: null,
    flaggedAt: null,
    escalatedToCpoAt: null,
    resolvedAt: null,
    boardRolledUpAt: null,
    createdById: "alice",
    createdAt: new Date("2026-05-01T00:00:00"),
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

describe("daysOverdue", () => {
  it("is positive when past due, zero otherwise", () => {
    expect(daysOverdue(item({ deadlineStart: new Date("2026-05-25T00:00:00") }), NOW)).toBe(10);
    expect(daysOverdue(item({ deadlineStart: new Date("2026-06-10T00:00:00") }), NOW)).toBe(0);
  });
});

describe("buildWeeklyPulse", () => {
  it("counts open, overdue, completed-this-week, and unowned", () => {
    const items = [
      item({ deadlineStart: new Date("2026-05-25T00:00:00") }), // overdue, has executor
      item({ status: "COMPLETE", updatedAt: new Date("2026-06-02T00:00:00") }), // win this week
      item({ assignments: [assignment("alice", "LEAD")] }), // open, no executor
    ];
    const pulse = buildWeeklyPulse(items, NOW);
    expect(pulse.openTotal).toBe(2);
    expect(pulse.overdue).toBe(1);
    expect(pulse.completedThisWeek).toBe(1);
    expect(pulse.unowned).toBe(1);
  });
});

describe("buildAttentionQueue", () => {
  it("surfaces the most urgent reason and sorts high severity first", () => {
    const items = [
      item({ title: "Stale", updatedAt: new Date("2026-05-01T00:00:00"), comments: [] }), // 30+ days stale
      item({ title: "Way overdue", deadlineStart: new Date("2026-05-20T00:00:00") }), // 15 days overdue
      item({ title: "Flagged", flaggedAt: new Date("2026-06-02T00:00:00") }),
    ];
    const queue = buildAttentionQueue(items, NOW);
    expect(queue[0].title).toBe("Way overdue");
    expect(queue[0].severity).toBe("high");
    expect(queue.map((q) => q.title)).toContain("Flagged");
    expect(queue.find((q) => q.title === "Stale")?.reason).toMatch(/No activity/);
  });

  it("excludes completed items", () => {
    const items = [item({ status: "COMPLETE", deadlineStart: new Date("2026-05-01T00:00:00") })];
    expect(buildAttentionQueue(items, NOW)).toHaveLength(0);
  });
});

describe("buildPersonMomentum", () => {
  it("credits owners for completions and penalizes overdue", () => {
    const items = [
      item({ leadId: "alice", lead: person("alice"), status: "COMPLETE", updatedAt: new Date("2026-06-02T00:00:00"), assignments: [assignment("alice", "LEAD")] }),
      item({ leadId: "carol", lead: person("carol"), deadlineStart: new Date("2026-05-20T00:00:00"), assignments: [assignment("carol", "LEAD")] }),
    ];
    const people = buildPersonMomentum(items, NOW);
    const alice = people.find((p) => p.id === "alice")!;
    const carol = people.find((p) => p.id === "carol")!;
    expect(alice.momentum.factors.completedRecent).toBe(1);
    expect(carol.momentum.factors.overdue).toBe(1);
    // Carol (overdue) sorts before Alice (completion) — most concerning first.
    expect(people[0].id).toBe("carol");
  });
});

describe("buildTeamMomentum and buildWinLog", () => {
  it("aggregates risk per department and lists weekly wins", () => {
    const items = [
      item({ deadlineStart: new Date("2026-05-20T00:00:00") }), // Instruction, overdue
      item({ status: "COMPLETE", updatedAt: new Date("2026-06-03T00:00:00"), title: "Shipped" }),
    ];
    const teams = buildTeamMomentum(items, NOW);
    expect(teams[0].name).toBe("Instruction");
    expect(teams[0].overdue).toBe(1);

    const wins = buildWinLog(items, NOW);
    expect(wins).toHaveLength(1);
    expect(wins[0].title).toBe("Shipped");
  });
});

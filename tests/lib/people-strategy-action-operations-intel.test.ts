import { describe, expect, it } from "vitest";

import type { ActionItemWithRelations } from "@/lib/people-strategy/action-queries";
import {
  deriveActionAccountabilitySummary,
  deriveCommandCenterActionQueue,
  deriveEntityActionPanel,
  deriveMeetingDecisionsWithoutActions,
  deriveMeetingFollowUpPack,
  deriveWeeklyActionReview,
  mondayOf,
  type DecisionLite,
} from "@/lib/people-strategy/action-operations-intel";

const NOW = new Date("2026-06-09T12:00:00"); // Tuesday

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
    title: "Confirm the venue contract for camp",
    description: null,
    goalCategory: null,
    departmentId: "d1",
    status: "IN_PROGRESS",
    priority: "MEDIUM",
    deadlineStart: new Date("2026-06-12T00:00:00"),
    deadlineEnd: null,
    completedAt: null,
    visibility: "ALL_LEADERSHIP",
    leadId: "alice",
    flaggedAt: null,
    escalatedToLeadershipAt: null,
    resolvedAt: null,
    boardRolledUpAt: null,
    createdById: "alice",
    createdAt: new Date("2026-05-01T00:00:00"),
    updatedAt: new Date("2026-06-08T00:00:00"),
    sourceType: null,
    sourceId: null,
    sourceActionId: null,
    strategicInitiativeId: null,
    strategicProjectId: null,
    successDefinition: "Signed",
    blockedReason: null,
    completionNote: null,
    completionOutcome: null,
    nextFollowUpAt: null,
    department: { id: "d1", name: "Instruction", slug: "instruction" },
    lead: person("alice"),
    createdBy: person("alice"),
    assignments: [assignment("alice", "LEAD"), assignment("bob", "EXECUTING")],
    comments: [],
    fileLinks: [],
    ...overrides,
  } as ActionItemWithRelations;
}
function decision(id: string, linkedActionId: string | null): DecisionLite {
  return { id, decision: `Decision ${id}`, linkedActionId };
}

describe("mondayOf", () => {
  it("returns Monday 00:00 of the week", () => {
    expect(mondayOf(NOW).toISOString().slice(0, 10)).toBe("2026-06-08");
  });
});

describe("deriveMeetingDecisionsWithoutActions", () => {
  it("returns only decisions with no linked action", () => {
    const out = deriveMeetingDecisionsWithoutActions([
      decision("a", null),
      decision("b", "act_1"),
      decision("c", null),
    ]);
    expect(out.map((d) => d.id)).toEqual(["a", "c"]);
  });
});

describe("deriveMeetingFollowUpPack", () => {
  it("splits open / overdue / recently completed and detects clear", () => {
    const pack = deriveMeetingFollowUpPack(
      {
        decisions: [decision("d1", null), decision("d2", "act_done")],
        actions: [
          item({ id: "open", status: "IN_PROGRESS" }),
          item({ id: "overdue", deadlineStart: new Date("2026-06-01T00:00:00") }),
          item({ id: "done", status: "COMPLETE", completedAt: new Date("2026-06-06T00:00:00") }),
        ],
      },
      NOW
    );
    expect(pack.decisionsWithoutActions.map((d) => d.id)).toEqual(["d1"]);
    expect(pack.openActions.map((a) => a.id).sort()).toEqual(["open", "overdue"]);
    expect(pack.overdueActions.map((a) => a.id)).toEqual(["overdue"]);
    expect(pack.recentlyCompleted.map((a) => a.id)).toEqual(["done"]);
    expect(pack.isClear).toBe(false);
  });

  it("is clear when nothing is pending", () => {
    const pack = deriveMeetingFollowUpPack(
      { decisions: [decision("d", "act")], actions: [item({ status: "COMPLETE", completedAt: new Date("2026-06-06T00:00:00") })] },
      NOW
    );
    expect(pack.isClear).toBe(true);
  });
});

describe("deriveWeeklyActionReview", () => {
  it("summarizes the action week", () => {
    const review = deriveWeeklyActionReview(
      [
        item({ id: "won", status: "COMPLETE", completedAt: new Date("2026-06-08T12:00:00") }),
        item({ id: "overdue", deadlineStart: new Date("2026-06-01T00:00:00") }),
        item({ id: "newThisWeek", createdAt: new Date("2026-06-09T09:00:00") }),
        item({ id: "unowned", assignments: [assignment("alice", "LEAD")] }),
        item({ id: "blockedStale", status: "BLOCKED", updatedAt: new Date("2026-05-01T00:00:00"), blockedReason: "x" }),
      ],
      NOW
    );
    expect(review.completedThisWeek.map((a) => a.id)).toContain("won");
    expect(review.overdue.map((a) => a.id)).toContain("overdue");
    expect(review.createdThisWeek.map((a) => a.id)).toContain("newThisWeek");
    // The legacy meeting-source link is gone — no action can be "from a meeting".
    expect(review.fromMeetingsThisWeek.map((a) => a.id)).toEqual([]);
    expect(review.unowned.map((a) => a.id)).toContain("unowned");
    expect(review.blockedNeedingEscalation.map((a) => a.id)).toContain("blockedStale");
  });
});

describe("deriveActionAccountabilitySummary", () => {
  it("aggregates per-owner and sorts most-concerning first", () => {
    const rows = deriveActionAccountabilitySummary(
      [
        item({ leadId: "alice", lead: person("alice"), deadlineStart: new Date("2026-06-01T00:00:00") }), // overdue
        item({ leadId: "alice", lead: person("alice"), status: "BLOCKED" }),
        item({ leadId: "carol", lead: person("carol"), status: "IN_PROGRESS" }),
        item({ leadId: "dan", lead: person("dan"), status: "COMPLETE" }), // settled — excluded
      ],
      NOW
    );
    expect(rows[0].ownerId).toBe("alice");
    expect(rows[0].open).toBe(2);
    expect(rows[0].overdue).toBe(1);
    expect(rows[0].blocked).toBe(1);
    expect(rows.find((r) => r.ownerId === "dan")).toBeUndefined();
  });
});

describe("deriveCommandCenterActionQueue", () => {
  it("returns attention, accountability, blocked, and stranded decisions", () => {
    const q = deriveCommandCenterActionQueue(
      {
        items: [item({ id: "blocked", status: "BLOCKED" }), item({ id: "ok", deadlineStart: new Date("2026-07-30T00:00:00") })],
        decisions: [decision("d1", null), decision("d2", "act")],
      },
      NOW
    );
    expect(q.blocked.map((a) => a.id)).toEqual(["blocked"]);
    expect(q.attention[0].id).toBe("blocked");
    expect(q.decisionsWithoutActions.map((d) => d.id)).toEqual(["d1"]);
    expect(q.accountability.length).toBeGreaterThan(0);
  });
});

describe("deriveEntityActionPanel", () => {
  it("surfaces open/overdue/blocked, last completed, suggested next, stranded decisions", () => {
    const panel = deriveEntityActionPanel(
      {
        actions: [
          item({ id: "blocked", status: "BLOCKED" }),
          item({ id: "soon", deadlineStart: new Date("2026-06-11T00:00:00") }),
          item({ id: "done", status: "COMPLETE", completedAt: new Date("2026-06-05T00:00:00") }),
        ],
        decisions: [decision("d1", null)],
      },
      NOW
    );
    expect(panel.open.map((a) => a.id).sort()).toEqual(["blocked", "soon"]);
    expect(panel.blocked.map((a) => a.id)).toEqual(["blocked"]);
    expect(panel.lastCompleted?.id).toBe("done");
    expect(panel.suggestedNext?.action.id).toBe("blocked"); // highest attention
    expect(panel.suggestedNext?.move.kind).toBe("escalate");
    expect(panel.decisionsWithoutActions.map((d) => d.id)).toEqual(["d1"]);
    expect(panel.isClear).toBe(false);
  });

  it("reads clear when there is no live work", () => {
    const panel = deriveEntityActionPanel(
      { actions: [item({ status: "COMPLETE", completedAt: new Date("2026-06-05T00:00:00") })], decisions: [] },
      NOW
    );
    expect(panel.isClear).toBe(true);
    expect(panel.suggestedNext).toBeNull();
  });
});

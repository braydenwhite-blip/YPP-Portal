import { describe, expect, it } from "vitest";

import type { ActionItemWithRelations } from "@/lib/people-strategy/action-queries";
import {
  actionToQualityInput,
  deriveActionFastestWins,
  deriveActionInboxGroups,
  deriveActionNextMove,
  deriveActionQualityLabels,
  deriveActionQualityWarnings,
  deriveActionSourceGroups,
  deriveActionStaleGroup,
  deriveActionUrgency,
  isVagueTitle,
  rankActionAttention,
} from "@/lib/people-strategy/action-intel";

const NOW = new Date("2026-06-09T12:00:00");

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
    successDefinition: "Signed contract on file",
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

describe("deriveActionUrgency", () => {
  it("settles complete/dropped", () => {
    expect(deriveActionUrgency(item({ status: "COMPLETE" }), NOW).level).toBe("settled");
    expect(deriveActionUrgency(item({ status: "DROPPED" }), NOW).level).toBe("settled");
  });
  it("flags overdue with day count", () => {
    const u = deriveActionUrgency(item({ deadlineStart: new Date("2026-06-04T00:00:00") }), NOW);
    expect(u.level).toBe("overdue");
    expect(u.daysOverdue).toBe(5);
  });
  it("classifies today / soon / scheduled", () => {
    expect(deriveActionUrgency(item({ deadlineStart: new Date("2026-06-09T00:00:00") }), NOW).level).toBe("due_today");
    expect(deriveActionUrgency(item({ deadlineStart: new Date("2026-06-13T00:00:00") }), NOW).level).toBe("due_soon");
    expect(deriveActionUrgency(item({ deadlineStart: new Date("2026-07-30T00:00:00") }), NOW).level).toBe("scheduled");
  });
});

describe("isVagueTitle", () => {
  it("flags empty, single-word, short, and generic titles", () => {
    expect(isVagueTitle("")).toBe(true);
    expect(isVagueTitle("Follow up")).toBe(true);
    expect(isVagueTitle("task")).toBe(true);
    expect(isVagueTitle("Sync")).toBe(true);
    expect(isVagueTitle("Email the Beth El site coordinator")).toBe(false);
  });
});

describe("deriveActionQualityWarnings", () => {
  const base = {
    title: "Email the Beth El site coordinator",
    hasOwner: true,
    hasDueDate: true,
    successDefinition: "Reply received",
    status: "IN_PROGRESS",
    hasStrategicLink: true,
  };
  it("returns no warnings for a strong action", () => {
    expect(deriveActionQualityWarnings(base)).toHaveLength(0);
  });
  it("warns on missing owner and due date (high)", () => {
    const w = deriveActionQualityWarnings({ ...base, hasOwner: false, hasDueDate: false });
    const codes = w.map((x) => x.code);
    expect(codes).toContain("NEEDS_OWNER");
    expect(codes).toContain("NEEDS_DUE_DATE");
    expect(w[0].severity).toBe("high");
  });
  it("warns blocked-without-reason and missing success definition", () => {
    const w = deriveActionQualityWarnings({ ...base, status: "BLOCKED", successDefinition: "" });
    const codes = w.map((x) => x.code);
    expect(codes).toContain("BLOCKED_NO_REASON");
    expect(codes).toContain("DEFINE_DONE");
  });
  it("warns strategic source but no link", () => {
    const w = deriveActionQualityWarnings({ ...base, sourceType: "PROJECT", hasStrategicLink: false });
    expect(w.map((x) => x.code)).toContain("STRATEGIC_UNLINKED");
  });
  it("warns follow-up without a follow-up date", () => {
    const w = deriveActionQualityWarnings({ ...base, sourceType: "FOLLOW_UP", nextFollowUpAt: null });
    expect(w.map((x) => x.code)).toContain("NEEDS_FOLLOWUP_DATE");
  });
  it("does not nag a completed/dropped draft about owner/due", () => {
    const w = deriveActionQualityWarnings({ ...base, status: "COMPLETE", hasOwner: false, hasDueDate: false, completionNote: "done" });
    const codes = w.map((x) => x.code);
    expect(codes).not.toContain("NEEDS_OWNER");
    expect(codes).not.toContain("NEEDS_DUE_DATE");
  });
});

describe("actionToQualityInput", () => {
  it("derives owner from an EXECUTING assignment and link from the registry", () => {
    const q = actionToQualityInput(item({ strategicProjectId: "beth-el-pilot" }), NOW);
    expect(q.hasOwner).toBe(true);
    expect(q.hasStrategicLink).toBe(true);
  });
  it("treats lead-only (no executor) as unowned", () => {
    const q = actionToQualityInput(item({ assignments: [assignment("alice", "LEAD")] }), NOW);
    expect(q.hasOwner).toBe(false);
  });
});

describe("deriveActionQualityLabels", () => {
  it("earns 'strong action' when clean and not started", () => {
    const labels = deriveActionQualityLabels(item({ status: "NOT_STARTED" }), NOW);
    expect(labels[0].key).toBe("strong");
  });
  it("reads 'ready to close' when clean and in progress", () => {
    const labels = deriveActionQualityLabels(item({ status: "IN_PROGRESS" }), NOW);
    expect(labels[0].key).toBe("ready_to_close");
  });
  it("surfaces overdue", () => {
    const labels = deriveActionQualityLabels(item({ deadlineStart: new Date("2026-06-01T00:00:00") }), NOW);
    expect(labels.map((l) => l.key)).toContain("overdue");
  });
  it("escalates a blocked + stale action", () => {
    const labels = deriveActionQualityLabels(
      item({ status: "BLOCKED", updatedAt: new Date("2026-05-01T00:00:00"), blockedReason: "vendor" }),
      NOW
    );
    expect(labels.map((l) => l.key)).toContain("blocked_escalate");
  });
});

describe("deriveActionNextMove", () => {
  it("escalates a blocked action", () => {
    expect(deriveActionNextMove(item({ status: "BLOCKED" }), NOW).kind).toBe("escalate");
  });
  it("reschedules an overdue action", () => {
    expect(deriveActionNextMove(item({ deadlineStart: new Date("2026-06-01T00:00:00") }), NOW).kind).toBe("reschedule");
  });
  it("assigns when unowned", () => {
    expect(deriveActionNextMove(item({ assignments: [assignment("alice", "LEAD")] }), NOW).kind).toBe("assign");
  });
  it("asks to define done when no success definition", () => {
    expect(deriveActionNextMove(item({ successDefinition: null }), NOW).kind).toBe("define");
  });
  it("asks to start a not-started action", () => {
    expect(deriveActionNextMove(item({ status: "NOT_STARTED" }), NOW).kind).toBe("start");
  });
  it("asks to capture the outcome on an undocumented completion", () => {
    expect(deriveActionNextMove(item({ status: "COMPLETE", completionNote: null }), NOW).kind).toBe("capture_outcome");
  });
});

describe("rankActionAttention", () => {
  it("enriches the attention queue with source + next move, severity-sorted", () => {
    const ranked = rankActionAttention(
      [
        item({ id: "ok", status: "IN_PROGRESS", deadlineStart: new Date("2026-07-30T00:00:00") }),
        item({ id: "blocked", status: "BLOCKED" }),
        item({ id: "overdue", deadlineStart: new Date("2026-05-20T00:00:00") }),
      ],
      NOW
    );
    expect(ranked.find((r) => r.id === "ok")).toBeUndefined(); // calm item excluded
    expect(ranked[0].severity).toBe("high");
    expect(ranked[0].nextMove).toBeTruthy();
    expect(typeof ranked[0].sourceLabel).toBe("string");
  });
});

describe("deriveActionInboxGroups", () => {
  it("produces non-empty operational groups and drops empties", () => {
    const groups = deriveActionInboxGroups(
      [
        item({ id: "blocked", status: "BLOCKED" }),
        item({ id: "unowned", assignments: [assignment("alice", "LEAD")] }),
        item({ id: "soon", status: "IN_PROGRESS", deadlineStart: new Date("2026-06-11T00:00:00") }),
        item({ id: "stale", updatedAt: new Date("2026-05-01T00:00:00") }),
      ],
      NOW
    );
    const keys = groups.map((g) => g.key);
    expect(keys).toContain("blocked");
    expect(keys).toContain("unowned");
    expect(keys).toContain("stale");
    // every returned group is non-empty
    expect(groups.every((g) => g.items.length > 0)).toBe(true);
  });
});

describe("deriveActionFastestWins", () => {
  it("selects small, owned, unblocked, due-soon, not-overdue actions", () => {
    const wins = deriveActionFastestWins(
      [
        item({ id: "win", status: "NOT_STARTED", deadlineStart: new Date("2026-06-11T00:00:00") }),
        item({ id: "overdue", deadlineStart: new Date("2026-06-01T00:00:00") }),
        item({ id: "blocked", status: "BLOCKED", deadlineStart: new Date("2026-06-11T00:00:00") }),
        item({ id: "unowned", assignments: [assignment("alice", "LEAD")], deadlineStart: new Date("2026-06-11T00:00:00") }),
      ],
      NOW
    );
    expect(wins.map((w) => w.id)).toEqual(["win"]);
  });
});

describe("deriveActionStaleGroup", () => {
  it("returns open actions idle 14+ days, most stale first", () => {
    const stale = deriveActionStaleGroup(
      [
        item({ id: "fresh", updatedAt: new Date("2026-06-08T00:00:00") }),
        item({ id: "old", updatedAt: new Date("2026-05-01T00:00:00") }),
        item({ id: "older", updatedAt: new Date("2026-04-01T00:00:00") }),
        item({ id: "done", status: "COMPLETE", updatedAt: new Date("2026-04-01T00:00:00") }),
      ],
      NOW
    );
    expect(stale.map((s) => s.id)).toEqual(["older", "old"]);
  });
});

describe("deriveActionSourceGroups", () => {
  it("groups by explicit/inferred source in a stable order", () => {
    const groups = deriveActionSourceGroups([
      item({ id: "m", sourceType: "MEETING" }), // explicit MEETING
      item({ id: "p", sourceType: "PROJECT" }), // explicit PROJECT
      item({ id: "man" }), // MANUAL
    ]);
    expect(groups.map((g) => g.sourceType)).toEqual(["MEETING", "PROJECT", "MANUAL"]);
  });
});

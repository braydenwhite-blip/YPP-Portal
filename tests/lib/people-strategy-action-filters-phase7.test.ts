import { describe, expect, it } from "vitest";

import type { ActionItemWithRelations } from "@/lib/people-strategy/action-queries";
import {
  ACTION_FILTER_DEFAULTS,
  applyActionFilters,
  effectiveStatus,
  smartBucket,
  type ActionFilters,
} from "@/lib/people-strategy/action-filters";

const NOW = new Date("2026-06-04T12:00:00");

type Comment = ActionItemWithRelations["comments"][number];

function comment(type: Comment["type"]): Comment {
  return { id: `c-${type}`, body: "ask", type, createdAt: NOW, author: null } as Comment;
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
    updatedAt: NOW,
    department: { id: "d1", name: "Instruction", slug: "instruction" },
    lead: null,
    createdBy: null,
    assignments: [],
    comments: [],
    fileLinks: [],
    ...overrides,
  } as ActionItemWithRelations;
}

function filters(overrides: Partial<ActionFilters>): ActionFilters {
  return { ...ACTION_FILTER_DEFAULTS, ...overrides };
}

describe("effectiveStatus with Phase 7 buckets", () => {
  it("preserves DROPPED and BLOCKED over a computed overdue", () => {
    const pastDue = new Date("2026-05-20T00:00:00");
    expect(effectiveStatus(item({ status: "DROPPED", deadlineStart: pastDue }), NOW)).toBe("DROPPED");
    expect(effectiveStatus(item({ status: "BLOCKED", deadlineStart: pastDue }), NOW)).toBe("BLOCKED");
    expect(effectiveStatus(item({ status: "IN_PROGRESS", deadlineStart: pastDue }), NOW)).toBe("OVERDUE");
  });
});

describe("smartBucket", () => {
  it("derives NEEDS_DECISION, WAITING, and the settled buckets", () => {
    expect(smartBucket(item({ flaggedAt: NOW }), NOW)).toBe("NEEDS_DECISION");
    expect(smartBucket(item({ comments: [comment("INPUT_REQUESTED")] }), NOW)).toBe("WAITING");
    expect(smartBucket(item({ status: "BLOCKED" }), NOW)).toBe("BLOCKED");
    expect(smartBucket(item({ status: "DROPPED" }), NOW)).toBe("DROPPED");
    expect(smartBucket(item({ status: "COMPLETE" }), NOW)).toBe("COMPLETE");
    expect(smartBucket(item({ status: "NOT_STARTED" }), NOW)).toBe("NOT_STARTED");
  });

  it("a resolved flag is no longer NEEDS_DECISION", () => {
    expect(smartBucket(item({ flaggedAt: NOW, resolvedAt: NOW }), NOW)).not.toBe("NEEDS_DECISION");
  });
});

describe("priority filter + sort", () => {
  const items = [
    item({ title: "Low", priority: "LOW", deadlineStart: new Date("2026-06-08T00:00:00") }),
    item({ title: "Urgent", priority: "URGENT", deadlineStart: new Date("2026-06-20T00:00:00") }),
    item({ title: "High", priority: "HIGH", deadlineStart: new Date("2026-06-12T00:00:00") }),
  ];

  it("filters to a single priority", () => {
    const out = applyActionFilters(items, filters({ priority: "URGENT" }), NOW);
    expect(out.map((i) => i.title)).toEqual(["Urgent"]);
  });

  it("sorts by priority desc, ignoring deadline order", () => {
    const out = applyActionFilters(items, filters({ sort: "priority_desc" }), NOW);
    expect(out.map((i) => i.title)).toEqual(["Urgent", "High", "Low"]);
  });
});

import { describe, expect, it } from "vitest";

import type { ActionItemWithRelations } from "@/lib/people-strategy/action-queries";
import { addDays } from "@/lib/leadership-action-center/dates";
import {
  bucketByUrgency,
  effectiveDeadline,
  isActionOverdue,
  latestInputRequest,
  needsViewerInput,
  selectExecuting,
  selectNeedsInput,
  sortByDeadline,
  summarizeMyActions,
} from "@/lib/people-strategy/my-actions-selectors";

const NOW = new Date("2026-06-01T12:00:00Z");

type Assignment = ActionItemWithRelations["assignments"][number];
type Comment = ActionItemWithRelations["comments"][number];

function person(id: string) {
  return { id, name: id, email: `${id}@x.org`, primaryRole: "ADMIN", profile: null };
}

function assignment(userId: string, role: Assignment["role"]): Assignment {
  return { id: `${userId}-${role}`, role, createdAt: NOW, user: person(userId) } as Assignment;
}

function comment(authorId: string, type: Comment["type"], body = "ask"): Comment {
  return { id: `c-${authorId}`, body, type, createdAt: NOW, author: person(authorId) } as Comment;
}

function item(overrides: Partial<ActionItemWithRelations>): ActionItemWithRelations {
  return {
    id: "i",
    title: "Item",
    description: null,
    goalCategory: "x",
    departmentId: "d",
    status: "IN_PROGRESS",
    deadlineStart: new Date("2026-06-10T00:00:00Z"),
    deadlineEnd: null,
    visibility: "ALL_LEADERSHIP",
    leadId: null,
    flaggedAt: null,
    createdById: null,
    createdAt: NOW,
    updatedAt: NOW,
    department: { id: "d", name: "Instruction", slug: "instruction" },
    lead: person("lead"),
    createdBy: person("lead"),
    assignments: [],
    comments: [],
    fileLinks: [],
    ...overrides,
  } as ActionItemWithRelations;
}

describe("my-actions selectors", () => {
  it("effectiveDeadline prefers deadlineEnd over deadlineStart", () => {
    const end = new Date("2026-07-01T00:00:00Z");
    expect(effectiveDeadline(item({ deadlineEnd: end })).getTime()).toBe(end.getTime());
    const start = new Date("2026-06-15T00:00:00Z");
    expect(effectiveDeadline(item({ deadlineStart: start, deadlineEnd: null })).getTime()).toBe(
      start.getTime()
    );
  });

  it("flags overdue by status and by past deadline, never when complete", () => {
    expect(isActionOverdue(item({ status: "OVERDUE" }), NOW)).toBe(true);
    expect(
      isActionOverdue(item({ status: "NOT_STARTED", deadlineStart: new Date("2026-05-01") }), NOW)
    ).toBe(true);
    expect(
      isActionOverdue(item({ status: "COMPLETE", deadlineStart: new Date("2026-05-01") }), NOW)
    ).toBe(false);
    expect(
      isActionOverdue(item({ status: "IN_PROGRESS", deadlineStart: new Date("2026-06-20") }), NOW)
    ).toBe(false);
  });

  it("needsViewerInput: INPUT assignee, but not the lead who authored the request", () => {
    const onboarding = item({
      leadId: "brayden",
      assignments: [
        assignment("brayden", "LEAD"),
        assignment("brayden", "EXECUTING"),
        assignment("anthea", "INPUT"),
      ],
      comments: [comment("brayden", "INPUT_REQUESTED")],
    });
    expect(needsViewerInput(onboarding, "anthea")).toBe(true);
    expect(needsViewerInput(onboarding, "brayden")).toBe(false);
    expect(latestInputRequest(onboarding, "anthea")?.author.id).toBe("brayden");
    expect(latestInputRequest(onboarding, "brayden")).toBeNull();
  });

  it("sorts by deadline ascending", () => {
    const a = item({ id: "a", deadlineStart: new Date("2026-06-20") });
    const b = item({ id: "b", deadlineStart: new Date("2026-06-05") });
    expect(sortByDeadline([a, b]).map((i) => i.id)).toEqual(["b", "a"]);
  });

  it("summarizes the seeded Brayden + Anthea scenarios", () => {
    const onboarding = item({
      id: "onboarding",
      status: "IN_PROGRESS",
      deadlineStart: new Date("2026-05-30"),
      deadlineEnd: new Date("2026-06-13"),
      leadId: "brayden",
      assignments: [
        assignment("brayden", "LEAD"),
        assignment("brayden", "EXECUTING"),
        assignment("anthea", "INPUT"),
      ],
      comments: [comment("brayden", "INPUT_REQUESTED")],
    });
    const succession = item({
      id: "succession",
      status: "NOT_STARTED",
      visibility: "OFFICERS_ONLY",
      deadlineStart: new Date("2026-06-06"),
      deadlineEnd: new Date("2026-06-21"),
      leadId: "brayden",
      assignments: [
        assignment("brayden", "LEAD"),
        assignment("anthea", "EXECUTING"),
        assignment("carly", "INPUT"),
      ],
    });
    const marketing = item({
      id: "marketing",
      status: "OVERDUE",
      deadlineStart: new Date("2026-05-18"),
      deadlineEnd: new Date("2026-05-29"),
      leadId: "anthea",
      assignments: [assignment("anthea", "LEAD"), assignment("carly", "EXECUTING")],
    });

    const brayden = summarizeMyActions([onboarding, succession], "brayden", NOW);
    expect(brayden.overdue).toBe(0);
    expect(brayden.inProgress).toBe(1);
    expect(brayden.executing).toBe(1);
    expect(brayden.needsInput).toBe(0);

    const anthea = summarizeMyActions([onboarding, succession, marketing], "anthea", NOW);
    expect(anthea.overdue).toBe(1);
    expect(anthea.executing).toBe(1);
    expect(anthea.needsInput).toBe(1);
    expect(selectExecuting([onboarding, succession, marketing], "anthea").map((i) => i.id)).toEqual([
      "succession",
    ]);
    expect(selectNeedsInput([onboarding, succession, marketing], "anthea").map((i) => i.id)).toEqual([
      "onboarding",
    ]);
  });
});

describe("bucketByUrgency", () => {
  // Deadlines are derived from NOW via addDays so the day-bucket maths is
  // timezone-independent (both sides go through the same startOfDay).
  it("groups open actions into overdue / today / this week / later", () => {
    const items = [
      item({ id: "od", deadlineStart: addDays(NOW, -10), deadlineEnd: null }),
      item({ id: "today", deadlineStart: NOW, deadlineEnd: null }),
      item({ id: "soon", deadlineStart: addDays(NOW, 3), deadlineEnd: null }),
      item({ id: "far", deadlineStart: addDays(NOW, 30), deadlineEnd: null }),
    ];
    const b = bucketByUrgency(items, NOW);
    expect(b.overdue.map((i) => i.id)).toEqual(["od"]);
    expect(b.today.map((i) => i.id)).toEqual(["today"]);
    expect(b.thisWeek.map((i) => i.id)).toEqual(["soon"]);
    expect(b.later.map((i) => i.id)).toEqual(["far"]);
  });

  it("excludes settled (complete / dropped) actions", () => {
    const items = [
      item({ id: "done", status: "COMPLETE", deadlineStart: addDays(NOW, -2), deadlineEnd: null }),
      item({ id: "dropped", status: "DROPPED", deadlineStart: addDays(NOW, -2), deadlineEnd: null }),
      item({ id: "open", status: "IN_PROGRESS", deadlineStart: addDays(NOW, 2), deadlineEnd: null }),
    ];
    const b = bucketByUrgency(items, NOW);
    const all = [...b.overdue, ...b.today, ...b.thisWeek, ...b.later].map((i) => i.id);
    expect(all).toEqual(["open"]);
  });

  it("sorts within a bucket by soonest deadline", () => {
    const items = [
      item({ id: "b", deadlineStart: addDays(NOW, 5), deadlineEnd: null }),
      item({ id: "a", deadlineStart: addDays(NOW, 2), deadlineEnd: null }),
    ];
    expect(bucketByUrgency(items, NOW).thisWeek.map((i) => i.id)).toEqual(["a", "b"]);
  });
});

import { describe, expect, it } from "vitest";

import { addDays } from "@/lib/leadership-action-center/dates";
import {
  attentionReason,
  buildActionOperatingBoard,
  buildActionPulseStrip,
  isWaitingTooLong,
  selectNeedsAttention,
  viewerIsInvolved,
} from "@/lib/people-strategy/action-operating-board";

import { NOW, actionItem, assignment } from "./people-strategy-action-fixtures";

const owned = {
  leadId: "lead-1",
  assignments: [assignment("lead-1", "LEAD"), assignment("owner-1", "EXECUTING")],
};

describe("buildActionPulseStrip — the compact factual strip", () => {
  it("counts overdue, due this week, blocked, unassigned, completed this week", () => {
    const items = [
      // overdue (prior week so it never double-counts as due-this-week)
      actionItem({ id: "a", status: "IN_PROGRESS", deadlineStart: addDays(NOW, -10), ...owned }),
      // due this week (due today)
      actionItem({ id: "b", status: "IN_PROGRESS", deadlineStart: NOW, ...owned }),
      // blocked, well in the future
      actionItem({ id: "c", status: "BLOCKED", deadlineStart: addDays(NOW, 20), ...owned }),
      // unassigned
      actionItem({
        id: "d",
        status: "NOT_STARTED",
        deadlineStart: addDays(NOW, 20),
        leadId: null,
        assignments: [],
      }),
      // completed this week
      actionItem({ id: "e", status: "COMPLETE", completedAt: NOW, ...owned }),
    ];

    const strip = buildActionPulseStrip(items, NOW);
    const byKey = Object.fromEntries(strip.map((s) => [s.key, s.count]));

    expect(strip.map((s) => s.key)).toEqual([
      "overdue",
      "dueThisWeek",
      "blocked",
      "unassigned",
      "completedThisWeek",
    ]);
    expect(byKey.overdue).toBe(1);
    expect(byKey.dueThisWeek).toBe(1);
    expect(byKey.blocked).toBe(1);
    expect(byKey.unassigned).toBe(1);
    expect(byKey.completedThisWeek).toBe(1);
  });

  it("labels the strip in plain English and links the actionable slices", () => {
    const strip = buildActionPulseStrip([], NOW);
    expect(strip.find((s) => s.key === "dueThisWeek")?.label).toBe("Due this week");
    expect(strip.find((s) => s.key === "overdue")?.href).toContain("preset=overdue");
    expect(strip.find((s) => s.key === "completedThisWeek")?.href).toBeNull();
  });
});

describe("selectNeedsAttention", () => {
  it("includes overdue, blocked, ownerless, deadline-less, and waiting-too-long", () => {
    const overdue = actionItem({ id: "overdue", deadlineStart: addDays(NOW, -2), ...owned });
    const blocked = actionItem({ id: "blocked", status: "BLOCKED", deadlineStart: addDays(NOW, 5), ...owned });
    const ownerless = actionItem({ id: "ownerless", leadId: null, assignments: [], deadlineStart: addDays(NOW, 5) });
    const noDeadline = actionItem({ id: "noDeadline", deadlineStart: null as never, ...owned });
    const stale = actionItem({
      id: "stale",
      deadlineStart: addDays(NOW, 5),
      updatedAt: addDays(NOW, -30),
      comments: [],
      ...owned,
    });
    const healthy = actionItem({ id: "healthy", deadlineStart: addDays(NOW, 5), ...owned });
    const done = actionItem({ id: "done", status: "COMPLETE", deadlineStart: addDays(NOW, -2) });

    const ids = selectNeedsAttention(
      [healthy, overdue, blocked, ownerless, noDeadline, stale, done],
      NOW
    ).map((i) => i.id);

    expect(ids).toContain("overdue");
    expect(ids).toContain("blocked");
    expect(ids).toContain("ownerless");
    expect(ids).toContain("noDeadline");
    expect(ids).toContain("stale");
    expect(ids).not.toContain("healthy");
    expect(ids).not.toContain("done");
  });

  it("sorts the most overdue first", () => {
    const a = actionItem({ id: "a", deadlineStart: addDays(NOW, -2), ...owned });
    const b = actionItem({ id: "b", deadlineStart: addDays(NOW, -9), ...owned });
    const sorted = selectNeedsAttention([a, b], NOW).map((i) => i.id);
    expect(sorted[0]).toBe("b");
  });
});

describe("attentionReason", () => {
  it("explains why an action needs attention, in plain English", () => {
    expect(attentionReason(actionItem({ deadlineStart: addDays(NOW, -1), ...owned }), NOW)).toBe(
      "1 day overdue"
    );
    expect(
      attentionReason(
        actionItem({ status: "BLOCKED", blockedReason: "vendor", deadlineStart: addDays(NOW, 5), ...owned }),
        NOW
      )
    ).toBe("Blocked — vendor");
    expect(
      attentionReason(actionItem({ leadId: null, assignments: [], deadlineStart: addDays(NOW, 5) }), NOW)
    ).toBe("No owner yet");
    expect(attentionReason(actionItem({ deadlineStart: null as never, ...owned }), NOW)).toBe(
      "No deadline set"
    );
    expect(attentionReason(actionItem({ status: "COMPLETE" }), NOW)).toBeNull();
  });
});

describe("isWaitingTooLong / viewerIsInvolved", () => {
  it("flags open work untouched for a fortnight", () => {
    expect(isWaitingTooLong(actionItem({ updatedAt: addDays(NOW, -30), comments: [] }), NOW)).toBe(true);
    expect(isWaitingTooLong(actionItem({ updatedAt: NOW }), NOW)).toBe(false);
    expect(
      isWaitingTooLong(actionItem({ status: "COMPLETE", updatedAt: addDays(NOW, -30) }), NOW)
    ).toBe(false);
  });

  it("knows when the viewer leads, executes, or owes input", () => {
    expect(viewerIsInvolved(actionItem({ leadId: "me", assignments: [] }), "me")).toBe(true);
    expect(
      viewerIsInvolved(actionItem({ leadId: "x", assignments: [assignment("me", "INPUT")] }), "me")
    ).toBe(true);
    expect(viewerIsInvolved(actionItem({ leadId: "x", assignments: [] }), "me")).toBe(false);
  });
});

describe("buildActionOperatingBoard", () => {
  it("partitions open work into mine vs team and keeps a short recent-done list", () => {
    const mine1 = actionItem({ id: "mine1", leadId: "me", deadlineStart: addDays(NOW, 2) });
    const mine2 = actionItem({
      id: "mine2",
      leadId: "x",
      assignments: [assignment("me", "EXECUTING")],
      deadlineStart: addDays(NOW, 1),
    });
    const team = actionItem({ id: "team", ...owned, deadlineStart: addDays(NOW, 3) });
    const recent = actionItem({ id: "recent", status: "COMPLETE", completedAt: addDays(NOW, -1) });
    const oldDone = actionItem({ id: "oldDone", status: "COMPLETE", completedAt: addDays(NOW, -30) });

    const board = buildActionOperatingBoard([mine1, mine2, team, recent, oldDone], "me", NOW);

    expect(board.mine.map((i) => i.id)).toEqual(["mine2", "mine1"]); // soonest deadline first
    expect(board.team.map((i) => i.id)).toEqual(["team"]);
    expect(board.recentlyCompleted.map((i) => i.id)).toEqual(["recent"]);
    expect(board.needsAttention.every((i) => i.status !== "COMPLETE")).toBe(true);
  });
});

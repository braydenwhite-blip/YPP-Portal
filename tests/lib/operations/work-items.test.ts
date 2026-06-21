import { describe, expect, it } from "vitest";

import type {
  ActionLite,
  MeetingFollowUpLite,
} from "@/lib/people-strategy/operational-digest";
import {
  buildUnifiedWorkItems,
  countOpenWorkItems,
  groupWorkItems,
  laneForWorkItem,
  workItemFromAction,
  workItemFromFollowUp,
  WORK_LANES,
} from "@/lib/operations/work-items";

const NOW = new Date("2026-06-11T12:00:00.000Z");

function action(overrides: Partial<ActionLite> = {}): ActionLite {
  return {
    id: "a1",
    title: "Finalize instructor interview materials",
    status: "IN_PROGRESS",
    priority: "MEDIUM",
    dueISO: "2026-06-15T00:00:00.000Z",
    ownerName: "Brayden Kim",
    overdue: false,
    daysOverdue: 0,
    blocked: false,
    unassigned: false,
    relatedType: null,
    relatedId: null,
    relatedLabel: null,
    relatedTypeLabel: null,
    sourceMeetingId: null,
    sourceMeetingTitle: null,
    sourceMeetingStartISO: null,
    latestUpdate: null,
    nextStep: "Draft the rubric",
    contextSummary: null,
    createdISO: "2026-06-01T00:00:00.000Z",
    href: "/actions/a1",
    ...overrides,
  };
}

function followUp(overrides: Partial<MeetingFollowUpLite> = {}): MeetingFollowUpLite {
  return {
    id: "f1",
    title: "Send recap to Beth El",
    description: "Email the pilot summary",
    meetingId: "m1",
    meetingTitle: "Beth El planning sync",
    meetingStartISO: "2026-06-08T15:00:00.000Z",
    meetingCategory: "PARTNERSHIPS",
    ownerName: "Maya Johnson",
    ownerId: "u2",
    dueISO: "2026-06-12T00:00:00.000Z",
    priority: "HIGH",
    status: "open",
    areaLabel: "Partnerships",
    relatedType: "PARTNER",
    relatedId: "p1",
    relatedLabel: "Beth El Day Camp",
    href: "/meetings/m1",
    ...overrides,
  };
}

describe("workItemFromAction", () => {
  it("maps an in-progress action with a due-date status", () => {
    const item = workItemFromAction(action());
    expect(item.id).toBe("action:a1");
    expect(item.kind).toBe("action");
    expect(item.status).toMatch(/^Due /);
    expect(item.tone).toBe("info");
    expect(item.sourceLabel).toBe("Action");
    expect(item.convertHref).toBeNull();
  });

  it("flags overdue actions with the day count", () => {
    const item = workItemFromAction(action({ status: "OVERDUE", overdue: true, daysOverdue: 3 }));
    expect(item.status).toBe("Overdue 3d");
    expect(item.tone).toBe("danger");
    expect(item.overdue).toBe(true);
  });

  it("labels actions born from meetings as meeting follow-ups", () => {
    const item = workItemFromAction(
      action({ sourceMeetingId: "m1", sourceMeetingTitle: "Officer sync" })
    );
    expect(item.sourceLabel).toBe("Meeting follow-up");
    expect(item.meetingTitle).toBe("Officer sync");
  });
});

describe("workItemFromFollowUp", () => {
  it("maps an open follow-up with a tracker-conversion link", () => {
    const item = workItemFromFollowUp(followUp(), NOW);
    expect(item.id).toBe("follow_up:f1");
    expect(item.kind).toBe("follow_up");
    expect(item.sourceLabel).toBe("Meeting follow-up");
    expect(item.convertHref).toContain("/actions/new");
    expect(item.relatedLabel).toBe("Beth El Day Camp");
  });

  it("computes overdue days from the due date", () => {
    const item = workItemFromFollowUp(
      followUp({ status: "overdue", dueISO: "2026-06-08T00:00:00.000Z" }),
      NOW
    );
    expect(item.overdue).toBe(true);
    expect(item.status).toBe("Overdue 3d");
  });

  it("warns when a follow-up has no due date", () => {
    const item = workItemFromFollowUp(followUp({ dueISO: null }), NOW);
    expect(item.status).toBe("No due date");
    expect(item.tone).toBe("warning");
  });

  it("treats an ownerless follow-up as unassigned", () => {
    const item = workItemFromFollowUp(followUp({ ownerName: null, ownerId: null }), NOW);
    expect(item.unassigned).toBe(true);
  });
});

describe("buildUnifiedWorkItems", () => {
  it("merges actions and follow-ups, dropping DROPPED actions", () => {
    const items = buildUnifiedWorkItems({
      actions: [action(), action({ id: "a2", status: "DROPPED" })],
      followUps: [followUp()],
      now: NOW,
    });
    expect(items.map((i) => i.id)).toEqual(["action:a1", "follow_up:f1"]);
  });
});

describe("laneForWorkItem / groupWorkItems", () => {
  it("places every item in exactly one lane, in triage priority order", () => {
    const items = buildUnifiedWorkItems({
      actions: [
        action({ id: "over", status: "OVERDUE", overdue: true, daysOverdue: 2, blocked: false }),
        action({ id: "block", status: "BLOCKED", blocked: true }),
        action({ id: "owner", unassigned: true, status: "NOT_STARTED", dueISO: "2026-07-20T00:00:00.000Z" }),
        action({ id: "soon", dueISO: "2026-06-13T00:00:00.000Z" }),
        action({ id: "prog", status: "IN_PROGRESS", dueISO: "2026-07-20T00:00:00.000Z" }),
        action({ id: "later", status: "NOT_STARTED", dueISO: "2026-07-20T00:00:00.000Z" }),
        action({ id: "done", status: "COMPLETE", completedISO: "2026-06-10T00:00:00.000Z" }),
      ],
      followUps: [],
      now: NOW,
    });
    const board = groupWorkItems(items, NOW);
    expect(board.overdue.map((i) => i.id)).toEqual(["action:over"]);
    expect(board.blocked.map((i) => i.id)).toEqual(["action:block"]);
    expect(board.needs_owner.map((i) => i.id)).toEqual(["action:owner"]);
    expect(board.due_soon.map((i) => i.id)).toEqual(["action:soon"]);
    expect(board.in_progress.map((i) => i.id)).toEqual(["action:prog"]);
    expect(board.not_started.map((i) => i.id)).toEqual(["action:later"]);
    expect(board.done_recently.map((i) => i.id)).toEqual(["action:done"]);

    // Mutual exclusivity: total across lanes equals item count.
    const total = WORK_LANES.reduce((sum, lane) => sum + board[lane].length, 0);
    expect(total).toBe(items.length);
  });

  it("overdue beats blocked beats ownerless (first rule wins)", () => {
    const both = workItemFromAction(
      action({ status: "OVERDUE", overdue: true, daysOverdue: 1, blocked: false, unassigned: true })
    );
    expect(laneForWorkItem(both, NOW)).toBe("overdue");
  });

  it("drops completions older than the recent window off the board", () => {
    const old = workItemFromAction(
      action({ id: "old", status: "COMPLETE", completedISO: "2026-05-01T00:00:00.000Z" })
    );
    expect(laneForWorkItem(old, NOW)).toBeNull();
  });

  it("sorts lanes by priority, then due date", () => {
    const board = groupWorkItems(
      buildUnifiedWorkItems({
        actions: [
          action({ id: "med", priority: "MEDIUM", dueISO: "2026-06-12T00:00:00.000Z" }),
          action({ id: "urgent", priority: "URGENT", dueISO: "2026-06-14T00:00:00.000Z" }),
        ],
        followUps: [],
        now: NOW,
      }),
      NOW
    );
    expect(board.due_soon.map((i) => i.id)).toEqual(["action:urgent", "action:med"]);
  });

  it("counts open work excluding recent completions", () => {
    const board = groupWorkItems(
      buildUnifiedWorkItems({
        actions: [
          action(),
          action({ id: "done", status: "COMPLETE", completedISO: "2026-06-10T00:00:00.000Z" }),
        ],
        followUps: [followUp()],
        now: NOW,
      }),
      NOW
    );
    expect(countOpenWorkItems(board)).toBe(2);
  });
});

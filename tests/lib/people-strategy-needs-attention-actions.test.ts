import { describe, expect, it } from "vitest";

import { actionAttentionForViewer } from "@/lib/people-strategy/needs-attention-queries";
import type { ActionViewer } from "@/lib/people-strategy/action-permissions";

import { NOW, actionItem, assignment } from "./people-strategy-action-fixtures";

/**
 * Unit coverage for the Action Tracker ↔ Needs Attention bridge
 * (`actionAttentionForViewer`): it must run already-loaded action items through
 * the unified engine AND respect visibility — a member never sees the
 * attention signal for an OFFICERS_ONLY action.
 */

const DAY = 86_400_000;
const days = (n: number) => new Date(NOW.getTime() + n * DAY);

const officer: ActionViewer = {
  id: "officer-1",
  roles: ["ADMIN"],
  primaryRole: "ADMIN",
  adminSubtypes: [],
};

const member: ActionViewer = {
  id: "member-1",
  roles: ["STUDENT"],
  primaryRole: "STUDENT",
  adminSubtypes: [],
};

const categories = (items: { category: string }[]) => items.map((i) => i.category);

describe("actionAttentionForViewer", () => {
  it("flags an overdue action as a critical ACTION_OVERDUE signal", () => {
    const items = actionAttentionForViewer(
      [actionItem({ id: "a", status: "IN_PROGRESS", deadlineStart: days(-5) })],
      officer,
      NOW
    );
    expect(categories(items)).toContain("ACTION_OVERDUE");
    expect(items[0].severity).toBe("critical");
    expect(items[0].subjectKind).toBe("action");
    expect(items[0].subjectId).toBe("a");
  });

  it("flags an action with no accountable lead as ACTION_MISSING_OWNER", () => {
    const items = actionAttentionForViewer(
      [actionItem({ id: "b", leadId: null, assignments: [assignment("x", "EXECUTING")] })],
      officer,
      NOW
    );
    expect(categories(items)).toContain("ACTION_MISSING_OWNER");
  });

  it("returns nothing for a healthy, owned, not-yet-due action", () => {
    const items = actionAttentionForViewer(
      [actionItem({ id: "c", status: "IN_PROGRESS", deadlineStart: days(30) })],
      officer,
      NOW
    );
    expect(items).toHaveLength(0);
  });

  it("skips settled (COMPLETE / DROPPED) actions", () => {
    const items = actionAttentionForViewer(
      [
        actionItem({ id: "d", status: "COMPLETE", deadlineStart: days(-5) }),
        actionItem({ id: "e", status: "DROPPED", deadlineStart: days(-5) }),
      ],
      officer,
      NOW
    );
    expect(items).toHaveLength(0);
  });

  it("hides OFFICERS_ONLY action signals unless the viewer is an assigned officer", () => {
    const officersOnlyOverdue = actionItem({
      id: "f",
      status: "IN_PROGRESS",
      deadlineStart: days(-5),
      visibility: "OFFICERS_ONLY",
      leadId: "officer-1",
      assignments: [assignment("officer-1", "LEAD")],
    });

    expect(categories(actionAttentionForViewer([officersOnlyOverdue], officer, NOW))).toContain(
      "ACTION_OVERDUE"
    );
    expect(actionAttentionForViewer([officersOnlyOverdue], member, NOW)).toHaveLength(0);

    const unassignedOfficer: ActionViewer = {
      id: "officer-2",
      roles: ["STAFF"],
      primaryRole: "STAFF",
      adminSubtypes: [],
    };
    expect(actionAttentionForViewer([officersOnlyOverdue], unassignedOfficer, NOW)).toHaveLength(0);
  });

  it("still surfaces ALL_LEADERSHIP action signals to an assigned member", () => {
    const items = actionAttentionForViewer(
      [
        actionItem({
          id: "g",
          status: "IN_PROGRESS",
          deadlineStart: days(-2),
          visibility: "ALL_LEADERSHIP",
          leadId: "member-1",
          assignments: [assignment("member-1", "LEAD")],
        }),
      ],
      member,
      NOW
    );
    expect(categories(items)).toContain("ACTION_OVERDUE");
  });
});

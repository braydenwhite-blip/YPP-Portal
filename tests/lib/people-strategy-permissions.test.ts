import { describe, expect, it } from "vitest";

import {
  canAssignAction,
  canCreateAction,
  canEditAction,
  canFlagAction,
  canViewAction,
  type ActionAccessShape,
  type ActionViewer,
} from "@/lib/people-strategy/action-permissions";

const member: ActionViewer = {
  id: "m1",
  roles: ["STUDENT"],
  primaryRole: "STUDENT",
  adminSubtypes: [],
};
const otherMember: ActionViewer = {
  id: "m2",
  roles: ["INSTRUCTOR"],
  primaryRole: "INSTRUCTOR",
  adminSubtypes: [],
};
const officer: ActionViewer = {
  id: "o1",
  roles: ["STAFF"],
  primaryRole: "STAFF",
  adminSubtypes: [],
};
const cpo: ActionViewer = {
  id: "c1",
  roles: ["ADMIN"],
  primaryRole: "ADMIN",
  adminSubtypes: ["CPO"],
};
const board: ActionViewer = {
  id: "b1",
  roles: ["ADMIN"],
  primaryRole: "ADMIN",
  adminSubtypes: ["SUPER_ADMIN"],
};

// ALL_LEADERSHIP action where m1 is an INPUT assignee.
const leadershipMine: ActionAccessShape = {
  leadId: null,
  visibility: "ALL_LEADERSHIP",
  assignments: [{ userId: "m1", role: "INPUT" }],
};
// ALL_LEADERSHIP action m1 is NOT involved in.
const leadershipNotMine: ActionAccessShape = {
  leadId: "someoneElse",
  visibility: "ALL_LEADERSHIP",
  assignments: [{ userId: "x", role: "EXECUTING" }],
};
// Officers-only action where m1 happens to be EXECUTING.
const officersOnlyMine: ActionAccessShape = {
  leadId: null,
  visibility: "OFFICERS_ONLY",
  assignments: [{ userId: "m1", role: "EXECUTING" }],
};
// Action where m1 is the lead.
const leadByMember: ActionAccessShape = {
  leadId: "m1",
  visibility: "ALL_LEADERSHIP",
  assignments: [],
};

describe("canViewAction", () => {
  it("lets a member view an ALL_LEADERSHIP action they are assigned to", () => {
    expect(canViewAction(member, leadershipMine)).toBe(true);
  });

  it("hides an ALL_LEADERSHIP action from a member who is not assigned", () => {
    expect(canViewAction(member, leadershipNotMine)).toBe(false);
    expect(canViewAction(otherMember, leadershipMine)).toBe(false);
  });

  it("hides an OFFICERS_ONLY action from a member even if assigned (stricter)", () => {
    expect(canViewAction(member, officersOnlyMine)).toBe(false);
  });

  it("lets an officer view all ALL_LEADERSHIP and OFFICERS_ONLY actions", () => {
    expect(canViewAction(officer, leadershipMine)).toBe(true);
    expect(canViewAction(officer, leadershipNotMine)).toBe(true);
    expect(canViewAction(officer, officersOnlyMine)).toBe(true);
  });

  it("lets the CPO view everything, including officers-only", () => {
    expect(canViewAction(cpo, leadershipNotMine)).toBe(true);
    expect(canViewAction(cpo, officersOnlyMine)).toBe(true);
  });

  it("lets the Board (SUPER_ADMIN) view everything", () => {
    expect(canViewAction(board, leadershipNotMine)).toBe(true);
    expect(canViewAction(board, officersOnlyMine)).toBe(true);
  });
});

describe("canCreateAction", () => {
  it("allows officer-tier and above, denies members", () => {
    expect(canCreateAction(member)).toBe(false);
    expect(canCreateAction(officer)).toBe(true);
    expect(canCreateAction(cpo)).toBe(true);
    expect(canCreateAction(board)).toBe(true);
  });
});

describe("canEditAction", () => {
  it("allows officers, the lead, and EXECUTING members; denies INPUT-only", () => {
    expect(canEditAction(officer, leadershipNotMine)).toBe(true);
    expect(canEditAction(member, leadByMember)).toBe(true);
    expect(
      canEditAction(member, {
        leadId: null,
        visibility: "ALL_LEADERSHIP",
        assignments: [{ userId: "m1", role: "EXECUTING" }],
      })
    ).toBe(true);
    // INPUT-only member can view but not edit.
    expect(canEditAction(member, leadershipMine)).toBe(false);
    // Not involved → cannot edit.
    expect(canEditAction(otherMember, leadershipMine)).toBe(false);
  });
});

describe("canAssignAction", () => {
  it("only officer-tier and above can assign", () => {
    expect(canAssignAction(member)).toBe(false);
    expect(canAssignAction(officer)).toBe(true);
    expect(canAssignAction(cpo)).toBe(true);
  });
});

describe("canFlagAction", () => {
  it("anyone who can view can flag; non-viewers cannot", () => {
    expect(canFlagAction(member, leadershipMine)).toBe(true);
    expect(canFlagAction(member, leadershipNotMine)).toBe(false);
    expect(canFlagAction(member, officersOnlyMine)).toBe(false);
    expect(canFlagAction(officer, leadershipNotMine)).toBe(true);
  });
});

import { describe, expect, it } from "vitest";

import {
  buildMentorshipViewModel,
  resolveMentorshipRole,
  selectNextFocus,
} from "@/lib/mentorship/selectors";
import type {
  MentorshipRelationshipFact,
  MentorshipViewerContext,
} from "@/lib/mentorship/view-model";

const NOW = new Date("2026-06-16T12:00:00.000Z");

function viewer(overrides: Partial<MentorshipViewerContext> = {}): MentorshipViewerContext {
  return { userId: "u-self", isAdmin: false, isChair: false, ...overrides };
}

function fact(overrides: Partial<MentorshipRelationshipFact> = {}): MentorshipRelationshipFact {
  return {
    id: "m1",
    mentorId: "u-mentor",
    mentorName: "Morgan Mentor",
    menteeId: "u-mentee",
    menteeName: "Sam Mentee",
    chairId: null,
    status: "ACTIVE",
    cycleStage: "REFLECTION_DUE",
    cycleNumber: 3,
    releasedColorStatus: null,
    kickoffCompleted: true,
    reflectionDue: false,
    reviewDue: false,
    reviewPendingChairApproval: false,
    reviewChangesRequested: false,
    lastActivityISO: NOW.toISOString(),
    sessions: [],
    goals: [],
    commitments: [],
    feedback: [],
    support: [],
    ...overrides,
  };
}

describe("resolveMentorshipRole", () => {
  it("marks a mentor-only viewer as mentor, not dual", () => {
    const role = resolveMentorshipRole(viewer({ userId: "u-mentor" }), [fact()]);
    expect(role.role).toBe("mentor");
    expect(role.isDualRole).toBe(false);
    expect(role.roles).toEqual(["mentor"]);
  });

  it("marks a mentee-only viewer as mentee", () => {
    const role = resolveMentorshipRole(viewer({ userId: "u-mentee" }), [fact()]);
    expect(role.role).toBe("mentee");
  });

  it("detects dual role (mentor in one, mentee in another)", () => {
    const role = resolveMentorshipRole(viewer({ userId: "u-self" }), [
      fact({ id: "m1", mentorId: "u-self" }),
      fact({ id: "m2", menteeId: "u-self" }),
    ]);
    expect(role.role).toBe("mentor");
    expect(role.isDualRole).toBe(true);
    expect(role.roles).toEqual(["mentor", "mentee"]);
  });

  it("treats a lane chair as chair", () => {
    const role = resolveMentorshipRole(viewer({ isChair: true }), [fact()]);
    expect(role.role).toBe("chair");
  });

  it("lets admin dominate even when also a mentee", () => {
    const role = resolveMentorshipRole(viewer({ userId: "u-mentee", isAdmin: true }), [fact()]);
    expect(role.role).toBe("admin");
    expect(role.roles).toContain("mentee");
  });

  it("returns none when uninvolved and not admin/chair", () => {
    const role = resolveMentorshipRole(viewer({ userId: "stranger" }), [fact()]);
    expect(role.role).toBe("none");
  });
});

describe("selectNextFocus", () => {
  it("surfaces the mentee's reflection when due", () => {
    const focus = selectNextFocus(
      { viewer: viewer({ userId: "u-mentee" }), relationships: [fact({ reflectionDue: true })] },
      NOW
    );
    expect(focus?.kind).toBe("reflection");
    expect(focus?.ctaHref).toBe("/my-mentor/reflection");
  });

  it("prioritizes a due review over a pending kickoff for the mentor", () => {
    const focus = selectNextFocus(
      {
        viewer: viewer({ userId: "u-mentor" }),
        relationships: [fact({ reviewDue: true, kickoffCompleted: false })],
      },
      NOW
    );
    expect(focus?.kind).toBe("review");
  });

  it("prioritizes changes-requested over a due review", () => {
    const focus = selectNextFocus(
      {
        viewer: viewer({ userId: "u-mentor" }),
        relationships: [fact({ reviewDue: true, reviewChangesRequested: true })],
      },
      NOW
    );
    expect(focus?.kind).toBe("changes_requested");
  });

  it("returns null when nothing is pending", () => {
    const focus = selectNextFocus(
      { viewer: viewer({ userId: "u-mentor" }), relationships: [fact()] },
      NOW
    );
    expect(focus).toBeNull();
  });

  it("ignores work on non-active relationships", () => {
    const focus = selectNextFocus(
      {
        viewer: viewer({ userId: "u-mentor" }),
        relationships: [fact({ status: "COMPLETE", reviewDue: true })],
      },
      NOW
    );
    expect(focus).toBeNull();
  });
});

describe("buildMentorshipViewModel", () => {
  it("scopes a mentee to their own relationship and exposes only released color", () => {
    const vm = buildMentorshipViewModel(
      {
        viewer: viewer({ userId: "u-mentee" }),
        relationships: [
          fact({ id: "mine", releasedColorStatus: "ACHIEVED" }),
          fact({ id: "someone-else", mentorId: "x", menteeId: "y" }),
        ],
      },
      NOW
    );
    expect(vm.relationships).toHaveLength(1);
    expect(vm.relationships[0].id).toBe("mine");
    expect(vm.relationships[0].viewerRole).toBe("mentee");
    expect(vm.relationships[0].href).toBe("/my-mentor");
    expect(vm.relationships[0].colorStatus).toBe("ACHIEVED");
  });

  it("drops completed commitments and goals that are done", () => {
    const vm = buildMentorshipViewModel(
      {
        viewer: viewer({ userId: "u-mentor" }),
        relationships: [
          fact({
            commitments: [
              { id: "c1", title: "Open", status: "OPEN", ownerId: "u-mentee", ownerName: "Sam", dueISO: null },
              { id: "c2", title: "Done", status: "COMPLETE", ownerId: "u-mentee", ownerName: "Sam", dueISO: null },
            ],
            goals: [
              { id: "g1", title: "Active", color: null, progressState: "IN_PROGRESS", dueISO: null },
              { id: "g2", title: "Done", color: "ACHIEVED", progressState: "DONE", dueISO: null },
            ],
          }),
        ],
      },
      NOW
    );
    expect(vm.commitments.map((c) => c.id)).toEqual(["c1"]);
    expect(vm.goals.map((g) => g.id)).toEqual(["g1"]);
  });

  it("derives permissions per role", () => {
    const mentee = buildMentorshipViewModel(
      { viewer: viewer({ userId: "u-mentee" }), relationships: [fact()] },
      NOW
    );
    expect(mentee.permissions.canUpdateGoals).toBe(false);
    expect(mentee.permissions.canCreateCommitment).toBe(true);
    expect(mentee.permissions.canAssign).toBe(false);

    const mentor = buildMentorshipViewModel(
      { viewer: viewer({ userId: "u-mentor" }), relationships: [fact()] },
      NOW
    );
    expect(mentor.permissions.canUpdateGoals).toBe(true);

    const admin = buildMentorshipViewModel(
      { viewer: viewer({ isAdmin: true }), relationships: [fact()] },
      NOW
    );
    expect(admin.permissions.canAssign).toBe(true);
  });
});

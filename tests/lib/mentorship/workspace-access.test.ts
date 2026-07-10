import { describe, it, expect, beforeEach, vi } from "vitest";

/**
 * Access-tier boundary for the unified Mentorship workspace. This is the
 * confidentiality guard: who can open a person's record, and whether they get
 * the leadership tier (confidential) or the relationship tier (scoped).
 */

const { mentorshipFindFirst, userFindUnique, hasMentorshipCommandAccess, isChairForLane } =
  vi.hoisted(() => ({
    mentorshipFindFirst: vi.fn(),
    userFindUnique: vi.fn(),
    hasMentorshipCommandAccess: vi.fn(),
    isChairForLane: vi.fn(),
  }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    mentorship: { findFirst: mentorshipFindFirst },
    user: { findUnique: userFindUnique },
  },
}));
vi.mock("@/lib/mentorship/command-access", () => ({
  hasMentorshipCommandAccess,
  requireMentorshipCommandAccess: vi.fn(),
}));
vi.mock("@/lib/mentorship-chair-access", () => ({ isChairForLane }));

import { resolveWorkspaceAccess } from "@/lib/mentorship/workspace";

type Over = Partial<{ id: string; roles: string[]; primaryRole: string }>;
function viewer(over: Over = {}) {
  return {
    id: over.id ?? "u1",
    roles: over.roles ?? [],
    primaryRole: over.primaryRole ?? "INSTRUCTOR",
    adminSubtypes: [],
  } as never;
}

const ACTIVE = {
  id: "m1",
  mentorId: "mentorX",
  chairId: null,
  startDate: new Date("2026-01-01T00:00:00Z"),
  status: "ACTIVE",
  mentor: { name: "Mentor X", email: "mx@x.org" },
  chair: null,
};

beforeEach(() => {
  mentorshipFindFirst.mockReset();
  hasMentorshipCommandAccess.mockReset();
  userFindUnique.mockReset();
  isChairForLane.mockReset();
  // Default: the viewed person has a mappable role but no lane-chair grant —
  // existing tests exercise chairId/mentorId ownership, not the lane check.
  userFindUnique.mockResolvedValue({ primaryRole: "INSTRUCTOR" });
  isChairForLane.mockResolvedValue(false);
});

describe("resolveWorkspaceAccess", () => {
  it("denies a random signed-in user with no relationship", async () => {
    hasMentorshipCommandAccess.mockResolvedValue(false);
    mentorshipFindFirst.mockResolvedValue({ ...ACTIVE, mentorId: "someoneElse" });
    const res = await resolveWorkspaceAccess(viewer({ id: "stranger" }), "personA");
    expect(res).toBeNull();
  });

  it("denies a Chapter President who is NOT the assigned mentor (owner-only access)", async () => {
    hasMentorshipCommandAccess.mockResolvedValue(false); // CP is officer-tier, not leadership/board
    mentorshipFindFirst.mockResolvedValue({ ...ACTIVE, mentorId: "someoneElse" });
    const res = await resolveWorkspaceAccess(
      viewer({ id: "cp", roles: ["CHAPTER_PRESIDENT"] }),
      "chapterMember"
    );
    expect(res).toBeNull();
  });

  it("gives the assigned mentor the relationship tier and record access", async () => {
    hasMentorshipCommandAccess.mockResolvedValue(false);
    mentorshipFindFirst.mockResolvedValue({ ...ACTIVE, mentorId: "u1" });
    const res = await resolveWorkspaceAccess(viewer({ id: "u1" }), "personA");
    expect(res?.level).toBe("relationship");
    expect(res?.ownsRelationship).toBe(true);
    expect(res?.canRecordCheckIn).toBe(true);
  });

  it("gives the assigned chair the relationship tier", async () => {
    hasMentorshipCommandAccess.mockResolvedValue(false);
    mentorshipFindFirst.mockResolvedValue({ ...ACTIVE, chairId: "u1" });
    const res = await resolveWorkspaceAccess(viewer({ id: "u1" }), "personA");
    expect(res?.level).toBe("relationship");
    expect(res?.ownsRelationship).toBe(true);
  });

  it("leadership viewing someone else gets the leadership tier", async () => {
    hasMentorshipCommandAccess.mockResolvedValue(true);
    mentorshipFindFirst.mockResolvedValue(null);
    const res = await resolveWorkspaceAccess(viewer({ id: "lead" }), "personA");
    expect(res?.level).toBe("leadership");
    expect(res?.isSelf).toBe(false);
  });

  it("a leadership user viewing their OWN record is downgraded to the relationship tier", async () => {
    hasMentorshipCommandAccess.mockResolvedValue(true);
    mentorshipFindFirst.mockResolvedValue(null);
    const res = await resolveWorkspaceAccess(
      viewer({ id: "self", roles: ["ADMIN"] }),
      "self"
    );
    expect(res).not.toBeNull();
    expect(res?.isSelf).toBe(true);
    expect(res?.level).toBe("relationship"); // never see your own succession/potential
  });

  it("a Leadership member who is ALSO the assigned mentor is flagged as both — the precondition for the POV fix", async () => {
    // Before the POV fix, workspace.ts resolved pov as
    // `isSelf ? "me" : isLeadership ? "leadership" : "mentor"` — a Leadership
    // viewer who also happened to be the assigned mentor always got the
    // "leadership" verb set (approve/synthesize) and was never prompted to
    // write the review that was, in fact, their job to write. The fix reads
    // isMentor before isLeadership; this test locks in that both booleans
    // are available (and both true) so that fix can't silently regress.
    hasMentorshipCommandAccess.mockResolvedValue(true);
    mentorshipFindFirst.mockResolvedValue({ ...ACTIVE, mentorId: "lead-mentor" });
    const res = await resolveWorkspaceAccess(
      viewer({ id: "lead-mentor", roles: ["ADMIN"] }),
      "personA"
    );
    expect(res).not.toBeNull();
    expect(res?.isMentor).toBe(true);
    expect(res?.isLeadership).toBe(true);
    expect(res?.capabilities.canDraftReview).toBe(true);
  });

  it("derives capabilities that union rather than picking one winner", async () => {
    // The assigned chair, who is not otherwise leadership-tier, must still
    // be able to approve THIS person's review — a plain tier enum would
    // have no way to grant that without also granting full leadership
    // visibility (private comments, etc.), which is exactly the brittleness
    // capability-based access replaces.
    hasMentorshipCommandAccess.mockResolvedValue(false);
    mentorshipFindFirst.mockResolvedValue({ ...ACTIVE, chairId: "chair-only" });
    const res = await resolveWorkspaceAccess(viewer({ id: "chair-only" }), "personA");
    expect(res).not.toBeNull();
    expect(res?.isChair).toBe(true);
    expect(res?.isLeadership).toBe(false);
    expect(res?.capabilities.canApprove).toBe(true);
    expect(res?.capabilities.canViewPrivateComments).toBe(false);
  });

  it("gives a lane chair (MentorCommitteeChair) workspace access and canApprove even when not the pairing's recorded chairId", async () => {
    // Before this fix, isChair only ever looked at activeMentorship.chairId —
    // the actual approval authority (requireReviewApprover() in
    // goal-review-actions.ts) is the lane chair for the mentee's role, which
    // can be a different, unassigned person. A lane chair with no explicit
    // chairId on the pairing was denied workspace access entirely.
    hasMentorshipCommandAccess.mockResolvedValue(false);
    mentorshipFindFirst.mockResolvedValue({ ...ACTIVE, mentorId: "someoneElse", chairId: null });
    userFindUnique.mockResolvedValue({ primaryRole: "INSTRUCTOR" });
    isChairForLane.mockResolvedValue(true);
    const res = await resolveWorkspaceAccess(viewer({ id: "lane-chair" }), "personA");
    expect(res).not.toBeNull();
    expect(res?.isChair).toBe(true);
    expect(res?.ownsRelationship).toBe(true);
    expect(res?.level).toBe("relationship");
    expect(res?.capabilities.canApprove).toBe(true);
    expect(isChairForLane).toHaveBeenCalledWith("lane-chair", "INSTRUCTOR", []);
  });

  it("is null-safe when the viewed person has no mappable role — never calls isChairForLane, never grants chair access", async () => {
    hasMentorshipCommandAccess.mockResolvedValue(false);
    mentorshipFindFirst.mockResolvedValue({ ...ACTIVE, mentorId: "someoneElse" });
    userFindUnique.mockResolvedValue({ primaryRole: "STUDENT" }); // not mappable via toMenteeRoleType
    const res = await resolveWorkspaceAccess(viewer({ id: "stranger" }), "personA");
    expect(res).toBeNull();
    expect(isChairForLane).not.toHaveBeenCalled();
  });

  it("is null-safe when the viewed person has no active (or any) mentorship — lane-chair check still runs off primaryRole alone", async () => {
    hasMentorshipCommandAccess.mockResolvedValue(false);
    mentorshipFindFirst.mockResolvedValue(null);
    userFindUnique.mockResolvedValue({ primaryRole: "CHAPTER_PRESIDENT" });
    isChairForLane.mockResolvedValue(true);
    const res = await resolveWorkspaceAccess(viewer({ id: "lane-chair" }), "personA");
    expect(res).not.toBeNull();
    expect(res?.isChair).toBe(true);
    expect(res?.capabilities.canApprove).toBe(true);
  });
});

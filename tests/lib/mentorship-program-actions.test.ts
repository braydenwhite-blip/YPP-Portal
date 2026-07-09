import { beforeEach, describe, expect, it, vi } from "vitest";

import { getSession } from "@/lib/auth-supabase";

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

vi.mock("@/lib/audit-log-actions", () => ({
  logAuditEvent: vi.fn(),
}));

vi.mock("@/lib/mentorship-canonical", () => ({
  ensureCanonicalTrack: vi.fn(),
  enforceFullProgramMentorCapacity: vi.fn(),
  getAchievementAwardLevelForPoints: vi.fn(),
  getAwardPolicyForProgramGroup: vi.fn(),
  getCommitteeScopeForProgramGroup: vi.fn(),
  getDefaultMentorCapForProgramGroup: vi.fn(),
  getGovernanceModeForProgramGroup: vi.fn(),
  getLegacyMenteeRoleTypeForRole: vi.fn(),
  getMentorshipProgramGroupForRole: vi.fn(),
  getMentorshipTypeForProgramGroup: vi.fn(),
  mentorshipRequiresChairApproval: vi.fn(),
  mentorshipRequiresKickoff: vi.fn(),
  mentorshipRequiresMonthlyReflection: vi.fn(),
}));

vi.mock("@/lib/mentorship-access", () => ({
  getMentorshipAccessibleMenteeIds: vi.fn(),
  hasMentorshipMenteeAccess: vi.fn(),
}));

vi.mock("@/lib/mentorship-hub-actions", () => ({
  ensureMentorshipSupportCircle: vi.fn(),
}));

import { logAuditEvent } from "@/lib/audit-log-actions";
import {
  getGovernanceModeForProgramGroup,
  getMentorshipProgramGroupForRole,
  mentorshipRequiresChairApproval,
  mentorshipRequiresKickoff,
  mentorshipRequiresMonthlyReflection,
} from "@/lib/mentorship-canonical";
import { hasMentorshipMenteeAccess } from "@/lib/mentorship-access";
import { prisma } from "@/lib/prisma";
import { submitMonthlyGoalReview, assignCommitteeChair } from "@/lib/mentorship-program-actions";

describe("mentorship-program-actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getSession).mockResolvedValue({
      user: {
        id: "mentor-1",
        roles: ["MENTOR"],
      },
    } as any);
    vi.mocked(hasMentorshipMenteeAccess).mockResolvedValue(true);
    vi.mocked(getMentorshipProgramGroupForRole).mockReturnValue("INSTRUCTOR" as any);
    vi.mocked(getGovernanceModeForProgramGroup).mockReturnValue("FULL_PROGRAM" as any);
    vi.mocked(mentorshipRequiresKickoff).mockReturnValue(true);
    vi.mocked(mentorshipRequiresMonthlyReflection).mockReturnValue(false);
    vi.mocked(mentorshipRequiresChairApproval).mockReturnValue(false);

    (prisma as any).mentorship = {
      findFirst: vi.fn(),
    };
    (prisma as any).mentorshipSession = {
      findFirst: vi.fn(),
    };
    (prisma as any).goal = {
      findMany: vi.fn(),
    };
    (prisma as any).reflectionSubmission = {
      findFirst: vi.fn(),
    };
    (prisma as any).notification = {
      create: vi.fn(),
    };
  });

  it("counts a completed kickoff session and backfills the mentorship record during review submission", async () => {
    const kickoffCompletedAt = new Date("2026-04-02T16:00:00.000Z");
    const tx = {
      mentorship: {
        update: vi.fn().mockResolvedValue({
          id: "mentorship-1",
        }),
      },
      monthlyGoalReview: {
        findFirst: vi.fn().mockResolvedValue(null),
        create: vi.fn().mockResolvedValue({
          id: "review-1",
        }),
      },
      monthlyGoalRating: {
        deleteMany: vi.fn(),
        createMany: vi.fn(),
      },
      progressUpdate: {
        deleteMany: vi.fn(),
        createMany: vi.fn(),
      },
    };

    (prisma as any).mentorship.findFirst.mockResolvedValue({
      id: "mentorship-1",
      mentorId: "mentor-1",
      menteeId: "mentee-1",
      trackId: "track-1",
      chairId: null,
      programGroup: "INSTRUCTOR",
      governanceMode: "FULL_PROGRAM",
      kickoffCompletedAt: null,
      mentor: {
        id: "mentor-1",
        name: "Mentor One",
        email: "mentor@example.com",
      },
      mentee: {
        id: "mentee-1",
        name: "Mentee One",
        email: "mentee@example.com",
        primaryRole: "INSTRUCTOR",
        chapterId: null,
      },
      track: null,
    });
    (prisma as any).mentorshipSession.findFirst.mockResolvedValue({
      completedAt: kickoffCompletedAt,
    });
    (prisma as any).goal.findMany.mockResolvedValue([
      {
        id: "goal-1",
        template: {
          title: "Goal 1",
          sortOrder: 0,
        },
      },
    ]);
    (prisma as any).reflectionSubmission.findFirst.mockResolvedValue(null);
    (prisma as any).notification.create.mockResolvedValue({
      id: "notification-1",
    });
    (prisma as any).$transaction = vi.fn(async (callback: any) => callback(tx));

    const formData = new FormData();
    formData.set("forUserId", "mentee-1");
    formData.set("month", "2026-04-01T00:00:00.000Z");
    formData.set("overallStatus", "ON_TRACK");
    formData.set("overallComments", "Strong month.");
    formData.set("nextMonthPlan", "Keep building.");
    formData.set("characterCulturePoints", "2");
    formData.set("escalateToChair", "false");
    formData.set("goal_goal-1_status", "ON_TRACK");
    formData.set("goal_goal-1_comments", "Kept momentum.");

    await expect(submitMonthlyGoalReview(formData)).resolves.toBeUndefined();

    expect((prisma as any).mentorshipSession.findFirst).toHaveBeenCalledWith({
      where: {
        mentorshipId: "mentorship-1",
        type: "KICKOFF",
        completedAt: { not: null },
      },
      orderBy: [{ completedAt: "desc" }, { scheduledAt: "desc" }],
      select: { completedAt: true },
    });
    expect(tx.mentorship.update).toHaveBeenCalledWith({
      where: { id: "mentorship-1" },
      data: { kickoffCompletedAt },
    });
    expect(tx.monthlyGoalReview.create).toHaveBeenCalled();
    expect(vi.mocked(logAuditEvent)).toHaveBeenCalledWith(
      expect.objectContaining({
        targetId: "review-1",
        description: "Submitted monthly goal review for Mentee One.",
      })
    );
  });
});

describe("assignCommitteeChair — Role Committee lane split", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getSession).mockResolvedValue({
      user: { id: "admin-1", roles: ["ADMIN"] },
    } as any);
    (prisma as any).user = {
      findUniqueOrThrow: vi.fn().mockResolvedValue({ name: "Aveena" }),
    };
    (prisma as any).mentorCommitteeChair = {
      updateMany: vi.fn().mockResolvedValue({ count: 0 }),
      findFirst: vi.fn().mockResolvedValue(null),
      upsert: vi.fn().mockResolvedValue({ id: "chair-row-1" }),
      update: vi.fn().mockResolvedValue({ id: "chair-row-1" }),
    };
  });

  it("deactivates only the prior chair of the SAME lane, not the whole roleType", async () => {
    const formData = new FormData();
    formData.set("userId", "aveena-1");
    formData.set("lane", "GLOBAL_DIRECTOR_MANAGER");

    await assignCommitteeChair(formData);

    // Officers and Global Directors/Managers share roleType GLOBAL_LEADERSHIP —
    // the deactivation query must scope by lane, never by roleType alone, or
    // assigning one committee's chair would silently remove the other's.
    expect((prisma as any).mentorCommitteeChair.updateMany).toHaveBeenCalledWith({
      where: { lane: "GLOBAL_DIRECTOR_MANAGER", isActive: true },
      data: { isActive: false },
    });
    expect((prisma as any).mentorCommitteeChair.upsert).toHaveBeenCalledWith({
      where: { userId_lane: { userId: "aveena-1", lane: "GLOBAL_DIRECTOR_MANAGER" } },
      create: { userId: "aveena-1", roleType: "GLOBAL_LEADERSHIP", lane: "GLOBAL_DIRECTOR_MANAGER", isActive: true },
      update: { isActive: true, roleType: "GLOBAL_LEADERSHIP" },
    });
  });

  it("re-picks the lane on a pre-split legacy chair row instead of creating an orphaned duplicate", async () => {
    (prisma as any).mentorCommitteeChair.findFirst = vi
      .fn()
      .mockResolvedValue({ id: "legacy-row-1", userId: "sam-1", roleType: "GLOBAL_LEADERSHIP", lane: null });

    const formData = new FormData();
    formData.set("userId", "sam-1");
    formData.set("lane", "OFFICER");

    await assignCommitteeChair(formData);

    expect((prisma as any).mentorCommitteeChair.update).toHaveBeenCalledWith({
      where: { id: "legacy-row-1" },
      data: { lane: "OFFICER", isActive: true },
    });
    expect((prisma as any).mentorCommitteeChair.upsert).not.toHaveBeenCalled();
  });

  it("rejects an invalid lane value", async () => {
    const formData = new FormData();
    formData.set("userId", "aveena-1");
    formData.set("lane", "NOT_A_REAL_LANE");

    await expect(assignCommitteeChair(formData)).rejects.toThrow("Invalid committee lane");
  });
});

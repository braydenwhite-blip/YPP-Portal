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
import { submitMonthlyGoalReview } from "@/lib/mentorship-program-actions";

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

import { beforeEach, describe, expect, it, vi } from "vitest";
import { getServerSession } from "next-auth";

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

vi.mock("@/lib/mentorship-program-actions", () => ({
  createMentorshipNotification: vi.fn(),
}));

import { prisma } from "@/lib/prisma";
import { createMentorshipNotification } from "@/lib/mentorship-program-actions";
import { submitSelfReflection } from "@/lib/self-reflection-actions";

function buildBaseFormData() {
  const formData = new FormData();
  formData.set("overallReflection", "I learned a lot this month.");
  formData.set("engagementOverall", "I stayed engaged.");
  formData.set("workingWell", "Team check-ins helped.");
  formData.set("supportNeeded", "I need clearer deadlines.");
  formData.set("mentorHelpfulness", "My mentor was responsive.");
  formData.set("collaborationAssessment", "Collaboration felt strong.");
  formData.set("teamMembersAboveAndBeyond", "Jordan stepped up.");
  formData.set("collaborationImprovements", "We can tighten handoffs.");
  formData.set("additionalReflections", "Ready for the next cycle.");
  return formData;
}

describe("self-reflection-actions", () => {
  const transactionMocks = {
    monthlySelfReflection: {
      create: vi.fn(),
    },
    mentorship: {
      update: vi.fn(),
    },
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getServerSession).mockResolvedValue({
      user: {
        id: "mentee-1",
        primaryRole: "INSTRUCTOR",
        roles: ["INSTRUCTOR"],
      },
    } as any);

    (prisma as any).mentorship = {
      findFirst: vi.fn().mockResolvedValue({
        id: "mentorship-1",
        mentorId: "mentor-1",
        reflectionStreak: 2,
        longestReflectionStreak: 4,
        selfReflections: [],
      }),
    };
    (prisma as any).mentorshipProgramGoal = {
      findMany: vi.fn().mockResolvedValue([]),
    };
    (prisma as any).monthlySelfReflection = {
      findUnique: vi.fn().mockResolvedValue(null),
    };

    transactionMocks.monthlySelfReflection.create.mockResolvedValue({ id: "reflection-1" });
    transactionMocks.mentorship.update.mockResolvedValue({ id: "mentorship-1" });
    (prisma as any).$transaction = vi.fn(async (callback: any) => callback(transactionMocks));
  });

  it("allows a reflection submission when the role has no active goals", async () => {
    const formData = buildBaseFormData();

    await expect(submitSelfReflection(formData)).resolves.toBe("reflection-1");

    expect(transactionMocks.monthlySelfReflection.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        menteeId: "mentee-1",
        mentorshipId: "mentorship-1",
        goalResponses: { create: [] },
      }),
    });
    expect(vi.mocked(createMentorshipNotification)).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "mentor-1",
        title: "New Self-Reflection Submitted",
      })
    );
  });

  it("rejects submissions that are missing active goals", async () => {
    (prisma as any).mentorshipProgramGoal.findMany.mockResolvedValue([
      { id: "goal-1", title: "Teach consistently" },
      { id: "goal-2", title: "Strengthen follow-up" },
    ]);

    const formData = buildBaseFormData();
    formData.append("goalIds", "goal-1");
    formData.set("goal_goal-1_progressMade", "I improved lesson pacing.");
    formData.set("goal_goal-1_objectiveAchieved", "true");
    formData.set("goal_goal-1_accomplishments", "Completed two lesson plans.");
    formData.set("goal_goal-1_blockers", "");
    formData.set("goal_goal-1_nextMonthPlans", "Keep refining delivery.");

    await expect(submitSelfReflection(formData)).rejects.toThrow(
      "Your reflection form is missing one or more active goals. Please refresh and try again."
    );
    expect((prisma as any).$transaction).not.toHaveBeenCalled();
  });

  it("rejects submissions that include outdated or unknown goals", async () => {
    (prisma as any).mentorshipProgramGoal.findMany.mockResolvedValue([
      { id: "goal-1", title: "Teach consistently" },
    ]);

    const formData = buildBaseFormData();
    formData.append("goalIds", "retired-goal");
    formData.set("goal_retired-goal_progressMade", "Worked on an old target.");
    formData.set("goal_retired-goal_objectiveAchieved", "false");
    formData.set("goal_retired-goal_accomplishments", "Made some progress.");
    formData.set("goal_retired-goal_blockers", "");
    formData.set("goal_retired-goal_nextMonthPlans", "Try again next month.");

    await expect(submitSelfReflection(formData)).rejects.toThrow(
      "Your reflection form is out of date. Please refresh and try again."
    );
    expect((prisma as any).$transaction).not.toHaveBeenCalled();
  });
});

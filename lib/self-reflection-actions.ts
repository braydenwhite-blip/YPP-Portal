"use server";

import { prisma } from "@/lib/prisma";
import { authOptions } from "@/lib/auth";
import { getServerSession } from "next-auth";
import { revalidatePath } from "next/cache";
import { MenteeRoleType } from "@prisma/client";

// Maps a user's primaryRole to the MenteeRoleType used in the program
export function toMenteeRoleType(primaryRole: string): MenteeRoleType | null {
  if (primaryRole === "INSTRUCTOR") return MenteeRoleType.INSTRUCTOR;
  if (primaryRole === "CHAPTER_LEAD") return MenteeRoleType.CHAPTER_PRESIDENT;
  if (primaryRole === "ADMIN" || primaryRole === "STAFF") return MenteeRoleType.GLOBAL_LEADERSHIP;
  return null;
}

async function requireMentee() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) throw new Error("Unauthorized");
  const primaryRole = session.user.primaryRole ?? "";
  const menteeRoleType = toMenteeRoleType(primaryRole);
  if (!menteeRoleType) throw new Error("Your role is not part of the mentorship program");
  return {
    userId: session.user.id as string,
    primaryRole,
    menteeRoleType,
  };
}

function getString(formData: FormData, key: string, required = true): string {
  const value = formData.get(key);
  if (required && (!value || String(value).trim() === "")) {
    throw new Error(`Missing field: ${key}`);
  }
  return value ? String(value).trim() : "";
}

// ============================================
// FETCH: MENTEE PROGRAM DATA
// ============================================

/**
 * Fetch all data needed for the mentee's My Program hub page.
 */
export async function getMyProgramData() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return null;

  const userId = session.user.id as string;
  const primaryRole = session.user.primaryRole ?? "";
  const menteeRoleType = toMenteeRoleType(primaryRole);
  if (!menteeRoleType) return null;

  const [mentorship, goals, reflections] = await Promise.all([
    // Active program mentorship pairing
    prisma.mentorship.findFirst({
      where: { menteeId: userId, status: "ACTIVE" },
      include: {
        mentor: { select: { id: true, name: true, email: true } },
        selfReflections: {
          orderBy: { cycleNumber: "desc" },
          take: 1,
          select: { id: true, cycleNumber: true, cycleMonth: true, submittedAt: true },
        },
      },
    }),

    // Role-specific active goals
    prisma.mentorshipProgramGoal.findMany({
      where: { roleType: menteeRoleType, isActive: true },
      orderBy: { sortOrder: "asc" },
      select: { id: true, title: true, description: true, sortOrder: true },
    }),

    // All submitted self-reflections, with released goal reviews
    prisma.monthlySelfReflection.findMany({
      where: { menteeId: userId },
      orderBy: { cycleNumber: "desc" },
      include: {
        goalReview: {
          where: { releasedToMenteeAt: { not: null } },
          select: {
            id: true,
            overallRating: true,
            overallComments: true,
            planOfAction: true,
            pointsAwarded: true,
            releasedToMenteeAt: true,
          },
        },
      },
    }),
  ]);

  // Achievement summary
  const achievementSummary = await prisma.achievementPointSummary.findUnique({
    where: { userId },
    select: { totalPoints: true, currentTier: true },
  });

  return {
    menteeRoleType,
    mentorship: mentorship
      ? {
          id: mentorship.id,
          mentorName: mentorship.mentor.name,
          mentorEmail: mentorship.mentor.email,
          startDate: mentorship.startDate.toISOString(),
          lastReflectionCycle: mentorship.selfReflections[0]?.cycleNumber ?? 0,
        }
      : null,
    goals,
    reflections: reflections.map((r) => ({
      id: r.id,
      cycleNumber: r.cycleNumber,
      cycleMonth: r.cycleMonth.toISOString(),
      submittedAt: r.submittedAt.toISOString(),
      hasReleasedReview: !!r.goalReview,
      reviewRating: r.goalReview?.overallRating ?? null,
      pointsAwarded: r.goalReview?.pointsAwarded ?? null,
    })),
    achievementSummary: achievementSummary
      ? { totalPoints: achievementSummary.totalPoints, currentTier: achievementSummary.currentTier }
      : { totalPoints: 0, currentTier: null },
  };
}

/**
 * Fetch a single self-reflection for read-only view (accessible to the mentee or their mentor/admin).
 */
export async function getReflectionById(reflectionId: string) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return null;

  const userId = session.user.id as string;
  const roles = session.user.roles ?? [];
  const isAdminOrMentor = roles.includes("ADMIN") || roles.includes("MENTOR");

  const reflection = await prisma.monthlySelfReflection.findUnique({
    where: { id: reflectionId },
    include: {
      mentee: { select: { id: true, name: true } },
      mentorship: {
        select: { mentorId: true },
      },
      goalResponses: {
        include: {
          goal: { select: { id: true, title: true, description: true } },
        },
        orderBy: { goal: { sortOrder: "asc" } },
      },
      goalReview: {
        where: { releasedToMenteeAt: { not: null } },
        select: {
          overallRating: true,
          overallComments: true,
          planOfAction: true,
          projectedFuturePath: true,
          promotionReadiness: true,
          pointsAwarded: true,
          releasedToMenteeAt: true,
        },
      },
    },
  });

  if (!reflection) return null;

  // Access control: only the mentee, their mentor, or an admin
  const isMentee = reflection.menteeId === userId;
  const isMentor = reflection.mentorship.mentorId === userId;
  if (!isMentee && !isMentor && !isAdminOrMentor) return null;

  return reflection;
}

// ============================================
// SUBMIT: MONTHLY SELF-REFLECTION
// ============================================

/**
 * Submit a monthly self-reflection.
 * Validates that the mentee has an active mentorship and hasn't already
 * submitted for the current cycle.
 */
export async function submitSelfReflection(formData: FormData) {
  const { userId, menteeRoleType } = await requireMentee();

  // Find active mentorship
  const mentorship = await prisma.mentorship.findFirst({
    where: { menteeId: userId, status: "ACTIVE" },
    include: {
      selfReflections: {
        orderBy: { cycleNumber: "desc" },
        take: 1,
      },
    },
  });

  if (!mentorship) {
    throw new Error("You don't have an active program mentorship. Contact your administrator.");
  }

  // Compute next cycle number
  const lastCycle = mentorship.selfReflections[0]?.cycleNumber ?? 0;
  const cycleNumber = lastCycle + 1;

  // Compute cycle month = first day of current calendar month
  const now = new Date();
  const cycleMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  // Prevent duplicate for same cycleNumber
  const existing = await prisma.monthlySelfReflection.findUnique({
    where: { mentorshipId_cycleNumber: { mentorshipId: mentorship.id, cycleNumber } },
  });
  if (existing) {
    throw new Error("You have already submitted a reflection for this cycle.");
  }

  // Parse Section 1
  const overallReflection = getString(formData, "overallReflection");

  // Parse Section 2
  const engagementOverall = getString(formData, "engagementOverall");
  const workingWell = getString(formData, "workingWell");
  const supportNeeded = getString(formData, "supportNeeded");
  const mentorHelpfulness = getString(formData, "mentorHelpfulness");

  // Parse Section 3
  const collaborationAssessment = getString(formData, "collaborationAssessment");
  const teamMembersAboveAndBeyond = getString(formData, "teamMembersAboveAndBeyond", false);
  const collaborationImprovements = getString(formData, "collaborationImprovements", false);

  // Parse Section 5
  const additionalReflections = getString(formData, "additionalReflections", false);

  // Parse Section 4: per-goal responses
  // Goals encoded as goalIds[] in formData
  const goalIds = formData.getAll("goalIds").map(String);

  const goalResponses = goalIds.map((goalId) => ({
    goalId,
    progressMade: getString(formData, `goal_${goalId}_progressMade`),
    objectiveAchieved: formData.get(`goal_${goalId}_objectiveAchieved`) === "true",
    accomplishments: getString(formData, `goal_${goalId}_accomplishments`),
    blockers: getString(formData, `goal_${goalId}_blockers`, false),
    nextMonthPlans: getString(formData, `goal_${goalId}_nextMonthPlans`),
  }));

  if (goalIds.length === 0) {
    throw new Error("No goals found for your role. Contact your administrator.");
  }

  // Create reflection + per-goal responses in a transaction
  const reflection = await prisma.$transaction(async (tx) => {
    const r = await tx.monthlySelfReflection.create({
      data: {
        menteeId: userId,
        mentorshipId: mentorship.id,
        cycleMonth,
        cycleNumber,
        overallReflection,
        engagementOverall,
        workingWell,
        supportNeeded,
        mentorHelpfulness,
        collaborationAssessment,
        teamMembersAboveAndBeyond: teamMembersAboveAndBeyond || null,
        collaborationImprovements: collaborationImprovements || null,
        additionalReflections: additionalReflections || null,
        goalResponses: {
          create: goalResponses,
        },
      },
    });
    return r;
  });

  revalidatePath("/my-program");
  return reflection.id;
}

"use server";

import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth-supabase";
import { revalidatePath } from "next/cache";
import { toMenteeRoleType } from "@/lib/mentee-role-utils";
import { logger } from "@/lib/logger";
import { recomputeMentorshipCycleStage } from "@/lib/mentorship-cycle";
import { emitReflectionSubmitted } from "@/lib/mentorship-notifications";

async function requireMentee() {
  const session = await getSession();
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

function getUniqueStringList(formData: FormData, key: string): string[] {
  return Array.from(
    new Set(
      formData
        .getAll(key)
        .map((value) => String(value).trim())
        .filter(Boolean)
    )
  );
}

// ============================================
// FETCH: MENTEE PROGRAM DATA
// ============================================

/**
 * Fetch all data needed for the mentee's My Program hub page.
 */
export async function getMyProgramData() {
  const session = await getSession();
  if (!session?.user?.id) return null;

  const userId = session.user.id as string;
  const primaryRole = session.user.primaryRole ?? "";
  const menteeRoleType = toMenteeRoleType(primaryRole);
  if (!menteeRoleType) return null;

  const [mentorship, goals, reflections] = await Promise.all([
    // Active program mentorship pairing
    prisma.mentorship.findFirst({
      where: { menteeId: userId, status: "ACTIVE" },
      select: {
        id: true,
        startDate: true,
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
  const session = await getSession();
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

  logger.info(
    { userId, menteeRoleType, action: "submitSelfReflection" },
    "submitSelfReflection: entry"
  );

  const [mentorship, activeGoals] = await Promise.all([
    prisma.mentorship.findFirst({
      where: { menteeId: userId, status: "ACTIVE" },
      select: {
        id: true,
        mentorId: true,
        reflectionStreak: true,
        longestReflectionStreak: true,
        selfReflections: {
          orderBy: { cycleNumber: "desc" },
          take: 1,
          select: {
            id: true,
            cycleNumber: true,
            cycleMonth: true,
            submittedAt: true,
          },
        },
      },
    }),
    prisma.mentorshipProgramGoal.findMany({
      where: { roleType: menteeRoleType, isActive: true },
      orderBy: { sortOrder: "asc" },
      select: { id: true },
    }),
  ]);

  if (!mentorship) {
    logger.warn(
      { userId, menteeRoleType, action: "submitSelfReflection" },
      "submitSelfReflection: no active mentorship found — user cannot submit reflection"
    );
    throw new Error("You don't have an active program mentorship. Contact your administrator.");
  }

  // Compute next cycle number
  const lastCycle = mentorship.selfReflections[0]?.cycleNumber ?? 0;
  const cycleNumber = lastCycle + 1;

  // Compute cycle month = first day of current calendar month
  const now = new Date();
  const cycleMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  logger.debug(
    {
      userId,
      mentorshipId: mentorship.id,
      cycleNumber,
      cycleMonth: cycleMonth.toISOString(),
      activeGoalCount: activeGoals.length,
      action: "submitSelfReflection",
    },
    "submitSelfReflection: validation pass — mentorship and cycle resolved"
  );

  // Prevent duplicate for same cycleNumber
  const existing = await prisma.monthlySelfReflection.findUnique({
    where: { mentorshipId_cycleNumber: { mentorshipId: mentorship.id, cycleNumber } },
  });
  if (existing) {
    logger.warn(
      { userId, mentorshipId: mentorship.id, cycleNumber, existingReflectionId: existing.id },
      "submitSelfReflection: duplicate submission blocked — reflection already exists for this cycle"
    );
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

  // Parse Section 4: per-goal responses, but only for the goals that are truly active now.
  const submittedGoalIds = getUniqueStringList(formData, "goalIds");
  const activeGoalIds = new Set(activeGoals.map((goal) => goal.id));
  const unexpectedGoalIds = submittedGoalIds.filter((goalId) => !activeGoalIds.has(goalId));
  if (unexpectedGoalIds.length > 0) {
    logger.warn(
      { userId, mentorshipId: mentorship.id, cycleNumber, unexpectedGoalIds },
      "submitSelfReflection: form stale — unexpected goal IDs in submission"
    );
    throw new Error("Your reflection form is out of date. Please refresh and try again.");
  }

  const hasMissingGoals = activeGoals.some((goal) => !submittedGoalIds.includes(goal.id));
  if (hasMissingGoals) {
    logger.warn(
      { userId, mentorshipId: mentorship.id, cycleNumber, activeGoalCount: activeGoals.length, submittedGoalCount: submittedGoalIds.length },
      "submitSelfReflection: form stale — missing active goal IDs in submission"
    );
    throw new Error("Your reflection form is missing one or more active goals. Please refresh and try again.");
  }

  const goalResponses = activeGoals.map((goal) => ({
    goalId: goal.id,
    progressMade: getString(formData, `goal_${goal.id}_progressMade`),
    objectiveAchieved: formData.get(`goal_${goal.id}_objectiveAchieved`) === "true",
    accomplishments: getString(formData, `goal_${goal.id}_accomplishments`),
    blockers: getString(formData, `goal_${goal.id}_blockers`, false),
    nextMonthPlans: getString(formData, `goal_${goal.id}_nextMonthPlans`),
  }));

  // Compute reflection streak: increment if last reflection was within 45 days
  const lastReflectionDate = mentorship.selfReflections[0]?.submittedAt ?? null;
  const daysSinceLast = lastReflectionDate
    ? (now.getTime() - lastReflectionDate.getTime()) / (1000 * 60 * 60 * 24)
    : null;
  const isOnTime = daysSinceLast === null || daysSinceLast <= 45;
  const newStreak = isOnTime ? (mentorship.reflectionStreak ?? 0) + 1 : 1;
  const newLongest = Math.max(newStreak, mentorship.longestReflectionStreak ?? 0);

  logger.debug(
    { userId, mentorshipId: mentorship.id, cycleNumber, newStreak, isOnTime },
    "submitSelfReflection: saving reflection"
  );

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
    // Update streak counters on the mentorship
    await tx.mentorship.update({
      where: { id: mentorship.id },
      data: { reflectionStreak: newStreak, longestReflectionStreak: newLongest },
    });
    return r;
  });

  logger.info(
    { userId, mentorshipId: mentorship.id, cycleNumber, reflectionId: reflection.id },
    "submitSelfReflection: reflection saved successfully — dispatching mentor notification"
  );

  // Recompute denormalized cycleStage so the Kanban column updates.
  try {
    await recomputeMentorshipCycleStage(mentorship.id);
  } catch (err) {
    logger.warn(
      { err, mentorshipId: mentorship.id, cycleNumber },
      "submitSelfReflection: cycleStage recompute failed — reflection saved"
    );
  }

  // Notify the assigned mentor that a new reflection was submitted.
  // Uses the Phase 0.9 cycle-milestone emitter (safeEmit + dedup).
  const menteeName = (await prisma.user.findUnique({ where: { id: userId }, select: { name: true } }))?.name ?? "A mentee";
  await emitReflectionSubmitted({
    mentorId: mentorship.mentorId,
    menteeName,
    menteeId: userId,
    ctx: { cycleNumber, cycleMonth },
  });

  logger.info(
    { userId, mentorshipId: mentorship.id, cycleNumber, reflectionId: reflection.id },
    "submitSelfReflection: complete"
  );

  revalidatePath("/my-program");
  return reflection.id;
}

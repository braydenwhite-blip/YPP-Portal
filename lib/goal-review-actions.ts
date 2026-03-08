"use server";

import { prisma } from "@/lib/prisma";
import { authOptions } from "@/lib/auth";
import { getServerSession } from "next-auth";
import { revalidatePath } from "next/cache";
import {
  GoalRatingColor,
  GoalReviewStatus,
  MenteeRoleType,
  AchievementAwardTier,
} from "@prisma/client";
import { logAuditEvent } from "@/lib/audit-log-actions";
import { toMenteeRoleType } from "@/lib/self-reflection-actions";

// ============================================
// POINT TABLE
// ============================================

const POINT_TABLE: Record<GoalRatingColor, Record<MenteeRoleType, number>> = {
  BEHIND_SCHEDULE: { INSTRUCTOR: 0, CHAPTER_PRESIDENT: 0, GLOBAL_LEADERSHIP: 0 },
  GETTING_STARTED: { INSTRUCTOR: 5, CHAPTER_PRESIDENT: 8, GLOBAL_LEADERSHIP: 10 },
  ACHIEVED: { INSTRUCTOR: 10, CHAPTER_PRESIDENT: 15, GLOBAL_LEADERSHIP: 20 },
  ABOVE_AND_BEYOND: { INSTRUCTOR: 15, CHAPTER_PRESIDENT: 22, GLOBAL_LEADERSHIP: 30 },
};

const TIER_THRESHOLDS: { tier: AchievementAwardTier; min: number }[] = [
  { tier: "LIFETIME", min: 1800 },
  { tier: "GOLD", min: 700 },
  { tier: "SILVER", min: 350 },
  { tier: "BRONZE", min: 175 },
];

function computeTier(totalPoints: number): AchievementAwardTier | null {
  for (const { tier, min } of TIER_THRESHOLDS) {
    if (totalPoints >= min) return tier;
  }
  return null;
}

// ============================================
// AUTH HELPERS
// ============================================

async function requireMentor() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) throw new Error("Unauthorized");
  const roles = session.user.roles ?? [];
  if (!roles.includes("MENTOR") && !roles.includes("ADMIN") && !roles.includes("CHAPTER_LEAD")) {
    throw new Error("Unauthorized");
  }
  return session as typeof session & { user: { id: string } };
}

async function requireAdmin() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) throw new Error("Unauthorized");
  const roles = session.user.roles ?? [];
  if (!roles.includes("ADMIN")) throw new Error("Unauthorized");
  return session as typeof session & { user: { id: string } };
}

function getString(formData: FormData, key: string, required = true): string {
  const value = formData.get(key);
  if (required && (!value || String(value).trim() === "")) throw new Error(`Missing: ${key}`);
  return value ? String(value).trim() : "";
}

// ============================================
// FETCH: MENTOR'S REVIEW QUEUE
// ============================================

/**
 * Returns the mentor's active mentees and the status of each reflection cycle.
 * Reflections without a review are "pending"; those with a DRAFT review are in-progress.
 */
export async function getMyReviewQueue() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return null;

  const userId = session.user.id as string;
  const roles = session.user.roles ?? [];
  const isAdmin = roles.includes("ADMIN");

  const mentorships = await prisma.mentorship.findMany({
    where: isAdmin ? { status: "ACTIVE" } : { mentorId: userId, status: "ACTIVE" },
    include: {
      mentee: { select: { id: true, name: true, email: true, primaryRole: true } },
      selfReflections: {
        orderBy: { cycleNumber: "desc" },
        include: {
          goalReview: {
            select: { id: true, status: true, pointsAwarded: true, releasedToMenteeAt: true },
          },
        },
      },
    },
  });

  return mentorships.map((m) => {
    const latestReflection = m.selfReflections[0] ?? null;
    const review = latestReflection?.goalReview ?? null;

    return {
      mentorshipId: m.id,
      mentorId: m.mentorId,
      menteeId: m.menteeId,
      menteeName: m.mentee.name,
      menteeEmail: m.mentee.email,
      menteeRole: m.mentee.primaryRole,
      totalReflections: m.selfReflections.length,
      latestReflection: latestReflection
        ? {
            id: latestReflection.id,
            cycleNumber: latestReflection.cycleNumber,
            cycleMonth: latestReflection.cycleMonth.toISOString(),
            submittedAt: latestReflection.submittedAt.toISOString(),
          }
        : null,
      reviewStatus: review?.status ?? null,
      reviewId: review?.id ?? null,
      isReleased: !!review?.releasedToMenteeAt,
    };
  });
}

/**
 * Fetch a single self-reflection with all data needed to write a review.
 */
export async function getReflectionForReview(reflectionId: string) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return null;

  const userId = session.user.id as string;
  const roles = session.user.roles ?? [];
  const isAdmin = roles.includes("ADMIN");

  const reflection = await prisma.monthlySelfReflection.findUnique({
    where: { id: reflectionId },
    include: {
      mentee: { select: { id: true, name: true, email: true, primaryRole: true } },
      mentorship: { select: { mentorId: true } },
      goalResponses: {
        include: { goal: { select: { id: true, title: true, description: true, sortOrder: true } } },
        orderBy: { goal: { sortOrder: "asc" } },
      },
      goalReview: {
        include: { goalRatings: true },
      },
    },
  });

  if (!reflection) return null;

  // Access: only the assigned mentor or an admin
  const isMentor = reflection.mentorship.mentorId === userId;
  if (!isMentor && !isAdmin) return null;

  return reflection;
}

// ============================================
// SAVE / SUBMIT: MENTOR GOAL REVIEW
// ============================================

/**
 * Save or update a goal review (creates if new, updates if DRAFT or CHANGES_REQUESTED).
 * Pass status="PENDING_CHAIR_APPROVAL" to submit for chair approval.
 */
export async function saveGoalReview(formData: FormData) {
  const session = await requireMentor();

  const reflectionId = getString(formData, "reflectionId");
  const overallRatingRaw = getString(formData, "overallRating");
  const overallComments = getString(formData, "overallComments");
  const planOfAction = getString(formData, "planOfAction");
  const projectedFuturePath = getString(formData, "projectedFuturePath", false);
  const promotionReadiness = getString(formData, "promotionReadiness", false);
  const submitForApproval = formData.get("submitForApproval") === "true";

  const overallRating = overallRatingRaw as GoalRatingColor;
  if (!Object.values(GoalRatingColor).includes(overallRating)) {
    throw new Error("Invalid overall rating");
  }

  const reflection = await prisma.monthlySelfReflection.findUniqueOrThrow({
    where: { id: reflectionId },
    include: {
      mentorship: { select: { mentorId: true, menteeId: true } },
      goalReview: { select: { id: true, status: true } },
    },
  });

  // Only assigned mentor or admin may write the review
  const roles = session.user.roles ?? [];
  const isAdmin = roles.includes("ADMIN");
  if (reflection.mentorship.mentorId !== session.user.id && !isAdmin) {
    throw new Error("You are not the assigned mentor for this reflection");
  }

  // Cannot edit an already-approved review
  if (reflection.goalReview?.status === "APPROVED") {
    throw new Error("This review has already been approved and cannot be edited");
  }

  const newStatus: GoalReviewStatus = submitForApproval
    ? "PENDING_CHAIR_APPROVAL"
    : "DRAFT";

  // Parse per-goal ratings
  const goalIds = formData.getAll("goalIds").map(String);
  const goalRatings = goalIds.map((goalId) => {
    const ratingRaw = getString(formData, `goal_${goalId}_rating`);
    const rating = ratingRaw as GoalRatingColor;
    if (!Object.values(GoalRatingColor).includes(rating)) {
      throw new Error(`Invalid rating for goal ${goalId}`);
    }
    const comments = getString(formData, `goal_${goalId}_comments`, false);
    return { goalId, rating, comments: comments || null };
  });

  const isQuarterly = reflection.cycleNumber % 3 === 0;

  await prisma.$transaction(async (tx) => {
    if (reflection.goalReview) {
      // Update existing draft
      await tx.mentorGoalReview.update({
        where: { id: reflection.goalReview.id },
        data: {
          overallRating,
          overallComments,
          planOfAction,
          projectedFuturePath: isQuarterly ? (projectedFuturePath || null) : null,
          promotionReadiness: isQuarterly ? (promotionReadiness || null) : null,
          status: newStatus,
        },
      });
      // Replace goal ratings
      await tx.goalReviewRating.deleteMany({ where: { reviewId: reflection.goalReview.id } });
      await tx.goalReviewRating.createMany({
        data: goalRatings.map((gr) => ({
          reviewId: reflection.goalReview!.id,
          goalId: gr.goalId,
          rating: gr.rating,
          comments: gr.comments,
        })),
      });
    } else {
      // Create new review
      await tx.mentorGoalReview.create({
        data: {
          mentorId: session.user.id,
          menteeId: reflection.mentorship.menteeId,
          mentorshipId: (
            await tx.mentorship.findFirstOrThrow({
              where: { id: reflection.mentorshipId },
              select: { id: true },
            })
          ).id,
          selfReflectionId: reflectionId,
          cycleMonth: reflection.cycleMonth,
          cycleNumber: reflection.cycleNumber,
          isQuarterly,
          overallRating,
          overallComments,
          planOfAction,
          projectedFuturePath: isQuarterly ? (projectedFuturePath || null) : null,
          promotionReadiness: isQuarterly ? (promotionReadiness || null) : null,
          status: newStatus,
          goalRatings: {
            create: goalRatings.map((gr) => ({
              goalId: gr.goalId,
              rating: gr.rating,
              comments: gr.comments,
            })),
          },
        },
      });
    }
  });

  revalidatePath("/mentorship-program/reviews");
}

// ============================================
// FETCH: CHAIR APPROVAL QUEUE
// ============================================

/**
 * Fetch all reviews pending chair approval, filtered to the chair's role group(s).
 * Admins see all pending reviews.
 */
export async function getChairQueue() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return null;

  const userId = session.user.id as string;
  const roles = session.user.roles ?? [];
  const isAdmin = roles.includes("ADMIN");

  // Find which role groups this user chairs
  const chairAssignments = await prisma.mentorCommitteeChair.findMany({
    where: { userId, isActive: true },
    select: { roleType: true },
  });

  const chairedRoleTypes = chairAssignments.map((c) => c.roleType);

  // If not admin and not a chair, return empty
  if (!isAdmin && chairedRoleTypes.length === 0) return [];

  const reviews = await prisma.mentorGoalReview.findMany({
    where: {
      status: { in: ["PENDING_CHAIR_APPROVAL", "CHANGES_REQUESTED"] },
      ...(isAdmin
        ? {}
        : {
            mentee: {
              primaryRole: {
                in: chairedRoleTypes.flatMap((rt) =>
                  rt === "INSTRUCTOR"
                    ? ["INSTRUCTOR"]
                    : rt === "CHAPTER_PRESIDENT"
                    ? ["CHAPTER_LEAD"]
                    : ["ADMIN", "STAFF"]
                ),
              },
            },
          }),
    },
    include: {
      mentor: { select: { id: true, name: true } },
      mentee: { select: { id: true, name: true, email: true, primaryRole: true } },
      selfReflection: {
        select: { id: true, cycleNumber: true, cycleMonth: true, submittedAt: true },
      },
      goalRatings: {
        include: { goal: { select: { title: true } } },
      },
    },
    orderBy: { updatedAt: "asc" },
  });

  return reviews.map((r) => ({
    id: r.id,
    mentorName: r.mentor.name,
    menteeName: r.mentee.name,
    menteeEmail: r.mentee.email,
    menteeRole: r.mentee.primaryRole,
    cycleNumber: r.selfReflection.cycleNumber,
    cycleMonth: r.selfReflection.cycleMonth.toISOString(),
    submittedAt: r.selfReflection.submittedAt.toISOString(),
    status: r.status,
    overallRating: r.overallRating,
    isQuarterly: r.isQuarterly,
    reflectionId: r.selfReflection.id,
  }));
}

/**
 * Fetch a single review + full reflection for the chair approval detail page.
 */
export async function getReviewForChair(reviewId: string) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return null;

  const userId = session.user.id as string;
  const roles = session.user.roles ?? [];
  const isAdmin = roles.includes("ADMIN");

  const review = await prisma.mentorGoalReview.findUnique({
    where: { id: reviewId },
    include: {
      mentor: { select: { id: true, name: true, email: true } },
      mentee: { select: { id: true, name: true, email: true, primaryRole: true } },
      selfReflection: {
        include: {
          goalResponses: {
            include: { goal: { select: { id: true, title: true, description: true, sortOrder: true } } },
            orderBy: { goal: { sortOrder: "asc" } },
          },
        },
      },
      goalRatings: {
        include: { goal: { select: { id: true, title: true, sortOrder: true } } },
        orderBy: { goal: { sortOrder: "asc" } },
      },
    },
  });

  if (!review) return null;

  // Access: admin or an active chair for this mentee's role group
  if (!isAdmin) {
    const menteeRoleType = toMenteeRoleType(review.mentee.primaryRole);
    if (!menteeRoleType) return null;
    const isChair = await prisma.mentorCommitteeChair.findFirst({
      where: { userId, roleType: menteeRoleType, isActive: true },
    });
    if (!isChair) return null;
  }

  return review;
}

// ============================================
// CHAIR ACTIONS: APPROVE / REQUEST CHANGES
// ============================================

/**
 * Chair approves a review. Triggers point award + release to mentee.
 */
export async function approveGoalReview(formData: FormData) {
  const session = await requireAdmin();

  const reviewId = getString(formData, "reviewId");
  const chairComments = getString(formData, "chairComments", false);

  const review = await prisma.mentorGoalReview.findUniqueOrThrow({
    where: { id: reviewId },
    include: {
      mentee: { select: { id: true, name: true, primaryRole: true } },
    },
  });

  if (review.status === "APPROVED") throw new Error("Already approved");

  const menteeRoleType = toMenteeRoleType(review.mentee.primaryRole);
  if (!menteeRoleType) throw new Error("Mentee role not eligible for point awards");

  const pointsAwarded = POINT_TABLE[review.overallRating][menteeRoleType];
  const now = new Date();

  await prisma.$transaction(async (tx) => {
    // Approve the review
    await tx.mentorGoalReview.update({
      where: { id: reviewId },
      data: {
        status: "APPROVED",
        chairReviewerId: session.user.id,
        chairComments: chairComments || null,
        chairApprovedAt: now,
        releasedToMenteeAt: now,
        pointsAwarded,
      },
    });

    // Upsert achievement summary
    const summary = await tx.achievementPointSummary.upsert({
      where: { userId: review.menteeId },
      create: {
        userId: review.menteeId,
        totalPoints: pointsAwarded,
        currentTier: computeTier(pointsAwarded),
      },
      update: {
        totalPoints: { increment: pointsAwarded },
      },
    });

    // Recompute tier after increment
    const newTotal = summary.totalPoints + pointsAwarded;
    const newTier = computeTier(newTotal);
    await tx.achievementPointSummary.update({
      where: { userId: review.menteeId },
      data: { currentTier: newTier },
    });

    // Log point entry
    await tx.achievementPointLog.create({
      data: {
        summaryId: summary.id,
        reviewId,
        points: pointsAwarded,
        reason: `${review.overallRating} — ${menteeRoleType} (Cycle ${review.cycleNumber})`,
        cycleMonth: review.cycleMonth,
      },
    });
  });

  await logAuditEvent({
    action: "MENTORSHIP_UPDATED",
    actorId: session.user.id,
    targetType: "MentorGoalReview",
    targetId: reviewId,
    description: `Goal review approved for ${review.mentee.name} — ${pointsAwarded} pts awarded`,
  });

  revalidatePath("/mentorship-program/chair");
  revalidatePath("/my-program");
}

/**
 * Chair requests changes on a review (sends it back to CHANGES_REQUESTED).
 */
export async function requestReviewChanges(formData: FormData) {
  const session = await requireAdmin();

  const reviewId = getString(formData, "reviewId");
  const chairComments = getString(formData, "chairComments");

  const review = await prisma.mentorGoalReview.findUniqueOrThrow({
    where: { id: reviewId },
    include: { mentee: { select: { name: true } } },
  });

  if (review.status === "APPROVED") throw new Error("Cannot request changes on an approved review");

  await prisma.mentorGoalReview.update({
    where: { id: reviewId },
    data: {
      status: "CHANGES_REQUESTED",
      chairReviewerId: session.user.id,
      chairComments,
    },
  });

  await logAuditEvent({
    action: "MENTORSHIP_UPDATED",
    actorId: session.user.id,
    targetType: "MentorGoalReview",
    targetId: reviewId,
    description: `Changes requested on goal review for ${review.mentee.name}`,
  });

  revalidatePath("/mentorship-program/chair");
  revalidatePath("/mentorship-program/reviews");
}

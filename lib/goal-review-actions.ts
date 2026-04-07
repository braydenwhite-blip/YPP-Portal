"use server";

import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth-supabase";
import { revalidatePath } from "next/cache";
import {
  GoalRatingColor,
  GoalReviewStatus,
  MenteeRoleType,
  AchievementAwardTier,
} from "@prisma/client";
import { logAuditEvent } from "@/lib/audit-log-actions";
import { toMenteeRoleType } from "@/lib/mentee-role-utils";
import { createMentorshipNotification } from "@/lib/mentorship-program-actions";
import { syncMentorGoalReviewWorkflow } from "@/lib/workflow";

// ============================================
// POINT TABLE
// ============================================

// Achievement point values per overall rating × role type (from YPP Mentorship Program PDF)
const POINT_TABLE: Record<GoalRatingColor, Record<MenteeRoleType, number>> = {
  BEHIND_SCHEDULE: { INSTRUCTOR: 0, CHAPTER_PRESIDENT: 0, GLOBAL_LEADERSHIP: 0 },
  GETTING_STARTED: { INSTRUCTOR: 10, CHAPTER_PRESIDENT: 20, GLOBAL_LEADERSHIP: 25 },
  ACHIEVED: { INSTRUCTOR: 35, CHAPTER_PRESIDENT: 50, GLOBAL_LEADERSHIP: 60 },
  ABOVE_AND_BEYOND: { INSTRUCTOR: 75, CHAPTER_PRESIDENT: 85, GLOBAL_LEADERSHIP: 100 },
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
  const session = await getSession();
  if (!session?.user?.id) throw new Error("Unauthorized");
  const roles = session.user.roles ?? [];
  if (!roles.includes("MENTOR") && !roles.includes("ADMIN") && !roles.includes("CHAPTER_PRESIDENT")) {
    throw new Error("Unauthorized");
  }
  return session as typeof session & { user: { id: string } };
}

async function requireAdmin() {
  const session = await getSession();
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
  const session = await getSession();
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
  const session = await getSession();
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

  // Character & Culture bonus points (0–25)
  const bonusPointsRaw = formData.get("bonusPoints");
  const bonusPoints = bonusPointsRaw ? Math.max(0, Math.min(25, parseInt(String(bonusPointsRaw), 10) || 0)) : 0;
  const bonusReason = getString(formData, "bonusReason", false);

  const overallRating = overallRatingRaw as GoalRatingColor;
  if (!Object.values(GoalRatingColor).includes(overallRating)) {
    throw new Error("Invalid overall rating");
  }

  const reflection = await prisma.monthlySelfReflection.findUniqueOrThrow({
    where: { id: reflectionId },
    include: {
      mentorship: {
        select: {
          mentorId: true,
          menteeId: true,
          chairId: true,
          reviewStreak: true,
          longestReviewStreak: true,
        },
      },
      mentee: { select: { name: true } },
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

  // Compute mentor review streak (only when submitting for approval, not saving drafts)
  let newReviewStreak = reflection.mentorship.reviewStreak ?? 0;
  let newLongestReviewStreak = reflection.mentorship.longestReviewStreak ?? 0;
  if (submitForApproval) {
    const daysSinceReflection =
      (new Date().getTime() - reflection.submittedAt.getTime()) / (1000 * 60 * 60 * 24);
    const reviewedOnTime = daysSinceReflection <= 7;
    newReviewStreak = reviewedOnTime ? newReviewStreak + 1 : 1;
    newLongestReviewStreak = Math.max(newReviewStreak, newLongestReviewStreak);
  }

  const reviewId = await prisma.$transaction(async (tx) => {
    let persistedReviewId = reflection.goalReview?.id ?? "";

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
          bonusPoints,
          bonusReason: bonusReason || null,
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
      persistedReviewId = reflection.goalReview.id;
    } else {
      // Create new review
      const review = await tx.mentorGoalReview.create({
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
          bonusPoints,
          bonusReason: bonusReason || null,
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
      persistedReviewId = review.id;
    }

    // Update review streak on submission
    if (submitForApproval) {
      await tx.mentorship.update({
        where: { id: reflection.mentorshipId },
        data: { reviewStreak: newReviewStreak, longestReviewStreak: newLongestReviewStreak },
      });
    }

    return persistedReviewId;
  });

  await syncMentorGoalReviewWorkflow(reviewId);

  // Notify chair when review is submitted for approval
  if (submitForApproval && reflection.mentorship.chairId) {
    await createMentorshipNotification({
      userId: reflection.mentorship.chairId,
      title: "Review Pending Your Approval",
      body: `A mentor has submitted a goal review for ${reflection.mentee?.name ?? "a mentee"} and it needs your approval.`,
      link: "/mentorship-program/chair",
    });
  }

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
  const session = await getSession();
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
                    ? ["CHAPTER_PRESIDENT"]
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
  const session = await getSession();
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

  // Chair can adjust bonus points (optional)
  const chairAdjustedBonusRaw = formData.get("chairAdjustedBonusPoints");
  const chairAdjustedBonusPoints = chairAdjustedBonusRaw !== null && chairAdjustedBonusRaw !== ""
    ? Math.max(0, Math.min(25, parseInt(String(chairAdjustedBonusRaw), 10) || 0))
    : null;

  const review = await prisma.mentorGoalReview.findUniqueOrThrow({
    where: { id: reviewId },
    include: {
      mentee: { select: { id: true, name: true, primaryRole: true } },
      mentor: { select: { id: true } },
    },
  });

  if (review.status === "APPROVED") throw new Error("Already approved");

  const menteeRoleType = toMenteeRoleType(review.mentee.primaryRole);
  if (!menteeRoleType) throw new Error("Mentee role not eligible for point awards");

  const basePoints = POINT_TABLE[review.overallRating][menteeRoleType];
  const effectiveBonus = chairAdjustedBonusPoints ?? review.bonusPoints;
  const pointsAwarded = basePoints + effectiveBonus;
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
        chairAdjustedBonusPoints: chairAdjustedBonusPoints,
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

  await syncMentorGoalReviewWorkflow(reviewId);

  await logAuditEvent({
    action: "MENTORSHIP_UPDATED",
    actorId: session.user.id,
    targetType: "MentorGoalReview",
    targetId: reviewId,
    description: `Goal review approved for ${review.mentee.name} — ${pointsAwarded} pts awarded (base: ${basePoints}, bonus: ${effectiveBonus})`,
  });

  // Notify mentor that their review was approved
  await createMentorshipNotification({
    userId: review.mentor.id,
    title: "Goal Review Approved",
    body: `Your review for ${review.mentee.name} (Cycle ${review.cycleNumber}) has been approved. ${pointsAwarded} points awarded.`,
    link: "/mentorship-program/reviews",
  });

  // Notify mentee that their review is available
  await createMentorshipNotification({
    userId: review.menteeId,
    title: "New Goal Review Available",
    body: `Your Cycle ${review.cycleNumber} goal review has been completed and released. You earned ${pointsAwarded} achievement points!`,
    link: "/my-program",
  });

  revalidatePath("/mentorship-program/chair");
  revalidatePath("/my-program");
}

// ============================================
// QUARTERLY STAKEHOLDER FEEDBACK
// ============================================

/**
 * Mentor creates a stakeholder feedback request for a quarterly review cycle.
 * Returns the unique token to share with external stakeholders.
 */
export async function createFeedbackRequest(formData: FormData) {
  const session = await requireMentor();

  const mentorshipId = getString(formData, "mentorshipId");
  const reviewId = getString(formData, "reviewId", false);
  const quarterNumber = parseInt(getString(formData, "quarterNumber") || "1", 10);

  // Verify mentor owns this mentorship
  const mentorship = await prisma.mentorship.findUniqueOrThrow({
    where: { id: mentorshipId },
    select: { mentorId: true },
  });

  const roles = session.user.roles ?? [];
  const isAdmin = roles.includes("ADMIN");
  if (mentorship.mentorId !== session.user.id && !isAdmin) {
    throw new Error("Unauthorized");
  }

  const request = await prisma.quarterlyFeedbackRequest.create({
    data: {
      mentorshipId,
      reviewId: reviewId || null,
      quarterNumber,
      requestedById: session.user.id,
    },
  });

  revalidatePath(`/mentorship-program/quarterly/${reviewId}`);
  return { success: true, token: request.token };
}

/**
 * Submit a stakeholder feedback response via public token link.
 */
export async function submitFeedbackResponse(formData: FormData) {
  const token = getString(formData, "token");
  const respondentName = getString(formData, "respondentName");
  const respondentEmail = getString(formData, "respondentEmail", false);
  const respondentRole = getString(formData, "respondentRole");
  const overallRatingRaw = parseInt(getString(formData, "overallRating"), 10);
  const strengths = getString(formData, "strengths");
  const areasForGrowth = getString(formData, "areasForGrowth");
  const additionalNotes = getString(formData, "additionalNotes", false);

  if (overallRatingRaw < 1 || overallRatingRaw > 5) throw new Error("Rating must be 1-5");

  const request = await prisma.quarterlyFeedbackRequest.findUnique({
    where: { token },
  });
  if (!request) throw new Error("Invalid feedback link");

  await prisma.quarterlyFeedbackResponse.create({
    data: {
      requestId: request.id,
      respondentName,
      respondentEmail: respondentEmail || null,
      respondentRole,
      overallRating: overallRatingRaw,
      strengths,
      areasForGrowth,
      additionalNotes: additionalNotes || null,
    },
  });

  return { success: true };
}

/**
 * Get a summary of stakeholder feedback responses for a feedback request.
 */
export async function getFeedbackSummary(token: string) {
  const request = await prisma.quarterlyFeedbackRequest.findUnique({
    where: { token },
    include: {
      responses: {
        orderBy: { submittedAt: "desc" },
      },
    },
  });

  if (!request) return null;

  const responses = request.responses;
  const avgRating =
    responses.length > 0
      ? responses.reduce((sum, r) => sum + r.overallRating, 0) / responses.length
      : null;

  return {
    requestId: request.id,
    token: request.token,
    quarterNumber: request.quarterNumber,
    totalResponses: responses.length,
    avgRating: avgRating !== null ? Math.round(avgRating * 10) / 10 : null,
    responses: responses.map((r) => ({
      id: r.id,
      respondentName: r.respondentName,
      respondentRole: r.respondentRole,
      overallRating: r.overallRating,
      strengths: r.strengths,
      areasForGrowth: r.areasForGrowth,
      additionalNotes: r.additionalNotes,
      submittedAt: r.submittedAt.toISOString(),
    })),
  };
}

/**
 * Get quarterly review data (3 monthly reviews side-by-side) for the quarterly dashboard.
 */
export async function getQuarterlyReviewData(reviewId: string) {
  const session = await getSession();
  if (!session?.user?.id) return null;

  const userId = session.user.id as string;
  const roles = session.user.roles ?? [];
  const isAdmin = roles.includes("ADMIN");

  const review = await prisma.mentorGoalReview.findUnique({
    where: { id: reviewId },
    include: {
      mentor: { select: { id: true, name: true } },
      mentee: { select: { id: true, name: true, email: true, primaryRole: true } },
      mentorship: { select: { id: true, mentorId: true } },
      goalRatings: {
        include: { goal: { select: { title: true, sortOrder: true } } },
        orderBy: { goal: { sortOrder: "asc" } },
      },
      feedbackRequests: {
        include: { responses: true },
        orderBy: { createdAt: "desc" },
        take: 1,
      },
    },
  });

  if (!review) return null;

  // Access: mentor, mentee (if released), or admin
  const isMentor = review.mentorship.mentorId === userId;
  const isMentee = review.menteeId === userId && review.releasedToMenteeAt !== null;
  if (!isMentor && !isMentee && !isAdmin) return null;

  if (!review.isQuarterly) return null;

  // Fetch the 2 preceding reviews in the same quarter group
  const precedingReviews = await prisma.mentorGoalReview.findMany({
    where: {
      mentorshipId: review.mentorshipId,
      cycleNumber: { in: [review.cycleNumber - 2, review.cycleNumber - 1] },
      status: "APPROVED",
    },
    include: {
      goalRatings: {
        include: { goal: { select: { title: true, sortOrder: true } } },
        orderBy: { goal: { sortOrder: "asc" } },
      },
    },
    orderBy: { cycleNumber: "asc" },
  });

  // Feedback summary
  const feedbackRequest = review.feedbackRequests[0] ?? null;
  const feedbackSummary = feedbackRequest
    ? {
        token: feedbackRequest.token,
        totalResponses: feedbackRequest.responses.length,
        avgRating:
          feedbackRequest.responses.length > 0
            ? feedbackRequest.responses.reduce((s, r) => s + r.overallRating, 0) /
              feedbackRequest.responses.length
            : null,
        responses: feedbackRequest.responses.map((r) => ({
          respondentName: r.respondentName,
          respondentRole: r.respondentRole,
          overallRating: r.overallRating,
          strengths: r.strengths,
          areasForGrowth: r.areasForGrowth,
        })),
      }
    : null;

  type ReviewForMap = {
    id: string;
    cycleNumber: number;
    cycleMonth: Date;
    overallRating: GoalRatingColor;
    pointsAwarded: number | null;
    overallComments: string;
    planOfAction: string;
    bonusPoints: number;
    bonusReason: string | null;
    isQuarterly: boolean;
    projectedFuturePath: string | null;
    promotionReadiness: string | null;
    chairComments: string | null;
    goalRatings: Array<{
      rating: GoalRatingColor;
      comments: string | null;
      goal: { title: string };
    }>;
  };

  const mapReview = (r: ReviewForMap) => ({
    id: r.id,
    cycleNumber: r.cycleNumber,
    cycleMonth: r.cycleMonth.toISOString(),
    overallRating: r.overallRating,
    pointsAwarded: r.pointsAwarded,
    overallComments: r.overallComments,
    planOfAction: r.planOfAction,
    bonusPoints: r.bonusPoints,
    bonusReason: r.bonusReason,
    isQuarterly: r.isQuarterly,
    projectedFuturePath: r.projectedFuturePath,
    promotionReadiness: r.promotionReadiness,
    chairComments: r.chairComments,
    goalRatings: r.goalRatings.map((gr) => ({
      goalTitle: gr.goal.title,
      rating: gr.rating,
      comments: gr.comments,
    })),
  });

  return {
    quarterlyReview: mapReview(review),
    precedingReviews: precedingReviews.map(mapReview),
    mentee: {
      id: review.mentee.id,
      name: review.mentee.name,
      email: review.mentee.email,
      role: review.mentee.primaryRole,
    },
    mentor: { id: review.mentor.id, name: review.mentor.name },
    mentorshipId: review.mentorshipId,
    isMentor: isMentor || isAdmin,
    feedbackSummary,
  };
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
    include: { mentee: { select: { name: true } }, mentor: { select: { id: true } } },
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

  await syncMentorGoalReviewWorkflow(reviewId);

  await logAuditEvent({
    action: "MENTORSHIP_UPDATED",
    actorId: session.user.id,
    targetType: "MentorGoalReview",
    targetId: reviewId,
    description: `Changes requested on goal review for ${review.mentee.name}`,
  });

  // Notify mentor that changes were requested
  await createMentorshipNotification({
    userId: review.mentor.id,
    title: "Review Changes Requested",
    body: `The chair has requested changes on your review for ${review.mentee.name}. Please review the feedback and update.`,
    link: "/mentorship-program/reviews",
  });

  revalidatePath("/mentorship-program/chair");
  revalidatePath("/mentorship-program/reviews");
}

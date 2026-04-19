"use server";

import { prisma } from "@/lib/prisma";
import { MENTORSHIP_LEGACY_ROOT_SELECT } from "@/lib/mentorship-read-fragments";
import { getSession } from "@/lib/auth-supabase";
import { revalidatePath } from "next/cache";
import {
  GoalRatingColor,
  GoalReviewStatus,
} from "@prisma/client";
import { logAuditEvent } from "@/lib/audit-log-actions";
import { toMenteeRoleType } from "@/lib/mentee-role-utils";
import { createMentorshipNotification } from "@/lib/mentorship-program-actions";
import { syncMentorGoalReviewWorkflow } from "@/lib/workflow";
import { computeTier } from "@/lib/achievement-tier-utils";
import { recomputeMentorshipCycleStage } from "@/lib/mentorship-cycle";
import { POINT_TABLE } from "@/lib/mentorship-point-table";
import {
  emitReviewSubmittedForApproval,
  emitReviewApprovedAndReleased,
} from "@/lib/mentorship-notifications";
import { ensureReviewGoalRatings } from "@/lib/mentorship-gr-binding";
import { insertMilestoneOnce, checkTenureMilestones } from "@/lib/milestones";
import { logger } from "@/lib/logger";

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
    select: {
      ...MENTORSHIP_LEGACY_ROOT_SELECT,
      mentee: { select: { id: true, name: true, email: true, primaryRole: true } },
      selfReflections: {
        orderBy: { cycleNumber: "desc" },
        select: {
          id: true,
          cycleNumber: true,
          cycleMonth: true,
          submittedAt: true,
          mentorshipId: true,
          menteeId: true,
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
  const aiDraftUsed = formData.get("aiDraftUsed") === "true";

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

  // Parse per-goal ratings — G&R goals (grGoalIds) take priority over legacy goalIds
  const grGoalIds = formData.getAll("grGoalIds").map(String).filter(Boolean);
  const legacyGoalIds = formData.getAll("goalIds").map(String).filter(Boolean);

  type GoalRatingEntry = {
    grDocumentGoalId: string | null;
    legacyGoalId: string | null;
    rating: GoalRatingColor;
    comments: string | null;
    progressState: string | null;
    newLifecycleStatus: string | null;
  };

  const goalRatings: GoalRatingEntry[] = [
    ...grGoalIds.map((goalId) => {
      const ratingRaw = getString(formData, `goal_${goalId}_rating`);
      const rating = ratingRaw as GoalRatingColor;
      if (!Object.values(GoalRatingColor).includes(rating)) throw new Error(`Invalid rating for goal ${goalId}`);
      return {
        grDocumentGoalId: goalId,
        legacyGoalId: null,
        rating,
        comments: getString(formData, `goal_${goalId}_comments`, false) || null,
        progressState: getString(formData, `goal_${goalId}_progressState`, false) || null,
        newLifecycleStatus: getString(formData, `goal_${goalId}_lifecycleStatus`, false) || null,
      };
    }),
    ...legacyGoalIds.map((goalId) => {
      const ratingRaw = getString(formData, `goal_${goalId}_rating`);
      const rating = ratingRaw as GoalRatingColor;
      if (!Object.values(GoalRatingColor).includes(rating)) throw new Error(`Invalid rating for goal ${goalId}`);
      return {
        grDocumentGoalId: null,
        legacyGoalId: goalId,
        rating,
        comments: getString(formData, `goal_${goalId}_comments`, false) || null,
        progressState: null,
        newLifecycleStatus: null,
      };
    }),
  ];

  // Parse next-month goal drafts (structured goals to propose via GRGoalChange)
  type NextMonthGoalDraft = { title: string; description: string; priority: string; dueDate: string | null };
  let nextMonthGoalDrafts: NextMonthGoalDraft[] = [];
  const nextMonthGoalsJson = formData.get("nextMonthGoalsJson");
  if (nextMonthGoalsJson && typeof nextMonthGoalsJson === "string") {
    try {
      nextMonthGoalDrafts = JSON.parse(nextMonthGoalsJson) as NextMonthGoalDraft[];
    } catch {
      logger.warn("saveGoalReview: failed to parse nextMonthGoalsJson");
    }
  }

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
          ...(aiDraftUsed ? { aiDraftUsed: true } : {}),
        },
      });
      // Replace goal ratings
      await tx.goalReviewRating.deleteMany({ where: { reviewId: reflection.goalReview.id } });
      await tx.goalReviewRating.createMany({
        data: goalRatings.map((gr) => ({
          reviewId: reflection.goalReview!.id,
          grDocumentGoalId: gr.grDocumentGoalId,
          goalId: gr.legacyGoalId,
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
          aiDraftUsed,
          goalRatings: {
            create: goalRatings.map((gr) => ({
              grDocumentGoalId: gr.grDocumentGoalId,
              goalId: gr.legacyGoalId,
              rating: gr.rating,
              comments: gr.comments,
            })),
          },
        },
      });
      persistedReviewId = review.id;
    }

    // Persist next-month goal drafts on DRAFT saves so the form survives a refresh
    await tx.mentorGoalReview.update({
      where: { id: persistedReviewId },
      data: {
        nextMonthGoalDraftsJson: newStatus === "DRAFT" && nextMonthGoalDrafts.length > 0
          ? JSON.parse(JSON.stringify(nextMonthGoalDrafts))
          : undefined,
      },
    });

    // Apply inline goal status updates (progressState / lifecycleStatus) ONLY on submission
    if (submitForApproval) {
      const now = new Date();
      for (const gr of goalRatings) {
        if (!gr.grDocumentGoalId) continue;
        const update: Record<string, unknown> = {};
        if (gr.progressState) update.progressState = gr.progressState;
        if (gr.newLifecycleStatus) {
          update.lifecycleStatus = gr.newLifecycleStatus;
          if (gr.newLifecycleStatus === "COMPLETED") update.completedAt = now;
        }
        if (Object.keys(update).length > 0) {
          await tx.gRDocumentGoal.update({ where: { id: gr.grDocumentGoalId }, data: update });
        }
      }
    }

    // Write goal snapshots when submitting for approval — never delete existing ones
    if (submitForApproval && grGoalIds.length > 0) {
      const grGoals = await tx.gRDocumentGoal.findMany({
        where: { id: { in: grGoalIds } },
        select: { id: true, title: true, description: true, timePhase: true, priority: true, dueDate: true, lifecycleStatus: true },
      });
      const snapshotReviewId = persistedReviewId;
      // Check which snapshots already exist (idempotent: only insert new ones)
      const existingSnapshots = await tx.mentorGoalReviewGoalSnapshot.findMany({
        where: { reviewId: snapshotReviewId },
        select: { grDocumentGoalId: true },
      });
      const existingSnapshotGoalIds = new Set(existingSnapshots.map((s) => s.grDocumentGoalId));
      const newSnapshots = grGoals.filter((g) => !existingSnapshotGoalIds.has(g.id));
      if (newSnapshots.length > 0) {
        await tx.mentorGoalReviewGoalSnapshot.createMany({
          data: newSnapshots.map((g) => ({
            id: `${snapshotReviewId}_${g.id}`,
            reviewId: snapshotReviewId,
            grDocumentGoalId: g.id,
            title: g.title,
            description: g.description,
            timePhase: g.timePhase,
            priority: g.priority,
            dueDateAtSnapshot: g.dueDate,
            lifecycleStatusAtSnapshot: g.lifecycleStatus,
          })),
          skipDuplicates: true,
        });
      }
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

  // Propose next-month goals via GRGoalChange when submitting for approval.
  // All proposals run inside their own transaction via proposeGRGoalChange;
  // failures are logged but don't roll back the already-committed review.
  if (submitForApproval && nextMonthGoalDrafts.length > 0) {
    const grDoc = await prisma.gRDocument.findFirst({
      where: { userId: reflection.mentorship.menteeId, status: "ACTIVE" },
      select: { id: true },
    });
    if (grDoc) {
      await prisma.$transaction(async () => {
        for (const draft of nextMonthGoalDrafts) {
          const fd = new FormData();
          fd.set("documentId", grDoc.id);
          fd.set("changeType", "ADD");
          fd.set("proposedTitle", draft.title);
          fd.set("proposedDescription", draft.description || "");
          fd.set("proposedTimePhase", "MONTHLY");
          fd.set("proposedPriority", draft.priority || "NORMAL");
          if (draft.dueDate) fd.set("proposedDueDate", draft.dueDate);
          fd.set("sourceReviewId", reviewId);
          fd.set("reason", `Proposed by mentor for next cycle (review ${reviewId})`);
          const { proposeGRGoalChange } = await import("@/lib/gr-actions");
          await proposeGRGoalChange(fd);
        }
      }).catch((err) => {
        logger.warn({ err, reviewId }, "saveGoalReview: failed to propose next-month goals (rolled back)");
      });
    }
  }

  // Backfill any missing GoalReviewRating rows (idempotent).
  try {
    await ensureReviewGoalRatings({
      id: reviewId,
      menteeId: reflection.mentorship.menteeId,
      cycleNumber: reflection.cycleNumber,
    });
  } catch (err) {
    logger.warn({ err, reviewId }, "saveGoalReview: ensureReviewGoalRatings failed");
  }

  // Recompute denormalized cycleStage for the Kanban.
  try {
    await recomputeMentorshipCycleStage(reflection.mentorshipId);
  } catch (err) {
    logger.warn({ err, mentorshipId: reflection.mentorshipId }, "saveGoalReview: cycleStage recompute failed");
  }

  if (submitForApproval) {
    // Fan out to lane chairs (Phase 0.9 emitter — includes dedup + try/catch).
    const mentee = await prisma.user.findUnique({
      where: { id: reflection.mentorship.menteeId },
      select: { name: true, primaryRole: true },
    });
    const mentor = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { name: true },
    });
    await emitReviewSubmittedForApproval({
      reviewId,
      mentorName: mentor?.name ?? "A mentor",
      menteeName: mentee?.name ?? "a mentee",
      menteePrimaryRole: mentee?.primaryRole ?? null,
      ctx: { cycleNumber: reflection.cycleNumber, cycleMonth: reflection.cycleMonth },
    });

    // Legacy per-mentorship chair fallback (preserves in-flight explicit chair assignments).
    if (reflection.mentorship.chairId) {
      await createMentorshipNotification({
        userId: reflection.mentorship.chairId,
        title: "Review Pending Your Approval",
        body: `A mentor has submitted a goal review for ${reflection.mentee?.name ?? "a mentee"} and it needs your approval.`,
        link: "/mentorship-program/chair",
      });
    }
  }

  revalidatePath("/mentorship/reviews");
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

    // Upsert achievement summary — fetch fresh row after increment to avoid stale totalPoints
    await tx.achievementPointSummary.upsert({
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
    const freshSummary = await tx.achievementPointSummary.findUniqueOrThrow({
      where: { userId: review.menteeId },
      select: { id: true, totalPoints: true },
    });

    const newTier = computeTier(freshSummary.totalPoints);
    await tx.achievementPointSummary.update({
      where: { userId: review.menteeId },
      data: { currentTier: newTier },
    });

    // Log point entry
    await tx.achievementPointLog.create({
      data: {
        summaryId: freshSummary.id,
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

  // Milestone events — fire-and-forget, never fail the approval
  try {
    if (review.overallRating === "ABOVE_AND_BEYOND") {
      await insertMilestoneOnce(review.menteeId, "ABOVE_AND_BEYOND_FIRST", {
        reviewId,
        cycleNumber: review.cycleNumber,
      });
    }
    const mentorshipRow = await prisma.mentorGoalReview.findUnique({
      where: { id: reviewId },
      select: { mentorshipId: true },
    });
    if (mentorshipRow) {
      await checkTenureMilestones(review.menteeId, mentorshipRow.mentorshipId);
    }
  } catch (err) {
    logger.warn({ err, reviewId }, "approveGoalReview: milestone check failed");
  }

  // Phase 0.9 cycle-milestone emitter (mentor + mentee, safeEmit + dedup).
  await emitReviewApprovedAndReleased({
    reviewId,
    mentorId: review.mentor.id,
    menteeId: review.menteeId,
    menteeName: review.mentee.name ?? "your mentee",
    pointsAwarded,
    ctx: { cycleNumber: review.cycleNumber, cycleMonth: review.cycleMonth },
  });

  // Recompute denormalized cycleStage.
  try {
    const mentorshipRow = await prisma.mentorGoalReview.findUnique({
      where: { id: reviewId },
      select: { mentorshipId: true },
    });
    if (mentorshipRow) await recomputeMentorshipCycleStage(mentorshipRow.mentorshipId);
  } catch (err) {
    logger.warn({ err, reviewId }, "approveGoalReview: cycleStage recompute failed");
  }

  revalidatePath("/mentorship/reviews");
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
      goal: { title: string } | null;
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
      goalTitle: gr.goal?.title ?? "",
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

  const updated = await prisma.mentorGoalReview.update({
    where: { id: reviewId },
    data: {
      status: "CHANGES_REQUESTED",
      chairReviewerId: session.user.id,
      chairComments,
    },
    select: { mentorshipId: true },
  });

  await syncMentorGoalReviewWorkflow(reviewId);

  // Recompute denormalized cycleStage so the mentor Kanban shows CHANGES_REQUESTED.
  try {
    await recomputeMentorshipCycleStage(updated.mentorshipId);
  } catch (err) {
    logger.warn({ err, reviewId }, "requestReviewChanges: cycleStage recompute failed");
  }

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

// ============================================
// BULK APPROVE (Chair / Admin)
// ============================================

/**
 * Approve multiple reviews in a single action. Light guardrail: rejects if any
 * review is not currently PENDING_CHAIR_APPROVAL. Each approved review is
 * processed exactly like a single approveGoalReview call.
 */
export async function bulkApproveReviews(formData: FormData) {
  const session = await requireAdmin();
  const reviewIdsRaw = formData.getAll("reviewIds").map(String).filter(Boolean);
  if (reviewIdsRaw.length === 0) throw new Error("No review IDs provided");
  if (reviewIdsRaw.length > 20) throw new Error("Bulk approve is limited to 20 reviews at a time");

  const reviews = await prisma.mentorGoalReview.findMany({
    where: { id: { in: reviewIdsRaw } },
    select: { id: true, status: true },
  });

  const notPending = reviews.filter((r) => r.status !== "PENDING_CHAIR_APPROVAL");
  if (notPending.length > 0) {
    throw new Error(
      `${notPending.length} review(s) are not pending approval and cannot be bulk-approved`
    );
  }

  const results: { id: string; ok: boolean; error?: string }[] = [];
  for (const review of reviews) {
    const fd = new FormData();
    fd.set("reviewId", review.id);
    fd.set("chairComments", "Approved via bulk action");
    try {
      await approveGoalReview(fd);
      results.push({ id: review.id, ok: true });
    } catch (err) {
      results.push({ id: review.id, ok: false, error: err instanceof Error ? err.message : "Unknown error" });
    }
  }

  await logAuditEvent({
    action: "MENTORSHIP_UPDATED",
    actorId: session.user.id,
    targetType: "MentorGoalReview",
    targetId: reviewIdsRaw.join(","),
    description: `Bulk approved ${results.filter((r) => r.ok).length}/${reviewIdsRaw.length} reviews`,
  });

  revalidatePath("/mentorship-program/chair");
  revalidatePath("/admin/mentorship-program");
  return results;
}

// ============================================
// CHAIR QUEUE DATA (for admin monitoring)
// ============================================

/**
 * Returns pending reviews enriched with age-in-days and overdue flag (>5 business days).
 */
export async function getChairQueueEnriched() {
  const session = await getSession();
  if (!session?.user?.id) return null;

  const reviews = await prisma.mentorGoalReview.findMany({
    where: { status: "PENDING_CHAIR_APPROVAL" },
    orderBy: { createdAt: "asc" },
    include: {
      mentee: { select: { id: true, name: true, primaryRole: true } },
      mentor: { select: { id: true, name: true } },
      goalRatings: { select: { rating: true } },
    },
  });

  const now = new Date();
  return reviews.map((r) => {
    const ageDays = Math.floor((now.getTime() - r.createdAt.getTime()) / (1000 * 60 * 60 * 24));
    // Rough business-day approximation: weekends don't count (subtract ≈28.5% of total days)
    const businessDays = Math.floor(ageDays * 0.715);
    return {
      id: r.id,
      mentee: r.mentee,
      mentor: r.mentor,
      cycleMonth: r.cycleMonth.toISOString(),
      overallRating: r.overallRating,
      isQuarterly: r.isQuarterly,
      ageDays,
      isOverdue: businessDays > 5,
      createdAt: r.createdAt.toISOString(),
      ratingDistribution: Object.fromEntries(
        ["BEHIND_SCHEDULE", "GETTING_STARTED", "ACHIEVED", "ABOVE_AND_BEYOND"].map((c) => [
          c,
          r.goalRatings.filter((gr) => gr.rating === c).length,
        ])
      ),
    };
  });
}

/**
 * Returns counts of active mentorships that have no review submitted for the current cycle month.
 */
export async function getReviewCompletionStatus() {
  const session = await getSession();
  if (!session?.user?.id) return null;

  const cycleStart = new Date();
  cycleStart.setDate(1);
  cycleStart.setHours(0, 0, 0, 0);

  const activeMentorships = await prisma.mentorship.findMany({
    where: { status: "ACTIVE" },
    select: {
      id: true,
      menteeId: true,
      mentorId: true,
      mentee: { select: { name: true, primaryRole: true } },
      mentor: { select: { name: true } },
      goalReviews: {
        where: { cycleMonth: { gte: cycleStart } },
        select: { id: true, status: true },
        take: 1,
      },
    },
  });

  const missing = activeMentorships.filter((m) => m.goalReviews.length === 0);
  const submitted = activeMentorships.filter((m) => m.goalReviews.length > 0);

  return {
    total: activeMentorships.length,
    submitted: submitted.length,
    missing: missing.map((m) => ({
      mentorshipId: m.id,
      menteeName: m.mentee.name,
      menteeRole: m.mentee.primaryRole,
      mentorName: m.mentor.name,
    })),
  };
}

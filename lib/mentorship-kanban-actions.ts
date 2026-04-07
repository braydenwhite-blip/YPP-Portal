"use server";

import { getSession } from "@/lib/auth-supabase";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import {
  GoalReviewStatus,
  MentorshipReviewStatus,
} from "@prisma/client";

async function requireAdmin() {
  const session = await getSession();
  if (!session?.user?.id) throw new Error("Not authenticated");
  const roles = session.user.roles ?? [];
  if (!roles.includes("ADMIN")) throw new Error("Unauthorized");
  return session.user.id;
}

/* ── Goal Review Status Updates ───────────────────── */

const VALID_GOAL_REVIEW_STATUSES: GoalReviewStatus[] = [
  "DRAFT",
  "PENDING_CHAIR_APPROVAL",
  "CHANGES_REQUESTED",
  "APPROVED",
];

export async function updateGoalReviewStage(
  reviewId: string,
  newStatus: string
): Promise<{ success: boolean; error?: string }> {
  try {
    await requireAdmin();

    if (!VALID_GOAL_REVIEW_STATUSES.includes(newStatus as GoalReviewStatus)) {
      return { success: false, error: `Invalid status: ${newStatus}` };
    }

    await prisma.mentorGoalReview.update({
      where: { id: reviewId },
      data: {
        status: newStatus as GoalReviewStatus,
        ...(newStatus === "APPROVED" ? { chairApprovedAt: new Date() } : {}),
      },
    });

    revalidatePath("/admin/mentorship-program");
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message || "Failed to update status" };
  }
}

/* ── Monthly Review Status Updates ────────────────── */

const VALID_MONTHLY_REVIEW_STATUSES: MentorshipReviewStatus[] = [
  "DRAFT",
  "PENDING_CHAIR_APPROVAL",
  "APPROVED",
  "RETURNED",
];

export async function updateMonthlyReviewStage(
  reviewId: string,
  newStatus: string
): Promise<{ success: boolean; error?: string }> {
  try {
    await requireAdmin();

    if (!VALID_MONTHLY_REVIEW_STATUSES.includes(newStatus as MentorshipReviewStatus)) {
      return { success: false, error: `Invalid status: ${newStatus}` };
    }

    await prisma.monthlyGoalReview.update({
      where: { id: reviewId },
      data: {
        status: newStatus as MentorshipReviewStatus,
        ...(newStatus === "APPROVED"
          ? { chairDecisionAt: new Date() }
          : {}),
      },
    });

    revalidatePath("/admin/mentorship-program");
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message || "Failed to update status" };
  }
}

/* ── Mentee Matching Stage (virtual stages) ───────── */

export async function updateMenteeMatchingStage(
  menteeId: string,
  newStage: string
): Promise<{ success: boolean; error?: string }> {
  try {
    await requireAdmin();
    // Matching stages are virtual (unassigned/shortlisted/matched).
    // Moving to "matched" triggers mentor assignment via the existing
    // approveMentorMatch server action, so drag-to-matched is blocked.
    // Moving to "shortlisted" just tags the mentee.
    if (newStage === "matched") {
      return {
        success: false,
        error: "Use the matching panel to approve matches.",
      };
    }
    // For shortlisting, we don't need a DB change - it's UI-only state
    revalidatePath("/admin/mentorship-program");
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message || "Failed to update stage" };
  }
}

/* ── Fetch data for mentorship kanban boards ──────── */

export async function getMentorshipGoalReviews() {
  const session = await getSession();
  if (!session?.user?.id) return [];
  const roles = session.user.roles ?? [];
  if (!roles.includes("ADMIN")) return [];

  const reviews = await prisma.mentorGoalReview.findMany({
    include: {
      mentor: { select: { id: true, name: true } },
      mentee: {
        select: {
          id: true,
          name: true,
          email: true,
          primaryRole: true,
          chapter: { select: { name: true } },
        },
      },
      selfReflection: {
        select: { cycleNumber: true, cycleMonth: true, submittedAt: true },
      },
      goalRatings: {
        include: { goal: { select: { id: true, title: true } } },
      },
    },
    orderBy: { updatedAt: "desc" },
  });

  return reviews.map((r) => ({
    id: r.id,
    status: r.status,
    mentorId: r.mentorId,
    mentorName: r.mentor.name,
    menteeId: r.menteeId,
    menteeName: r.mentee.name,
    menteeEmail: r.mentee.email,
    menteeRole: r.mentee.primaryRole,
    menteeChapter: r.mentee.chapter?.name ?? null,
    cycleNumber: r.selfReflection.cycleNumber,
    cycleMonth: r.selfReflection.cycleMonth.toISOString(),
    submittedAt: r.selfReflection.submittedAt.toISOString(),
    overallRating: r.overallRating,
    overallComments: r.overallComments,
    planOfAction: r.planOfAction,
    isQuarterly: r.isQuarterly,
    bonusPoints: r.bonusPoints,
    bonusReason: r.bonusReason,
    chairComments: r.chairComments,
    chairApprovedAt: r.chairApprovedAt?.toISOString() ?? null,
    goalRatings: r.goalRatings.map((gr) => ({
      goalTitle: gr.goal.title,
      rating: gr.rating,
      comment: gr.comment,
    })),
    updatedAt: r.updatedAt.toISOString(),
    createdAt: r.createdAt.toISOString(),
  }));
}

export async function getMentorshipMonthlyReviews() {
  const session = await getSession();
  if (!session?.user?.id) return [];
  const roles = session.user.roles ?? [];
  if (!roles.includes("ADMIN")) return [];

  const reviews = await prisma.monthlyGoalReview.findMany({
    include: {
      mentor: { select: { id: true, name: true } },
      mentee: {
        select: {
          id: true,
          name: true,
          email: true,
          primaryRole: true,
          chapter: { select: { name: true } },
        },
      },
    },
    orderBy: { updatedAt: "desc" },
  });

  return reviews.map((r) => ({
    id: r.id,
    status: r.status,
    mentorName: r.mentor?.name ?? "Unknown",
    menteeId: r.menteeId,
    menteeName: r.mentee.name,
    menteeEmail: r.mentee.email,
    menteeRole: r.mentee.primaryRole,
    menteeChapter: r.mentee.chapter?.name ?? null,
    month: r.month.toISOString(),
    overallStatus: r.overallStatus,
    overallComments: r.overallComments,
    strengths: r.strengths,
    focusAreas: r.focusAreas,
    chairDecisionNotes: r.chairDecisionNotes,
    chairDecisionAt: r.chairDecisionAt?.toISOString() ?? null,
    mentorSubmittedAt: r.mentorSubmittedAt?.toISOString() ?? null,
    updatedAt: r.updatedAt.toISOString(),
    createdAt: r.createdAt.toISOString(),
  }));
}

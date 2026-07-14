"use server";

import { revalidatePath } from "next/cache";
import type { GoalRatingColor } from "@prisma/client";
import { z } from "zod";

import { computeTier } from "@/lib/achievement-tier-utils";
import { requireSessionUser } from "@/lib/authorization";
import { toMenteeRoleType } from "@/lib/mentee-role-utils";
import { mentorshipRequiresChairApproval } from "@/lib/mentorship-canonical";
import { getCurrentCycleMonth, recomputeMentorshipCycleStage } from "@/lib/mentorship-cycle";
import { getGoalsForMentee, ensureReviewGoalRatings } from "@/lib/mentorship-gr-binding";
import {
  emitReviewApprovedAndReleased,
  emitReviewSubmittedForApproval,
} from "@/lib/mentorship-notifications";
import { POINT_TABLE } from "@/lib/mentorship-point-table";
import { createMentorshipNotification } from "@/lib/mentorship-program-actions";
import {
  packGoalProgressText,
  packProgressNarrative,
} from "@/lib/mentorship/monthly-progress-update-shared";
import { prisma } from "@/lib/prisma";
import { syncMentorGoalReviewWorkflow } from "@/lib/workflow";
import { logger } from "@/lib/logger";

const GoalRatingSchema = z.enum([
  "BEHIND_SCHEDULE",
  "GETTING_STARTED",
  "ACHIEVED",
  "ABOVE_AND_BEYOND",
]);

const GoalBlockSchema = z.object({
  goalId: z.string().min(1),
  source: z.enum(["gr", "legacy"]),
  rating: GoalRatingSchema,
  collaborateWith: z.string().max(500).optional().default(""),
  objective: z.string().max(8000).optional().default(""),
  actionItems: z.string().max(8000).optional().default(""),
});

const SubmitSchema = z.object({
  mentorshipId: z.string().min(1),
  menteeId: z.string().min(1),
  overallRating: GoalRatingSchema,
  overallComments: z.string().min(1).max(8000),
  strengths: z.string().min(1).max(4000),
  areasForDevelopment: z.string().min(1).max(4000),
  planOfAction: z.string().min(1).max(8000),
  goals: z.array(GoalBlockSchema).min(0),
});

export type SubmitProgressUpdateInput = z.infer<typeof SubmitSchema>;

function parseActionLines(raw: string): string[] {
  return raw
    .split(/\r?\n/)
    .map((line) => line.replace(/^[-*•]\s*/, "").trim())
    .filter(Boolean)
    .slice(0, 12);
}

/**
 * Mentor composes a Monthly Progress Update and sends it to the mentee.
 * Ensures the cycle reflection + mentor check-in exist, then writes a
 * MentorGoalReview. Chair-gated mentorships go to PENDING_CHAIR_APPROVAL;
 * otherwise the update is approved and released immediately.
 */
export async function submitMonthlyProgressUpdate(
  input: SubmitProgressUpdateInput
): Promise<{ ok: true; reviewId: string; released: boolean }> {
  const viewer = await requireSessionUser();
  const data = SubmitSchema.parse(input);

  const mentorship = await prisma.mentorship.findUnique({
    where: { id: data.mentorshipId },
    select: {
      id: true,
      status: true,
      mentorId: true,
      menteeId: true,
      chairId: true,
      governanceMode: true,
      programGroup: true,
      reviewStreak: true,
      longestReviewStreak: true,
      mentee: { select: { id: true, name: true, primaryRole: true } },
      mentor: { select: { name: true } },
    },
  });
  if (!mentorship || mentorship.status !== "ACTIVE") {
    throw new Error("Active mentorship not found.");
  }
  if (mentorship.menteeId !== data.menteeId) {
    throw new Error("Mentee does not match this mentorship.");
  }

  const isAdmin = viewer.roles.includes("ADMIN");
  if (mentorship.mentorId !== viewer.id && !isAdmin) {
    throw new Error("Only the assigned mentor can send a progress update.");
  }

  const { cycleMonth, cycleLabel } = getCurrentCycleMonth();
  const requiresChair = mentorshipRequiresChairApproval({
    governanceMode: mentorship.governanceMode,
    programGroup: mentorship.programGroup,
  });

  // Ensure a reflection for this calendar month exists (create a stub if needed).
  let reflection = await prisma.monthlySelfReflection.findFirst({
    where: { mentorshipId: mentorship.id, cycleMonth },
    include: {
      goalReview: { select: { id: true, status: true } },
      mentorCycleCheckIn: { select: { id: true } },
    },
  });

  if (!reflection) {
    const last = await prisma.monthlySelfReflection.findFirst({
      where: { mentorshipId: mentorship.id },
      orderBy: { cycleNumber: "desc" },
      select: { cycleNumber: true },
    });
    const cycleNumber = (last?.cycleNumber ?? 0) + 1;
    const stubNote =
      "(Progress update authored by mentor — mentee reflection was not submitted for this cycle.)";
    reflection = await prisma.monthlySelfReflection.create({
      data: {
        menteeId: mentorship.menteeId,
        mentorshipId: mentorship.id,
        cycleMonth,
        cycleNumber,
        overallReflection: stubNote,
        engagementOverall: stubNote,
        workingWell: stubNote,
        supportNeeded: stubNote,
        mentorHelpfulness: stubNote,
        collaborationAssessment: stubNote,
      },
      include: {
        goalReview: { select: { id: true, status: true } },
        mentorCycleCheckIn: { select: { id: true } },
      },
    });
  }

  if (reflection.goalReview?.status === "APPROVED") {
    throw new Error(
      `A progress update for ${cycleLabel} was already sent. Open the PDF from Past updates.`
    );
  }
  if (reflection.goalReview?.status === "PENDING_CHAIR_APPROVAL") {
    throw new Error(
      "This month's update is waiting on chair approval. You can revise it after the chair sends it back."
    );
  }

  if (!reflection.mentorCycleCheckIn) {
    await prisma.mentorshipCheckIn.create({
      data: {
        subjectId: mentorship.menteeId,
        mentorshipId: mentorship.id,
        authorId: viewer.id,
        selfReflectionId: reflection.id,
        kind: "CHECK_IN",
        notes: `Monthly progress update prepared for ${cycleLabel}.`,
        discussion: data.overallComments.trim(),
        participantIds: [viewer.id, mentorship.menteeId],
        occurredAt: new Date(),
      },
    });
  }

  const overallComments = packProgressNarrative({
    overallComments: data.overallComments,
    strengths: data.strengths,
    areasForDevelopment: data.areasForDevelopment,
  });
  const planOfAction = data.planOfAction.trim();
  const isQuarterly = reflection.cycleNumber % 3 === 0;
  const now = new Date();

  const daysSinceReflection =
    (now.getTime() - reflection.submittedAt.getTime()) / (1000 * 60 * 60 * 24);
  const reviewedOnTime = daysSinceReflection <= 7;
  const newReviewStreak = reviewedOnTime
    ? (mentorship.reviewStreak ?? 0) + 1
    : 1;
  const newLongestReviewStreak = Math.max(
    newReviewStreak,
    mentorship.longestReviewStreak ?? 0
  );

  // Prefer live goals if the form omitted them (e.g. no active G&R).
  const liveGoals = await getGoalsForMentee(mentorship.menteeId, reflection.cycleNumber);
  const goalBlocks =
    data.goals.length > 0
      ? data.goals.map((g) => ({
          ...g,
          objective: g.objective.trim() || planOfAction,
          rating: g.rating as GoalRatingColor,
        }))
      : liveGoals.map((g) => ({
          goalId: g.id,
          source: (g.grDocumentGoalId ? "gr" : "legacy") as "gr" | "legacy",
          rating: data.overallRating as GoalRatingColor,
          collaborateWith: "",
          objective: g.description?.trim() || planOfAction || g.title,
          actionItems: "",
        }));

  const reviewStatus = requiresChair ? "PENDING_CHAIR_APPROVAL" : "APPROVED";
  const overallRating = data.overallRating as GoalRatingColor;

  const reviewId = await prisma.$transaction(async (tx) => {
    let persistedId = reflection!.goalReview?.id ?? "";

    const goalRatingRows = goalBlocks.map((g) => ({
      grDocumentGoalId: g.source === "gr" ? g.goalId : null,
      goalId: g.source === "legacy" ? g.goalId : null,
      rating: g.rating,
      comments: packGoalProgressText({
        collaborateWith: g.collaborateWith,
        objective: g.objective,
      }),
    }));

    if (reflection!.goalReview) {
      await tx.mentorGoalReview.update({
        where: { id: reflection!.goalReview.id },
        data: {
          overallRating,
          overallComments,
          planOfAction,
          status: reviewStatus,
          ...(requiresChair
            ? {}
            : {
                chairReviewerId: viewer.id,
                chairComments: "Released directly — chair approval not required.",
                chairApprovedAt: now,
                releasedToMenteeAt: now,
              }),
        },
      });
      await tx.goalReviewRating.deleteMany({
        where: { reviewId: reflection!.goalReview.id },
      });
      await tx.goalReviewRating.createMany({
        data: goalRatingRows.map((gr) => ({
          reviewId: reflection!.goalReview!.id,
          ...gr,
        })),
      });
      await tx.mentorshipActionItem.deleteMany({
        where: { sourceReviewId: reflection!.goalReview.id },
      });
      persistedId = reflection!.goalReview.id;
    } else {
      const created = await tx.mentorGoalReview.create({
        data: {
          mentorId: viewer.id,
          menteeId: mentorship.menteeId,
          mentorshipId: mentorship.id,
          selfReflectionId: reflection!.id,
          cycleMonth: reflection!.cycleMonth,
          cycleNumber: reflection!.cycleNumber,
          isQuarterly,
          overallRating,
          overallComments,
          planOfAction,
          status: reviewStatus,
          ...(requiresChair
            ? {}
            : {
                chairReviewerId: viewer.id,
                chairComments: "Released directly — chair approval not required.",
                chairApprovedAt: now,
                releasedToMenteeAt: now,
              }),
          goalRatings: {
            create: goalRatingRows,
          },
        },
        select: { id: true },
      });
      persistedId = created.id;
    }

    // Action items from each goal block.
    for (const g of goalBlocks) {
      const lines = parseActionLines(g.actionItems);
      for (const title of lines) {
        await tx.mentorshipActionItem.create({
          data: {
            mentorshipId: mentorship.id,
            menteeId: mentorship.menteeId,
            title,
            status: "OPEN",
            ownerId: mentorship.menteeId,
            createdById: viewer.id,
            sourceReviewId: persistedId,
            grDocumentGoalId: g.source === "gr" ? g.goalId : null,
          },
        });
      }
    }

    // Goal snapshots for G&R goals (idempotent).
    const grIds = goalBlocks.filter((g) => g.source === "gr").map((g) => g.goalId);
    if (grIds.length > 0) {
      const grGoals = await tx.gRDocumentGoal.findMany({
        where: { id: { in: grIds } },
        select: {
          id: true,
          title: true,
          description: true,
          timePhase: true,
          priority: true,
          dueDate: true,
          lifecycleStatus: true,
        },
      });
      const existing = await tx.mentorGoalReviewGoalSnapshot.findMany({
        where: { reviewId: persistedId },
        select: { grDocumentGoalId: true },
      });
      const existingIds = new Set(existing.map((s) => s.grDocumentGoalId));
      const fresh = grGoals.filter((g) => !existingIds.has(g.id));
      if (fresh.length > 0) {
        await tx.mentorGoalReviewGoalSnapshot.createMany({
          data: fresh.map((g) => ({
            id: `${persistedId}_${g.id}`,
            reviewId: persistedId,
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

    if (!requiresChair) {
      const menteeRoleType = toMenteeRoleType(mentorship.mentee.primaryRole);
      if (menteeRoleType) {
        const pointsAwarded = POINT_TABLE[overallRating][menteeRoleType];
        await tx.mentorGoalReview.update({
          where: { id: persistedId },
          data: { pointsAwarded },
        });
        await tx.achievementPointSummary.upsert({
          where: { userId: mentorship.menteeId },
          create: {
            userId: mentorship.menteeId,
            totalPoints: pointsAwarded,
            currentTier: computeTier(pointsAwarded),
          },
          update: { totalPoints: { increment: pointsAwarded } },
        });
        const freshSummary = await tx.achievementPointSummary.findUniqueOrThrow({
          where: { userId: mentorship.menteeId },
          select: { id: true, totalPoints: true },
        });
        await tx.achievementPointSummary.update({
          where: { userId: mentorship.menteeId },
          data: { currentTier: computeTier(freshSummary.totalPoints) },
        });
        const existingLog = await tx.achievementPointLog.findUnique({
          where: { reviewId: persistedId },
          select: { id: true },
        });
        if (!existingLog) {
          await tx.achievementPointLog.create({
            data: {
              summaryId: freshSummary.id,
              reviewId: persistedId,
              points: pointsAwarded,
              reason: `${overallRating} — ${menteeRoleType} (Cycle ${reflection!.cycleNumber})`,
              cycleMonth: reflection!.cycleMonth,
            },
          });
        }
      }
    }

    await tx.mentorship.update({
      where: { id: mentorship.id },
      data: {
        reviewStreak: newReviewStreak,
        longestReviewStreak: newLongestReviewStreak,
      },
    });

    return persistedId;
  });

  try {
    await ensureReviewGoalRatings({
      id: reviewId,
      menteeId: mentorship.menteeId,
      cycleNumber: reflection.cycleNumber,
    });
  } catch (err) {
    logger.warn({ err, reviewId }, "submitMonthlyProgressUpdate: ensureReviewGoalRatings failed");
  }

  try {
    await syncMentorGoalReviewWorkflow(reviewId);
  } catch (err) {
    logger.warn({ err, reviewId }, "submitMonthlyProgressUpdate: workflow sync failed");
  }

  if (requiresChair) {
    await emitReviewSubmittedForApproval({
      reviewId,
      mentorName: mentorship.mentor.name ?? "A mentor",
      menteeName: mentorship.mentee.name ?? "a mentee",
      menteePrimaryRole: mentorship.mentee.primaryRole,
      ctx: { cycleNumber: reflection.cycleNumber, cycleMonth: reflection.cycleMonth },
    });
    if (mentorship.chairId) {
      await createMentorshipNotification({
        userId: mentorship.chairId,
        title: "Progress update pending approval",
        body: `${mentorship.mentor.name ?? "A mentor"} submitted a monthly progress update for ${mentorship.mentee.name ?? "a mentee"}.`,
        link: "/mentorship/chair",
      });
    }
  } else {
    const approved = await prisma.mentorGoalReview.findUnique({
      where: { id: reviewId },
      select: { pointsAwarded: true },
    });
    await emitReviewApprovedAndReleased({
      reviewId,
      mentorId: viewer.id,
      menteeId: mentorship.menteeId,
      menteeName: mentorship.mentee.name ?? "your mentee",
      pointsAwarded: approved?.pointsAwarded ?? 0,
      ctx: { cycleNumber: reflection.cycleNumber, cycleMonth: reflection.cycleMonth },
    });
    await createMentorshipNotification({
      userId: mentorship.menteeId,
      title: `${cycleLabel} progress update`,
      body: `${mentorship.mentor.name ?? "Your mentor"} sent your monthly progress update.`,
      link: `/mentorship/people/${mentorship.menteeId}?section=progress`,
    });
  }

  try {
    await recomputeMentorshipCycleStage(mentorship.id);
  } catch (err) {
    logger.warn({ err, mentorshipId: mentorship.id }, "submitMonthlyProgressUpdate: cycleStage failed");
  }

  revalidatePath(`/mentorship/people/${mentorship.menteeId}`);
  revalidatePath("/mentorship");
  revalidatePath("/mentorship/chair");
  revalidatePath("/my-program");

  return { ok: true, reviewId, released: !requiresChair };
}

const ShareSchema = z.object({
  reviewId: z.string().min(1),
  menteeId: z.string().min(1),
  audience: z.enum(["mentee", "chair"]),
});

/**
 * Share a finished (or pending) progress update inside the portal via an
 * in-app notification with deep links to the Progress tab and PDF.
 */
export async function shareProgressUpdateInPortal(input: z.infer<typeof ShareSchema>) {
  const viewer = await requireSessionUser();
  const data = ShareSchema.parse(input);

  const review = await prisma.mentorGoalReview.findFirst({
    where: { id: data.reviewId, menteeId: data.menteeId },
    select: {
      id: true,
      cycleMonth: true,
      releasedToMenteeAt: true,
      status: true,
      mentorshipId: true,
      mentorId: true,
      mentee: { select: { id: true, name: true } },
      mentor: { select: { name: true } },
      mentorship: {
        select: {
          chairId: true,
          mentorId: true,
        },
      },
    },
  });
  if (!review) throw new Error("Progress update not found.");

  const isAdmin = viewer.roles.includes("ADMIN");
  if (review.mentorId !== viewer.id && !isAdmin) {
    throw new Error("Only the assigned mentor can share this update.");
  }

  const monthLabel = review.cycleMonth.toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
  const monthKey = `${review.cycleMonth.getUTCFullYear()}-${String(
    review.cycleMonth.getUTCMonth() + 1
  ).padStart(2, "0")}`;
  const portalLink = `/mentorship/people/${review.mentee.id}?section=progress`;
  const pdfLink = `/mentorship/people/${review.mentee.id}/monthly-update/print?reviewId=${review.id}&month=${monthKey}`;

  if (data.audience === "mentee") {
    if (!review.releasedToMenteeAt && review.status !== "APPROVED") {
      throw new Error(
        "Release this update (or wait for chair approval) before sharing it with the mentee."
      );
    }
    await createMentorshipNotification({
      userId: review.mentee.id,
      title: `${monthLabel} progress update`,
      body: `${review.mentor.name ?? "Your mentor"} shared your monthly progress update in the portal. You can also open the PDF.`,
      link: portalLink,
    });
    // Second ping with the PDF deep link so they have both entry points.
    await createMentorshipNotification({
      userId: review.mentee.id,
      title: `${monthLabel} progress update PDF`,
      body: "Open the printable Monthly Progress Update.",
      link: pdfLink,
    });
  } else {
    const chairId = review.mentorship.chairId;
    if (!chairId) throw new Error("This mentorship has no chair assigned.");
    await createMentorshipNotification({
      userId: chairId,
      title: `${monthLabel} progress update`,
      body: `${review.mentor.name ?? "A mentor"} shared ${review.mentee.name ?? "a mentee"}'s progress update.`,
      link: pdfLink,
    });
  }

  revalidatePath(`/mentorship/people/${review.mentee.id}`);
  return { ok: true as const };
}


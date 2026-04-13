/**
 * Cycle-milestone notifications (Phase 0.9).
 *
 * Each emitter wraps its own write in a try/catch with structured logging so a
 * notification failure never fails the primary action. Email dispatch is
 * deliberately deferred to Phase 1.5 — these are in-app only.
 */
import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { getChairsForLane } from "@/lib/mentorship-chair-access";
import { toMenteeRoleType } from "@/lib/mentee-role-utils";
import { NotificationType } from "@prisma/client";

type EmitCtx = {
  cycleNumber: number;
  cycleMonth: Date;
};

function monthLabel(date: Date): string {
  return date.toLocaleDateString("en-US", { month: "long", year: "numeric", timeZone: "UTC" });
}

async function createOnce(params: {
  userId: string;
  type: NotificationType;
  title: string;
  body: string;
  link: string;
  dedupKey: string;
}) {
  // Soft de-dup: skip if a notification with the same (userId, type, link, title) was
  // created in the last 24 hours. The compound uniqueness would require a schema
  // change; for Phase 0.9 we dedup in code on a narrow window.
  const existing = await prisma.notification.findFirst({
    where: {
      userId: params.userId,
      type: params.type,
      title: params.title,
      link: params.link,
      createdAt: { gte: new Date(Date.now() - 1000 * 60 * 60 * 24) },
    },
    select: { id: true },
  });
  if (existing) {
    logger.debug({ dedupKey: params.dedupKey, notificationType: params.type }, "notification deduped");
    return null;
  }
  return prisma.notification.create({
    data: {
      userId: params.userId,
      type: params.type,
      title: params.title,
      body: params.body,
      link: params.link,
    },
  });
}

function safeEmit<T extends (...args: any[]) => Promise<unknown>>(fn: T, label: string): T {
  return (async (...args: Parameters<T>) => {
    try {
      return await fn(...args);
    } catch (err) {
      logger.warn({ err, emitter: label }, "mentorship notification emit failed");
      return null;
    }
  }) as T;
}

export const emitReflectionWindowOpened = safeEmit(async function emitReflectionWindowOpened(params: {
  menteeId: string;
  ctx: EmitCtx;
}) {
  const label = monthLabel(params.ctx.cycleMonth);
  await createOnce({
    userId: params.menteeId,
    type: NotificationType.REFLECTION_WINDOW_OPENED,
    title: `Your ${label} self-reflection is open`,
    body: `Take a few minutes to reflect on the past month and share it with your mentor.`,
    link: "/my-program/reflect",
    dedupKey: `refl-open:${params.menteeId}:${params.ctx.cycleNumber}`,
  });
}, "emitReflectionWindowOpened");

export const emitReflectionSubmitted = safeEmit(async function emitReflectionSubmitted(params: {
  mentorId: string;
  menteeName: string;
  menteeId: string;
  ctx: EmitCtx;
}) {
  const label = monthLabel(params.ctx.cycleMonth);
  await createOnce({
    userId: params.mentorId,
    type: NotificationType.REFLECTION_SUBMITTED,
    title: `${params.menteeName} submitted their ${label} reflection`,
    body: `Their reflection is ready for your monthly review.`,
    link: `/mentorship/mentees/${params.menteeId}`,
    dedupKey: `refl-submit:${params.mentorId}:${params.ctx.cycleNumber}:${params.menteeId}`,
  });
}, "emitReflectionSubmitted");

export const emitReviewSubmittedForApproval = safeEmit(async function emitReviewSubmittedForApproval(params: {
  reviewId: string;
  mentorName: string;
  menteeName: string;
  menteePrimaryRole: string | null;
  ctx: EmitCtx;
}) {
  const laneRole = params.menteePrimaryRole ? toMenteeRoleType(params.menteePrimaryRole) : null;
  if (!laneRole) {
    logger.warn({ reviewId: params.reviewId }, "review submitted but mentee role not resolvable — skipping chair notification");
    return;
  }
  const chairs = await getChairsForLane(laneRole);
  const label = monthLabel(params.ctx.cycleMonth);
  for (const chair of chairs) {
    await createOnce({
      userId: chair.id,
      type: NotificationType.REVIEW_SUBMITTED_FOR_APPROVAL,
      title: `${params.mentorName} submitted a ${label} review for ${params.menteeName}`,
      body: `A monthly review is awaiting your approval.`,
      link: `/mentorship-program/chair/${params.reviewId}`,
      dedupKey: `review-submit:${chair.id}:${params.reviewId}`,
    });
  }
}, "emitReviewSubmittedForApproval");

export const emitReviewApprovedAndReleased = safeEmit(async function emitReviewApprovedAndReleased(params: {
  reviewId: string;
  mentorId: string;
  menteeId: string;
  menteeName: string;
  pointsAwarded: number;
  ctx: EmitCtx;
}) {
  const label = monthLabel(params.ctx.cycleMonth);
  await createOnce({
    userId: params.menteeId,
    type: NotificationType.REVIEW_APPROVED_AND_RELEASED,
    title: `Your ${label} review is released`,
    body: `Your Cycle ${params.ctx.cycleNumber} monthly review has been approved. You earned ${params.pointsAwarded} achievement points.`,
    link: "/my-program",
    dedupKey: `review-released-mentee:${params.reviewId}`,
  });
  await createOnce({
    userId: params.mentorId,
    type: NotificationType.REVIEW_APPROVED_AND_RELEASED,
    title: `Your ${label} review for ${params.menteeName} was approved`,
    body: `The chair has approved the review. ${params.pointsAwarded} points awarded.`,
    link: `/mentorship/mentees/${params.menteeId}`,
    dedupKey: `review-released-mentor:${params.reviewId}`,
  });
}, "emitReviewApprovedAndReleased");

export async function getMentorshipPendingActionCount(userId: string): Promise<number> {
  return prisma.notification.count({
    where: {
      userId,
      isRead: false,
      type: {
        in: [
          NotificationType.REFLECTION_WINDOW_OPENED,
          NotificationType.REFLECTION_SUBMITTED,
          NotificationType.REVIEW_SUBMITTED_FOR_APPROVAL,
          NotificationType.REVIEW_APPROVED_AND_RELEASED,
        ],
      },
    },
  });
}

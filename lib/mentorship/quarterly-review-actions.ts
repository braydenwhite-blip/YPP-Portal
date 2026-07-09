"use server";

/**
 * Quarterly Committee Review — Pathway Decision workflow (Phase 2).
 *
 * Mirrors the monthly goal-review lifecycle (draft → submit → chair
 * approve/request-changes) with one addition: officer/board-level Pathway
 * Decisions route through an extra Board sign-off stage after the chair
 * approves. Authorization reuses the same lane-chair-or-admin rule as
 * monthly approval (lib/goal-review-actions.ts requireReviewApprover) so
 * there is exactly one place "who can approve for this mentee's committee"
 * is decided — never a second, quarterly-specific copy of that rule.
 *
 * AI is not involved in this file at all: every write here is a decision a
 * human explicitly submitted, matching the doc's "AI may not approve,
 * release, or make award/pathway decisions" guardrail.
 */

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { QuarterlyReviewDecision } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth-supabase";
import { requireBoard } from "@/lib/authorization";
import { logAuditEvent } from "@/lib/audit-log-actions";
import { toMenteeRoleType } from "@/lib/mentee-role-utils";
import { requireReviewApprover } from "@/lib/goal-review-actions";
import { isQuarterlyCycle } from "./quarterly-review";
import { currentQuarterLabel } from "@/lib/people-strategy/people-performance-selectors";

async function requireSession() {
  const session = await getSession();
  if (!session?.user?.id) throw new Error("Unauthorized");
  return session as typeof session & { user: { id: string } };
}

const REVALIDATE_PATHS = (menteeId: string) => {
  revalidatePath(`/people/${menteeId}`);
  revalidatePath("/mentorship/committee");
};

/**
 * Mentor (or admin) starts the quarterly review: creates the DRAFT row and
 * snapshots the last up-to-3 approved+released monthly reviews as evidence.
 * Idempotent — re-calling on an existing DRAFT/CHANGES_REQUESTED row just
 * refreshes the evidence snapshot rather than erroring.
 */
export async function startQuarterlyReview(input: unknown) {
  const session = await requireSession();
  const { mentorshipId } = z.object({ mentorshipId: z.string().trim().min(1) }).parse(input);

  const mentorship = await prisma.mentorship.findUniqueOrThrow({
    where: { id: mentorshipId },
    select: { id: true, mentorId: true, menteeId: true },
  });

  const roles = session.user.roles ?? [];
  if (mentorship.mentorId !== session.user.id && !roles.includes("ADMIN")) {
    throw new Error("Only the assigned mentor (or an admin) can start a quarterly review.");
  }

  const latestApproved = await prisma.mentorGoalReview.findFirst({
    where: { mentorshipId, status: "APPROVED", releasedToMenteeAt: { not: null } },
    orderBy: { cycleNumber: "desc" },
    select: { cycleNumber: true, cycleMonth: true },
  });
  if (!latestApproved || !isQuarterlyCycle(latestApproved.cycleNumber)) {
    throw new Error("This mentorship is not due for a quarterly review right now.");
  }

  const quarter = currentQuarterLabel(latestApproved.cycleMonth);

  const evidenceReviews = await prisma.mentorGoalReview.findMany({
    where: {
      mentorshipId,
      status: "APPROVED",
      releasedToMenteeAt: { not: null },
      cycleNumber: { lte: latestApproved.cycleNumber },
    },
    orderBy: { cycleNumber: "desc" },
    take: 3,
    select: { id: true },
  });

  const review = await prisma.mentorshipQuarterlyReview.upsert({
    where: { mentorshipId_quarter: { mentorshipId, quarter } },
    create: {
      mentorshipId,
      menteeId: mentorship.menteeId,
      quarter,
      cycleNumber: latestApproved.cycleNumber,
      status: "DRAFT",
      evidenceReviews: {
        create: evidenceReviews.map((r) => ({ monthlyReviewId: r.id })),
      },
    },
    update: {},
  });

  // Re-snapshot evidence on an existing DRAFT/CHANGES_REQUESTED row (a
  // mentor re-opening a review after a late-approved monthly cycle).
  if (review.status === "DRAFT" || review.status === "CHANGES_REQUESTED") {
    await prisma.mentorshipQuarterlyReviewEvidence.deleteMany({ where: { quarterlyReviewId: review.id } });
    await prisma.mentorshipQuarterlyReviewEvidence.createMany({
      data: evidenceReviews.map((r) => ({ quarterlyReviewId: review.id, monthlyReviewId: r.id })),
      skipDuplicates: true,
    });
  }

  REVALIDATE_PATHS(mentorship.menteeId);
  return { ok: true, reviewId: review.id };
}

const SaveDraftSchema = z.object({
  reviewId: z.string().trim().min(1),
  broaderFeedbackSummary: z.string().trim().max(10000).optional(),
  committeeNotes: z.string().trim().max(10000).optional(),
  decision: z
    .enum(["PROMOTION", "ACHIEVEMENT_AWARD", "ROLE_CHANGE", "PIP", "CONTINUATION"])
    .optional(),
  decisionRationale: z.string().trim().max(10000).optional(),
  submitForApproval: z.boolean().optional(),
});

/**
 * Mentor/committee edits the quarterly packet — broader feedback synthesis,
 * committee notes, and (optionally) recommends a Pathway Decision. Setting
 * `submitForApproval` moves it to PENDING_CHAIR_APPROVAL; a decision is
 * required to submit.
 */
export async function saveQuarterlyReviewDraft(input: unknown) {
  const session = await requireSession();
  const { reviewId, broaderFeedbackSummary, committeeNotes, decision, decisionRationale, submitForApproval } =
    SaveDraftSchema.parse(input);

  const review = await prisma.mentorshipQuarterlyReview.findUniqueOrThrow({
    where: { id: reviewId },
    include: { mentorship: { select: { mentorId: true } }, mentee: { select: { primaryRole: true } } },
  });

  const roles = session.user.roles ?? [];
  if (review.mentorship.mentorId !== session.user.id && !roles.includes("ADMIN")) {
    throw new Error("Only the assigned mentor (or an admin) can edit this quarterly review.");
  }
  if (review.status === "APPROVED" || review.status === "PENDING_BOARD_APPROVAL") {
    throw new Error("This quarterly review is already with the committee/board and can no longer be edited.");
  }
  if (submitForApproval && !decision) {
    throw new Error("A Pathway Decision is required before submitting for committee approval.");
  }

  await prisma.mentorshipQuarterlyReview.update({
    where: { id: reviewId },
    data: {
      broaderFeedbackSummary: broaderFeedbackSummary ?? review.broaderFeedbackSummary,
      committeeNotes: committeeNotes ?? review.committeeNotes,
      decision: (decision as QuarterlyReviewDecision | undefined) ?? review.decision,
      decisionRationale: decisionRationale ?? review.decisionRationale,
      status: submitForApproval ? "PENDING_CHAIR_APPROVAL" : "DRAFT",
      recommendedById: submitForApproval ? session.user.id : review.recommendedById,
      recommendedAt: submitForApproval ? new Date() : review.recommendedAt,
    },
  });

  if (submitForApproval) {
    await logAuditEvent({
      action: "MENTORSHIP_UPDATED",
      actorId: session.user.id,
      targetType: "MentorshipQuarterlyReview",
      targetId: reviewId,
      description: `Quarterly committee review submitted for approval (${decision}).`,
    });
  }

  REVALIDATE_PATHS(review.menteeId);
  return { ok: true };
}

/** Officer/board-level decisions require Board sign-off before they're final. */
function requiresBoardApproval(decision: QuarterlyReviewDecision | null, roleType: string | null): boolean {
  if (!decision) return false;
  return roleType === "GLOBAL_LEADERSHIP" && (decision === "PROMOTION" || decision === "ROLE_CHANGE");
}

const ApprovalSchema = z.object({
  reviewId: z.string().trim().min(1),
  chairComments: z.string().trim().max(5000).optional(),
});

/**
 * Role Chair (or Chief of Staff / admin) approves the quarterly packet and
 * its Pathway Decision. Officer/board-level decisions move to
 * PENDING_BOARD_APPROVAL instead of APPROVED; everything else is final here.
 */
export async function approveQuarterlyReview(input: unknown) {
  const { reviewId, chairComments } = ApprovalSchema.parse(input);

  const review = await prisma.mentorshipQuarterlyReview.findUniqueOrThrow({
    where: { id: reviewId },
    include: { mentee: { select: { id: true, primaryRole: true } } },
  });
  if (review.status !== "PENDING_CHAIR_APPROVAL") {
    throw new Error("This quarterly review is not waiting on chair approval.");
  }

  const session = await requireReviewApprover(review.mentee);
  const roleType = toMenteeRoleType(review.mentee.primaryRole);
  const needsBoard = requiresBoardApproval(review.decision, roleType);

  await prisma.mentorshipQuarterlyReview.update({
    where: { id: reviewId },
    data: {
      status: needsBoard ? "PENDING_BOARD_APPROVAL" : "APPROVED",
      chairApproverId: session.user.id,
      chairApprovedAt: new Date(),
      chairComments: chairComments ?? review.chairComments,
      requiresBoardApproval: needsBoard,
    },
  });

  await logAuditEvent({
    action: "MENTORSHIP_UPDATED",
    actorId: session.user.id,
    targetType: "MentorshipQuarterlyReview",
    targetId: reviewId,
    description: needsBoard
      ? "Quarterly committee review chair-approved — routed to the Board for sign-off."
      : "Quarterly committee review approved.",
  });

  REVALIDATE_PATHS(review.menteeId);
  return { ok: true, requiresBoardApproval: needsBoard };
}

/** Board (or SUPER_ADMIN Board stand-in) gives final sign-off on an officer/board-level Pathway Decision. */
export async function boardApproveQuarterlyReview(input: unknown) {
  const { reviewId } = z.object({ reviewId: z.string().trim().min(1) }).parse(input);
  const boardMember = await requireBoard();

  const review = await prisma.mentorshipQuarterlyReview.findUniqueOrThrow({ where: { id: reviewId } });
  if (review.status !== "PENDING_BOARD_APPROVAL") {
    throw new Error("This quarterly review is not waiting on Board approval.");
  }

  await prisma.mentorshipQuarterlyReview.update({
    where: { id: reviewId },
    data: { status: "APPROVED", boardApproverId: boardMember.id, boardApprovedAt: new Date() },
  });

  await logAuditEvent({
    action: "MENTORSHIP_UPDATED",
    actorId: boardMember.id,
    targetType: "MentorshipQuarterlyReview",
    targetId: reviewId,
    description: "Quarterly committee review Board-approved.",
  });

  REVALIDATE_PATHS(review.menteeId);
  return { ok: true };
}

/** Role Chair sends the quarterly packet back to the mentor for revision. */
export async function requestQuarterlyReviewChanges(input: unknown) {
  const { reviewId, chairComments } = ApprovalSchema.parse(input);

  const review = await prisma.mentorshipQuarterlyReview.findUniqueOrThrow({
    where: { id: reviewId },
    include: { mentee: { select: { id: true, primaryRole: true } } },
  });
  if (review.status === "APPROVED") {
    throw new Error("Cannot request changes on an approved quarterly review.");
  }

  const session = await requireReviewApprover(review.mentee);

  await prisma.mentorshipQuarterlyReview.update({
    where: { id: reviewId },
    data: {
      status: "CHANGES_REQUESTED",
      chairApproverId: session.user.id,
      chairComments: chairComments ?? review.chairComments,
    },
  });

  await logAuditEvent({
    action: "MENTORSHIP_UPDATED",
    actorId: session.user.id,
    targetType: "MentorshipQuarterlyReview",
    targetId: reviewId,
    description: "Changes requested on quarterly committee review.",
  });

  REVALIDATE_PATHS(review.menteeId);
  return { ok: true };
}

"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { GoalRatingColor, QuarterlyReviewDecision } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { requireCPO } from "@/lib/authorization";
import { isQuarterlyReviewsEnabled } from "@/lib/feature-flags";
import { getMatrixLabel, isSuccessionCandidate } from "@/lib/matrix";
import {
  GOAL_RATING_ORDER,
  QUARTERLY_REVIEW_DECISION_VALUES,
} from "./constants";

/**
 * People Strategy — Quarterly Review submission (ENABLE_QUARTERLY_REVIEWS).
 *
 * Follows the `lib/*-actions.ts` convention: `"use server"`, a guard first,
 * zod validation, prisma write, then `revalidatePath`. Gated to leadership via
 * `requireCPO()` — only the CPO (`AdminSubtype.CPO`) and the Board stand-in
 * (`SUPER_ADMIN`) may place a user on the succession matrix.
 *
 * `successionFlag` is COMPUTED from the two ratings (`isSuccessionCandidate`)
 * and persisted; the matrix LABEL is computed by `lib/matrix.ts` and returned
 * for display but never stored. The write UPSERTS on the unique
 * (userId, quarter) key so re-submitting refreshes the same row.
 */

function ensureEnabled() {
  if (!isQuarterlyReviewsEnabled()) {
    throw new Error("Quarterly Reviews are not enabled");
  }
}

const GoalRatingEnum = z.enum(
  GOAL_RATING_ORDER as [GoalRatingColor, ...GoalRatingColor[]]
);

const DecisionEnum = z.enum(
  QUARTERLY_REVIEW_DECISION_VALUES as [
    QuarterlyReviewDecision,
    ...QuarterlyReviewDecision[]
  ]
);

const SubmitSchema = z.object({
  userId: z.string().min(1, "userId is required"),
  /** e.g. "2026-Q2". Free-form but normalized/trimmed. */
  quarter: z.string().trim().min(1, "quarter is required").max(32),
  performanceRating: GoalRatingEnum,
  potentialRating: GoalRatingEnum,
  decision: DecisionEnum,
  notes: z.string().trim().max(5000).optional(),
});

export type SubmitQuarterlyReviewInput = z.input<typeof SubmitSchema>;

export interface SavedQuarterlyReview {
  id: string;
  userId: string;
  quarter: string;
  performanceRating: GoalRatingColor;
  potentialRating: GoalRatingColor;
  decision: QuarterlyReviewDecision;
  notes: string | null;
  successionFlag: boolean;
  createdById: string;
  createdAt: Date;
  /** Derived, NOT persisted — computed from the two ratings via lib/matrix.ts. */
  matrixLabel: string;
}

/**
 * Create (or refresh) the Quarterly Review for one user/quarter. Idempotent via
 * the unique (userId, quarter) constraint.
 */
export async function submitQuarterlyReview(
  input: SubmitQuarterlyReviewInput
): Promise<SavedQuarterlyReview> {
  ensureEnabled();
  const reviewer = await requireCPO();

  const { userId, quarter, performanceRating, potentialRating, decision, notes } =
    SubmitSchema.parse(input);

  const successionFlag = isSuccessionCandidate(
    performanceRating,
    potentialRating
  );

  const review = await prisma.quarterlyReview.upsert({
    where: { userId_quarter: { userId, quarter } },
    create: {
      userId,
      quarter,
      performanceRating,
      potentialRating,
      decision,
      notes: notes ?? null,
      successionFlag,
      createdById: reviewer.id,
    },
    update: {
      performanceRating,
      potentialRating,
      decision,
      notes: notes ?? null,
      successionFlag,
      createdById: reviewer.id,
    },
  });

  revalidatePath(`/admin/instructors/${userId}`);
  revalidatePath("/admin/people");

  return {
    ...review,
    matrixLabel: getMatrixLabel(
      review.performanceRating,
      review.potentialRating
    ),
  };
}

/**
 * Latest Quarterly Review for a user (most recent quarter / createdAt), with the
 * matrix label computed for display. Returns `null` when none exists or the
 * feature is disabled.
 */
export async function getLatestQuarterlyReview(
  userId: string
): Promise<SavedQuarterlyReview | null> {
  if (!isQuarterlyReviewsEnabled()) return null;

  const review = await prisma.quarterlyReview.findFirst({
    where: { userId },
    orderBy: [{ quarter: "desc" }, { createdAt: "desc" }],
  });
  if (!review) return null;

  return {
    ...review,
    matrixLabel: getMatrixLabel(
      review.performanceRating,
      review.potentialRating
    ),
  };
}

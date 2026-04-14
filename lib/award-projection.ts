/**
 * Award projection for chair approval (Phase 0.99999).
 *
 * Chairs see a read-only preview of exactly what will happen when they click
 * Approve on a MentorGoalReview: points earned, running total, current tier,
 * projected tier, and whether a tier threshold will be crossed.
 *
 * Source of truth for point math is `POINT_TABLE` / `computeTier` in
 * `lib/goal-review-actions.ts`. Do not duplicate that logic here — import it.
 */
import type { AchievementAwardTier, GoalRatingColor } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { POINT_TABLE } from "@/lib/goal-review-actions";
import { TIER_THRESHOLDS, computeTier } from "@/lib/achievement-tier-utils";
import { toMenteeRoleType } from "@/lib/mentee-role-utils";

export type AwardProjection = {
  cyclePoints: number;
  basePoints: number;
  bonusPoints: number;
  runningTotal: number;
  projectedTotal: number;
  currentTier: AchievementAwardTier | null;
  projectedTier: AchievementAwardTier | null;
  willCrossTierThreshold: boolean;
  nextThreshold: { tier: AchievementAwardTier; min: number; pointsAway: number } | null;
  requiresBoardApproval: boolean;
};

type ReviewForProjection = {
  id: string;
  overallRating: GoalRatingColor;
  bonusPoints: number;
  chairAdjustedBonusPoints: number | null;
  pointsAwarded: number | null;
  menteeId: string;
  mentee: { primaryRole: string | null };
};

/**
 * Compute what approving this review will produce. Read-only — no writes.
 */
export async function projectAwardOutcome(review: ReviewForProjection): Promise<AwardProjection> {
  const menteeRoleType = toMenteeRoleType(review.mentee.primaryRole);

  const basePoints = menteeRoleType ? POINT_TABLE[review.overallRating][menteeRoleType] : 0;
  const bonusPoints = review.chairAdjustedBonusPoints ?? review.bonusPoints ?? 0;
  const cyclePoints = review.pointsAwarded ?? basePoints + bonusPoints;

  const summary = await prisma.achievementPointSummary.findUnique({
    where: { userId: review.menteeId },
    select: { totalPoints: true, currentTier: true },
  });

  const runningTotal = summary?.totalPoints ?? 0;
  const projectedTotal = runningTotal + (review.pointsAwarded ? 0 : cyclePoints);
  const currentTier = summary?.currentTier ?? computeTier(runningTotal);
  const projectedTier = computeTier(projectedTotal);
  const willCrossTierThreshold = currentTier !== projectedTier;

  const nextUnreached = TIER_THRESHOLDS
    .slice()
    .reverse() // ascending by threshold
    .find((t) => projectedTotal < t.min);
  const nextThreshold = nextUnreached
    ? { tier: nextUnreached.tier, min: nextUnreached.min, pointsAway: nextUnreached.min - projectedTotal }
    : null;

  // Board approval required for Gold and Lifetime tiers
  const requiresBoardApproval =
    projectedTier === "GOLD" || projectedTier === "LIFETIME";

  return {
    cyclePoints,
    basePoints,
    bonusPoints,
    runningTotal,
    projectedTotal,
    currentTier,
    projectedTier,
    willCrossTierThreshold,
    nextThreshold,
    requiresBoardApproval,
  };
}

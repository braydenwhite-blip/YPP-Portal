// Senior / Lead Instructor expectation math — pure functions over
// contribution-shaped rows so they can run on server pages, in dashboards,
// and in tests without touching Prisma.
//
// Expectations:
//   Senior Instructor — at least 1 meaningful contribution (target 2).
//     Examples: Student Advisor, instructor mentor, curriculum reviewer,
//     interviewer, onboarding helper, class quality reviewer, project mentor.
//   Lead Instructor — at least 2 meaningful contributions (target 3), of
//     which at least one involves real ownership (committee, subject lead,
//     partner lead, program/curriculum/mentorship/success lead, initiative
//     owner).
//
// "Meaningful" = review-visible, weight >= 2, and either currently held
// (ACTIVE / ASSIGNED / NEEDS_ATTENTION) or finished (COMPLETED). SUGGESTED
// and PAUSED rows never count.

import type {
  LeadershipContributionStatus,
  LeadershipRoleCategory,
} from "@prisma/client";

export type ContributionLike = {
  category: LeadershipRoleCategory;
  status: LeadershipContributionStatus;
  weight: number;
  isOwnership: boolean;
  reviewVisible: boolean;
};

export const MEANINGFUL_WEIGHT_MIN = 2;

export const SENIOR_REQUIRED_COUNT = 1;
export const SENIOR_TARGET_COUNT = 2;
export const LEAD_REQUIRED_COUNT = 2;
export const LEAD_TARGET_COUNT = 3;
export const LEAD_REQUIRED_OWNERSHIP = 1;

const COUNTABLE_STATUSES: LeadershipContributionStatus[] = [
  "ASSIGNED",
  "ACTIVE",
  "NEEDS_ATTENTION",
  "COMPLETED",
];

export function isCountable(contribution: ContributionLike): boolean {
  return (
    contribution.reviewVisible &&
    COUNTABLE_STATUSES.includes(contribution.status)
  );
}

export function isMeaningful(contribution: ContributionLike): boolean {
  return isCountable(contribution) && contribution.weight >= MEANINGFUL_WEIGHT_MIN;
}

export type LevelProgress = {
  /** Minimum meaningful contributions to meet the expectation. */
  required: number;
  /** The "generally 1-2 / 2-3" upper target. */
  target: number;
  /** Ownership contributions required (Lead only; 0 for Senior). */
  ownershipRequired: number;
  met: boolean;
  /** Met the upper target too (e.g. 2+ for Senior, 3+ for Lead). */
  exceeded: boolean;
  /** 0-100, for progress bars. Counts ownership as its own step for Lead. */
  percent: number;
  /** Human summary, e.g. "1 of 2 meaningful contributions". */
  summary: string;
};

export type ExpectationProgress = {
  meaningfulCount: number;
  ownershipCount: number;
  activeCount: number;
  completedCount: number;
  needsAttentionCount: number;
  senior: LevelProgress;
  lead: LevelProgress;
  /** Overall standing label for dashboards. */
  standing: "LEAD_READY" | "SENIOR_READY" | "BELOW_EXPECTATIONS" | "NO_CONTRIBUTIONS";
};

function clampPercent(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

export function computeExpectationProgress(
  contributions: ContributionLike[],
): ExpectationProgress {
  const countable = contributions.filter(isCountable);
  const meaningful = countable.filter(
    (c) => c.weight >= MEANINGFUL_WEIGHT_MIN,
  );
  const meaningfulCount = meaningful.length;
  const ownershipCount = meaningful.filter((c) => c.isOwnership).length;
  const activeCount = contributions.filter(
    (c) => c.status === "ACTIVE" || c.status === "ASSIGNED",
  ).length;
  const completedCount = contributions.filter(
    (c) => c.status === "COMPLETED",
  ).length;
  const needsAttentionCount = contributions.filter(
    (c) => c.status === "NEEDS_ATTENTION",
  ).length;

  const senior: LevelProgress = {
    required: SENIOR_REQUIRED_COUNT,
    target: SENIOR_TARGET_COUNT,
    ownershipRequired: 0,
    met: meaningfulCount >= SENIOR_REQUIRED_COUNT,
    exceeded: meaningfulCount >= SENIOR_TARGET_COUNT,
    percent: clampPercent((meaningfulCount / SENIOR_TARGET_COUNT) * 100),
    summary: `${meaningfulCount} of ${SENIOR_TARGET_COUNT} meaningful contributions`,
  };

  // Lead progress: required meaningful count plus the ownership requirement,
  // each counted as one step so the bar reflects both dimensions.
  const leadSteps = LEAD_TARGET_COUNT + LEAD_REQUIRED_OWNERSHIP;
  const leadStepsDone =
    Math.min(meaningfulCount, LEAD_TARGET_COUNT) +
    Math.min(ownershipCount, LEAD_REQUIRED_OWNERSHIP);
  const leadMet =
    meaningfulCount >= LEAD_REQUIRED_COUNT &&
    ownershipCount >= LEAD_REQUIRED_OWNERSHIP;
  const lead: LevelProgress = {
    required: LEAD_REQUIRED_COUNT,
    target: LEAD_TARGET_COUNT,
    ownershipRequired: LEAD_REQUIRED_OWNERSHIP,
    met: leadMet,
    exceeded: leadMet && meaningfulCount >= LEAD_TARGET_COUNT,
    percent: clampPercent((leadStepsDone / leadSteps) * 100),
    summary: `${meaningfulCount} of ${LEAD_TARGET_COUNT} meaningful, ${ownershipCount} of ${LEAD_REQUIRED_OWNERSHIP} ownership`,
  };

  const standing: ExpectationProgress["standing"] =
    meaningfulCount === 0
      ? countable.length === 0
        ? "NO_CONTRIBUTIONS"
        : "BELOW_EXPECTATIONS"
      : lead.met
        ? "LEAD_READY"
        : senior.met
          ? "SENIOR_READY"
          : "BELOW_EXPECTATIONS";

  return {
    meaningfulCount,
    ownershipCount,
    activeCount,
    completedCount,
    needsAttentionCount,
    senior,
    lead,
    standing,
  };
}

export const STANDING_META: Record<
  ExpectationProgress["standing"],
  { label: string; tone: "success" | "info" | "warning" | "neutral" }
> = {
  LEAD_READY: { label: "Meets Lead expectations", tone: "success" },
  SENIOR_READY: { label: "Meets Senior expectations", tone: "info" },
  BELOW_EXPECTATIONS: { label: "Below expectations", tone: "warning" },
  NO_CONTRIBUTIONS: { label: "No contributions yet", tone: "neutral" },
};

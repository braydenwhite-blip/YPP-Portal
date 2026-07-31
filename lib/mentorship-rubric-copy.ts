import type { GoalRatingColor, ProgressStatus } from "@prisma/client";

export interface MentorshipRubricCopy {
  label: string;
  shortLabel: string;
  menteeLabel: string;
  mentorDescription: string;
  menteeDescription: string;
  adminDescription: string;
  color: string;
  background: string;
  adminAttention: boolean;
}

/**
 * Leadership Goals & Rubric rating scale (shared across Instructor + Leadership G&R):
 *   Above & Beyond — Dramatically exceeds all bullets at this level
 *   On Track — All bullets met
 *   Needs Attention — Some bullets met; no major deficiencies
 *   At Risk — Major deficiencies present
 *
 * Prisma enums stay ABOVE_AND_BEYOND / ACHIEVED / GETTING_STARTED / BEHIND_SCHEDULE.
 */
export const GOAL_RATING_COPY: Record<GoalRatingColor, MentorshipRubricCopy> = {
  ABOVE_AND_BEYOND: {
    label: "Above & Beyond",
    shortLabel: "Purple",
    menteeLabel: "Above & Beyond",
    mentorDescription: "Dramatically exceeds all bullets at this level.",
    menteeDescription:
      "You’re exceeding expectations on this goal — keep stretching into bigger ownership.",
    adminDescription: "Dramatically exceeds all bullets at this level.",
    color: "#7c3aed",
    background: "#f5f3ff",
    adminAttention: false,
  },
  ACHIEVED: {
    label: "On Track",
    shortLabel: "Green",
    menteeLabel: "On Track",
    mentorDescription: "All bullets met.",
    menteeDescription: "You’re meeting the expectations for this goal.",
    adminDescription: "All bullets met.",
    color: "#16a34a",
    background: "#dcfce7",
    adminAttention: false,
  },
  GETTING_STARTED: {
    label: "Needs Attention",
    shortLabel: "Yellow",
    menteeLabel: "Needs Attention",
    mentorDescription: "Some bullets met; no major deficiencies.",
    menteeDescription:
      "Some expectations are met. Your mentor will help close the remaining gaps.",
    adminDescription: "Some bullets met; no major deficiencies.",
    color: "#d97706",
    background: "#fef3c7",
    adminAttention: false,
  },
  BEHIND_SCHEDULE: {
    label: "At Risk",
    shortLabel: "Red",
    menteeLabel: "At Risk",
    mentorDescription: "Major deficiencies present.",
    menteeDescription:
      "This area needs focused support. Your mentor and the team will help you reset with clear next steps.",
    adminDescription: "Major deficiencies present; requires admin attention.",
    color: "#dc2626",
    background: "#fee2e2",
    adminAttention: true,
  },
};

export const PROGRESS_STATUS_COPY: Record<ProgressStatus, MentorshipRubricCopy> = {
  ABOVE_AND_BEYOND: GOAL_RATING_COPY.ABOVE_AND_BEYOND,
  ON_TRACK: GOAL_RATING_COPY.ACHIEVED,
  GETTING_STARTED: GOAL_RATING_COPY.GETTING_STARTED,
  BEHIND_SCHEDULE: GOAL_RATING_COPY.BEHIND_SCHEDULE,
};

export function getGoalRatingCopy(
  rating?: GoalRatingColor | string | null
): MentorshipRubricCopy {
  if (rating && rating in GOAL_RATING_COPY) {
    return GOAL_RATING_COPY[rating as GoalRatingColor];
  }
  return GOAL_RATING_COPY.GETTING_STARTED;
}

export function getProgressStatusCopy(
  status?: ProgressStatus | string | null
): MentorshipRubricCopy {
  if (status && status in PROGRESS_STATUS_COPY) {
    return PROGRESS_STATUS_COPY[status as ProgressStatus];
  }
  return PROGRESS_STATUS_COPY.GETTING_STARTED;
}

export function ratingRequiresAdminAttention(
  rating?: GoalRatingColor | string | null
): boolean {
  return rating === "BEHIND_SCHEDULE";
}

/**
 * Canonical display order for the rubric: strongest → needs-most-support.
 * Purple (Above & Beyond) → Green (On Track) → Yellow (Needs Attention) → Red (At Risk).
 */
export const RATING_ORDER: GoalRatingColor[] = [
  "ABOVE_AND_BEYOND",
  "ACHIEVED",
  "GETTING_STARTED",
  "BEHIND_SCHEDULE",
];

export type RatingAudience = "mentee" | "mentor" | "admin";

/**
 * Returns the right label + description for a given audience, so mentee-facing
 * surfaces stay supportive while mentor/admin surfaces stay operationally clear.
 */
export function getRatingCopyForAudience(
  rating: GoalRatingColor | string | null | undefined,
  audience: RatingAudience
): {
  label: string;
  description: string;
  color: string;
  background: string;
  adminAttention: boolean;
} {
  const cfg = getGoalRatingCopy(rating);
  if (audience === "mentee") {
    return {
      label: cfg.menteeLabel,
      description: cfg.menteeDescription,
      color: cfg.color,
      background: cfg.background,
      adminAttention: cfg.adminAttention,
    };
  }
  if (audience === "admin") {
    return {
      label: cfg.label,
      description: cfg.adminDescription,
      color: cfg.color,
      background: cfg.background,
      adminAttention: cfg.adminAttention,
    };
  }
  return {
    label: cfg.label,
    description: cfg.mentorDescription,
    color: cfg.color,
    background: cfg.background,
    adminAttention: cfg.adminAttention,
  };
}

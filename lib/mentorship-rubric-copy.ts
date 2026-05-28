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

export const GOAL_RATING_COPY: Record<GoalRatingColor, MentorshipRubricCopy> = {
  ABOVE_AND_BEYOND: {
    label: "Above & Beyond",
    shortLabel: "Purple",
    menteeLabel: "Exceptional progress",
    mentorDescription:
      "Exceptional progress. This person may be ready for future mentor or leadership opportunities.",
    menteeDescription:
      "You are making exceptional progress and may be ready for more leadership responsibility.",
    adminDescription:
      "Exceptional progress; consider future mentor, chair, or leadership pathways.",
    color: "#7c3aed",
    background: "#f5f3ff",
    adminAttention: false,
  },
  ACHIEVED: {
    label: "Achieved",
    shortLabel: "Green",
    menteeLabel: "On track",
    mentorDescription: "On track. Goals are being met at the expected pace.",
    menteeDescription: "You are on track and building steady momentum.",
    adminDescription: "On track.",
    color: "#16a34a",
    background: "#dcfce7",
    adminAttention: false,
  },
  GETTING_STARTED: {
    label: "Getting Started",
    shortLabel: "Yellow",
    menteeLabel: "Needs support",
    mentorDescription:
      "Needs support. Clarify next steps and add structure before the next review.",
    menteeDescription:
      "You are still getting traction. Your mentor should help make the next steps clearer and easier to start.",
    adminDescription: "Needs support; watch for follow-up and resource needs.",
    color: "#d97706",
    background: "#fef3c7",
    adminAttention: false,
  },
  BEHIND_SCHEDULE: {
    label: "Serious Concern",
    shortLabel: "Red",
    menteeLabel: "Needs focused support",
    mentorDescription:
      "Serious concern. Requires admin attention and a concrete support plan.",
    menteeDescription:
      "This area needs focused support. Your mentor and the team should help you reset with clear, manageable next steps.",
    adminDescription: "Serious concern; requires admin attention.",
    color: "#dc2626",
    background: "#fee2e2",
    adminAttention: true,
  },
};

export const PROGRESS_STATUS_COPY: Record<ProgressStatus, MentorshipRubricCopy> = {
  ABOVE_AND_BEYOND: GOAL_RATING_COPY.ABOVE_AND_BEYOND,
  ON_TRACK: {
    ...GOAL_RATING_COPY.ACHIEVED,
    label: "On Track",
    menteeLabel: "On track",
  },
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

import {
  MentorshipPointCategory,
  MentorshipReviewStatus,
  ProgressStatus,
  RoleType,
} from "@prisma/client";

export const PROGRESS_STATUS_META: Record<
  ProgressStatus,
  { color: string; label: string; description: string; position: number }
> = {
  BEHIND_SCHEDULE: {
    color: "#dc2626",
    label: "Behind Schedule",
    description:
      "Incomplete or behind schedule, with no realistic catch-up path.",
    position: 0,
  },
  GETTING_STARTED: {
    color: "#eab308",
    label: "Getting Started",
    description:
      "Incomplete or behind schedule, but a catch-up path still exists.",
    position: 1,
  },
  ON_TRACK: {
    color: "#16a34a",
    label: "Achieved",
    description:
      "Complete and on schedule in both quantity and quality.",
    position: 2,
  },
  ABOVE_AND_BEYOND: {
    color: "#7c3aed",
    label: "Above & Beyond",
    description:
      "Exceeds goals in both quantity and quality.",
    position: 3,
  },
};

export const REVIEW_STATUS_META: Record<
  MentorshipReviewStatus,
  { label: string; tone: "neutral" | "warning" | "success" | "danger" }
> = {
  DRAFT: { label: "Mentor Draft", tone: "neutral" },
  PENDING_CHAIR_APPROVAL: {
    label: "Chair Approval Pending",
    tone: "warning",
  },
  APPROVED: { label: "Approved", tone: "success" },
  RETURNED: { label: "Returned For Edits", tone: "danger" },
};

export function normalizeMonthlyReviewMonth(value?: Date | string | null) {
  const date = value ? new Date(value) : new Date();
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

export function calculateOverallProgress(
  statuses: Array<ProgressStatus | null | undefined>
) {
  const numeric = statuses
    .filter((status): status is ProgressStatus => Boolean(status))
    .map((status) => PROGRESS_STATUS_META[status].position);

  if (numeric.length === 0) {
    return null;
  }

  const average = numeric.reduce((sum, value) => sum + value, 0) / numeric.length;

  if (average < 0.75) return "BEHIND_SCHEDULE" as ProgressStatus;
  if (average < 1.5) return "GETTING_STARTED" as ProgressStatus;
  if (average < 2.5) return "ON_TRACK" as ProgressStatus;
  return "ABOVE_AND_BEYOND" as ProgressStatus;
}

export function getMonthlyCycleLabel(args: {
  hasReflection: boolean;
  reviewStatus?: MentorshipReviewStatus | null;
}) {
  if (args.reviewStatus) {
    return REVIEW_STATUS_META[args.reviewStatus];
  }

  if (args.hasReflection) {
    return { label: "Mentor Review Needed", tone: "warning" as const };
  }

  return { label: "Reflection Not Started", tone: "neutral" as const };
}

export function getDefaultPointCategory(
  primaryRole?: RoleType | null
): MentorshipPointCategory {
  if (primaryRole === "INSTRUCTOR") return "INSTRUCTOR";
  if (primaryRole === "CHAPTER_PRESIDENT") return "CHAPTER_PRESIDENT";
  if (primaryRole === "STUDENT") return "STUDENT";
  if (primaryRole === "STAFF") return "STAFF";
  return "GLOBAL_LEADERSHIP";
}

const ACHIEVEMENT_POINT_MATRICES: Record<
  MentorshipPointCategory,
  Record<ProgressStatus, number>
> = {
  STUDENT: {
    BEHIND_SCHEDULE: 0,
    GETTING_STARTED: 10,
    ON_TRACK: 25,
    ABOVE_AND_BEYOND: 50,
  },
  INSTRUCTOR: {
    BEHIND_SCHEDULE: 0,
    GETTING_STARTED: 10,
    ON_TRACK: 35,
    ABOVE_AND_BEYOND: 75,
  },
  CHAPTER_PRESIDENT: {
    BEHIND_SCHEDULE: 0,
    GETTING_STARTED: 20,
    ON_TRACK: 50,
    ABOVE_AND_BEYOND: 85,
  },
  GLOBAL_LEADERSHIP: {
    BEHIND_SCHEDULE: 0,
    GETTING_STARTED: 25,
    ON_TRACK: 60,
    ABOVE_AND_BEYOND: 100,
  },
  STAFF: {
    BEHIND_SCHEDULE: 0,
    GETTING_STARTED: 25,
    ON_TRACK: 60,
    ABOVE_AND_BEYOND: 100,
  },
  CUSTOM: {
    BEHIND_SCHEDULE: 0,
    GETTING_STARTED: 0,
    ON_TRACK: 0,
    ABOVE_AND_BEYOND: 0,
  },
};

export function getAchievementPointsForCategory(
  category: MentorshipPointCategory,
  status?: ProgressStatus | null
) {
  if (!status) return 0;
  return ACHIEVEMENT_POINT_MATRICES[category][status];
}

import type { ProgressStatus } from "@prisma/client";

import { formatApplicantDisplayName } from "@/lib/applicant-display-name";

/** Active pipeline stages shown in the applicant review workspace. */
export const WORKSPACE_STATUSES = [
  "CHAIR_REVIEW",
  "INTERVIEW_COMPLETED",
  "INTERVIEW_SCHEDULED",
  "PRE_APPROVED",
  "UNDER_REVIEW",
  "INFO_REQUESTED",
] as const;

export type WorkspaceApplicantStatus = (typeof WORKSPACE_STATUSES)[number];

const STATUS_RANK: Record<string, number> = {
  CHAIR_REVIEW: 0,
  INTERVIEW_COMPLETED: 1,
  INTERVIEW_SCHEDULED: 2,
  PRE_APPROVED: 3,
  UNDER_REVIEW: 4,
  INFO_REQUESTED: 5,
};

const STAGE_LABEL: Record<string, string> = {
  CHAIR_REVIEW: "Final review",
  INTERVIEW_COMPLETED: "Post-interview",
  INTERVIEW_SCHEDULED: "Interview scheduled",
  PRE_APPROVED: "Interview prep",
  UNDER_REVIEW: "Under review",
  INFO_REQUESTED: "Info requested",
};

const RECOMMENDATION_LABEL: Record<string, string> = {
  ACCEPT: "Advance to offer",
  ACCEPT_WITH_SUPPORT: "Advance with support",
  HOLD: "Hold for discussion",
  REJECT: "Decline",
};

const AVATAR_HUES = ["#5a1da8", "#0891b2", "#0e7c52", "#d97706", "#2563eb", "#db2777"];

export function workspaceStageLabel(status: string): string {
  return STAGE_LABEL[status] ?? status.replace(/_/g, " ").toLowerCase();
}

export function applicantInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

export function applicantAvatarColor(seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) hash = seed.charCodeAt(i) + ((hash << 5) - hash);
  return AVATAR_HUES[Math.abs(hash) % AVATAR_HUES.length];
}

/** Map the 4-point progress scale to a 5-star display score. */
export function ratingToFiveStar(rating: string | null | undefined): number | null {
  if (!rating) return null;
  const map: Record<string, number> = {
    BEHIND_SCHEDULE: 2.5,
    GETTING_STARTED: 3.5,
    ON_TRACK: 4.0,
    ABOVE_AND_BEYOND: 4.5,
  };
  return map[rating] ?? null;
}

export function averageReviewScore(
  reviews: Array<{ overallRating: string | null }>
): number | null {
  const scores = reviews
    .map((r) => ratingToFiveStar(r.overallRating))
    .filter((s): s is number => s !== null);
  if (scores.length === 0) return null;
  const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
  return Math.round(avg * 10) / 10;
}

export function recommendedNextStep(
  reviews: Array<{ recommendation: string | null }>
): { label: string; detail: string; tone: "success" | "warning" | "danger" | "neutral" } {
  const recs = reviews.map((r) => r.recommendation).filter(Boolean) as string[];
  if (recs.length === 0) {
    return {
      label: "Awaiting interviewer reviews",
      detail: "No panel reviews submitted yet.",
      tone: "neutral",
    };
  }
  const accept = recs.filter((r) => r === "ACCEPT" || r === "ACCEPT_WITH_SUPPORT").length;
  const reject = recs.filter((r) => r === "REJECT").length;
  const hold = recs.filter((r) => r === "HOLD").length;

  if (reject > recs.length / 2) {
    return {
      label: "Decline",
      detail: "Majority of interviewers recommend declining.",
      tone: "danger",
    };
  }
  if (hold > 0 && accept <= hold) {
    return {
      label: "Hold for discussion",
      detail: "Mixed signals — discuss at the next officer meeting.",
      tone: "warning",
    };
  }
  const label = RECOMMENDATION_LABEL.ACCEPT;
  return {
    label,
    detail: "Strong, consistent reviews across interviewers. Provisional 3-month period applies.",
    tone: "success",
  };
}

export type InterviewStepState = "done" | "current" | "pending";

export type InterviewStep = {
  label: string;
  note: string;
  state: InterviewStepState;
};

export function buildInterviewSteps(args: {
  status: string;
  interviewScheduledAt: Date | string | null;
  submittedReviewCount: number;
  assignmentCount: number;
}): InterviewStep[] {
  const scheduled = args.interviewScheduledAt
    ? new Date(args.interviewScheduledAt).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      })
    : null;

  const pastScreening = !["SUBMITTED", "UNDER_REVIEW", "INFO_REQUESTED"].includes(args.status);
  const pastDemo =
    args.status === "INTERVIEW_COMPLETED" ||
    args.status === "CHAIR_REVIEW" ||
    args.submittedReviewCount > 0;
  const pastPanel = args.status === "CHAIR_REVIEW" || args.submittedReviewCount >= args.assignmentCount;

  return [
    {
      label: "Screening call",
      note: pastScreening ? "Passed" : "Not scheduled",
      state: pastScreening ? "done" : args.status === "PRE_APPROVED" ? "current" : "pending",
    },
    {
      label: "Teaching demo",
      note: pastDemo
        ? scheduled
          ? `${scheduled} · passed`
          : "Complete"
        : scheduled
          ? `${scheduled} · scheduled`
          : "Not scheduled",
      state: pastDemo ? "done" : args.status === "INTERVIEW_SCHEDULED" ? "current" : "pending",
    },
    {
      label: "Panel interview",
      note: pastPanel
        ? "Complete"
        : args.submittedReviewCount > 0
          ? `${args.submittedReviewCount} of ${Math.max(args.assignmentCount, 1)} in`
          : "Not scheduled",
      state: pastPanel ? "done" : args.status === "INTERVIEW_COMPLETED" ? "current" : "pending",
    },
  ];
}

export function reviewSummaryText(review: {
  categories: Array<{ notes: string | null }>;
}): string {
  for (const cat of review.categories) {
    const note = cat.notes?.trim();
    if (note) return note.length > 160 ? `${note.slice(0, 157)}…` : note;
  }
  return "Review submitted — open the full cockpit for category detail.";
}

export function interviewerRoleLabel(
  assignment: { role: string } | undefined,
  fallback = "Panel"
): string {
  if (!assignment) return fallback;
  return assignment.role.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export function sortWorkspaceApplicants<
  T extends {
    status: string;
    interviewReviews: unknown[];
    createdAt?: Date | string;
  }
>(apps: T[]): T[] {
  return [...apps].sort((a, b) => {
    const reviewDiff = b.interviewReviews.length - a.interviewReviews.length;
    if (reviewDiff !== 0) return reviewDiff;
    const rankA = STATUS_RANK[a.status] ?? 99;
    const rankB = STATUS_RANK[b.status] ?? 99;
    if (rankA !== rankB) return rankA - rankB;
    const aTime = a.createdAt ? new Date(a.createdAt).getTime() : 0;
    const bTime = b.createdAt ? new Date(b.createdAt).getTime() : 0;
    return aTime - bTime;
  });
}

export function formatWorkspaceDisplayName(app: {
  preferredFirstName: string | null;
  lastName: string | null;
  legalName: string | null;
  applicant: { name: string | null };
}): string {
  return formatApplicantDisplayName(app);
}

export function formatAppliedDate(createdAt: Date | string | null | undefined): string {
  if (!createdAt) return "—";
  return new Date(createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function formatExperience(teachingExperience: string | null | undefined): string {
  if (!teachingExperience?.trim()) return "—";
  const trimmed = teachingExperience.trim();
  return trimmed.length > 40 ? `${trimmed.slice(0, 37)}…` : trimmed;
}

export function showFinalDecisionModule(status: string, reviewCount: number): boolean {
  return status === "CHAIR_REVIEW" && reviewCount > 0;
}

export type ProgressRating = ProgressStatus;

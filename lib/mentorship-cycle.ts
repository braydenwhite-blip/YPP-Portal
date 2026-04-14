/**
 * Mentorship cycle helpers.
 *
 * Calendar-month anchored: cycleMonth is the first day of the month UTC.
 * cycleNumber is sequential from the mentorship kickoff; multiples of 3 are
 * quarterly cycles in the modern pipeline.
 *
 * Introduced in Phase 0.8. Extended in Phase 0.9 with computeCycleStage and
 * getReviewSpineForMentee.
 */
import type {
  Mentorship,
  MentorGoalReview,
  MonthlySelfReflection,
  MentorshipCycleStage,
  GoalReviewStatus,
  MentorshipStatus,
} from "@prisma/client";
import { prisma } from "@/lib/prisma";

export type CycleMonthInfo = {
  /** First day of the current calendar month, UTC midnight. */
  cycleMonth: Date;
  /** YYYY-MM string for comparison. */
  cycleMonthKey: string;
  /** Human label, e.g. "April 2026". */
  cycleLabel: string;
};

export function getCurrentCycleMonth(date: Date = new Date()): CycleMonthInfo {
  const cycleMonth = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
  const cycleMonthKey = `${cycleMonth.getUTCFullYear()}-${String(cycleMonth.getUTCMonth() + 1).padStart(2, "0")}`;
  const cycleLabel = cycleMonth.toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
  return { cycleMonth, cycleMonthKey, cycleLabel };
}

/**
 * Soft deadline for the current cycle's reflection: day 21 of the cycle month.
 * Grace period extends to the end of the cycle month.
 */
export function getReflectionSoftDeadline(cycleMonth: Date): Date {
  return new Date(Date.UTC(cycleMonth.getUTCFullYear(), cycleMonth.getUTCMonth(), 21));
}

export function getReflectionGraceDeadline(cycleMonth: Date): Date {
  return new Date(Date.UTC(cycleMonth.getUTCFullYear(), cycleMonth.getUTCMonth() + 1, 0));
}

type CycleStageInputs = {
  mentorship: Pick<Mentorship, "status" | "kickoffCompletedAt">;
  latestReflection: Pick<MonthlySelfReflection, "cycleNumber" | "cycleMonth"> | null;
  latestReview: Pick<
    MentorGoalReview,
    "status" | "cycleNumber" | "cycleMonth" | "releasedToMenteeAt"
  > | null;
  currentCycleMonth?: Date;
};

/**
 * Pure function deriving the denormalized Mentorship.cycleStage.
 * See prisma/schema.prisma `enum MentorshipCycleStage` for the ordering.
 */
export function computeCycleStage({
  mentorship,
  latestReflection,
  latestReview,
  currentCycleMonth,
}: CycleStageInputs): MentorshipCycleStage {
  if (mentorship.status === "PAUSED") return "PAUSED";
  if (mentorship.status === "COMPLETE") return "COMPLETE";
  if (!mentorship.kickoffCompletedAt) return "KICKOFF_PENDING";

  const cycleAnchor = currentCycleMonth ?? getCurrentCycleMonth().cycleMonth;

  if (latestReview) {
    if (latestReview.status === "APPROVED" && latestReview.releasedToMenteeAt) {
      // Approved for the CURRENT cycle → APPROVED; otherwise a new cycle is due.
      if (sameCalendarMonth(latestReview.cycleMonth, cycleAnchor)) return "APPROVED";
    } else if (latestReview.status === "CHANGES_REQUESTED") {
      return "CHANGES_REQUESTED";
    } else if (latestReview.status === "PENDING_CHAIR_APPROVAL") {
      return "REVIEW_SUBMITTED";
    }
  }

  if (latestReflection) {
    const hasReviewForReflection =
      latestReview && latestReview.cycleNumber === latestReflection.cycleNumber;
    if (!hasReviewForReflection) return "REFLECTION_SUBMITTED";
  }

  return "REFLECTION_DUE";
}

function sameCalendarMonth(a: Date, b: Date): boolean {
  return a.getUTCFullYear() === b.getUTCFullYear() && a.getUTCMonth() === b.getUTCMonth();
}

/**
 * Recompute and persist cycleStage for a single mentorship.
 * Call from any transaction that mutates reflection/review state.
 */
export async function recomputeMentorshipCycleStage(mentorshipId: string): Promise<MentorshipCycleStage> {
  const mentorship = await prisma.mentorship.findUnique({
    where: { id: mentorshipId },
    select: {
      id: true,
      status: true,
      kickoffCompletedAt: true,
      cycleStage: true,
    },
  });
  if (!mentorship) throw new Error(`Mentorship ${mentorshipId} not found`);

  const [latestReflection, latestReview] = await Promise.all([
    prisma.monthlySelfReflection.findFirst({
      where: { mentorshipId },
      orderBy: { cycleNumber: "desc" },
      select: { cycleNumber: true, cycleMonth: true },
    }),
    prisma.mentorGoalReview.findFirst({
      where: { mentorshipId },
      orderBy: { cycleNumber: "desc" },
      select: {
        status: true,
        cycleNumber: true,
        cycleMonth: true,
        releasedToMenteeAt: true,
      },
    }),
  ]);

  const nextStage = computeCycleStage({
    mentorship,
    latestReflection,
    latestReview,
  });

  if (nextStage !== mentorship.cycleStage) {
    await prisma.mentorship.update({
      where: { id: mentorshipId },
      data: { cycleStage: nextStage },
    });
  }

  return nextStage;
}

export type MenteeCycleState = {
  mentorshipId: string | null;
  hasQualifyingMentorship: boolean;
  cycleMonth: Date;
  cycleMonthKey: string;
  cycleLabel: string;
  cycleNumber: number | null;
  reflectionSubmitted: boolean;
  reviewReleased: boolean;
  reviewStatus: GoalReviewStatus | null;
  softDeadline: Date;
  graceDeadline: Date;
  isOverdue: boolean;
  mentorshipStatus: MentorshipStatus | null;
};

export async function getMenteeCycleState(userId: string): Promise<MenteeCycleState> {
  const { cycleMonth, cycleMonthKey, cycleLabel } = getCurrentCycleMonth();
  const softDeadline = getReflectionSoftDeadline(cycleMonth);
  const graceDeadline = getReflectionGraceDeadline(cycleMonth);

  const mentorship = await prisma.mentorship.findFirst({
    where: { menteeId: userId, status: "ACTIVE" },
    orderBy: { startDate: "desc" },
    select: {
      id: true,
      status: true,
      kickoffCompletedAt: true,
      governanceMode: true,
      cycleStage: true,
    },
  });

  if (!mentorship) {
    return {
      mentorshipId: null,
      hasQualifyingMentorship: false,
      cycleMonth,
      cycleMonthKey,
      cycleLabel,
      cycleNumber: null,
      reflectionSubmitted: false,
      reviewReleased: false,
      reviewStatus: null,
      softDeadline,
      graceDeadline,
      isOverdue: false,
      mentorshipStatus: null,
    };
  }

  const latestReflection = await prisma.monthlySelfReflection.findFirst({
    where: { mentorshipId: mentorship.id },
    orderBy: { cycleNumber: "desc" },
    select: {
      cycleNumber: true,
      cycleMonth: true,
      goalReview: {
        select: { status: true, releasedToMenteeAt: true },
      },
    },
  });

  const reflectionIsCurrent =
    latestReflection !== null && sameCalendarMonth(latestReflection.cycleMonth, cycleMonth);
  const reflectionSubmitted = reflectionIsCurrent;
  const review = reflectionIsCurrent ? latestReflection?.goalReview ?? null : null;
  const reviewReleased = !!review?.releasedToMenteeAt;
  const isOverdue = !reflectionSubmitted && new Date() > softDeadline;

  return {
    mentorshipId: mentorship.id,
    hasQualifyingMentorship: true,
    cycleMonth,
    cycleMonthKey,
    cycleLabel,
    cycleNumber: latestReflection?.cycleNumber ?? null,
    reflectionSubmitted,
    reviewReleased,
    reviewStatus: review?.status ?? null,
    softDeadline,
    graceDeadline,
    isOverdue,
    mentorshipStatus: mentorship.status,
  };
}

export type MentorCycleSummary = {
  needsReview: number;
  awaitingChair: number;
  changesRequested: number;
  kickoffPending: number;
};

export async function getMentorCycleSummary(userId: string): Promise<MentorCycleSummary> {
  const { cycleMonth } = getCurrentCycleMonth();
  const [needsReview, awaitingChair, changesRequested, kickoffPending] = await Promise.all([
    prisma.monthlySelfReflection.count({
      where: {
        cycleMonth: { gte: cycleMonth },
        mentorship: { status: "ACTIVE", mentorId: userId },
        goalReview: null,
      },
    }),
    prisma.mentorGoalReview.count({
      where: { mentorId: userId, status: "PENDING_CHAIR_APPROVAL" },
    }),
    prisma.mentorGoalReview.count({
      where: { mentorId: userId, status: "CHANGES_REQUESTED" },
    }),
    prisma.mentorship.count({
      where: { mentorId: userId, status: "ACTIVE", kickoffCompletedAt: null },
    }),
  ]);
  return { needsReview, awaitingChair, changesRequested, kickoffPending };
}

export type ReviewSpineStep = {
  key: "KICKOFF" | "REFLECTION" | "REVIEW" | "APPROVAL" | "POINTS";
  label: string;
  state: "completed" | "pending" | "skipped" | "active";
  timestamp: Date | null;
  href: string | null;
  detail: string | null;
};

export type ReviewSpineCycle = {
  cycleNumber: number;
  cycleMonth: Date;
  cycleLabel: string;
  currentStage: MentorshipCycleStage;
  steps: ReviewSpineStep[];
};

/**
 * Historical timeline of a mentee's cycles — Kickoff → Reflection → Review →
 * Approval → Points Awarded, newest first.
 */
export async function getReviewSpineForMentee(menteeId: string): Promise<ReviewSpineCycle[]> {
  const mentorship = await prisma.mentorship.findFirst({
    where: { menteeId, status: { in: ["ACTIVE", "COMPLETE"] } },
    orderBy: { startDate: "desc" },
    select: {
      id: true,
      kickoffCompletedAt: true,
      kickoffScheduledAt: true,
      cycleStage: true,
    },
  });
  if (!mentorship) return [];

  const [reflections, reviews, points] = await Promise.all([
    prisma.monthlySelfReflection.findMany({
      where: { mentorshipId: mentorship.id },
      orderBy: { cycleNumber: "desc" },
      select: {
        id: true,
        cycleNumber: true,
        cycleMonth: true,
        createdAt: true,
      },
    }),
    prisma.mentorGoalReview.findMany({
      where: { mentorshipId: mentorship.id },
      orderBy: { cycleNumber: "desc" },
      select: {
        id: true,
        cycleNumber: true,
        cycleMonth: true,
        status: true,
        releasedToMenteeAt: true,
        chairApprovedAt: true,
      },
    }),
    prisma.achievementPointLog.findMany({
      where: { summary: { userId: menteeId } },
      select: {
        id: true,
        points: true,
        cycleMonth: true,
        createdAt: true,
        reviewId: true,
      },
    }),
  ]);

  const reviewByCycle = new Map<number, (typeof reviews)[number]>();
  reviews.forEach((r) => reviewByCycle.set(r.cycleNumber, r));
  const pointsByReview = new Map<string, (typeof points)[number]>();
  points.forEach((p) => pointsByReview.set(p.reviewId, p));

  const cycleNumbers = new Set<number>();
  reflections.forEach((r) => cycleNumbers.add(r.cycleNumber));
  reviews.forEach((r) => cycleNumbers.add(r.cycleNumber));

  return Array.from(cycleNumbers)
    .sort((a, b) => b - a)
    .map((cycleNumber) => {
      const reflection = reflections.find((r) => r.cycleNumber === cycleNumber) ?? null;
      const review = reviewByCycle.get(cycleNumber) ?? null;
      const pointLog = review ? pointsByReview.get(review.id) ?? null : null;
      const cycleMonth = reflection?.cycleMonth ?? review?.cycleMonth ?? new Date();
      const cycleLabel = cycleMonth.toLocaleDateString("en-US", {
        month: "long",
        year: "numeric",
        timeZone: "UTC",
      });

      const steps: ReviewSpineStep[] = [
        {
          key: "KICKOFF",
          label: "Kickoff",
          state: mentorship.kickoffCompletedAt ? "completed" : "pending",
          timestamp: mentorship.kickoffCompletedAt,
          href: null,
          detail: mentorship.kickoffCompletedAt
            ? null
            : mentorship.kickoffScheduledAt
              ? "Scheduled"
              : "Not yet scheduled",
        },
        {
          key: "REFLECTION",
          label: "Reflection",
          state: reflection ? "completed" : "pending",
          timestamp: reflection?.createdAt ?? null,
          href: reflection ? `/my-program/reflect?cycle=${cycleNumber}` : "/my-program/reflect",
          detail: null,
        },
        {
          key: "REVIEW",
          label: "Monthly Review",
          state: review ? (review.status === "APPROVED" ? "completed" : "active") : "pending",
          timestamp: review?.releasedToMenteeAt ?? null,
          href: review?.releasedToMenteeAt ? `/mentorship/reviews/${review.id}` : null,
          detail: review && !review.releasedToMenteeAt ? "Your mentor is writing this." : null,
        },
        {
          key: "APPROVAL",
          label: "Chair Approval",
          state: review?.chairApprovedAt ? "completed" : review ? "active" : "pending",
          timestamp: review?.chairApprovedAt ?? null,
          href: null,
          detail: null,
        },
        {
          key: "POINTS",
          label: "Points Awarded",
          state: pointLog ? "completed" : "pending",
          timestamp: pointLog?.createdAt ?? null,
          href: null,
          detail: pointLog ? `${pointLog.points} points` : null,
        },
      ];

      return {
        cycleNumber,
        cycleMonth,
        cycleLabel,
        currentStage: mentorship.cycleStage,
        steps,
      };
    });
}

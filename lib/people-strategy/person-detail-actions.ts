"use server";

import type { GoalRatingColor } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { requireLeadership } from "@/lib/authorization";
import { isPeopleDashboardEnabled, isQuarterlyReviewsEnabled } from "@/lib/feature-flags";
import { z } from "zod";

import {
  buildCheckInReadiness,
  type CheckInReadiness,
} from "./check-in-readiness";
import {
  buildCheckInDrawerMonths,
  monthKeyUTC,
  monthLabelUTC,
  monthShortLabelUTC,
} from "./people-performance-selectors";

function startOfNextMonthUTC(monthStart: Date): Date {
  return new Date(
    Date.UTC(monthStart.getUTCFullYear(), monthStart.getUTCMonth() + 1, 1)
  );
}

/**
 * People & Performance — the Person Detail drawer's lazy read.
 *
 * The performance table rows already carry workload, dots, and quarterly facts;
 * this fetches only the extra detail the drawer's Check-in section needs (the
 * latest compiled check-in's aggregate notes) so the table payload stays small.
 *
 * Leadership/Board only (`requireLeadership()`), gated by ENABLE_PEOPLE_DASHBOARD.
 * The notes returned are the AGGREGATE compiled notes — they never contain raw
 * collaborator feedback bodies (those live only in the feedback review surface).
 */

export type PersonCheckInDetail = {
  monthKey: string;
  /** "May 2026" */
  monthLabel: string;
  performanceRating: GoalRatingColor | null;
  /** Aggregate compiled notes — safe to show; no confidential bodies. */
  compiledNotes: string | null;
  compiledAtISO: string;
} | null;

export type CheckInMonthReadiness = CheckInReadiness & {
  hasSelfReflection: boolean;
  hasMentorReview: boolean;
  goalRatingCount: number;
  feedbackRequested: number;
  feedbackReceived: number;
  feedbackPending: number;
};

export type CheckInMonthRow = {
  monthKey: string;
  /** "June 2026" */
  monthLabel: string;
  /** "Jun 26" */
  monthShortLabel: string;
  state: "rated" | "completed" | "missing" | "not_due";
  performanceRating: GoalRatingColor | null;
  compiledAtISO: string | null;
  /** Aggregate compiled notes — safe to show; no confidential bodies. */
  compiledNotesPreview: string | null;
  readiness: CheckInMonthReadiness;
};

export type CheckInMonthsSnapshot = {
  subject: { id: string; name: string | null };
  /** Newest month first. */
  months: CheckInMonthRow[];
  canCompile: boolean;
  personHref: string;
};

const Schema = z.object({ subjectUserId: z.string().min(1) });

const MonthsSchema = z.object({
  subjectUserId: z.string().min(1),
});

export async function loadLatestCheckInDetail(
  input: z.input<typeof Schema>
): Promise<PersonCheckInDetail> {
  if (!isPeopleDashboardEnabled()) {
    throw new Error("The People dashboard is not enabled");
  }
  await requireLeadership();

  const { subjectUserId } = Schema.parse(input);

  const checkIn = await prisma.checkIn.findFirst({
    where: { userId: subjectUserId },
    orderBy: { month: "desc" },
    select: {
      month: true,
      performanceRating: true,
      compiledNotes: true,
      createdAt: true,
    },
  });
  if (!checkIn) return null;

  return {
    monthKey: monthKeyUTC(checkIn.month),
    monthLabel: monthLabelUTC(checkIn.month),
    performanceRating: checkIn.performanceRating,
    compiledNotes: checkIn.compiledNotes,
    compiledAtISO: checkIn.createdAt.toISOString(),
  };
}

/** Rolling calendar months with compile status — powers the check-ins drawer. */
export async function loadCheckInMonthsForSubject(
  input: z.input<typeof MonthsSchema>
): Promise<CheckInMonthsSnapshot> {
  if (!isPeopleDashboardEnabled()) {
    throw new Error("The People dashboard is not enabled");
  }
  await requireLeadership();

  const { subjectUserId } = MonthsSchema.parse(input);

  const subject = await prisma.user.findUnique({
    where: { id: subjectUserId },
    select: {
      id: true,
      name: true,
      email: true,
    },
  });
  if (!subject) throw new Error("Member not found");

  const now = new Date();
  const monthOptions = buildCheckInDrawerMonths(now);
  const monthStarts = monthOptions.map((m) => {
    const [y, mo] = m.key.split("-").map(Number);
    return new Date(Date.UTC(y, mo - 1, 1));
  });
  const monthRanges = monthStarts.map((start) => ({
    gte: start,
    lt: startOfNextMonthUTC(start),
  }));

  const [checkIns, reflections, reviews, feedbackRequests] = await Promise.all([
    prisma.checkIn.findMany({
      where: { userId: subjectUserId, month: { in: monthStarts } },
      select: {
        month: true,
        performanceRating: true,
        compiledNotes: true,
        createdAt: true,
      },
    }),
    prisma.monthlySelfReflection.findMany({
      where: {
        menteeId: subjectUserId,
        OR: monthRanges.map((range) => ({ cycleMonth: range })),
      },
      select: { cycleMonth: true },
    }),
    prisma.mentorGoalReview.findMany({
      where: {
        menteeId: subjectUserId,
        OR: monthRanges.map((range) => ({ cycleMonth: range })),
      },
      select: {
        cycleMonth: true,
        goalRatings: { select: { id: true } },
      },
    }),
    prisma.feedbackRequest.findMany({
      where: { subjectUserId, month: { in: monthStarts } },
      select: { month: true, submittedAt: true },
    }),
  ]);

  const checkInByKey = new Map(
    checkIns.map((c) => [
      monthKeyUTC(c.month),
      {
        performanceRating: c.performanceRating,
        compiledAtISO: c.createdAt.toISOString(),
        compiledAt: c.createdAt,
        compiledNotes: c.compiledNotes,
      },
    ])
  );

  const reflectionKeys = new Set(
    reflections.map((r) => monthKeyUTC(r.cycleMonth))
  );

  const reviewByKey = new Map<
    string,
    { hasReview: boolean; goalRatingCount: number }
  >();
  for (const review of reviews) {
    const key = monthKeyUTC(review.cycleMonth);
    reviewByKey.set(key, {
      hasReview: true,
      goalRatingCount: review.goalRatings.length,
    });
  }

  const feedbackByKey = new Map<
    string,
    { requested: number; received: number; latestSubmittedAt: Date | null }
  >();
  for (const req of feedbackRequests) {
    const key = monthKeyUTC(req.month);
    const entry = feedbackByKey.get(key) ?? {
      requested: 0,
      received: 0,
      latestSubmittedAt: null,
    };
    entry.requested += 1;
    if (req.submittedAt) {
      entry.received += 1;
      if (!entry.latestSubmittedAt || req.submittedAt > entry.latestSubmittedAt) {
        entry.latestSubmittedAt = req.submittedAt;
      }
    }
    feedbackByKey.set(key, entry);
  }

  const months: CheckInMonthRow[] = monthOptions.map((opt) => {
    const [y, mo] = opt.key.split("-").map(Number);
    const monthDate = new Date(Date.UTC(y, mo - 1, 1));
    const found = checkInByKey.get(opt.key);
    const feedback = feedbackByKey.get(opt.key) ?? {
      requested: 0,
      received: 0,
      latestSubmittedAt: null,
    };
    const review = reviewByKey.get(opt.key);
    const hasSelfReflection = reflectionKeys.has(opt.key);
    const hasMentorReview = Boolean(review?.hasReview);
    const goalRatingCount = review?.goalRatingCount ?? 0;
    const feedbackPending = Math.max(0, feedback.requested - feedback.received);
    const newFeedbackSinceCompile =
      Boolean(found?.compiledAt) &&
      Boolean(feedback.latestSubmittedAt) &&
      feedback.latestSubmittedAt! > found!.compiledAt;

    const state: CheckInMonthRow["state"] = found
      ? found.performanceRating
        ? "rated"
        : "completed"
      : "missing";

    const readinessCore = buildCheckInReadiness({
      state,
      hasSelfReflection,
      hasMentorReview,
      goalRatingCount,
      feedbackRequested: feedback.requested,
      feedbackReceived: feedback.received,
      newFeedbackSinceCompile,
    });

    return {
      monthKey: opt.key,
      monthLabel: opt.label,
      monthShortLabel: monthShortLabelUTC(monthDate),
      state,
      performanceRating: found?.performanceRating ?? null,
      compiledAtISO: found?.compiledAtISO ?? null,
      compiledNotesPreview: found?.compiledNotes ?? null,
      readiness: {
        ...readinessCore,
        hasSelfReflection,
        hasMentorReview,
        goalRatingCount,
        feedbackRequested: feedback.requested,
        feedbackReceived: feedback.received,
        feedbackPending,
      },
    };
  });

  // Newest first.
  months.reverse();

  return {
    subject: { id: subject.id, name: subject.name ?? subject.email },
    months,
    canCompile: isQuarterlyReviewsEnabled(),
    personHref: `/people/${subject.id}`,
  };
}

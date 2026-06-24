"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { GoalRatingColor } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { requireLeadership } from "@/lib/authorization";
import { notifyMenteeReflectionDue } from "@/lib/mentorship-notifications";
import { isQuarterlyReviewsEnabled } from "@/lib/feature-flags";
import { derivePerformanceRating, RATING_LABELS } from "./check-in-rating";

/**
 * People Strategy — Monthly Check-In compilation (ENABLE_QUARTERLY_REVIEWS).
 *
 * Follows the `lib/*-actions.ts` convention: `"use server"`, a guard first
 * (`requireOfficer()`), zod validation, prisma write, then `revalidatePath`.
 *
 * `compileCheckIn` COMPILES a check-in from data that already exists — the
 * user's `MonthlySelfReflection` and `MentorGoalReview` for the month — and
 * derives `performanceRating` from the live goal-progress ratings. It never
 * collects a fresh monthly rating, and it UPSERTS on the unique (userId, month)
 * key so re-running it refreshes the same row rather than creating a duplicate.
 */

function ensureEnabled() {
  if (!isQuarterlyReviewsEnabled()) {
    throw new Error("Quarterly Reviews are not enabled");
  }
}

/** First day of the month (UTC) for `date`, matching the `cycleMonth` convention. */
function firstOfMonthUTC(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
}

/** Start of the month AFTER `monthStart` (UTC) — upper bound for range matching. */
function startOfNextMonthUTC(monthStart: Date): Date {
  return new Date(
    Date.UTC(monthStart.getUTCFullYear(), monthStart.getUTCMonth() + 1, 1)
  );
}

const CompileSchema = z.object({
  userId: z.string().min(1, "userId is required"),
  /** Any date within the target month; normalized to the first of the month. */
  month: z.coerce.date(),
});

export type CompileCheckInInput = z.input<typeof CompileSchema>;

export interface CompiledCheckIn {
  id: string;
  userId: string;
  month: Date;
  performanceRating: GoalRatingColor | null;
  selfReflectionId: string | null;
  mentorGoalReviewId: string | null;
  compiledNotes: string | null;
  /** Feedback responses received for the month (aggregate count, no bodies). */
  feedbackResponses: number;
  /** Feedback requests for the month still awaiting a response. */
  feedbackPending: number;
  /** True when a check-in for this month already existed (this was a refresh). */
  isRecompile: boolean;
  /** Responses that arrived after the previous compile (0 on first compile). */
  newResponses: number;
}

/**
 * Build a short, deterministic narrative from the sources that were found.
 * Kept human-readable; the structured fields above are the source of truth.
 */
function buildCompiledNotes(args: {
  hasReflection: boolean;
  rating: GoalRatingColor | null;
  goalCount: number;
  feedbackResponses: number;
  feedbackPending: number;
}): string {
  const lines: string[] = [];
  lines.push(
    args.hasReflection
      ? "Monthly self-reflection: on file."
      : "Monthly self-reflection: not submitted for this month."
  );
  if (args.rating) {
    lines.push(
      `Performance (from goal progress): ${RATING_LABELS[args.rating]} (${args.rating}).`
    );
  } else {
    lines.push("Performance: no goal-progress data available to derive a rating.");
  }
  lines.push(
    args.goalCount > 0
      ? `Derived from ${args.goalCount} per-goal rating${args.goalCount === 1 ? "" : "s"}.`
      : "No per-goal ratings recorded for this month."
  );
  // Feedback context — AGGREGATE COUNTS ONLY. Compiled notes surface to admins
  // (broader than Leadership/Board), so confidential collaborator response
  // bodies are never written here; they stay in the leadership-gated review
  // surface. See the privacy note on `compileCheckIn`.
  if (args.feedbackResponses > 0 || args.feedbackPending > 0) {
    const parts = [
      `${args.feedbackResponses} response${args.feedbackResponses === 1 ? "" : "s"} received`,
    ];
    if (args.feedbackPending > 0) {
      parts.push(`${args.feedbackPending} still pending`);
    }
    lines.push(
      `Collaborator feedback: ${parts.join(", ")} (summaries in the leadership feedback review).`
    );
  } else {
    lines.push("Collaborator feedback: none requested or received for this month.");
  }
  return lines.join("\n");
}

/**
 * Compile (or refresh) the monthly check-in for one user/month. Idempotent via
 * the unique (userId, month) constraint.
 */
export async function compileCheckIn(
  input: CompileCheckInInput
): Promise<CompiledCheckIn> {
  ensureEnabled();
  await requireLeadership();

  const { userId, month } = CompileSchema.parse(input);
  const monthStart = firstOfMonthUTC(month);
  const nextMonth = startOfNextMonthUTC(monthStart);
  const monthRange = { gte: monthStart, lt: nextMonth };

  // Pull the EXISTING reflection + mentor review for this user/month, plus the
  // PRIOR check-in (to tell first-compile from recompile) and the month's
  // feedback responses (COUNTS ONLY — no response bodies are read here). All
  // optional: a check-in can be compiled before any of these are on file.
  const [reflection, review, priorCheckIn, feedbackRequests] = await Promise.all([
    prisma.monthlySelfReflection.findFirst({
      where: { menteeId: userId, cycleMonth: monthRange },
      orderBy: { submittedAt: "desc" },
      select: { id: true },
    }),
    prisma.mentorGoalReview.findFirst({
      where: { menteeId: userId, cycleMonth: monthRange },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        overallRating: true,
        goalRatings: { select: { rating: true } },
      },
    }),
    prisma.checkIn.findUnique({
      where: { userId_month: { userId, month: monthStart } },
      select: { createdAt: true },
    }),
    prisma.feedbackRequest.findMany({
      where: { subjectUserId: userId, month: monthStart },
      select: { submittedAt: true },
    }),
  ]);

  const submittedRequests = feedbackRequests.filter((r) => r.submittedAt != null);
  const feedbackResponses = submittedRequests.length;
  const feedbackPending = feedbackRequests.length - feedbackResponses;
  const isRecompile = priorCheckIn != null;
  const newResponses = isRecompile
    ? submittedRequests.filter(
        (r) => r.submittedAt != null && r.submittedAt > priorCheckIn.createdAt
      ).length
    : feedbackResponses;

  const performanceRating = derivePerformanceRating(review);
  const compiledNotes = buildCompiledNotes({
    hasReflection: Boolean(reflection),
    rating: performanceRating,
    goalCount: review?.goalRatings.length ?? 0,
    feedbackResponses,
    feedbackPending,
  });

  const checkIn = await prisma.checkIn.upsert({
    where: { userId_month: { userId, month: monthStart } },
    create: {
      userId,
      month: monthStart,
      selfReflectionId: reflection?.id ?? null,
      mentorGoalReviewId: review?.id ?? null,
      performanceRating,
      compiledNotes,
    },
    update: {
      selfReflectionId: reflection?.id ?? null,
      mentorGoalReviewId: review?.id ?? null,
      performanceRating,
      compiledNotes,
    },
  });

  revalidatePath("/admin/people");
  revalidatePath("/people");
  revalidatePath("/people/performance");

  return {
    id: checkIn.id,
    userId: checkIn.userId,
    month: checkIn.month,
    performanceRating: checkIn.performanceRating,
    selfReflectionId: checkIn.selfReflectionId,
    mentorGoalReviewId: checkIn.mentorGoalReviewId,
    compiledNotes: checkIn.compiledNotes,
    feedbackResponses,
    feedbackPending,
    isRecompile,
    newResponses,
  };
}

const ReminderSchema = z.object({
  userId: z.string().min(1, "userId is required"),
  /** Any date within the target month; defaults to the current month (UTC). */
  month: z.coerce.date().optional(),
});

export type SendSelfReflectionReminderInput = z.input<typeof ReminderSchema>;

/** Leadership nudge when a member has not submitted this month's self-reflection. */
export async function sendSelfReflectionReminder(
  input: SendSelfReflectionReminderInput
): Promise<{ ok: true }> {
  await requireLeadership();

  const { userId, month } = ReminderSchema.parse(input);
  const monthStart = firstOfMonthUTC(month ?? new Date());
  const nextMonth = startOfNextMonthUTC(monthStart);

  const existing = await prisma.monthlySelfReflection.findFirst({
    where: {
      menteeId: userId,
      cycleMonth: { gte: monthStart, lt: nextMonth },
    },
    select: { id: true },
  });
  if (existing) {
    throw new Error("Self-reflection already submitted for this month.");
  }

  await notifyMenteeReflectionDue({
    menteeId: userId,
    cycleMonthIso: monthStart.toISOString(),
  });

  revalidatePath("/people/check-ins");
  revalidatePath("/people");

  return { ok: true };
}

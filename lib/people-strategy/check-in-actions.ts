"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { GoalRatingColor } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { requireOfficer } from "@/lib/authorization";
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
}

/**
 * Build a short, deterministic narrative from the sources that were found.
 * Kept human-readable; the structured fields above are the source of truth.
 */
function buildCompiledNotes(args: {
  hasReflection: boolean;
  rating: GoalRatingColor | null;
  goalCount: number;
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
  await requireOfficer();

  const { userId, month } = CompileSchema.parse(input);
  const monthStart = firstOfMonthUTC(month);
  const nextMonth = startOfNextMonthUTC(monthStart);
  const monthRange = { gte: monthStart, lt: nextMonth };

  // Pull the EXISTING reflection + mentor review for this user/month. Both are
  // optional — a check-in can be compiled before either is on file.
  const [reflection, review] = await Promise.all([
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
  ]);

  const performanceRating = derivePerformanceRating(review);
  const compiledNotes = buildCompiledNotes({
    hasReflection: Boolean(reflection),
    rating: performanceRating,
    goalCount: review?.goalRatings.length ?? 0,
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

  return {
    id: checkIn.id,
    userId: checkIn.userId,
    month: checkIn.month,
    performanceRating: checkIn.performanceRating,
    selfReflectionId: checkIn.selfReflectionId,
    mentorGoalReviewId: checkIn.mentorGoalReviewId,
    compiledNotes: checkIn.compiledNotes,
  };
}

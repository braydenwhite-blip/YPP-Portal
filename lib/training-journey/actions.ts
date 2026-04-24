"use server";

/**
 * Server actions for the interactive training journey (Phase 4).
 *
 * Exports:
 *   - submitBeatAttempt   — score a single beat and persist the attempt.
 *   - completeInteractiveJourney — finalize a journey, compute metrics, award XP.
 *   - resumeInteractiveJourney  — fetch resume state (read-only).
 *
 * Security invariants enforced here:
 *   1. Feature flag checked first on every action.
 *   2. Auth + role gate via authorize() on every action.
 *   3. Rate limiting: 60/60s submit, 6/60s complete.
 *   4. Strict Zod input validation (.strict()) on every action.
 *   5. Answer keys never leave this file — all beat data read from DB.
 *   6. CSRF: Next.js server actions include built-in CSRF protection.
 */

import { z } from "zod";
import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth-supabase";
import { hasApprovedInstructorTrainingAccess } from "@/lib/training-access";
import { checkRateLimit } from "@/lib/rate-limit-redis";
import { scoreBeat, BeatValidationError } from "@/lib/training-journey/scoring";
import { getBadgeForContentKey } from "@/lib/training-journey/client-contracts";
import type {
  BeatSubmitInput,
  BeatSubmitResult,
  CompleteJourneyInput,
  CompleteJourneyResult,
  JourneyAttemptSummary,
  JourneyCompletionSummary,
  ResumeJourneyInput,
  ResumeJourneyResult,
} from "@/lib/training-journey/client-contracts";
import pino from "pino";

const logger = pino({ name: "training-journey-actions" });

// ---------------------------------------------------------------------------
// Feature flag
// ---------------------------------------------------------------------------

function isInteractiveJourneyEnabled(): boolean {
  const v = process.env.ENABLE_INTERACTIVE_TRAINING_JOURNEY;
  return v !== "false" && v !== "0" && v !== "no";
}

// ---------------------------------------------------------------------------
// Shared auth helper
// ---------------------------------------------------------------------------

type AuthOk = { ok: true; userId: string; roles: string[] };
type AuthFail = { ok: false; code: "UNAUTHORIZED"; message: string };

async function authorize(): Promise<AuthOk | AuthFail> {
  const session = await getSession();
  if (!session?.user?.id) {
    return { ok: false, code: "UNAUTHORIZED", message: "You must be signed in." };
  }
  const roles = session.user.roles ?? [];
  if (!hasApprovedInstructorTrainingAccess(roles)) {
    return {
      ok: false,
      code: "UNAUTHORIZED",
      message: "You do not have access to instructor training.",
    };
  }
  return { ok: true, userId: session.user.id, roles };
}

// ---------------------------------------------------------------------------
// Zod schemas
// ---------------------------------------------------------------------------

const BeatSubmitInputSchema = z
  .object({
    moduleId: z.string().min(1),
    beatSourceKey: z.string().min(1),
    response: z.unknown(),
    timeMs: z.number().int().nonnegative().nullable().optional(),
  })
  .strict();

const CompleteJourneyInputSchema = z.object({ moduleId: z.string().min(1) }).strict();

const ResumeJourneyInputSchema = z.object({ moduleId: z.string().min(1) }).strict();

// ---------------------------------------------------------------------------
// submitBeatAttempt
// ---------------------------------------------------------------------------

export async function submitBeatAttempt(
  rawInput: BeatSubmitInput
): Promise<BeatSubmitResult> {
  // 1. Feature flag
  if (!isInteractiveJourneyEnabled()) {
    return {
      ok: false,
      code: "FEATURE_DISABLED",
      message: "Interactive journeys are not enabled.",
    };
  }

  // 2. Auth
  const auth = await authorize();
  if (!auth.ok) return auth;
  const { userId } = auth;

  // 3. Rate limit: 60 per 60s per user
  const rl = await checkRateLimit(`training-beat:${userId}`, 60, 60_000);
  if (!rl.success) {
    return {
      ok: false,
      code: "RATE_LIMITED",
      message: "Too many requests. Please wait a moment before trying again.",
    };
  }

  // 4. Zod parse
  const parsed = BeatSubmitInputSchema.safeParse(rawInput);
  if (!parsed.success) {
    return {
      ok: false,
      code: "INVALID_INPUT",
      message: parsed.error.issues.map((i) => i.message).join("; "),
    };
  }
  const input = parsed.data;

  // 5. Load the beat (join through journey to verify moduleId)
  const beat = await prisma.interactiveBeat.findFirst({
    where: {
      sourceKey: input.beatSourceKey,
      removedAt: null,
      journey: { moduleId: input.moduleId },
    },
    include: {
      journey: { select: { id: true, moduleId: true } },
    },
  });

  if (!beat) {
    // Distinguish "module not found" vs "beat not found" by checking module existence
    const moduleExists = await prisma.trainingModule.findUnique({
      where: { id: input.moduleId },
      select: { id: true },
    });
    if (!moduleExists) {
      return { ok: false, code: "MODULE_NOT_FOUND", message: "Training module not found." };
    }
    return { ok: false, code: "BEAT_NOT_FOUND", message: "Beat not found." };
  }

  // 6. Score the beat
  let scoreResult: Awaited<ReturnType<typeof scoreBeat>>;
  try {
    scoreResult = scoreBeat(beat, input.response);
  } catch (err) {
    if (err instanceof BeatValidationError) {
      if (err.stage === "response") {
        return {
          ok: false,
          code: "INVALID_RESPONSE",
          message: err.zodError.issues.map((i) => i.message).join("; "),
        };
      }
      // stage === "config" — content bug
      logger.error(
        { beatId: beat.id, sourceKey: beat.sourceKey, kind: beat.kind, zodError: err.zodError },
        "CRITICAL: beat config failed Zod parse — content bug"
      );
      return { ok: false, code: "SERVER_ERROR", message: "A server error occurred." };
    }
    logger.error({ err }, "Unexpected error in scoreBeat");
    return { ok: false, code: "SERVER_ERROR", message: "A server error occurred." };
  }

  const { correct, score, feedback } = scoreResult;

  // 7. Persist in a transaction
  let attemptNumber: number;
  try {
    const result = await prisma.$transaction(async (tx) => {
      // Compute next attempt number via aggregate
      const agg = await tx.interactiveBeatAttempt.aggregate({
        where: { beatId: beat.id, userId },
        _max: { attemptNumber: true },
      });
      const nextAttemptNumber = (agg._max.attemptNumber ?? 0) + 1;

      const attempt = await tx.interactiveBeatAttempt.create({
        data: {
          beatId: beat.id,
          userId,
          attemptNumber: nextAttemptNumber,
          response: input.response as object,
          responseSchemaVersion: beat.schemaVersion,
          correct,
          score,
          timeMs: input.timeMs ?? null,
          hintsShown: 0,
        },
      });

      return attempt;
    });
    attemptNumber = result.attemptNumber;
  } catch (err) {
    logger.error({ err, userId, beatId: beat.id }, "Failed to persist beat attempt");
    return { ok: false, code: "SERVER_ERROR", message: "A server error occurred." };
  }

  // 8. Compute next beat in sortOrder (ascending, same journey, not removed)
  const nextBeat = await prisma.interactiveBeat.findFirst({
    where: {
      journeyId: beat.journeyId,
      removedAt: null,
      sortOrder: { gt: beat.sortOrder },
    },
    orderBy: { sortOrder: "asc" },
    select: { sourceKey: true },
  });

  // 9. Log
  logger.info({
    userId,
    moduleId: input.moduleId,
    beatSourceKey: input.beatSourceKey,
    attemptNumber,
    correct,
    score,
    timeMs: input.timeMs,
  });

  // NOTE: No revalidatePath here — per-beat submit revalidation would thrash
  // the viewer's RSC on every click. Revalidation only happens on completion.

  return {
    ok: true,
    correct,
    score,
    attemptNumber,
    feedback,
    nextBeatSourceKey: nextBeat?.sourceKey ?? null,
  };
}

// ---------------------------------------------------------------------------
// completeInteractiveJourney
// ---------------------------------------------------------------------------

export async function completeInteractiveJourney(
  rawInput: CompleteJourneyInput
): Promise<CompleteJourneyResult> {
  // 1. Feature flag
  if (!isInteractiveJourneyEnabled()) {
    return {
      ok: false,
      code: "FEATURE_DISABLED",
      message: "Interactive journeys are not enabled.",
    };
  }

  // 2. Auth
  const auth = await authorize();
  if (!auth.ok) return auth;
  const { userId } = auth;

  // 3. Rate limit: 6 per 60s per user
  const rl = await checkRateLimit(`training-complete:${userId}`, 6, 60_000);
  if (!rl.success) {
    return {
      ok: false,
      code: "RATE_LIMITED",
      message: "Too many completion requests. Please wait a moment.",
    };
  }

  // 4. Zod parse
  const parsed = CompleteJourneyInputSchema.safeParse(rawInput);
  if (!parsed.success) {
    return {
      ok: false,
      code: "SERVER_ERROR",
      message: parsed.error.issues.map((i) => i.message).join("; "),
    };
  }
  const { moduleId } = parsed.data;

  // 5. Load module + journey + beats
  const trainingModule = await prisma.trainingModule.findUnique({
    where: { id: moduleId },
    include: {
      interactiveJourney: {
        include: {
          beats: { where: { removedAt: null }, orderBy: { sortOrder: "asc" } },
        },
      },
    },
  });

  if (!trainingModule) {
    return { ok: false, code: "MODULE_NOT_FOUND", message: "Training module not found." };
  }

  const journey = trainingModule.interactiveJourney;
  if (!journey) {
    return { ok: false, code: "MODULE_NOT_FOUND", message: "Interactive journey not found." };
  }

  // 6. Load all attempts for this user in this journey
  const allAttempts = await prisma.interactiveBeatAttempt.findMany({
    where: { userId, beat: { journeyId: journey.id } },
    orderBy: [{ beatId: "asc" }, { attemptNumber: "desc" }],
  });

  // Build latest-per-beat map
  const latestByBeatId = new Map<string, typeof allAttempts[number]>();
  for (const a of allAttempts) {
    if (!latestByBeatId.has(a.beatId)) {
      latestByBeatId.set(a.beatId, a);
    }
  }

  // 7. Validate readiness
  const scoredBeats = journey.beats.filter((b) => b.scoringWeight > 0);

  for (const beat of scoredBeats) {
    const latest = latestByBeatId.get(beat.id);
    if (journey.strictMode) {
      // Strict mode: any attempt is sufficient
      if (!latest) {
        return {
          ok: false,
          code: "JOURNEY_NOT_READY",
          message: "Please attempt all activities before completing the journey.",
        };
      }
    } else {
      // Non-strict (M1): correct attempt required on every scored beat
      if (!latest || !latest.correct) {
        return {
          ok: false,
          code: "JOURNEY_NOT_READY",
          message:
            "Please answer all activities correctly before completing the journey.",
        };
      }
    }
  }

  // 8. Compute completion metrics
  const totalScore = scoredBeats.reduce((sum, beat) => {
    const latest = latestByBeatId.get(beat.id);
    return sum + (latest?.score ?? 0);
  }, 0);

  const maxScore = scoredBeats.reduce((sum, beat) => sum + beat.scoringWeight, 0);
  const scorePct = maxScore > 0 ? Math.round((totalScore / maxScore) * 100) : 0;
  const passed = scorePct >= journey.passScorePct;

  // First-try correct: look for attempts where attemptNumber === 1 and correct === true
  const firstAttemptByBeatId = new Map<string, typeof allAttempts[number]>();
  for (const a of allAttempts) {
    if (a.attemptNumber === 1) {
      firstAttemptByBeatId.set(a.beatId, a);
    }
  }
  const firstTryCorrectCount = scoredBeats.filter((beat) => {
    const firstAttempt = firstAttemptByBeatId.get(beat.id);
    return firstAttempt?.correct === true;
  }).length;

  // XP: score + bonus score for first-try correct (2× on first-try correct)
  const xpEarned = scoredBeats.reduce((sum, beat) => {
    const latest = latestByBeatId.get(beat.id);
    if (!latest) return sum;
    const beatScore = latest.score;
    const firstAttempt = firstAttemptByBeatId.get(beat.id);
    const bonus = firstAttempt?.correct ? beatScore : 0;
    return sum + beatScore + bonus;
  }, 0);

  // visitedBeatCount: beats with at least one attempt
  const visitedBeatCount = journey.beats.filter((beat) =>
    latestByBeatId.has(beat.id)
  ).length;

  // 9. Persist in a transaction
  const now = new Date();
  try {
    await prisma.$transaction(async (tx) => {
      // Upsert completion row
      await tx.interactiveJourneyCompletion.upsert({
        where: { journeyId_userId: { journeyId: journey.id, userId } },
        create: {
          journeyId: journey.id,
          userId,
          totalScore,
          maxScore,
          scorePct,
          passed,
          firstTryCorrectCount,
          xpEarned,
          visitedBeatCount,
          moduleBreakdown: Prisma.JsonNull,
          personalizedTips: Prisma.JsonNull,
          completedAt: now,
        },
        update: {
          totalScore,
          maxScore,
          scorePct,
          passed,
          firstTryCorrectCount,
          xpEarned,
          visitedBeatCount,
          moduleBreakdown: Prisma.JsonNull,
          personalizedTips: Prisma.JsonNull,
          completedAt: now,
        },
      });

      // If passed, mark assignment complete
      if (passed) {
        await tx.trainingAssignment.upsert({
          where: { userId_moduleId: { userId, moduleId } },
          create: {
            userId,
            moduleId,
            status: "COMPLETE",
            completedAt: now,
          },
          update: {
            status: "COMPLETE",
            completedAt: now,
          },
        });
      }
    });
  } catch (err) {
    logger.error({ err, userId, moduleId }, "Failed to persist journey completion");
    return { ok: false, code: "SERVER_ERROR", message: "A server error occurred." };
  }

  // 10. Revalidate paths
  revalidatePath("/instructor-training");
  revalidatePath(`/training/${moduleId}`);

  // 11. Fetch next module
  const nextModule = await prisma.trainingModule.findFirst({
    where: { sortOrder: { gt: trainingModule.sortOrder } },
    orderBy: { sortOrder: "asc" },
    select: { id: true, title: true },
  });

  // 12. Log
  logger.info({ userId, moduleId, scorePct, passed, xpEarned });

  // 13. Build completion summary
  const badgeKey = getBadgeForContentKey(trainingModule.contentKey ?? null);

  const completionSummary: JourneyCompletionSummary = {
    totalScore,
    maxScore,
    scorePct,
    passed,
    firstTryCorrectCount,
    xpEarned,
    visitedBeatCount,
    moduleBreakdown: null,
    personalizedTips: null,
    completedAt: now.toISOString(),
    badgeKey,
  };

  return {
    ok: true,
    completion: completionSummary,
    nextModule: nextModule ?? null,
  };
}

// ---------------------------------------------------------------------------
// resumeInteractiveJourney
// ---------------------------------------------------------------------------

export async function resumeInteractiveJourney(
  rawInput: ResumeJourneyInput
): Promise<ResumeJourneyResult> {
  // 1. Feature flag
  if (!isInteractiveJourneyEnabled()) {
    return {
      ok: false,
      code: "FEATURE_DISABLED",
      message: "Interactive journeys are not enabled.",
    };
  }

  // 2. Auth
  const auth = await authorize();
  if (!auth.ok) return auth;
  const { userId } = auth;

  // 3. Zod parse
  const parsed = ResumeJourneyInputSchema.safeParse(rawInput);
  if (!parsed.success) {
    return {
      ok: false,
      code: "SERVER_ERROR",
      message: parsed.error.issues.map((i) => i.message).join("; "),
    };
  }
  const { moduleId } = parsed.data;

  // 4. Load module + journey + beats
  const trainingModule = await prisma.trainingModule.findUnique({
    where: { id: moduleId },
    include: {
      interactiveJourney: {
        include: {
          beats: { where: { removedAt: null }, orderBy: { sortOrder: "asc" } },
        },
      },
    },
  });

  if (!trainingModule?.interactiveJourney) {
    return { ok: false, code: "MODULE_NOT_FOUND", message: "Interactive journey not found." };
  }

  const journey = trainingModule.interactiveJourney;

  // 5. Load attempts
  const allAttempts = await prisma.interactiveBeatAttempt.findMany({
    where: { userId, beat: { journeyId: journey.id } },
    orderBy: [{ beatId: "asc" }, { attemptNumber: "desc" }],
  });

  // Latest-per-beat map
  const latestByBeatId = new Map<string, typeof allAttempts[number]>();
  for (const a of allAttempts) {
    if (!latestByBeatId.has(a.beatId)) {
      latestByBeatId.set(a.beatId, a);
    }
  }

  // Build sourceKey → beatId map for attempt summaries
  const beatById = new Map(journey.beats.map((b) => [b.id, b]));

  // 6. Compute resumeBeatSourceKey: first scored beat without a correct latest attempt
  let resumeBeatSourceKey: string | null = null;
  for (const beat of journey.beats) {
    if (beat.scoringWeight === 0) continue;
    const latest = latestByBeatId.get(beat.id);
    if (!latest || !latest.correct) {
      resumeBeatSourceKey = beat.sourceKey;
      break;
    }
  }

  // 7. Build JourneyAttemptSummary[]
  const userAttempts: JourneyAttemptSummary[] = [];
  for (const [beatId, attempt] of latestByBeatId.entries()) {
    const beat = beatById.get(beatId);
    if (!beat) continue;
    userAttempts.push({
      beatSourceKey: beat.sourceKey,
      attemptNumber: attempt.attemptNumber,
      correct: attempt.correct,
      score: attempt.score,
    });
  }

  return {
    ok: true,
    resumeBeatSourceKey,
    userAttempts,
  };
}

/**
 * Nightly job that opens new reflection cycles and keeps denormalized
 * `Mentorship.cycleStage` in sync (Phase 0.99999).
 *
 * Replaces the Phase 0.9 lazy page-load trigger for REFLECTION_WINDOW_OPENED.
 * Safe to re-run idempotently — notification dedup in
 * `lib/mentorship-notifications.ts` prevents double-firing.
 *
 * Behaviour per active mentorship:
 *   1. Recompute cycleStage; write back on drift.
 *   2. If mentorship is eligible to reflect this cycle (kickoff done,
 *      governance requires reflections, no reflection yet), and it's the
 *      first 2 days of the calendar month, fire REFLECTION_WINDOW_OPENED.
 *
 * Skips:
 *   - Paused or complete mentorships
 *   - Kickoff-incomplete mentorships
 *   - Mentorships whose governance does not require monthly reflections
 */
import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import {
  computeCycleStage,
  recomputeMentorshipCycleStage,
  getCurrentCycleMonth,
} from "@/lib/mentorship-cycle";
import { mentorshipRequiresMonthlyReflection } from "@/lib/mentorship-canonical";
import { emitReflectionWindowOpened } from "@/lib/mentorship-notifications";

export type RolloverResult = {
  ranAt: string;
  scanned: number;
  cycleStageCorrections: number;
  notificationsFired: number;
  skippedPaused: number;
  skippedNoReflectionRequired: number;
  skippedKickoffIncomplete: number;
  skippedReflectionAlreadySubmitted: number;
  errors: number;
};

const NOTIFY_WINDOW_DAYS = 2;

function isSameUtcMonth(a: Date, b: Date): boolean {
  return a.getUTCFullYear() === b.getUTCFullYear() && a.getUTCMonth() === b.getUTCMonth();
}

export async function runMentorshipCycleRollover(
  opts: { dryRun?: boolean } = {}
): Promise<RolloverResult> {
  const dryRun = !!opts.dryRun;
  const ranAt = new Date();
  const { cycleMonth } = getCurrentCycleMonth(ranAt);

  const dayOfMonth = ranAt.getUTCDate();
  const withinOpenWindow = dayOfMonth <= NOTIFY_WINDOW_DAYS;

  const result: RolloverResult = {
    ranAt: ranAt.toISOString(),
    scanned: 0,
    cycleStageCorrections: 0,
    notificationsFired: 0,
    skippedPaused: 0,
    skippedNoReflectionRequired: 0,
    skippedKickoffIncomplete: 0,
    skippedReflectionAlreadySubmitted: 0,
    errors: 0,
  };

  const mentorships = await prisma.mentorship.findMany({
    where: { status: { in: ["ACTIVE", "PAUSED"] } },
    select: {
      id: true,
      status: true,
      cycleStage: true,
      kickoffCompletedAt: true,
      programGroup: true,
      governanceMode: true,
      menteeId: true,
      mentorId: true,
      selfReflections: {
        orderBy: { cycleNumber: "desc" },
        take: 1,
        select: { id: true, cycleNumber: true, submittedAt: true, cycleMonth: true },
      },
      goalReviews: {
        orderBy: { cycleNumber: "desc" },
        take: 1,
        select: {
          id: true,
          cycleNumber: true,
          status: true,
          releasedToMenteeAt: true,
          cycleMonth: true,
        },
      },
    },
  });

  result.scanned = mentorships.length;

  for (const m of mentorships) {
    try {
      // 1. cycleStage drift correction
      const computed = computeCycleStage({
        mentorship: { status: m.status, kickoffCompletedAt: m.kickoffCompletedAt },
        latestReflection: m.selfReflections[0] ?? null,
        latestReview: m.goalReviews[0] ?? null,
        currentCycleMonth: cycleMonth,
      });
      if (computed !== m.cycleStage) {
        logger.info(
          {
            mentorshipId: m.id,
            from: m.cycleStage,
            to: computed,
            dryRun,
          },
          "[cycle-rollover] cycleStage drift corrected"
        );
        result.cycleStageCorrections += 1;
        if (!dryRun) {
          await recomputeMentorshipCycleStage(m.id);
        }
      }

      // 2. Reflection-window open notification
      if (m.status === "PAUSED") {
        result.skippedPaused += 1;
        continue;
      }
      if (!m.kickoffCompletedAt) {
        result.skippedKickoffIncomplete += 1;
        continue;
      }
      const requiresReflection = mentorshipRequiresMonthlyReflection({
        programGroup: m.programGroup,
        governanceMode: m.governanceMode,
      });
      if (!requiresReflection) {
        result.skippedNoReflectionRequired += 1;
        continue;
      }

      const latestReflection = m.selfReflections[0] ?? null;
      const alreadySubmitted =
        latestReflection !== null && isSameUtcMonth(latestReflection.cycleMonth, cycleMonth);
      if (alreadySubmitted) {
        result.skippedReflectionAlreadySubmitted += 1;
        continue;
      }

      if (!withinOpenWindow) continue;

      // cycleNumber is sequential per mentorship, so we derive the next one from
      // the mentee's own latest submitted reflection rather than from the month helper.
      const cycleNumber = (latestReflection?.cycleNumber ?? 0) + 1;

      logger.info(
        { mentorshipId: m.id, menteeId: m.menteeId, cycleNumber, dryRun },
        "[cycle-rollover] firing REFLECTION_WINDOW_OPENED"
      );
      result.notificationsFired += 1;
      if (!dryRun) {
        await emitReflectionWindowOpened({
          menteeId: m.menteeId,
          ctx: { cycleNumber, cycleMonth },
        });
      }
    } catch (err) {
      result.errors += 1;
      logger.warn(
        { err, mentorshipId: m.id },
        "[cycle-rollover] mentorship scan failed"
      );
    }
  }

  logger.info({ ...result, dryRun }, "[cycle-rollover] complete");
  return result;
}

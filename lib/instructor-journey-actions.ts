"use server";

import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth-supabase";
import { awardXp, XP_REWARDS } from "@/lib/xp";
import { LAUNCHPAD_STEP_COUNT, type JourneyStepKey } from "@/lib/instructor-journey";

function clampStep(step: number) {
  return Math.max(0, Math.min(step, LAUNCHPAD_STEP_COUNT - 1));
}

/** Narrow timestamp patch for a single launchpad step (one field only). */
type StepStamp =
  | { welcomeCompletedAt: Date }
  | { profileCompletedAt: Date }
  | { trainingCompletedAt: Date }
  | { communityCompletedAt: Date }
  | { tourCompletedAt: Date };

function stampFor(key: JourneyStepKey, at: Date): StepStamp {
  switch (key) {
    case "welcome":
      return { welcomeCompletedAt: at };
    case "profile":
      return { profileCompletedAt: at };
    case "training":
      return { trainingCompletedAt: at };
    case "community":
      return { communityCompletedAt: at };
    case "tour":
      return { tourCompletedAt: at };
  }
}

function isStamped(
  row: {
    welcomeCompletedAt: Date | null;
    profileCompletedAt: Date | null;
    trainingCompletedAt: Date | null;
    communityCompletedAt: Date | null;
    tourCompletedAt: Date | null;
  } | null,
  key: JourneyStepKey,
): boolean {
  if (!row) return false;
  switch (key) {
    case "welcome":
      return Boolean(row.welcomeCompletedAt);
    case "profile":
      return Boolean(row.profileCompletedAt);
    case "training":
      return Boolean(row.trainingCompletedAt);
    case "community":
      return Boolean(row.communityCompletedAt);
    case "tour":
      return Boolean(row.tourCompletedAt);
  }
}

/** Persist the current launchpad step so progress survives a refresh. */
export async function saveJourneyStep(step: number) {
  const session = await getSession();
  if (!session?.user?.id) return { error: "Not authenticated" };

  const clamped = clampStep(step);
  try {
    await prisma.instructorJourney.upsert({
      where: { userId: session.user.id },
      create: { userId: session.user.id, currentStep: clamped },
      update: { currentStep: clamped },
    });
  } catch {
    // Table may not exist yet — continue silently.
  }

  return { success: true };
}

/**
 * Mark a launchpad step complete (idempotent) and optionally advance the
 * current step. When all five steps are complete, stamp `completedAt` once and
 * award onboarding XP a single time.
 */
export async function completeJourneyStep(key: JourneyStepKey, nextStep?: number) {
  const session = await getSession();
  if (!session?.user?.id) return { error: "Not authenticated" };

  const userId = session.user.id;
  const now = new Date();
  const stamp = stampFor(key, now);
  const stepPatch =
    nextStep !== undefined ? { currentStep: clampStep(nextStep) } : {};

  try {
    const existing = await prisma.instructorJourney.findUnique({
      where: { userId },
      select: {
        welcomeCompletedAt: true,
        profileCompletedAt: true,
        trainingCompletedAt: true,
        communityCompletedAt: true,
        tourCompletedAt: true,
        completedAt: true,
      },
    });

    const row = await prisma.instructorJourney.upsert({
      where: { userId },
      create: {
        userId,
        currentStep: nextStep !== undefined ? clampStep(nextStep) : 0,
        ...stamp,
      },
      // Only stamp the first time a step is cleared.
      update: {
        ...(isStamped(existing, key) ? {} : stamp),
        ...stepPatch,
      },
    });

    const allDone =
      row.welcomeCompletedAt &&
      row.profileCompletedAt &&
      row.trainingCompletedAt &&
      row.communityCompletedAt &&
      row.tourCompletedAt;

    if (allDone && !row.completedAt) {
      await prisma.instructorJourney.update({
        where: { userId },
        data: { completedAt: now },
      });
      try {
        await awardXp(userId, XP_REWARDS.COMPLETE_ONBOARDING, "Completed instructor onboarding");
      } catch {
        // XP columns may not exist yet.
      }
    }
  } catch {
    // Table may not exist yet — continue silently.
  }

  return { success: true };
}

/**
 * Finish the entire launchpad in one shot (used by the final "Finish" CTA).
 * Backfills any unstamped step timestamps without overwriting earlier ones,
 * and awards onboarding XP a single time.
 */
export async function completeInstructorJourney() {
  const session = await getSession();
  if (!session?.user?.id) return { error: "Not authenticated" };

  const userId = session.user.id;
  const now = new Date();
  try {
    const existing = await prisma.instructorJourney.findUnique({
      where: { userId },
    });

    const alreadyComplete = Boolean(existing?.completedAt);

    await prisma.instructorJourney.upsert({
      where: { userId },
      create: {
        userId,
        currentStep: LAUNCHPAD_STEP_COUNT - 1,
        welcomeCompletedAt: now,
        profileCompletedAt: now,
        trainingCompletedAt: now,
        communityCompletedAt: now,
        tourCompletedAt: now,
        completedAt: now,
      },
      update: {
        welcomeCompletedAt: existing?.welcomeCompletedAt ?? now,
        profileCompletedAt: existing?.profileCompletedAt ?? now,
        trainingCompletedAt: existing?.trainingCompletedAt ?? now,
        communityCompletedAt: existing?.communityCompletedAt ?? now,
        tourCompletedAt: existing?.tourCompletedAt ?? now,
        completedAt: existing?.completedAt ?? now,
      },
    });

    if (!alreadyComplete) {
      try {
        await awardXp(userId, XP_REWARDS.COMPLETE_ONBOARDING, "Completed instructor onboarding");
      } catch {
        // XP columns may not exist yet.
      }
    }
  } catch {
    // Table may not exist yet — continue silently.
  }

  return { success: true };
}

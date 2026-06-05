import { prisma } from "@/lib/prisma";

/**
 * Instructor Launchpad — single source of truth for the instructor onboarding
 * journey. The launchpad has exactly five steps; the onboarding percentage is
 * derived from how many of them the instructor has completed. Training's
 * authoritative module-by-module percent still comes from the readiness/training
 * models — `trainingComplete` here only reflects clearing the launchpad's
 * training step.
 */

export const LAUNCHPAD_STEP_COUNT = 5;

export type JourneyStepKey =
  | "welcome"
  | "profile"
  | "training"
  | "community"
  | "tour";

export const JOURNEY_STEP_ORDER: JourneyStepKey[] = [
  "welcome",
  "profile",
  "training",
  "community",
  "tour",
];

export interface InstructorJourneyState {
  currentStep: number;
  welcomeComplete: boolean;
  profileComplete: boolean;
  trainingComplete: boolean;
  communityComplete: boolean;
  tourComplete: boolean;
  completedAt: Date | null;
  /** 0–100, derived from the five launchpad steps. */
  onboardingPercent: number;
}

export const EMPTY_JOURNEY: InstructorJourneyState = {
  currentStep: 0,
  welcomeComplete: false,
  profileComplete: false,
  trainingComplete: false,
  communityComplete: false,
  tourComplete: false,
  completedAt: null,
  onboardingPercent: 0,
};

type JourneyRow = {
  currentStep: number;
  welcomeCompletedAt: Date | null;
  profileCompletedAt: Date | null;
  trainingCompletedAt: Date | null;
  communityCompletedAt: Date | null;
  tourCompletedAt: Date | null;
  completedAt: Date | null;
};

export function toJourneyState(row: JourneyRow): InstructorJourneyState {
  const welcomeComplete = Boolean(row.welcomeCompletedAt);
  const profileComplete = Boolean(row.profileCompletedAt);
  const trainingComplete = Boolean(row.trainingCompletedAt);
  const communityComplete = Boolean(row.communityCompletedAt);
  const tourComplete = Boolean(row.tourCompletedAt);
  const completedCount = [
    welcomeComplete,
    profileComplete,
    trainingComplete,
    communityComplete,
    tourComplete,
  ].filter(Boolean).length;

  return {
    currentStep: Math.max(0, Math.min(row.currentStep, LAUNCHPAD_STEP_COUNT - 1)),
    welcomeComplete,
    profileComplete,
    trainingComplete,
    communityComplete,
    tourComplete,
    completedAt: row.completedAt,
    onboardingPercent: Math.round((completedCount / LAUNCHPAD_STEP_COUNT) * 100),
  };
}

/**
 * Read the unified instructor-journey state. Falls back gracefully to an empty
 * journey when the table is missing (pre-migration environments) so callers
 * never throw P2021.
 */
export async function getInstructorJourney(
  userId: string,
): Promise<InstructorJourneyState> {
  try {
    const row = await prisma.instructorJourney.findUnique({
      where: { userId },
      select: {
        currentStep: true,
        welcomeCompletedAt: true,
        profileCompletedAt: true,
        trainingCompletedAt: true,
        communityCompletedAt: true,
        tourCompletedAt: true,
        completedAt: true,
      },
    });
    if (!row) return EMPTY_JOURNEY;
    return toJourneyState(row);
  } catch {
    return EMPTY_JOURNEY;
  }
}

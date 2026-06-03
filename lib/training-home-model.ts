import { prisma } from "@/lib/prisma";
import {
  buildFallbackInstructorReadiness,
  getInstructorReadiness,
} from "@/lib/instructor-readiness";
import { withPrismaFallback } from "@/lib/prisma-guard";
import {
  LESSON_DESIGN_STUDIO_MODULE_KEY,
  READINESS_CHECK_MODULE_KEY,
  TRACKABLE_REQUIRED_VIDEO_PROVIDERS,
} from "@/lib/training-constants";
import {
  buildTrainingPhases,
  type PhaseModuleCard,
  type TrainingHomeModel,
} from "@/lib/training-phases";

export const TRAINING_READINESS_HREF = "/instructor-training/readiness";

export interface TrainingHomeData {
  model: TrainingHomeModel;
  isSummerWorkshop: boolean;
  wasPromotedFromSummerWorkshop: boolean;
  readinessCheckPassed: boolean;
  readinessCheckModuleId: string | null;
}

/**
 * Builds the full training mission-control view model for an instructor.
 * Shared by the standalone training page and the onboarding launchpad's
 * Training step, so the two read as one system. Server-only.
 */
export async function getTrainingHomeModel(instructorId: string): Promise<TrainingHomeData> {
  const instructorSubtype = await withPrismaFallback(
    "training-home:subtype",
    async () => {
      const app = await prisma.instructorApplication.findFirst({
        where: { applicantId: instructorId },
        orderBy: { createdAt: "desc" },
        select: { instructorSubtype: true },
      });
      return app?.instructorSubtype ?? "STANDARD";
    },
    "STANDARD" as const,
  );
  const isSummerWorkshop = instructorSubtype === "SUMMER_WORKSHOP";

  const previousWorkshopSubmission = !isSummerWorkshop
    ? await withPrismaFallback(
        "training-home:promoted-from-sw",
        () =>
          prisma.workshopProposalSubmission.findUnique({
            where: { authorId: instructorId },
            select: { id: true },
          }),
        null,
      )
    : null;
  const wasPromotedFromSummerWorkshop = previousWorkshopSubmission !== null;

  const [modules, assignments, videoProgress, quizAttempts, journeyCompletions, journeyBeatAttempts, readiness] =
    await Promise.all([
      withPrismaFallback(
        "training-home:modules",
        () =>
          prisma.trainingModule.findMany({
            where: { archivedAt: null },
            orderBy: { sortOrder: "asc" },
            include: {
              quizQuestions: { select: { id: true } },
              interactiveJourney: {
                select: {
                  id: true,
                  estimatedMinutes: true,
                  beats: { where: { removedAt: null, scoringWeight: { gt: 0 } }, select: { id: true } },
                },
              },
            },
          }),
        [],
      ),
      withPrismaFallback(
        "training-home:assignments",
        () => prisma.trainingAssignment.findMany({ where: { userId: instructorId } }),
        [],
      ),
      withPrismaFallback(
        "training-home:video-progress",
        () =>
          prisma.videoProgress.findMany({
            where: { userId: instructorId },
            select: { moduleId: true, watchedSeconds: true, completed: true },
          }),
        [],
      ),
      withPrismaFallback(
        "training-home:quiz-attempts",
        () =>
          prisma.trainingQuizAttempt.findMany({
            where: { userId: instructorId },
            orderBy: { attemptedAt: "desc" },
            select: { moduleId: true, passed: true, scorePct: true, attemptedAt: true },
          }),
        [],
      ),
      withPrismaFallback(
        "training-home:journey-completions",
        () =>
          prisma.interactiveJourneyCompletion.findMany({
            where: { userId: instructorId },
            select: { journeyId: true, scorePct: true, passed: true, firstTryCorrectCount: true, visitedBeatCount: true },
          }),
        [],
      ),
      withPrismaFallback(
        "training-home:journey-beat-attempts",
        () =>
          prisma.interactiveBeatAttempt.findMany({
            where: { userId: instructorId },
            select: {
              beatId: true,
              correct: true,
              attemptNumber: true,
              beat: { select: { journeyId: true, scoringWeight: true } },
            },
          }),
        [],
      ),
      withPrismaFallback(
        "training-home:readiness",
        () => getInstructorReadiness(instructorId),
        buildFallbackInstructorReadiness(instructorId),
      ),
    ]);

  const videoByModule = new Map(videoProgress.map((p) => [p.moduleId, p]));
  const assignmentByModule = new Map(assignments.map((a) => [a.moduleId, a]));
  const latestQuizByModule = new Map<string, (typeof quizAttempts)[number]>();
  const passedQuizModuleIds = new Set<string>();
  for (const attempt of quizAttempts) {
    if (!latestQuizByModule.has(attempt.moduleId)) latestQuizByModule.set(attempt.moduleId, attempt);
    if (attempt.passed) passedQuizModuleIds.add(attempt.moduleId);
  }
  const journeyCompletionByJourneyId = new Map(journeyCompletions.map((c) => [c.journeyId, c]));
  const correctBeatsByJourneyId = new Map<string, Set<string>>();
  for (const attempt of journeyBeatAttempts) {
    if (!attempt.correct || attempt.beat.scoringWeight <= 0) continue;
    const journeyId = attempt.beat.journeyId;
    let beatSet = correctBeatsByJourneyId.get(journeyId);
    if (!beatSet) {
      beatSet = new Set<string>();
      correctBeatsByJourneyId.set(journeyId, beatSet);
    }
    beatSet.add(attempt.beatId);
  }

  const visibleModules = isSummerWorkshop
    ? modules.filter((m) => m.contentKey !== LESSON_DESIGN_STUDIO_MODULE_KEY)
    : modules;

  const moduleCards: PhaseModuleCard[] = visibleModules.map((module) => {
    const progress = videoByModule.get(module.id);
    const journey = module.interactiveJourney;
    const isInteractive = journey !== null;
    const totalScoredBeats = journey?.beats.length ?? 0;
    const correctBeats = journey ? (correctBeatsByJourneyId.get(journey.id)?.size ?? 0) : 0;
    const journeyCompletion = journey ? journeyCompletionByJourneyId.get(journey.id) : undefined;

    let configurationIssue: string | null = null;
    if (module.requiresQuiz && module.quizQuestions.length === 0) {
      configurationIssue = "Quiz is required but no quiz questions are configured for this module.";
    } else if (
      module.required &&
      !isInteractive &&
      !module.videoUrl &&
      !module.requiresQuiz &&
      !module.requiresEvidence
    ) {
      configurationIssue = "This required module has no actionable steps configured yet. Ask an admin to set it up.";
    } else if (
      module.required &&
      module.videoUrl &&
      module.videoProvider &&
      !TRACKABLE_REQUIRED_VIDEO_PROVIDERS.has(module.videoProvider)
    ) {
      configurationIssue = "Required module video provider must be YOUTUBE, VIMEO, or CUSTOM so watch tracking can count.";
    }

    const videoReady = !module.videoUrl || progress?.completed === true;
    const quizReady =
      !module.requiresQuiz || (module.quizQuestions.length > 0 && passedQuizModuleIds.has(module.id));
    const journeyReady = !isInteractive || journeyCompletion?.passed === true;
    const fullyComplete = !configurationIssue && videoReady && quizReady && journeyReady;

    let progressPct: number;
    if (fullyComplete) {
      progressPct = 100;
    } else if (isInteractive) {
      progressPct =
        totalScoredBeats > 0 ? Math.min(99, Math.round((correctBeats / totalScoredBeats) * 100)) : 0;
    } else {
      const videoDuration = module.videoDuration ?? null;
      progressPct =
        videoDuration && videoDuration > 0
          ? Math.min(99, Math.round(((progress?.watchedSeconds ?? 0) / videoDuration) * 100))
          : (progress?.watchedSeconds ?? 0) > 0
            ? 30
            : 0;
    }

    return {
      module,
      assignment: assignmentByModule.get(module.id),
      fullyComplete,
      progressPct,
      configurationIssue,
      estimatedMinutes: journey?.estimatedMinutes ?? module.estimatedMinutes ?? null,
      journeyProgress: {
        isInteractive,
        scorePct: journeyCompletion?.scorePct ?? null,
      },
    };
  });

  const ldsGate = readiness.lessonDesignStudioGate;
  const readinessCheckPassed = ldsGate.unlocked;
  const readinessCheckModuleId = ldsGate.unlocked
    ? moduleCards.find((c) => c.module.contentKey === READINESS_CHECK_MODULE_KEY)?.module.id ?? null
    : ldsGate.reason === "READINESS_CHECK_REQUIRED"
      ? ldsGate.readinessCheckModuleId
      : null;

  const moduleWeight = readiness.requiredModulesCount;
  const doneModuleWeight = readiness.academyModulesComplete
    ? moduleWeight
    : readiness.completedRequiredModules;
  const totalTrainingWeight = moduleWeight + 1;
  const doneTrainingWeight = doneModuleWeight + (readiness.studioCapstoneComplete ? 1 : 0);
  const trainingPct =
    totalTrainingWeight > 0 ? Math.round((doneTrainingWeight / totalTrainingWeight) * 100) : 0;

  const academyCards = moduleCards.filter(
    (c) => c.module.contentKey !== LESSON_DESIGN_STUDIO_MODULE_KEY,
  );
  const ldsCard =
    moduleCards.find((c) => c.module.contentKey === LESSON_DESIGN_STUDIO_MODULE_KEY) ?? null;

  const model = buildTrainingPhases({
    academyCards,
    ldsCard,
    readiness,
    readinessCheckPassed,
    readinessCheckModuleId,
    isSummerWorkshop,
    readinessHref: TRAINING_READINESS_HREF,
    trainingPct,
  });

  return {
    model,
    isSummerWorkshop,
    wasPromotedFromSummerWorkshop,
    readinessCheckPassed,
    readinessCheckModuleId,
  };
}

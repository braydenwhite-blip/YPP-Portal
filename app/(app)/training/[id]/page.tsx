import { notFound, redirect } from "next/navigation";
import { getSession } from "@/lib/auth-supabase";
import { prisma } from "@/lib/prisma";
import { withPrismaFallback } from "@/lib/prisma-guard";
import { getPreferredCurriculumDraftForStudioSurface } from "@/lib/curriculum-draft-actions";
import {
  getTrainingAccessRedirect,
  hasApprovedInstructorTrainingAccess,
} from "@/lib/training-access";
import { serializeBeatForClient } from "@/lib/training-journey/serialize";
import type { JourneyAttemptSummary } from "@/lib/training-journey/client-contracts";
import { getBadgeForContentKey } from "@/lib/training-journey/client-contracts";
import { JourneyShell } from "./journey-shell";
import TrainingModuleClient from "./client";

// ---------------------------------------------------------------------------
// Feature flag helper (default-on per plan §9)
// ---------------------------------------------------------------------------

function isInteractiveJourneyEnabled(): boolean {
  const v = process.env.ENABLE_INTERACTIVE_TRAINING_JOURNEY;
  return v !== "false" && v !== "0" && v !== "no";
}

export default async function TrainingModulePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const session = await getSession();
  if (!session?.user?.id) {
    redirect("/login");
  }

  const roles = session.user.roles ?? [];
  const hasInstructorTrainingAccess = hasApprovedInstructorTrainingAccess(roles);
  const canView = hasInstructorTrainingAccess || roles.includes("STUDENT");

  if (!canView) {
    redirect(getTrainingAccessRedirect(roles));
  }

  const learnerId = session.user.id;
  const isStudentOnly =
    roles.includes("STUDENT") &&
    !roles.includes("INSTRUCTOR") &&
    !roles.includes("ADMIN") &&
    !roles.includes("CHAPTER_PRESIDENT");

  // ---------------------------------------------------------------------------
  // INTERACTIVE_JOURNEY branch — runs before the legacy fetch to avoid loading
  // checkpoints / videos / quiz data that journey modules don't need.
  // ---------------------------------------------------------------------------

  // Lightweight probe: check module type without pulling the full include graph.
  const moduleTypePeek = await prisma.trainingModule.findUnique({
    where: { id },
    select: { type: true, contentKey: true },
  });

  if (moduleTypePeek?.type === "INTERACTIVE_JOURNEY") {
    // Determine back-link for this user (same as legacy path below).
    const academyHref = isStudentOnly ? "/student-training" : "/instructor-training";
    const academyLabel = isStudentOnly ? "Back to student academy" : "Back to academy";

    if (!isInteractiveJourneyEnabled()) {
      // Feature disabled: render minimal placeholder; do NOT fall through to
      // the video shell (journey modules have no video/quiz data).
      const moduleTitle = await prisma.trainingModule.findUnique({
        where: { id },
        select: { title: true },
      });
      return (
        <main style={{ maxWidth: 600, margin: "40px auto", padding: "0 16px" }}>
          <a href={academyHref} style={{ fontSize: 14, color: "var(--muted)", textDecoration: "none" }}>
            ← {academyLabel}
          </a>
          <h1 style={{ marginTop: 24 }}>{moduleTitle?.title ?? "Interactive Module"}</h1>
          <p style={{ color: "var(--muted)" }}>Coming soon.</p>
        </main>
      );
    }

    // Full journey fetch
    const journeyModule = await prisma.trainingModule.findUnique({
      where: { id },
      include: {
        interactiveJourney: {
          include: {
            beats: { where: { removedAt: null }, orderBy: { sortOrder: "asc" } },
          },
        },
      },
    });

    if (!journeyModule?.interactiveJourney) {
      notFound();
    }

    const journey = journeyModule.interactiveJourney;

    // Parallel: attempts + existing completion + next module
    const [attempts, completion, nextModule] = await Promise.all([
      prisma.interactiveBeatAttempt.findMany({
        where: { userId: learnerId, beat: { journeyId: journey.id } },
        orderBy: [{ beatId: "asc" }, { attemptNumber: "desc" }],
      }),
      prisma.interactiveJourneyCompletion.findUnique({
        where: { journeyId_userId: { journeyId: journey.id, userId: learnerId } },
      }),
      prisma.trainingModule.findFirst({
        where: { sortOrder: { gt: journeyModule.sortOrder } },
        orderBy: { sortOrder: "asc" },
        select: { id: true, title: true },
      }),
    ]);

    // Mark IN_PROGRESS on first view (non-fatal; fire-and-forget).
    // Use upsert: create the row if missing, otherwise leave status alone
    // (do not downgrade a COMPLETE assignment that may exist from a prior visit).
    if (!completion) {
      prisma.trainingAssignment
        .upsert({
          where: { userId_moduleId: { userId: learnerId, moduleId: id } },
          create: { userId: learnerId, moduleId: id, status: "IN_PROGRESS" },
          update: {},
        })
        .catch(() => {
          // Non-fatal — do not block the render
        });
    }

    // Build latest-per-beat map (sorted desc by attemptNumber so first hit = latest)
    const latestByBeatId = new Map<string, typeof attempts[number]>();
    for (const a of attempts) {
      if (!latestByBeatId.has(a.beatId)) {
        latestByBeatId.set(a.beatId, a);
      }
    }

    // Build beatId → beat lookup
    const beatById = new Map(journey.beats.map((b) => [b.id, b]));

    // JourneyAttemptSummary[] (latest attempt per beat)
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

    // Security boundary: strip answer keys from every beat before shipping to client
    const clientBeats = journey.beats.map((beat) => serializeBeatForClient(beat));

    // resumeBeatSourceKey: first scored beat without a correct latest attempt
    let resumeBeatSourceKey: string | null = null;
    for (const beat of journey.beats) {
      if (beat.scoringWeight === 0) continue;
      const latest = latestByBeatId.get(beat.id);
      if (!latest || !latest.correct) {
        resumeBeatSourceKey = beat.sourceKey;
        break;
      }
    }
    // If all beats correct AND journey completed → null (already done)
    if (completion && resumeBeatSourceKey === null) {
      resumeBeatSourceKey = null;
    }

    // Build JourneyCompletionSummary if a completion row exists
    const completionSummary = completion
      ? {
          totalScore: completion.totalScore,
          maxScore: completion.maxScore,
          scorePct: completion.scorePct,
          passed: completion.passed,
          firstTryCorrectCount: completion.firstTryCorrectCount,
          xpEarned: completion.xpEarned,
          visitedBeatCount: completion.visitedBeatCount,
          moduleBreakdown:
            (completion.moduleBreakdown as Record<string, number> | null) ?? null,
          personalizedTips:
            (completion.personalizedTips as { module: string; tip: string }[] | null) ??
            null,
          completedAt: completion.completedAt.toISOString(),
          badgeKey: getBadgeForContentKey(journeyModule.contentKey ?? null),
        }
      : null;

    return (
      <JourneyShell
        snapshot={{
          moduleId: journeyModule.id,
          contentKey: journeyModule.contentKey ?? null,
          title: journeyModule.title,
          description: journeyModule.description,
          estimatedMinutes: journey.estimatedMinutes,
          passScorePct: journey.passScorePct,
          strictMode: journey.strictMode,
          version: journey.version,
          beats: clientBeats,
          userAttempts,
          resumeBeatSourceKey,
          completion: completionSummary,
        }}
        backHref={academyHref}
        backLabel={academyLabel}
        nextModule={nextModule ?? null}
      />
    );
  }

  // ---------------------------------------------------------------------------
  // END INTERACTIVE_JOURNEY branch
  // Legacy path continues unchanged below.
  // ---------------------------------------------------------------------------

  const trainingModule = await withPrismaFallback(
    "training-module:module",
    () =>
      prisma.trainingModule.findUnique({
        where: { id },
        include: {
          checkpoints: {
            orderBy: { sortOrder: "asc" },
          },
          quizQuestions: {
            orderBy: { sortOrder: "asc" },
          },
          videos: {
            orderBy: { sortOrder: "asc" },
            include: {
              segments: {
                orderBy: { sortOrder: "asc" },
              },
            },
          },
          resources: {
            orderBy: { sortOrder: "asc" },
          },
        },
      }),
    null
  );

  if (!trainingModule) {
    notFound();
  }

  const canAccessLessonDesignStudio =
    hasInstructorTrainingAccess;

  const lessonDesignStudioDraft =
    trainingModule.type === "CURRICULUM_REVIEW" && canAccessLessonDesignStudio
      ? await getPreferredCurriculumDraftForStudioSurface()
      : null;

  const [assignment, videoProgress, quizAttempts, evidenceSubmissions, nextModule] =
    await Promise.all([
      withPrismaFallback(
        "training-module:assignment",
        () =>
          prisma.trainingAssignment.findUnique({
            where: {
              userId_moduleId: {
                userId: learnerId,
                moduleId: trainingModule.id,
              },
            },
          }),
        null
      ),
      withPrismaFallback(
        "training-module:video-progress",
        () =>
          prisma.videoProgress.findUnique({
            where: {
              userId_moduleId: {
                userId: learnerId,
                moduleId: trainingModule.id,
              },
            },
          }),
        null
      ),
      withPrismaFallback(
        "training-module:quiz-attempts",
        () =>
          prisma.trainingQuizAttempt.findMany({
            where: {
              userId: learnerId,
              moduleId: trainingModule.id,
            },
            orderBy: { attemptedAt: "desc" },
            take: 5,
          }),
        []
      ),
      withPrismaFallback(
        "training-module:evidence-submissions",
        () =>
          prisma.trainingEvidenceSubmission.findMany({
            where: {
              userId: learnerId,
              moduleId: trainingModule.id,
            },
            orderBy: { createdAt: "desc" },
            take: 5,
          }),
        []
      ),
      withPrismaFallback(
        "training-module:next-module",
        () =>
          prisma.trainingModule.findFirst({
            where: {
              sortOrder: { gt: trainingModule.sortOrder },
            },
            orderBy: { sortOrder: "asc" },
            select: {
              id: true,
              title: true,
            },
          }),
        null
      ),
    ]);

  if (isStudentOnly && !assignment) {
    redirect("/student-training");
  }

  let effectiveNextModule = nextModule;
  if (isStudentOnly) {
    const nextAssigned = await withPrismaFallback(
      "training-module:next-assigned-module",
      () =>
        prisma.trainingAssignment.findFirst({
          where: {
            userId: learnerId,
            module: {
              sortOrder: { gt: trainingModule.sortOrder },
            },
          },
          orderBy: {
            module: {
              sortOrder: "asc",
            },
          },
          select: {
            module: {
              select: {
                id: true,
                title: true,
              },
            },
          },
        }),
      null
    );

    effectiveNextModule = nextAssigned?.module ?? null;
  }

  const academyHref = isStudentOnly ? "/student-training" : "/instructor-training";
  const academyLabel = isStudentOnly ? "Back to student academy" : "Back to academy";

  const normalizedQuizQuestions = trainingModule.quizQuestions.map((question) => {
    let options: string[] = [];

    if (Array.isArray(question.options)) {
      options = question.options.map((option) => String(option));
    } else if (question.options && typeof question.options === "object") {
      options = Object.values(question.options as Record<string, unknown>).map((option) =>
        String(option)
      );
    }

    return {
      id: question.id,
      question: question.question,
      correctAnswer: question.correctAnswer,
      explanation: question.explanation,
      sortOrder: question.sortOrder,
      options,
    };
  });

  return (
    <TrainingModuleClient
      module={{
        id: trainingModule.id,
        title: trainingModule.title,
        description: trainingModule.description,
        type: trainingModule.type,
        required: trainingModule.required,
        videoUrl: trainingModule.videoUrl,
        videoProvider: trainingModule.videoProvider,
        videoDuration: trainingModule.videoDuration,
        videoThumbnail: trainingModule.videoThumbnail,
        requiresQuiz: trainingModule.requiresQuiz,
        requiresEvidence: trainingModule.requiresEvidence,
        passScorePct: trainingModule.passScorePct,
        checkpoints: trainingModule.checkpoints.map((checkpoint) => ({
          id: checkpoint.id,
          title: checkpoint.title,
          description: checkpoint.description,
          sortOrder: checkpoint.sortOrder,
        })),
        quizQuestions: normalizedQuizQuestions,
        videos: trainingModule.videos.map((video) => ({
          id: video.id,
          title: video.title,
          description: video.description,
          videoUrl: video.videoUrl,
          videoProvider: video.videoProvider,
          videoDuration: video.videoDuration,
          sortOrder: video.sortOrder,
          isSupplementary: video.isSupplementary,
          segments: video.segments.map((segment) => ({
            id: segment.id,
            title: segment.title,
            startTime: segment.startTime,
            endTime: segment.endTime,
            sortOrder: segment.sortOrder,
          })),
        })),
        resources: trainingModule.resources.map((resource) => ({
          id: resource.id,
          title: resource.title,
          description: resource.description,
          resourceUrl: resource.resourceUrl,
          resourceType: resource.resourceType,
          sortOrder: resource.sortOrder,
          downloads: resource.downloads,
        })),
        estimatedMinutes: trainingModule.estimatedMinutes,
      }}
      assignment={
        assignment
          ? {
              status: assignment.status,
              completedAt: assignment.completedAt?.toISOString() ?? null,
            }
          : null
      }
      videoProgress={
        videoProgress
          ? {
              watchedSeconds: videoProgress.watchedSeconds,
              lastPosition: videoProgress.lastPosition,
              completed: videoProgress.completed,
            }
          : null
      }
      quizAttempts={quizAttempts.map((attempt) => ({
        id: attempt.id,
        scorePct: attempt.scorePct,
        passed: attempt.passed,
        attemptedAt: attempt.attemptedAt.toISOString(),
      }))}
      evidenceSubmissions={evidenceSubmissions.map((submission) => ({
        id: submission.id,
        status: submission.status,
        fileUrl: submission.fileUrl,
        notes: submission.notes,
        reviewNotes: submission.reviewNotes,
        createdAt: submission.createdAt.toISOString(),
      }))}
      nextModule={effectiveNextModule}
      academyHref={academyHref}
      academyLabel={academyLabel}
      lessonDesignStudio={
        lessonDesignStudioDraft
          ? {
              userId: session.user.id,
              userName: session.user.name ?? "Instructor Applicant",
              draft: {
                id: lessonDesignStudioDraft.id,
                title: lessonDesignStudioDraft.title,
                description: lessonDesignStudioDraft.description ?? "",
                interestArea: lessonDesignStudioDraft.interestArea,
                outcomes: lessonDesignStudioDraft.outcomes,
                courseConfig: lessonDesignStudioDraft.courseConfig,
                weeklyPlans: (lessonDesignStudioDraft.weeklyPlans as unknown[]) ?? [],
                understandingChecks: lessonDesignStudioDraft.understandingChecks,
                reviewRubric: lessonDesignStudioDraft.reviewRubric,
                reviewNotes: lessonDesignStudioDraft.reviewNotes ?? "",
                reviewedAt: lessonDesignStudioDraft.reviewedAt?.toISOString() ?? null,
                submittedAt: lessonDesignStudioDraft.submittedAt?.toISOString() ?? null,
                approvedAt: lessonDesignStudioDraft.approvedAt?.toISOString() ?? null,
                generatedTemplateId: lessonDesignStudioDraft.generatedTemplateId ?? null,
                status: lessonDesignStudioDraft.status,
                updatedAt: lessonDesignStudioDraft.updatedAt.toISOString(),
              },
            }
          : null
      }
    />
  );
}

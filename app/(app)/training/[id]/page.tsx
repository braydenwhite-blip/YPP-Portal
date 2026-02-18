import { getServerSession } from "next-auth";
import { notFound, redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { withPrismaFallback } from "@/lib/prisma-guard";
import TrainingModuleClient from "./client";

export default async function TrainingModulePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    redirect("/login");
  }

  const roles = session.user.roles ?? [];
  const canView =
    roles.includes("INSTRUCTOR") ||
    roles.includes("ADMIN") ||
    roles.includes("CHAPTER_LEAD") ||
    roles.includes("STUDENT");

  if (!canView) {
    redirect("/");
  }

  const learnerId = session.user.id;
  const isStudentOnly =
    roles.includes("STUDENT") &&
    !roles.includes("INSTRUCTOR") &&
    !roles.includes("ADMIN") &&
    !roles.includes("CHAPTER_LEAD");

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

  const [assignment, videoProgress, checkpointCompletions, quizAttempts, evidenceSubmissions, nextModule] =
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
        "training-module:checkpoint-completions",
        () =>
          prisma.trainingCheckpointCompletion.findMany({
            where: {
              userId: learnerId,
              checkpoint: {
                moduleId: trainingModule.id,
              },
            },
            select: {
              checkpointId: true,
              completedAt: true,
              notes: true,
            },
          }),
        []
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

  const checkpointCompletionMap = new Map(
    checkpointCompletions.map((completion) => [
      completion.checkpointId,
      {
        completedAt: completion.completedAt,
        notes: completion.notes,
      },
    ])
  );

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
          required: checkpoint.required,
          sortOrder: checkpoint.sortOrder,
          completed: checkpointCompletionMap.has(checkpoint.id),
          completedAt: checkpointCompletionMap.get(checkpoint.id)?.completedAt?.toISOString() ?? null,
          notes: checkpointCompletionMap.get(checkpoint.id)?.notes ?? null,
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
    />
  );
}

import { getServerSession } from "next-auth";
import { notFound, redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
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

  const module = await prisma.trainingModule.findUnique({
    where: { id },
    include: {
      checkpoints: {
        orderBy: { sortOrder: "asc" },
      },
      quizQuestions: {
        orderBy: { sortOrder: "asc" },
      },
    },
  });

  if (!module) {
    notFound();
  }

  const [assignment, videoProgress, checkpointCompletions, quizAttempts, evidenceSubmissions, nextModule] =
    await Promise.all([
      prisma.trainingAssignment.findUnique({
        where: {
          userId_moduleId: {
            userId: learnerId,
            moduleId: module.id,
          },
        },
      }),
      prisma.videoProgress.findUnique({
        where: {
          userId_moduleId: {
            userId: learnerId,
            moduleId: module.id,
          },
        },
      }),
      prisma.trainingCheckpointCompletion.findMany({
        where: {
          userId: learnerId,
          checkpoint: {
            moduleId: module.id,
          },
        },
        select: {
          checkpointId: true,
          completedAt: true,
        },
      }),
      prisma.trainingQuizAttempt.findMany({
        where: {
          userId: learnerId,
          moduleId: module.id,
        },
        orderBy: { attemptedAt: "desc" },
        take: 5,
      }),
      prisma.trainingEvidenceSubmission.findMany({
        where: {
          userId: learnerId,
          moduleId: module.id,
        },
        orderBy: { createdAt: "desc" },
        take: 5,
      }),
      prisma.trainingModule.findFirst({
        where: {
          sortOrder: { gt: module.sortOrder },
        },
        orderBy: { sortOrder: "asc" },
        select: {
          id: true,
          title: true,
        },
      }),
    ]);

  const checkpointCompletionSet = new Set(
    checkpointCompletions.map((completion) => completion.checkpointId)
  );

  if (isStudentOnly && !assignment) {
    redirect("/student-training");
  }

  let effectiveNextModule = nextModule;
  if (isStudentOnly) {
    const nextAssigned = await prisma.trainingAssignment.findFirst({
      where: {
        userId: learnerId,
        module: {
          sortOrder: { gt: module.sortOrder },
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
    });

    effectiveNextModule = nextAssigned?.module ?? null;
  }

  const academyHref = isStudentOnly ? "/student-training" : "/instructor-training";
  const academyLabel = isStudentOnly ? "Back to student academy" : "Back to academy";

  const normalizedQuizQuestions = module.quizQuestions.map((question) => {
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
        id: module.id,
        title: module.title,
        description: module.description,
        type: module.type,
        required: module.required,
        videoUrl: module.videoUrl,
        videoProvider: module.videoProvider,
        videoDuration: module.videoDuration,
        videoThumbnail: module.videoThumbnail,
        requiresQuiz: module.requiresQuiz,
        requiresEvidence: module.requiresEvidence,
        passScorePct: module.passScorePct,
        checkpoints: module.checkpoints.map((checkpoint) => ({
          id: checkpoint.id,
          title: checkpoint.title,
          description: checkpoint.description,
          required: checkpoint.required,
          sortOrder: checkpoint.sortOrder,
          completed: checkpointCompletionSet.has(checkpoint.id),
        })),
        quizQuestions: normalizedQuizQuestions,
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

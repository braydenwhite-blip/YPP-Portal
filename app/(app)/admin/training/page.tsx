import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth-supabase";
import { prisma } from "@/lib/prisma";
import TrainingManager from "./training-manager";

export default async function AdminTrainingPage() {
  const session = await getSession();
  const roles = session?.user?.roles ?? [];
  if (!roles.includes("ADMIN")) {
    redirect("/");
  }

  try {
    const [modules, instructors, students, latestQuizAttempts, videoProgressRows] = await Promise.all([
      prisma.trainingModule.findMany({
        orderBy: { sortOrder: "asc" },
        include: {
          checkpoints: {
            orderBy: { sortOrder: "asc" },
          },
          quizQuestions: {
            orderBy: { sortOrder: "asc" },
          },
          assignments: {
            include: {
              user: { select: { id: true, name: true, email: true } },
            },
          },
          _count: {
            select: { assignments: true },
          },
        },
      }),
      prisma.user.findMany({
        where: { roles: { some: { role: "INSTRUCTOR" } } },
        select: { id: true, name: true, email: true },
        orderBy: { name: "asc" },
      }),
      prisma.user.findMany({
        where: { roles: { some: { role: "STUDENT" } } },
        select: { id: true, name: true, email: true },
        orderBy: { name: "asc" },
      }),
      prisma.trainingQuizAttempt.findMany({
        orderBy: { attemptedAt: "desc" },
        select: {
          userId: true,
          moduleId: true,
          scorePct: true,
          passed: true,
          attemptedAt: true,
        },
      }),
      prisma.videoProgress.findMany({
        select: {
          userId: true,
          moduleId: true,
          watchedSeconds: true,
          completed: true,
        },
      }),
    ]);

  const serializedModules = modules.map((m) => ({
    id: m.id,
    contentKey: m.contentKey,
    title: m.title,
    description: m.description,
    materialUrl: m.materialUrl,
    materialNotes: m.materialNotes,
    type: m.type,
    required: m.required,
    sortOrder: m.sortOrder,
    videoUrl: m.videoUrl,
    videoProvider: m.videoProvider,
    videoDuration: m.videoDuration,
    videoThumbnail: m.videoThumbnail,
    requiresQuiz: m.requiresQuiz,
    requiresEvidence: m.requiresEvidence,
    passScorePct: m.passScorePct,
    estimatedMinutes: m.estimatedMinutes,
    checkpoints: m.checkpoints.map((checkpoint) => ({
      id: checkpoint.id,
      contentKey: checkpoint.contentKey,
      title: checkpoint.title,
      description: checkpoint.description,
      sortOrder: checkpoint.sortOrder,
      required: checkpoint.required,
    })),
    quizQuestions: m.quizQuestions.map((question) => {
      let options: string[] = [];
      try {
        if (Array.isArray(question.options)) {
          options = question.options.map((option) => String(option));
        } else if (question.options && typeof question.options === "object") {
          options = Object.values(question.options as Record<string, unknown>).map((option) => String(option));
        }
      } catch (error) {
        console.error(`Error serializing quiz options for question ${question.id}:`, error);
        options = [];
      }
      return {
        id: question.id,
        contentKey: question.contentKey,
        question: question.question,
        options,
        correctAnswer: question.correctAnswer,
        explanation: question.explanation,
        sortOrder: question.sortOrder,
      };
    }),
    assignmentCount: m._count.assignments,
    assignments: m.assignments.map((a) => ({
      id: a.id,
      userId: a.userId,
      userName: a.user?.name ?? "Unknown User",
      userEmail: a.user?.email ?? "no-email@example.com",
      status: a.status,
      completedAt: a.completedAt?.toISOString() ?? null,
    })),
  }));

    // Build per-user latest quiz attempt and video progress lookups for the
    // Learner Progress view. Quiz attempts arrive ordered desc, so the first
    // hit per (userId, moduleId) is the latest.
    const latestQuizByUserModule = new Map<string, (typeof latestQuizAttempts)[number]>();
    for (const attempt of latestQuizAttempts) {
      const key = `${attempt.userId}::${attempt.moduleId}`;
      if (!latestQuizByUserModule.has(key)) {
        latestQuizByUserModule.set(key, attempt);
      }
    }
    const videoByUserModule = new Map<string, (typeof videoProgressRows)[number]>();
    for (const row of videoProgressRows) {
      videoByUserModule.set(`${row.userId}::${row.moduleId}`, row);
    }

    const requiredModuleCount = modules.filter((m) => m.required).length;

    function buildLearnerRows(
      learners: typeof instructors,
      audience: "INSTRUCTOR" | "STUDENT"
    ) {
      return learners.map((learner) => {
        const perModule = modules.map((mod) => {
          const assignment = mod.assignments.find((a) => a.userId === learner.id);
          const quiz = latestQuizByUserModule.get(`${learner.id}::${mod.id}`) ?? null;
          const video = videoByUserModule.get(`${learner.id}::${mod.id}`) ?? null;
          const videoPct =
            mod.videoDuration && mod.videoDuration > 0 && video
              ? Math.min(100, Math.round((video.watchedSeconds / mod.videoDuration) * 100))
              : video?.completed
                ? 100
                : 0;
          return {
            moduleId: mod.id,
            moduleTitle: mod.title,
            required: mod.required,
            sortOrder: mod.sortOrder,
            status: assignment?.status ?? "NOT_STARTED",
            completedAt: assignment?.completedAt?.toISOString() ?? null,
            videoPct,
            videoCompleted: Boolean(video?.completed),
            quizScorePct: quiz?.scorePct ?? null,
            quizPassed: quiz?.passed ?? null,
            quizAttemptedAt: quiz?.attemptedAt?.toISOString() ?? null,
            requiresQuiz: mod.requiresQuiz,
          };
        });
        const requiredModules = perModule.filter((m) => m.required);
        const requiredComplete = requiredModules.filter((m) => m.status === "COMPLETE").length;
        const lastActivity = perModule
          .map((m) => m.completedAt ?? m.quizAttemptedAt)
          .filter((d): d is string => d !== null)
          .sort()
          .pop() ?? null;
        return {
          audience,
          userId: learner.id,
          userName: learner.name ?? "Unknown",
          userEmail: learner.email ?? "—",
          requiredModulesCount: requiredModules.length,
          requiredComplete,
          completePct:
            requiredModules.length > 0
              ? Math.round((requiredComplete / requiredModules.length) * 100)
              : 0,
          lastActivity,
          modules: perModule,
        };
      });
    }

    const learnerProgress = [
      ...buildLearnerRows(instructors, "INSTRUCTOR"),
      ...buildLearnerRows(students, "STUDENT"),
    ];

    return (
      <div>
        <div className="topbar">
          <div>
            <p className="badge">Admin</p>
            <h1 className="page-title">Training Module Management</h1>
            <p className="page-subtitle">
              Create, edit, assign, and track training modules
            </p>
          </div>
        </div>

        <TrainingManager
          modules={serializedModules}
          instructors={instructors}
          students={students}
          learnerProgress={learnerProgress}
          requiredModuleCount={requiredModuleCount}
        />
      </div>
    );
  } catch (error) {
    console.error("Error loading training data:", error);
    throw new Error(
      `Failed to load training data: ${error instanceof Error ? error.message : "Unknown error"}`
    );
  }
}

import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import TrainingManager from "./training-manager";

export default async function AdminTrainingPage() {
  const session = await getServerSession(authOptions);
  const roles = session?.user?.roles ?? [];
  if (!roles.includes("ADMIN")) {
    redirect("/");
  }

  const [modules, instructors] = await Promise.all([
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
    checkpoints: m.checkpoints.map((checkpoint) => ({
      id: checkpoint.id,
      contentKey: checkpoint.contentKey,
      title: checkpoint.title,
      description: checkpoint.description,
      sortOrder: checkpoint.sortOrder,
      required: checkpoint.required,
    })),
    quizQuestions: m.quizQuestions.map((question) => ({
      id: question.id,
      contentKey: question.contentKey,
      question: question.question,
      options: Array.isArray(question.options)
        ? question.options.map((option) => String(option))
        : question.options && typeof question.options === "object"
          ? Object.values(question.options as Record<string, unknown>).map((option) => String(option))
          : [],
      correctAnswer: question.correctAnswer,
      explanation: question.explanation,
      sortOrder: question.sortOrder,
    })),
    assignmentCount: m._count.assignments,
    assignments: m.assignments.map((a) => ({
      id: a.id,
      userId: a.userId,
      userName: a.user.name,
      userEmail: a.user.email,
      status: a.status,
      completedAt: a.completedAt?.toISOString() ?? null,
    })),
  }));

  return (
    <div>
      <div className="topbar">
        <div>
          <p className="badge">Admin</p>
          <h1 className="page-title">Training Module Management</h1>
          <p className="page-subtitle">
            Create, edit, assign, and track instructor training modules
          </p>
        </div>
      </div>

      <TrainingManager
        modules={serializedModules}
        instructors={instructors}
      />
    </div>
  );
}

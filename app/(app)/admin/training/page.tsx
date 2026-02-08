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

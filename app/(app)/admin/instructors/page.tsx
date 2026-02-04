import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import InstructorTable from "./instructor-table";

export default async function AdminInstructorsPage() {
  const session = await getServerSession(authOptions);
  const roles = session?.user?.roles ?? [];
  if (!roles.includes("ADMIN")) {
    redirect("/");
  }

  const [instructors, chapters, mentors] = await Promise.all([
    prisma.user.findMany({
      where: {
        roles: { some: { role: "INSTRUCTOR" } }
      },
      include: {
        roles: true,
        chapter: true,
        approvals: { include: { levels: true } },
        trainings: { include: { module: true } },
        menteePairs: { include: { mentor: true } },
        courses: true
      },
      orderBy: { name: "asc" }
    }),
    prisma.chapter.findMany({ orderBy: { name: "asc" } }),
    prisma.user.findMany({
      where: { roles: { some: { role: "MENTOR" } } },
      orderBy: { name: "asc" }
    })
  ]);

  const instructorData = instructors.map((instructor) => {
    const approval = instructor.approvals[0];
    const completedTrainings = instructor.trainings.filter((t) => t.status === "COMPLETE").length;
    const totalTrainings = instructor.trainings.length;
    const mentor = instructor.menteePairs.find((m) => m.type === "INSTRUCTOR")?.mentor;

    return {
      id: instructor.id,
      name: instructor.name,
      email: instructor.email,
      chapter: instructor.chapter?.name ?? "None",
      chapterId: instructor.chapterId ?? "",
      approvalStatus: approval?.status ?? "NOT_STARTED",
      approvedLevels: approval?.levels.map((l) => l.level.replace("LEVEL_", "")).join(", ") || "None",
      trainingProgress: totalTrainings > 0 ? `${completedTrainings}/${totalTrainings}` : "0/0",
      trainingPercent: totalTrainings > 0 ? Math.round((completedTrainings / totalTrainings) * 100) : 0,
      coursesCount: instructor.courses.length,
      mentorId: mentor?.id ?? "",
      mentorName: mentor?.name ?? "Unassigned",
      createdAt: instructor.createdAt.toISOString()
    };
  });

  return (
    <div>
      <div className="topbar">
        <div>
          <p className="badge">Admin</p>
          <h1 className="page-title">All Instructors</h1>
        </div>
        <div>
          <span className="kpi" style={{ fontSize: 24 }}>{instructors.length}</span>
          <span className="kpi-label" style={{ marginLeft: 8 }}>Total Instructors</span>
        </div>
      </div>

      <div className="card">
        <InstructorTable
          instructors={instructorData}
          chapters={chapters}
          mentors={mentors}
        />
      </div>
    </div>
  );
}

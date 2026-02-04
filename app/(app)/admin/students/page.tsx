import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import StudentTable from "./student-table";

export default async function AdminStudentsPage() {
  const session = await getServerSession(authOptions);
  const roles = session?.user?.roles ?? [];
  if (!roles.includes("ADMIN")) {
    redirect("/");
  }

  const [students, chapters, mentors] = await Promise.all([
    prisma.user.findMany({
      where: {
        roles: { some: { role: "STUDENT" } }
      },
      include: {
        roles: true,
        chapter: true,
        enrollments: { include: { course: true } },
        menteePairs: { where: { type: "STUDENT" }, include: { mentor: true } },
        profile: true,
        certificates: true
      },
      orderBy: { name: "asc" }
    }),
    prisma.chapter.findMany({ orderBy: { name: "asc" } }),
    prisma.user.findMany({
      where: { roles: { some: { role: "MENTOR" } } },
      orderBy: { name: "asc" }
    })
  ]);

  const studentData = students.map((student) => {
    const enrolledCount = student.enrollments.filter((e) => e.status === "ENROLLED").length;
    const completedCount = student.enrollments.filter((e) => e.status === "COMPLETED").length;
    const mentor = student.menteePairs[0]?.mentor;

    return {
      id: student.id,
      name: student.name,
      email: student.email,
      chapter: student.chapter?.name ?? "None",
      chapterId: student.chapterId ?? "",
      grade: student.profile?.grade ?? null,
      school: student.profile?.school ?? "",
      enrolledCourses: enrolledCount,
      completedCourses: completedCount,
      certificates: student.certificates.length,
      mentorId: mentor?.id ?? "",
      mentorName: mentor?.name ?? "Unassigned",
      createdAt: student.createdAt.toISOString()
    };
  });

  return (
    <div>
      <div className="topbar">
        <div>
          <p className="badge">Admin</p>
          <h1 className="page-title">All Students</h1>
        </div>
        <div>
          <span className="kpi" style={{ fontSize: 24 }}>{students.length}</span>
          <span className="kpi-label" style={{ marginLeft: 8 }}>Total Students</span>
        </div>
      </div>

      <div className="card">
        <StudentTable
          students={studentData}
          chapters={chapters}
          mentors={mentors}
        />
      </div>
    </div>
  );
}

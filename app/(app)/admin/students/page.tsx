import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth-supabase";
import { prisma } from "@/lib/prisma";
import { ActionCommandBar } from "@/components/people-strategy/action-command-bar";
import { StatCard } from "@/components/people-strategy/stat-card";
import { MasterDirectoryBanner } from "@/components/people/master-directory-banner";
import StudentTable from "./student-table";

export default async function AdminStudentsPage() {
  const session = await getSession();
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
        adviseeAssignments: {
          where: { isActive: true },
          select: { id: true, advisor: { select: { name: true } } }
        },
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
    const advisorAssignment = student.adviseeAssignments[0];

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
      advisorName: advisorAssignment?.advisor.name ?? "",
      advisorAssignmentId: advisorAssignment?.id ?? "",
      createdAt: student.createdAt.toISOString()
    };
  });

  const totals = {
    students: studentData.length,
    activeEnrollments: studentData.reduce((sum, s) => sum + s.enrolledCourses, 0),
    completed: studentData.reduce((sum, s) => sum + s.completedCourses, 0),
    certificates: studentData.reduce((sum, s) => sum + s.certificates, 0),
    mentored: studentData.filter((s) => s.mentorId).length,
  };

  return (
    <div className="ps-page psuite">
      <MasterDirectoryBanner
        label="Browse students in People"
        href="/people?role=student"
      />
      <ActionCommandBar
        eyebrow="Admin · Students"
        title="All Students"
        subtitle="Every learner across every chapter — search, filter, and manage enrollments, mentors, and achievements in one place."
        meta={`${totals.students} students · ${chapters.length} chapters`}
      />

      <div className="psuite-stat-strip">
        <StatCard label="Total students" value={totals.students} icon="users" tone="accent" />
        <StatCard label="Active enrollments" value={totals.activeEnrollments} icon="layers" />
        <StatCard label="Courses completed" value={totals.completed} icon="check" tone="success" />
        <StatCard label="Certificates earned" value={totals.certificates} icon="target" tone="warning" />
        <StatCard label="With a mentor" value={totals.mentored} icon="activity" />
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

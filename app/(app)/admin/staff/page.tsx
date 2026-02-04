import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import StaffReflectionsTable from "./staff-reflections-table";

export default async function AdminStaffPage() {
  const session = await getServerSession(authOptions);
  const roles = session?.user?.roles ?? [];
  if (!roles.includes("ADMIN")) {
    redirect("/");
  }

  const staffUsers = await prisma.user.findMany({
    where: {
      OR: [
        { roles: { some: { role: "STAFF" } } },
        { roles: { some: { role: "INSTRUCTOR" } } },
        { roles: { some: { role: "CHAPTER_LEAD" } } }
      ]
    },
    include: {
      roles: true,
      chapter: true,
      reflectionSubmissions: {
        include: {
          form: true,
          responses: {
            include: { question: true },
            orderBy: { question: { sortOrder: "asc" } }
          }
        },
        orderBy: { submittedAt: "desc" }
      }
    },
    orderBy: { name: "asc" }
  });

  const staffData = staffUsers.map((user) => {
    const submissions = user.reflectionSubmissions;
    const latestSubmission = submissions[0];

    return {
      id: user.id,
      name: user.name,
      email: user.email,
      roles: user.roles.map((r) => r.role).join(", "),
      chapter: user.chapter?.name ?? "None",
      chapterId: user.chapterId ?? "",
      totalReflections: submissions.length,
      latestSubmission: latestSubmission
        ? {
            id: latestSubmission.id,
            formTitle: latestSubmission.form.title,
            month: latestSubmission.month.toISOString(),
            submittedAt: latestSubmission.submittedAt.toISOString(),
            responses: latestSubmission.responses.map((r) => ({
              question: r.question.question,
              value: r.value
            }))
          }
        : null
    };
  });

  const totalSubmissions = staffData.reduce((sum, s) => sum + s.totalReflections, 0);
  const usersWithReflections = staffData.filter((s) => s.totalReflections > 0).length;

  return (
    <div>
      <div className="topbar">
        <div>
          <p className="badge">Admin</p>
          <h1 className="page-title">Staff Reflections</h1>
        </div>
      </div>

      <div className="grid three" style={{ marginBottom: 24 }}>
        <div className="card">
          <div className="kpi">{staffUsers.length}</div>
          <div className="kpi-label">Total Staff</div>
        </div>
        <div className="card">
          <div className="kpi">{totalSubmissions}</div>
          <div className="kpi-label">Total Reflections</div>
        </div>
        <div className="card">
          <div className="kpi">{usersWithReflections}</div>
          <div className="kpi-label">Active Participants</div>
        </div>
      </div>

      <div className="card">
        <h3>All Staff Reflections</h3>
        <StaffReflectionsTable staffData={staffData} />
      </div>
    </div>
  );
}

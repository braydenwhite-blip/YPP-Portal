import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createStudentOfMonth } from "@/lib/showcase-actions";

export default async function AdminStudentOfMonthPage() {
  const session = await getServerSession(authOptions);
  const roles: string[] = (session?.user as any)?.roles ?? [];
  if (!roles.includes("ADMIN")) {
    redirect("/");
  }

  const [winners, students, chapters] = await Promise.all([
    prisma.studentOfMonth.findMany({
      include: { student: { select: { name: true } } },
      orderBy: { month: "desc" },
    }),
    prisma.user.findMany({
      where: { roles: { some: { role: "STUDENT" } } },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    prisma.chapter.findMany({ orderBy: { name: "asc" } }),
  ]);

  return (
    <div>
      <div className="topbar">
        <div>
          <p className="badge">Admin</p>
          <h1 className="page-title">Manage Student of the Month</h1>
        </div>
      </div>

      <div className="grid two" style={{ marginBottom: 24 }}>
        <div className="card">
          <h3>Nominate Student of the Month</h3>
          <form action={createStudentOfMonth} className="form-grid">
            <label className="form-row">
              Student
              <select className="input" name="studentId" required>
                <option value="">Select student</option>
                {students.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </label>
            <label className="form-row">
              Month
              <input className="input" name="month" type="month" required />
            </label>
            <label className="form-row">
              Chapter
              <select className="input" name="chapterId" defaultValue="">
                <option value="">All Chapters</option>
                {chapters.map((ch) => (
                  <option key={ch.id} value={ch.id}>{ch.name}</option>
                ))}
              </select>
            </label>
            <label className="form-row">
              Nomination Reason
              <textarea className="input" name="nomination" rows={4} required placeholder="Why this student was chosen..." />
            </label>
            <label className="form-row">
              Achievements (one per line)
              <textarea className="input" name="achievements" rows={3} placeholder="First achievement&#10;Second achievement&#10;Third achievement" />
            </label>
            <button className="button" type="submit">Create Nomination</button>
          </form>
        </div>

        <div className="card">
          <h3>Past Winners ({winners.length})</h3>
          {winners.length === 0 ? (
            <p style={{ color: "var(--text-secondary)" }}>No winners yet.</p>
          ) : (
            <table className="table">
              <thead>
                <tr>
                  <th>Student</th>
                  <th>Month</th>
                  <th>Nomination</th>
                </tr>
              </thead>
              <tbody>
                {winners.map((w) => (
                  <tr key={w.id}>
                    <td>{w.student.name}</td>
                    <td>{new Date(w.month).toLocaleDateString("en-US", { month: "long", year: "numeric" })}</td>
                    <td>{w.nomination.length > 80 ? w.nomination.substring(0, 80) + "..." : w.nomination}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}

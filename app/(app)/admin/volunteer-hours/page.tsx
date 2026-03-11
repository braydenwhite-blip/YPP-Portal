import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import Link from "next/link";

export default async function VolunteerHoursPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id || session.user.primaryRole !== "ADMIN") {
    redirect("/");
  }

  const volunteers = await prisma.serviceVolunteer.findMany({
    include: {
      student: { select: { name: true, email: true } },
      project: { select: { title: true, passionArea: true, status: true } },
    },
    orderBy: { hoursLogged: "desc" },
    take: 100,
  });

  const totalHours = volunteers.reduce((sum, v) => sum + v.hoursLogged, 0);
  const totalVolunteers = new Set(volunteers.map((v) => v.studentId)).size;
  const totalProjects = new Set(volunteers.map((v) => v.projectId)).size;

  const STATUS_COLORS: Record<string, string> = {
    RECRUITING: "#f59e0b",
    ACTIVE: "#10b981",
    COMPLETED: "#6366f1",
    CANCELLED: "#ef4444",
  };

  return (
    <div>
      <div className="topbar">
        <div>
          <p className="badge">Admin</p>
          <h1 className="page-title">Volunteer Hour Tracking</h1>
          <p className="page-subtitle">
            Hours logged by students across all service projects.
          </p>
        </div>
        <Link href="/service-projects" className="button">
          View Service Projects
        </Link>
      </div>

      {/* Summary stats */}
      <div className="grid three" style={{ marginBottom: 32 }}>
        <div className="card" style={{ textAlign: "center" }}>
          <div style={{ fontSize: 36, fontWeight: 700, color: "var(--primary-color)" }}>{totalHours}</div>
          <div style={{ fontSize: 14, color: "var(--text-secondary)", marginTop: 4 }}>Total Hours Logged</div>
        </div>
        <div className="card" style={{ textAlign: "center" }}>
          <div style={{ fontSize: 36, fontWeight: 700, color: "var(--primary-color)" }}>{totalVolunteers}</div>
          <div style={{ fontSize: 14, color: "var(--text-secondary)", marginTop: 4 }}>Unique Volunteers</div>
        </div>
        <div className="card" style={{ textAlign: "center" }}>
          <div style={{ fontSize: 36, fontWeight: 700, color: "var(--primary-color)" }}>{totalProjects}</div>
          <div style={{ fontSize: 14, color: "var(--text-secondary)", marginTop: 4 }}>Active Projects</div>
        </div>
      </div>

      {volunteers.length === 0 ? (
        <div className="card" style={{ padding: "32px", textAlign: "center" }}>
          <p style={{ color: "var(--text-secondary)", marginBottom: 12 }}>
            No volunteer hours have been logged yet.
          </p>
          <p style={{ fontSize: 14, color: "var(--text-secondary)" }}>
            Hours are recorded when students join and log time on{" "}
            <Link href="/service-projects" style={{ color: "var(--primary-color)" }}>
              service projects
            </Link>
            . Create a service project to get started.
          </p>
        </div>
      ) : (
        <div>
          <h2 style={{ marginBottom: 16 }}>Volunteer Log</h2>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
              <thead>
                <tr style={{ borderBottom: "2px solid var(--border-color)" }}>
                  <th style={{ textAlign: "left", padding: "10px 12px", color: "var(--text-secondary)", fontWeight: 600 }}>Student</th>
                  <th style={{ textAlign: "left", padding: "10px 12px", color: "var(--text-secondary)", fontWeight: 600 }}>Project</th>
                  <th style={{ textAlign: "left", padding: "10px 12px", color: "var(--text-secondary)", fontWeight: 600 }}>Passion Area</th>
                  <th style={{ textAlign: "left", padding: "10px 12px", color: "var(--text-secondary)", fontWeight: 600 }}>Role</th>
                  <th style={{ textAlign: "center", padding: "10px 12px", color: "var(--text-secondary)", fontWeight: 600 }}>Hours</th>
                  <th style={{ textAlign: "left", padding: "10px 12px", color: "var(--text-secondary)", fontWeight: 600 }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {volunteers.map((v) => (
                  <tr key={v.id} style={{ borderBottom: "1px solid var(--border-color)" }}>
                    <td style={{ padding: "10px 12px" }}>
                      <div style={{ fontWeight: 500 }}>{v.student.name}</div>
                      <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>{v.student.email}</div>
                    </td>
                    <td style={{ padding: "10px 12px" }}>{v.project.title}</td>
                    <td style={{ padding: "10px 12px", color: "var(--text-secondary)" }}>
                      {v.project.passionArea ?? "—"}
                    </td>
                    <td style={{ padding: "10px 12px", color: "var(--text-secondary)" }}>
                      {v.role ?? "Volunteer"}
                    </td>
                    <td style={{ padding: "10px 12px", textAlign: "center", fontWeight: 600 }}>
                      {v.hoursLogged}
                    </td>
                    <td style={{ padding: "10px 12px" }}>
                      <span
                        className="pill"
                        style={{
                          backgroundColor: STATUS_COLORS[v.project.status] ?? "var(--text-secondary)",
                          color: "white",
                          border: "none",
                          fontSize: 12,
                        }}
                      >
                        {v.project.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

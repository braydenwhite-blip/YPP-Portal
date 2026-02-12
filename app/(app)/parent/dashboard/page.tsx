import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getLinkedStudents, getStudentProgress } from "@/lib/parent-actions";

export default async function ParentDashboardPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");

  const roles = session.user.roles ?? [];
  if (!roles.includes("PARENT") && !roles.includes("ADMIN")) redirect("/");

  const linkedStudents = await getLinkedStudents();

  // Fetch progress for all linked students
  const progressData = await Promise.all(
    linkedStudents.map(async (s) => {
      try {
        return { studentId: s.studentId, name: s.name, progress: await getStudentProgress(s.studentId) };
      } catch {
        return { studentId: s.studentId, name: s.name, progress: null };
      }
    }),
  );

  // Aggregate stats
  const totalEnrollments = progressData.reduce(
    (sum, p) => sum + (p.progress?.enrollments?.length ?? 0), 0,
  );
  const totalCerts = progressData.reduce(
    (sum, p) => sum + (p.progress?.certificates?.length ?? 0), 0,
  );
  const totalGoals = progressData.reduce(
    (sum, p) => sum + (p.progress?.goals?.length ?? 0), 0,
  );
  const goalsOnTrack = progressData.reduce(
    (sum, p) =>
      sum +
      (p.progress?.goals?.filter(
        (g) => g.latestStatus === "ON_TRACK" || g.latestStatus === "ABOVE_AND_BEYOND",
      ).length ?? 0),
    0,
  );

  // Collect recent activity across all children
  type Activity = { type: string; label: string; student: string; date: Date; studentId: string };
  const activities: Activity[] = [];

  for (const p of progressData) {
    if (!p.progress) continue;
    for (const e of p.progress.enrollments) {
      activities.push({
        type: "enrollment",
        label: `Enrolled in ${e.course.title}`,
        student: p.name,
        date: new Date(e.enrolledAt),
        studentId: p.studentId,
      });
    }
    for (const c of p.progress.certificates) {
      activities.push({
        type: "certificate",
        label: `Earned certificate: ${c.title}`,
        student: p.name,
        date: new Date(c.issuedAt),
        studentId: p.studentId,
      });
    }
    for (const g of p.progress.goals) {
      if (g.lastUpdatedAt) {
        activities.push({
          type: "goal",
          label: `Goal "${g.title}" updated — ${(g.latestStatus ?? "").replace(/_/g, " ")}`,
          student: p.name,
          date: new Date(g.lastUpdatedAt),
          studentId: p.studentId,
        });
      }
    }
  }

  activities.sort((a, b) => b.date.getTime() - a.date.getTime());
  const recentActivities = activities.slice(0, 15);

  // Fetch upcoming events (if any)
  const upcomingEvents = await prisma.event.findMany({
    where: { date: { gte: new Date() } },
    orderBy: { date: "asc" },
    take: 5,
    select: { id: true, title: true, date: true, location: true },
  }).catch(() => []);

  return (
    <div>
      <div className="topbar">
        <div>
          <Link href="/parent" style={{ fontSize: 13, color: "var(--muted)" }}>
            &larr; Parent Portal
          </Link>
          <h1 className="page-title">Student Overview</h1>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <Link href="/parent/connect" className="button secondary small">
            Manage Connections
          </Link>
          <Link href="/parent/reports" className="button secondary small">
            Reports
          </Link>
        </div>
      </div>

      {linkedStudents.length === 0 ? (
        <div className="card" style={{ textAlign: "center", padding: 40 }}>
          <h3>No students linked yet</h3>
          <p style={{ color: "var(--text-secondary)" }}>
            Link your child&apos;s account to see their progress here.
          </p>
          <Link href="/parent" className="button primary" style={{ marginTop: 12 }}>
            Link a Student
          </Link>
        </div>
      ) : (
        <>
          {/* Aggregate Stats */}
          <div className="grid four" style={{ marginBottom: 24 }}>
            <div className="card" style={{ textAlign: "center" }}>
              <div className="kpi">{linkedStudents.length}</div>
              <div className="kpi-label">Linked Students</div>
            </div>
            <div className="card" style={{ textAlign: "center" }}>
              <div className="kpi">{totalEnrollments}</div>
              <div className="kpi-label">Total Enrollments</div>
            </div>
            <div className="card" style={{ textAlign: "center" }}>
              <div className="kpi" style={{ color: "#16a34a" }}>
                {totalGoals > 0 ? `${Math.round((goalsOnTrack / totalGoals) * 100)}%` : "N/A"}
              </div>
              <div className="kpi-label">Goals On Track</div>
            </div>
            <div className="card" style={{ textAlign: "center" }}>
              <div className="kpi" style={{ color: "#7c3aed" }}>{totalCerts}</div>
              <div className="kpi-label">Certificates Earned</div>
            </div>
          </div>

          <div className="grid two">
            {/* Recent Activity */}
            <div className="card">
              <div className="section-title">Recent Activity</div>
              {recentActivities.length === 0 ? (
                <p style={{ color: "var(--text-secondary)" }}>No recent activity.</p>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
                  {recentActivities.map((activity, i) => (
                    <Link
                      key={i}
                      href={`/parent/${activity.studentId}`}
                      style={{
                        textDecoration: "none",
                        color: "inherit",
                        padding: "10px 0",
                        borderBottom: i < recentActivities.length - 1 ? "1px solid var(--border)" : "none",
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <div>
                          <div style={{ fontSize: 13, fontWeight: 500 }}>
                            {activity.label}
                          </div>
                          <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 2 }}>
                            {activity.student}
                          </div>
                        </div>
                        <span style={{ fontSize: 11, color: "var(--muted)", whiteSpace: "nowrap" }}>
                          {activity.date.toLocaleDateString()}
                        </span>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </div>

            {/* Right Column */}
            <div>
              {/* Per-student summary */}
              <div className="card" style={{ marginBottom: 16 }}>
                <div className="section-title">Students</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {progressData.map((p) => {
                    const prog = p.progress;
                    const attendTotal = prog?.attendance?.totalSessions ?? 0;
                    const attendPresent = prog?.attendance?.presentCount ?? 0;
                    const rate = attendTotal > 0 ? Math.round((attendPresent / attendTotal) * 100) : null;

                    return (
                      <Link
                        key={p.studentId}
                        href={`/parent/${p.studentId}`}
                        style={{ textDecoration: "none", color: "inherit" }}
                      >
                        <div
                          style={{
                            padding: "10px 12px",
                            background: "var(--surface-alt)",
                            borderRadius: "var(--radius-sm)",
                            cursor: "pointer",
                          }}
                        >
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                            <strong style={{ fontSize: 14 }}>{p.name}</strong>
                            <span style={{ color: "var(--muted)" }}>&rsaquo;</span>
                          </div>
                          <div style={{ display: "flex", gap: 12, marginTop: 6, fontSize: 12, color: "var(--muted)" }}>
                            <span>{prog?.enrollments?.length ?? 0} courses</span>
                            <span>{prog?.certificates?.length ?? 0} certs</span>
                            {rate !== null && <span>{rate}% attendance</span>}
                          </div>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              </div>

              {/* Upcoming Events */}
              <div className="card">
                <div className="section-title">Upcoming Events</div>
                {upcomingEvents.length === 0 ? (
                  <p style={{ fontSize: 13, color: "var(--text-secondary)" }}>
                    No upcoming events.
                  </p>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
                    {upcomingEvents.map((event, i) => (
                      <div
                        key={event.id}
                        style={{
                          padding: "10px 0",
                          borderBottom: i < upcomingEvents.length - 1 ? "1px solid var(--border)" : "none",
                        }}
                      >
                        <div style={{ fontWeight: 500, fontSize: 13 }}>{event.title}</div>
                        <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 2 }}>
                          {new Date(event.date).toLocaleDateString("en-US", {
                            weekday: "short",
                            month: "short",
                            day: "numeric",
                          })}
                          {event.location && ` — ${event.location}`}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

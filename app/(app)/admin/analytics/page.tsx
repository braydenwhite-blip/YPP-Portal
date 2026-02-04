import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { getDashboardAnalytics, getTrainingAnalytics } from "@/lib/analytics-actions";

export default async function AnalyticsDashboardPage() {
  const session = await getServerSession(authOptions);
  const roles = session?.user?.roles ?? [];

  if (!roles.includes("ADMIN")) {
    redirect("/");
  }

  const [dashboardData, trainingData] = await Promise.all([
    getDashboardAnalytics(),
    getTrainingAnalytics()
  ]);

  const formatNumber = (num: number) => num.toLocaleString();

  return (
    <div>
      <div className="topbar">
        <div>
          <p className="badge">Admin</p>
          <h1 className="page-title">Analytics Dashboard</h1>
        </div>
      </div>

      {/* Overview KPIs */}
      <div className="grid three">
        <div className="card">
          <div className="kpi">{formatNumber(dashboardData.overview.totalUsers)}</div>
          <div className="kpi-label">Total Users</div>
          <p style={{ fontSize: 12, color: "var(--muted)", marginTop: 8 }}>
            +{dashboardData.recentActivity.newUsersLast30Days} in last 30 days
          </p>
        </div>
        <div className="card">
          <div className="kpi">{formatNumber(dashboardData.overview.totalEnrollments)}</div>
          <div className="kpi-label">Active Enrollments</div>
          <p style={{ fontSize: 12, color: "var(--muted)", marginTop: 8 }}>
            +{dashboardData.recentActivity.newEnrollmentsLast30Days} in last 30 days
          </p>
        </div>
        <div className="card">
          <div className="kpi">{formatNumber(dashboardData.recentActivity.activeUsersLast7Days)}</div>
          <div className="kpi-label">Active Users (7 days)</div>
        </div>
      </div>

      {/* User Breakdown */}
      <div className="grid three" style={{ marginTop: 24 }}>
        <div className="card">
          <div className="kpi" style={{ color: "var(--accent)" }}>{formatNumber(dashboardData.overview.totalInstructors)}</div>
          <div className="kpi-label">Instructors</div>
        </div>
        <div className="card">
          <div className="kpi" style={{ color: "var(--accent-3)" }}>{formatNumber(dashboardData.overview.totalStudents)}</div>
          <div className="kpi-label">Students</div>
        </div>
        <div className="card">
          <div className="kpi" style={{ color: "var(--accent-2)" }}>{formatNumber(dashboardData.overview.totalParents)}</div>
          <div className="kpi-label">Parents</div>
        </div>
      </div>

      <div className="grid two" style={{ marginTop: 24 }}>
        {/* Enrollment by Format */}
        <div className="card">
          <div className="section-title">Enrollments by Course Format</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {Object.entries(dashboardData.enrollmentsByFormat).map(([format, count]) => (
              <div key={format}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                  <span style={{ fontSize: 13 }}>{format.replace("_", " ")}</span>
                  <span style={{ fontSize: 13, fontWeight: 600 }}>{count}</span>
                </div>
                <div
                  style={{
                    height: 8,
                    background: "var(--surface-alt)",
                    borderRadius: 4,
                    overflow: "hidden"
                  }}
                >
                  <div
                    style={{
                      height: "100%",
                      width: `${Math.min((count / dashboardData.overview.totalEnrollments) * 100, 100)}%`,
                      background: "var(--accent)",
                      borderRadius: 4
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Top Courses */}
        <div className="card">
          <div className="section-title">Top Courses by Enrollment</div>
          <table className="table">
            <thead>
              <tr>
                <th>Course</th>
                <th>Format</th>
                <th>Enrollments</th>
              </tr>
            </thead>
            <tbody>
              {dashboardData.topCourses.map((course, i) => (
                <tr key={i}>
                  <td>{course.title}</td>
                  <td>
                    <span className="pill" style={{ fontSize: 10 }}>
                      {course.format?.replace("_", " ")}
                    </span>
                  </td>
                  <td><strong>{course.enrollments}</strong></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Training & Video Stats */}
      <div className="grid two" style={{ marginTop: 24 }}>
        <div className="card">
          <div className="section-title">Training Completion</div>
          <div className="grid three" style={{ gap: 12 }}>
            <div style={{ textAlign: "center", padding: 16, background: "var(--surface-alt)", borderRadius: "var(--radius-md)" }}>
              <div style={{ fontSize: 24, fontWeight: 700, color: "#ef4444" }}>
                {trainingData.completionRates.notStarted}
              </div>
              <div style={{ fontSize: 11, color: "var(--muted)" }}>Not Started</div>
            </div>
            <div style={{ textAlign: "center", padding: 16, background: "var(--surface-alt)", borderRadius: "var(--radius-md)" }}>
              <div style={{ fontSize: 24, fontWeight: 700, color: "#eab308" }}>
                {trainingData.completionRates.inProgress}
              </div>
              <div style={{ fontSize: 11, color: "var(--muted)" }}>In Progress</div>
            </div>
            <div style={{ textAlign: "center", padding: 16, background: "var(--surface-alt)", borderRadius: "var(--radius-md)" }}>
              <div style={{ fontSize: 24, fontWeight: 700, color: "#22c55e" }}>
                {trainingData.completionRates.complete}
              </div>
              <div style={{ fontSize: 11, color: "var(--muted)" }}>Complete</div>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="section-title">Video Engagement</div>
          <div className="grid three" style={{ gap: 12 }}>
            <div style={{ textAlign: "center", padding: 16, background: "var(--surface-alt)", borderRadius: "var(--radius-md)" }}>
              <div style={{ fontSize: 24, fontWeight: 700 }}>
                {formatNumber(dashboardData.videoStats.totalVideoViews)}
              </div>
              <div style={{ fontSize: 11, color: "var(--muted)" }}>Total Views</div>
            </div>
            <div style={{ textAlign: "center", padding: 16, background: "var(--surface-alt)", borderRadius: "var(--radius-md)" }}>
              <div style={{ fontSize: 24, fontWeight: 700 }}>
                {formatNumber(dashboardData.videoStats.totalWatchTimeMinutes)}
              </div>
              <div style={{ fontSize: 11, color: "var(--muted)" }}>Watch Minutes</div>
            </div>
            <div style={{ textAlign: "center", padding: 16, background: "var(--surface-alt)", borderRadius: "var(--radius-md)" }}>
              <div style={{ fontSize: 24, fontWeight: 700 }}>
                {trainingData.videoStats.completedVideos}
              </div>
              <div style={{ fontSize: 11, color: "var(--muted)" }}>Completed</div>
            </div>
          </div>
        </div>
      </div>

      {/* Chapter Stats */}
      <div className="card" style={{ marginTop: 24 }}>
        <div className="section-title">Chapter Statistics</div>
        <table className="table">
          <thead>
            <tr>
              <th>Chapter</th>
              <th>Location</th>
              <th>Members</th>
              <th>Courses</th>
              <th>Events</th>
            </tr>
          </thead>
          <tbody>
            {dashboardData.chapterStats.map(chapter => (
              <tr key={chapter.id}>
                <td><strong>{chapter.name}</strong></td>
                <td>{chapter.city || "-"}</td>
                <td>{chapter.users}</td>
                <td>{chapter.courses}</td>
                <td>{chapter.events}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Certificates */}
      <div className="grid two" style={{ marginTop: 24 }}>
        <div className="card">
          <div className="kpi">{formatNumber(dashboardData.overview.totalCertificates)}</div>
          <div className="kpi-label">Certificates Issued</div>
          <p style={{ fontSize: 12, color: "var(--muted)", marginTop: 8 }}>
            +{dashboardData.recentActivity.certificatesLast30Days} in last 30 days
          </p>
        </div>
        <div className="card">
          <div className="kpi">{formatNumber(dashboardData.overview.totalCourses)}</div>
          <div className="kpi-label">Total Courses</div>
        </div>
      </div>
    </div>
  );
}

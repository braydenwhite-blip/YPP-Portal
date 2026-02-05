import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { getStudentProgress } from "@/lib/parent-actions";
import Link from "next/link";

function getGoalPillClass(status: string | null): string {
  if (!status) return "";
  switch (status) {
    case "ON_TRACK":
      return "pill-success";
    case "BEHIND_SCHEDULE":
      return "pill-pending";
    case "ABOVE_AND_BEYOND":
      return "pill-pathway";
    case "NEEDS_ATTENTION":
      return "pill-declined";
    default:
      return "";
  }
}

function getEnrollmentPillClass(status: string): string {
  switch (status) {
    case "ENROLLED":
    case "ACTIVE":
      return "pill-success";
    case "COMPLETED":
      return "pill-pathway";
    case "DROPPED":
    case "WITHDRAWN":
      return "pill-declined";
    case "PENDING":
      return "pill-pending";
    default:
      return "";
  }
}

export default async function ParentStudentDetailPage({
  params,
}: {
  params: Promise<{ studentId: string }>;
}) {
  const { studentId } = await params;
  const session = await getServerSession(authOptions);
  const roles = session?.user?.roles ?? [];

  if (!session?.user?.id) {
    redirect("/login");
  }

  if (!roles.includes("PARENT") && !roles.includes("ADMIN")) {
    redirect("/");
  }

  const data = await getStudentProgress(studentId);

  // Compute derived stats
  const enrollmentCount = data.enrollments.length;
  const trainingPct =
    data.training.total > 0
      ? Math.round((data.training.completed / data.training.total) * 100)
      : 0;
  const certificateCount = data.certificates.length;
  const attendanceRate =
    data.attendance.totalSessions > 0
      ? Math.round(
          (data.attendance.presentCount / data.attendance.totalSessions) * 100
        )
      : 0;

  return (
    <div className="main-content">
      {/* Page Header with Back Link */}
      <div className="page-header">
        <Link
          href="/parent"
          className="back-link"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            color: "var(--muted)",
            fontSize: 13,
            fontWeight: 600,
            marginBottom: 8,
          }}
        >
          &larr; Back to Parent Dashboard
        </Link>
        <h1 className="page-title">{data.student.name}</h1>
        <div
          style={{
            display: "flex",
            gap: 10,
            alignItems: "center",
            flexWrap: "wrap",
            marginTop: 8,
          }}
        >
          <span style={{ color: "var(--muted)", fontSize: 14 }}>
            {data.student.email}
          </span>
          {data.student.primaryRole && (
            <span className="badge">
              {data.student.primaryRole.replace(/_/g, " ")}
            </span>
          )}
          {data.student.chapter && (
            <span className="badge">{data.student.chapter.name}</span>
          )}
        </div>
      </div>

      {/* Stats Row */}
      <div
        className="stats-row"
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
          gap: "1rem",
          marginBottom: "2rem",
        }}
      >
        <div className="stat-card">
          <span className="stat-label">Enrollments</span>
          <span className="stat-value">{enrollmentCount}</span>
        </div>
        <div className="stat-card">
          <span className="stat-label">Training Progress</span>
          <span className="stat-value">{trainingPct}%</span>
        </div>
        <div className="stat-card">
          <span className="stat-label">Certificates</span>
          <span className="stat-value">{certificateCount}</span>
        </div>
        <div className="stat-card">
          <span className="stat-label">Attendance Rate</span>
          <span className="stat-value">
            {data.attendance.totalSessions > 0 ? `${attendanceRate}%` : "N/A"}
          </span>
        </div>
      </div>

      {/* Detail Sections */}
      <div className="dashboard-grid">
        {/* ============================================
            ENROLLMENTS TABLE
            ============================================ */}
        <div className="card">
          <h3>Enrollments</h3>
          {data.enrollments.length === 0 ? (
            <p className="empty">No enrollments found.</p>
          ) : (
            <table className="table">
              <thead>
                <tr>
                  <th>Course</th>
                  <th>Format</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {data.enrollments.map((enrollment) => (
                  <tr key={enrollment.id}>
                    <td>{enrollment.course.title}</td>
                    <td>{enrollment.course.format}</td>
                    <td>
                      <span
                        className={`pill ${getEnrollmentPillClass(
                          enrollment.status
                        )}`}
                      >
                        {enrollment.status.replace(/_/g, " ")}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* ============================================
            GOALS WITH PROGRESS STATUS
            ============================================ */}
        <div className="card">
          <h3>Goals</h3>
          {data.goals.length === 0 ? (
            <p className="empty">No goals assigned yet.</p>
          ) : (
            <div className="enrollments-list">
              {data.goals.map((goal, index) => (
                <div
                  key={index}
                  className="enrollment-item"
                  style={{
                    flexDirection: "column",
                    alignItems: "flex-start",
                    gap: 8,
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      width: "100%",
                      alignItems: "center",
                    }}
                  >
                    <strong>{goal.title}</strong>
                    {goal.latestStatus && (
                      <span
                        className={`pill ${getGoalPillClass(
                          goal.latestStatus
                        )}`}
                      >
                        {goal.latestStatus.replace(/_/g, " ")}
                      </span>
                    )}
                  </div>
                  {goal.description && (
                    <p
                      style={{
                        margin: 0,
                        fontSize: 13,
                        color: "var(--muted)",
                        lineHeight: 1.5,
                      }}
                    >
                      {goal.description}
                    </p>
                  )}
                  {goal.latestComments && (
                    <div
                      style={{
                        width: "100%",
                        padding: 10,
                        background: "var(--surface-alt)",
                        borderRadius: "var(--radius-sm)",
                        fontSize: 13,
                      }}
                    >
                      <strong>Latest Comment:</strong> {goal.latestComments}
                    </div>
                  )}
                  {goal.lastUpdatedAt && (
                    <span style={{ fontSize: 12, color: "var(--muted)" }}>
                      Last updated:{" "}
                      {new Date(goal.lastUpdatedAt).toLocaleDateString()}
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ============================================
            CERTIFICATES LIST
            ============================================ */}
        <div className="card">
          <h3>Certificates</h3>
          {data.certificates.length === 0 ? (
            <p className="empty">No certificates earned yet.</p>
          ) : (
            <div className="enrollments-list">
              {data.certificates.map((cert) => (
                <div key={cert.id} className="enrollment-item">
                  <strong>{cert.title}</strong>
                  <span className="badge">
                    {new Date(cert.issuedAt).toLocaleDateString("en-US", {
                      year: "numeric",
                      month: "long",
                      day: "numeric",
                    })}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ============================================
            ATTENDANCE BREAKDOWN
            ============================================ */}
        <div className="card">
          <h3>Attendance Breakdown</h3>
          {data.attendance.totalSessions === 0 ? (
            <p className="empty">No attendance records found.</p>
          ) : (
            <>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(4, 1fr)",
                  gap: "1rem",
                  marginBottom: 16,
                }}
              >
                <div style={{ textAlign: "center" }}>
                  <span
                    className="stat-value"
                    style={{ fontSize: "1.5rem", color: "#166534" }}
                  >
                    {data.attendance.presentCount}
                  </span>
                  <span className="stat-label">Present</span>
                </div>
                <div style={{ textAlign: "center" }}>
                  <span
                    className="stat-value"
                    style={{ fontSize: "1.5rem", color: "#991b1b" }}
                  >
                    {data.attendance.absentCount}
                  </span>
                  <span className="stat-label">Absent</span>
                </div>
                <div style={{ textAlign: "center" }}>
                  <span
                    className="stat-value"
                    style={{ fontSize: "1.5rem", color: "#92400e" }}
                  >
                    {data.attendance.lateCount}
                  </span>
                  <span className="stat-label">Late</span>
                </div>
                <div style={{ textAlign: "center" }}>
                  <span
                    className="stat-value"
                    style={{ fontSize: "1.5rem", color: "#3730a3" }}
                  >
                    {data.attendance.excusedCount}
                  </span>
                  <span className="stat-label">Excused</span>
                </div>
              </div>
              <div
                style={{
                  padding: 12,
                  background: "var(--surface-alt)",
                  borderRadius: "var(--radius-sm)",
                  textAlign: "center",
                }}
              >
                <span style={{ fontSize: 14, color: "var(--muted)" }}>
                  Overall Attendance Rate:{" "}
                </span>
                <strong style={{ color: "var(--ypp-purple)", fontSize: 18 }}>
                  {data.attendance.totalSessions > 0
                    ? Math.round(
                        ((data.attendance.presentCount + data.attendance.lateCount) /
                          data.attendance.totalSessions) *
                          100
                      )
                    : 0}%
                </strong>
                <span
                  style={{
                    fontSize: 13,
                    color: "var(--muted)",
                    marginLeft: 8,
                  }}
                >
                  ({data.attendance.presentCount} of{" "}
                  {data.attendance.totalSessions} sessions)
                </span>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

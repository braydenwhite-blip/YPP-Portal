import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import {
  createAttendanceSession,
  getAttendanceSessions,
  getMyAttendance,
} from "@/lib/attendance-actions";

function formatDate(date: Date): string {
  return new Date(date).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function statusColor(status: string): string {
  switch (status) {
    case "PRESENT":
      return "#16a34a";
    case "ABSENT":
      return "#dc2626";
    case "LATE":
      return "#d97706";
    case "EXCUSED":
      return "#2563eb";
    default:
      return "#6b7280";
  }
}

function statusBg(status: string): string {
  switch (status) {
    case "PRESENT":
      return "#dcfce7";
    case "ABSENT":
      return "#fee2e2";
    case "LATE":
      return "#fef3c7";
    case "EXCUSED":
      return "#dbeafe";
    default:
      return "#f3f4f6";
  }
}

export default async function AttendancePage() {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    redirect("/login");
  }

  const roles = session.user.roles ?? [];
  const isStaff =
    roles.includes("ADMIN") ||
    roles.includes("INSTRUCTOR") ||
    roles.includes("CHAPTER_LEAD");

  if (isStaff) {
    return <StaffView />;
  }

  return <StudentView />;
}

/* ============================================
   STAFF VIEW: Session management
   ============================================ */

async function StaffView() {
  const sessions = await getAttendanceSessions();

  return (
    <div className="main-content">
      <div className="page-header">
        <div>
          <h1 className="page-title">Attendance</h1>
          <p style={{ margin: "4px 0 0", fontSize: 14, color: "var(--muted, #6b7280)" }}>
            Create and manage attendance sessions
          </p>
        </div>
      </div>

      {/* Create Session Form */}
      <div className="card" style={{ marginBottom: 24 }}>
        <h3 style={{ margin: "0 0 16px" }}>Create Session</h3>
        <form action={createAttendanceSession}>
          <div className="form-row" style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "flex-end" }}>
            <div className="form-group" style={{ flex: "1 1 240px" }}>
              <label
                htmlFor="title"
                style={{ display: "block", fontSize: 13, fontWeight: 600, marginBottom: 4 }}
              >
                Session Title
              </label>
              <input
                id="title"
                name="title"
                type="text"
                required
                placeholder="e.g. Week 5 Lab Session"
                style={{
                  width: "100%",
                  padding: "8px 12px",
                  borderRadius: 6,
                  border: "1px solid var(--border, #d1d5db)",
                  fontSize: 14,
                  boxSizing: "border-box",
                }}
              />
            </div>
            <div className="form-group" style={{ flex: "0 1 200px" }}>
              <label
                htmlFor="date"
                style={{ display: "block", fontSize: 13, fontWeight: 600, marginBottom: 4 }}
              >
                Date
              </label>
              <input
                id="date"
                name="date"
                type="date"
                required
                style={{
                  width: "100%",
                  padding: "8px 12px",
                  borderRadius: 6,
                  border: "1px solid var(--border, #d1d5db)",
                  fontSize: 14,
                  boxSizing: "border-box",
                }}
              />
            </div>
            <div style={{ flex: "0 0 auto", paddingBottom: 1 }}>
              <button type="submit" className="btn btn-primary">
                Create Session
              </button>
            </div>
          </div>
        </form>
      </div>

      {/* Sessions List */}
      <h3 style={{ margin: "0 0 12px", fontSize: 16, fontWeight: 600 }}>
        Sessions ({sessions.length})
      </h3>

      {sessions.length === 0 ? (
        <div className="card">
          <p className="empty">
            No attendance sessions yet. Create your first session using the form
            above to start tracking attendance.
          </p>
        </div>
      ) : (
        <div className="dashboard-grid">
          {sessions.map((s) => (
            <Link
              key={s.id}
              href={`/attendance/${s.id}`}
              style={{ textDecoration: "none", color: "inherit" }}
            >
              <div
                className="card"
                style={{
                  height: "100%",
                  transition: "box-shadow 0.15s ease",
                  cursor: "pointer",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "flex-start",
                    marginBottom: 8,
                  }}
                >
                  <h4 style={{ margin: 0, fontSize: 15, fontWeight: 600 }}>{s.title}</h4>
                  <span
                    className="badge"
                    style={{
                      fontSize: 12,
                      whiteSpace: "nowrap",
                      flexShrink: 0,
                      marginLeft: 8,
                    }}
                  >
                    {s._count.records} record{s._count.records !== 1 ? "s" : ""}
                  </span>
                </div>

                <p style={{ margin: "0 0 8px", fontSize: 13, color: "var(--muted, #6b7280)" }}>
                  {formatDate(s.date)}
                </p>

                {(s.course || s.event) && (
                  <p style={{ margin: "0 0 8px", fontSize: 13 }}>
                    {s.course && (
                      <span
                        style={{
                          display: "inline-block",
                          padding: "2px 8px",
                          borderRadius: 4,
                          backgroundColor: "var(--surface-alt, #f3f4f6)",
                          fontSize: 12,
                          marginRight: 6,
                        }}
                      >
                        Course: {s.course.title}
                      </span>
                    )}
                    {s.event && (
                      <span
                        style={{
                          display: "inline-block",
                          padding: "2px 8px",
                          borderRadius: 4,
                          backgroundColor: "var(--surface-alt, #f3f4f6)",
                          fontSize: 12,
                        }}
                      >
                        Event: {s.event.title}
                      </span>
                    )}
                  </p>
                )}

                {s.createdBy && (
                  <p style={{ margin: 0, fontSize: 12, color: "var(--muted, #9ca3af)" }}>
                    Created by {s.createdBy.name}
                  </p>
                )}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

/* ============================================
   STUDENT VIEW: My attendance records
   ============================================ */

async function StudentView() {
  const records = await getMyAttendance();

  const totalSessions = records.length;
  const presentCount = records.filter((r) => r.status === "PRESENT").length;
  const absentCount = records.filter((r) => r.status === "ABSENT").length;
  const lateCount = records.filter((r) => r.status === "LATE").length;
  const presentPct =
    totalSessions > 0
      ? Math.round(((presentCount + lateCount) / totalSessions) * 100)
      : 0;

  return (
    <div className="main-content">
      <div className="page-header">
        <div>
          <h1 className="page-title">My Attendance</h1>
          <p style={{ margin: "4px 0 0", fontSize: 14, color: "var(--muted, #6b7280)" }}>
            Your attendance history across all sessions
          </p>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="stats-row" style={{ display: "flex", gap: 16, flexWrap: "wrap", marginBottom: 24 }}>
        <div className="stat-card card" style={{ flex: "1 1 140px", textAlign: "center", padding: 16 }}>
          <div className="stat-value" style={{ fontSize: 28, fontWeight: 700, color: "var(--primary, #6b21a8)" }}>
            {totalSessions}
          </div>
          <div className="stat-label" style={{ fontSize: 13, color: "var(--muted, #6b7280)", marginTop: 4 }}>
            Total Sessions
          </div>
        </div>
        <div className="stat-card card" style={{ flex: "1 1 140px", textAlign: "center", padding: 16 }}>
          <div className="stat-value" style={{ fontSize: 28, fontWeight: 700, color: "#16a34a" }}>
            {presentPct}%
          </div>
          <div className="stat-label" style={{ fontSize: 13, color: "var(--muted, #6b7280)", marginTop: 4 }}>
            Present Rate
          </div>
        </div>
        <div className="stat-card card" style={{ flex: "1 1 140px", textAlign: "center", padding: 16 }}>
          <div className="stat-value" style={{ fontSize: 28, fontWeight: 700, color: "#dc2626" }}>
            {absentCount}
          </div>
          <div className="stat-label" style={{ fontSize: 13, color: "var(--muted, #6b7280)", marginTop: 4 }}>
            Absences
          </div>
        </div>
      </div>

      {/* Attendance Records */}
      {records.length === 0 ? (
        <div className="card">
          <p className="empty">
            No attendance records found. Your attendance will appear here once
            instructors begin recording sessions.
          </p>
        </div>
      ) : (
        <div>
          {records.map((record) => (
            <div
              key={record.id}
              className="card"
              style={{
                marginBottom: 12,
                borderLeft: `4px solid ${statusColor(record.status)}`,
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  flexWrap: "wrap",
                  gap: 8,
                }}
              >
                <div>
                  <h4 style={{ margin: "0 0 4px", fontSize: 15, fontWeight: 600 }}>
                    {record.session.title}
                  </h4>
                  <p style={{ margin: 0, fontSize: 13, color: "var(--muted, #6b7280)" }}>
                    {formatDate(record.session.date)}
                    {record.session.course && ` \u00B7 ${record.session.course.title}`}
                    {record.session.event && ` \u00B7 ${record.session.event.title}`}
                  </p>
                </div>
                <span
                  className="badge"
                  style={{
                    padding: "4px 12px",
                    borderRadius: 12,
                    fontSize: 12,
                    fontWeight: 600,
                    color: statusColor(record.status),
                    backgroundColor: statusBg(record.status),
                  }}
                >
                  {record.status}
                </span>
              </div>
              {record.notes && (
                <p style={{ margin: "8px 0 0", fontSize: 13, color: "var(--muted, #6b7280)" }}>
                  Note: {record.notes}
                </p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

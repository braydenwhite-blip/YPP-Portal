import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { getStudentProgress } from "@/lib/parent-actions";
import { prisma } from "@/lib/prisma";
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

function getGoalStatusLabel(status: string): string {
  switch (status) {
    case "ON_TRACK":
      return "Meeting expectations — your child is progressing as planned.";
    case "BEHIND_SCHEDULE":
      return "Behind schedule — progress is slower than expected. Consider talking to their instructor.";
    case "ABOVE_AND_BEYOND":
      return "Above & beyond — your child is exceeding expectations. Great work!";
    case "NEEDS_ATTENTION":
      return "Needs attention — instructor flagged this goal as requiring support.";
    default:
      return status.replace(/_/g, " ");
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

function getAttendanceColor(rate: number): string {
  if (rate >= 80) return "#16a34a";
  if (rate >= 60) return "#d97706";
  return "#dc2626";
}

function getBarColor(rate: number): string {
  if (rate >= 80) return "#16a34a";
  if (rate >= 60) return "#d97706";
  return "#dc2626";
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

  // Fetch upcoming class sessions for this student
  const upcomingSessions = await prisma.classSession.findMany({
    where: {
      date: { gt: new Date() },
      isCancelled: false,
      offering: {
        enrollments: {
          some: { studentId, status: { not: "DROPPED" } },
        },
      },
    },
    include: {
      offering: { select: { title: true } },
    },
    orderBy: { date: "asc" },
    take: 5,
  }).catch(() => []);

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
          ((data.attendance.presentCount + data.attendance.lateCount) /
            data.attendance.totalSessions) *
            100
        )
      : 0;
  const activeChallengeCount = data.challenge?.activeCount ?? 0;
  const bestChallengeStreak = data.challenge?.bestStreak ?? 0;
  const incubatorProjectCount = data.incubator?.activeProjectCount ?? 0;
  const incubatorPhase = data.incubator?.latestProject?.currentPhase
    ? String(data.incubator.latestProject.currentPhase).replace(/_/g, " ")
    : "Not started";

  const maxTrendTotal = Math.max(
    ...data.attendanceTrend.map((w) => w.total),
    1
  );

  return (
    <div className="main-content">
      {/* Page Header */}
      <div className="page-header">
        <Link
          href="/parent"
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
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            flexWrap: "wrap",
            gap: 12,
          }}
        >
          <div>
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
          <Link
            href={`/parent/${studentId}/messages`}
            className="button small"
            style={{ flexShrink: 0 }}
          >
            ✉ Message Instructor
          </Link>
        </div>
      </div>

      {/* Attendance context note */}
      {data.attendance.totalSessions > 0 && (
        <div
          style={{
            padding: "10px 14px",
            borderRadius: "var(--radius-sm)",
            marginBottom: 16,
            fontSize: 13,
            background:
              attendanceRate >= 80
                ? "#f0fdf4"
                : attendanceRate >= 60
                ? "#fffbeb"
                : "#fef2f2",
            borderLeft: `3px solid ${getAttendanceColor(attendanceRate)}`,
            color: getAttendanceColor(attendanceRate),
          }}
        >
          <strong>Attendance:</strong>{" "}
          {data.student.name.split(" ")[0]} is at{" "}
          <strong>{attendanceRate}%</strong> this period.{" "}
          {attendanceRate >= 80
            ? "Strong attendance — keep it up!"
            : attendanceRate >= 60
            ? "Below the 80% target. Consider discussing attendance with their instructor."
            : "Attendance needs attention. Please reach out to the instructor."}
        </div>
      )}

      {/* Stats Row */}
      <div
        className="stats-row"
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
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
        <div
          className="stat-card"
          style={
            data.attendance.totalSessions > 0 && attendanceRate < 80
              ? { borderColor: "#fcd34d" }
              : {}
          }
        >
          <span className="stat-label">Attendance Rate</span>
          <span
            className="stat-value"
            style={
              data.attendance.totalSessions > 0
                ? { color: getAttendanceColor(attendanceRate) }
                : {}
            }
          >
            {data.attendance.totalSessions > 0 ? `${attendanceRate}%` : "N/A"}
          </span>
        </div>
        <div className="stat-card">
          <span className="stat-label">Active Challenges</span>
          <span className="stat-value">{activeChallengeCount}</span>
        </div>
        <div className="stat-card">
          <span className="stat-label">Incubator Projects</span>
          <span className="stat-value">{incubatorProjectCount}</span>
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
            <p className="empty">
              No enrollments yet. Use &ldquo;Browse Classes&rdquo; on the dashboard to
              enroll your child in an upcoming class.
            </p>
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
            UPCOMING SCHEDULE
            ============================================ */}
        <div className="card">
          <h3>Upcoming Schedule</h3>
          {upcomingSessions.length === 0 ? (
            <p className="empty">No upcoming sessions scheduled.</p>
          ) : (
            <div className="enrollments-list">
              {upcomingSessions.map((session) => (
                <div
                  key={session.id}
                  className="enrollment-item"
                  style={{ flexDirection: "column", alignItems: "flex-start", gap: 2 }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", width: "100%" }}>
                    <strong style={{ fontSize: 13 }}>{session.topic}</strong>
                    <span className="badge" style={{ fontSize: 11 }}>
                      {new Date(session.date).toLocaleDateString("en-US", {
                        weekday: "short",
                        month: "short",
                        day: "numeric",
                      })}
                    </span>
                  </div>
                  <div style={{ fontSize: 12, color: "var(--muted)" }}>
                    {session.offering.title}
                    {session.startTime && ` · ${session.startTime}–${session.endTime}`}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ============================================
            GOALS WITH TRAJECTORY
            ============================================ */}
        <div className="card">
          <h3>Goals</h3>
          {/* Legend */}
          <div
            style={{
              display: "flex",
              gap: 10,
              flexWrap: "wrap",
              marginBottom: 12,
              fontSize: 11,
              color: "var(--muted)",
            }}
          >
            {[
              { label: "On Track", color: "#16a34a" },
              { label: "Above & Beyond", color: "#7c3aed" },
              { label: "Behind Schedule", color: "#d97706" },
              { label: "Needs Attention", color: "#dc2626" },
            ].map((item) => (
              <span key={item.label} style={{ display: "flex", gap: 4, alignItems: "center" }}>
                <span
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: "50%",
                    background: item.color,
                    display: "inline-block",
                  }}
                />
                {item.label}
              </span>
            ))}
          </div>

          {data.goals.length === 0 ? (
            <p className="empty">No goals assigned yet. Goals are assigned by instructors or mentors.</p>
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
                      gap: 8,
                    }}
                  >
                    <strong>{goal.title}</strong>
                    {goal.latestStatus && (
                      <span
                        className={`pill ${getGoalPillClass(goal.latestStatus)}`}
                        title={getGoalStatusLabel(goal.latestStatus)}
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

                  {/* History trajectory dots */}
                  {goal.history && goal.history.length > 1 && (
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 4,
                        flexWrap: "wrap",
                      }}
                    >
                      <span style={{ fontSize: 11, color: "var(--muted)" }}>
                        History:
                      </span>
                      {[...goal.history].reverse().slice(0, 5).map((h, i) => {
                        const dotColor =
                          h.status === "ON_TRACK"
                            ? "#16a34a"
                            : h.status === "ABOVE_AND_BEYOND"
                            ? "#7c3aed"
                            : h.status === "BEHIND_SCHEDULE"
                            ? "#d97706"
                            : h.status === "GETTING_STARTED"
                            ? "#eab308"
                            : "#9ca3af";
                        return (
                          <span
                            key={i}
                            title={`${h.status.replace(/_/g, " ")} — ${new Date(h.createdAt).toLocaleDateString()}`}
                            style={{
                              width: 10,
                              height: 10,
                              borderRadius: "50%",
                              background: dotColor,
                              display: "inline-block",
                              cursor: "default",
                            }}
                          />
                        );
                      })}
                      <span style={{ fontSize: 10, color: "var(--muted)" }}>
                        (oldest → newest, hover for details)
                      </span>
                    </div>
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
                      <strong>Instructor comment:</strong> {goal.latestComments}
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
            <p className="empty">
              No certificates earned yet. Certificates are awarded when your
              child completes a course pathway or achieves a program milestone.
            </p>
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
                <strong
                  style={{
                    color: getAttendanceColor(attendanceRate),
                    fontSize: 18,
                  }}
                >
                  {data.attendance.totalSessions > 0 ? `${attendanceRate}%` : "0%"}
                </strong>
                <span
                  style={{
                    fontSize: 13,
                    color: "var(--muted)",
                    marginLeft: 8,
                  }}
                >
                  ({data.attendance.presentCount + data.attendance.lateCount} of{" "}
                  {data.attendance.totalSessions} sessions)
                </span>
              </div>
              <div style={{ marginTop: 8, fontSize: 12, color: "var(--muted)" }}>
                80%+ is considered strong attendance. Late arrivals count as present in this calculation.
              </div>
            </>
          )}
        </div>

        {/* ============================================
            ATTENDANCE TREND (8-WEEK)
            ============================================ */}
        <div className="card">
          <h3>Attendance Trend</h3>
          <p style={{ fontSize: 12, color: "var(--muted)", margin: "0 0 16px" }}>
            Weekly attendance over the last 8 weeks
          </p>
          {data.attendanceTrend.every((w) => w.total === 0) ? (
            <p className="empty">Not enough session data to show a trend yet.</p>
          ) : (
            <div
              style={{
                display: "flex",
                alignItems: "flex-end",
                gap: 6,
                height: 80,
              }}
            >
              {data.attendanceTrend.map((week, i) => {
                const rate =
                  week.total > 0
                    ? Math.round((week.present / week.total) * 100)
                    : null;
                const barHeight =
                  week.total === 0
                    ? 4
                    : Math.max(4, Math.round((week.present / maxTrendTotal) * 72));
                const color =
                  rate === null
                    ? "#e5e7eb"
                    : getBarColor(rate);
                return (
                  <div
                    key={i}
                    style={{
                      flex: 1,
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      gap: 4,
                    }}
                    title={
                      week.total === 0
                        ? `Week of ${week.week}: No sessions`
                        : `Week of ${week.week}: ${week.present}/${week.total} sessions (${rate}%)`
                    }
                  >
                    <div
                      style={{
                        width: "100%",
                        height: barHeight,
                        background: color,
                        borderRadius: 3,
                        transition: "height 0.3s",
                      }}
                    />
                    <span
                      style={{
                        fontSize: 9,
                        color: "var(--muted)",
                        textAlign: "center",
                        lineHeight: 1.2,
                      }}
                    >
                      {week.week.split(" ")[1]}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
          <div style={{ display: "flex", gap: 12, marginTop: 10, fontSize: 11 }}>
            {[
              { color: "#16a34a", label: "≥80%" },
              { color: "#d97706", label: "60–79%" },
              { color: "#dc2626", label: "<60%" },
              { color: "#e5e7eb", label: "No sessions" },
            ].map((item) => (
              <span
                key={item.label}
                style={{ display: "flex", gap: 4, alignItems: "center", color: "var(--muted)" }}
              >
                <span
                  style={{
                    width: 10,
                    height: 10,
                    background: item.color,
                    borderRadius: 2,
                    display: "inline-block",
                  }}
                />
                {item.label}
              </span>
            ))}
          </div>
        </div>

        {/* ============================================
            PASSION & SKILL MAP
            ============================================ */}
        {data.passions && data.passions.length > 0 && (
          <div className="card">
            <h3>Passion & Skill Areas</h3>
            <p style={{ fontSize: 12, color: "var(--muted)", margin: "0 0 14px" }}>
              Areas your child is actively exploring in the YPP program
            </p>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))",
                gap: 10,
              }}
            >
              {data.passions.map((passion, i) => {
                const xpForNextLevel = passion.level * 100;
                const xpPct = Math.min(
                  100,
                  Math.round((passion.xpPoints % xpForNextLevel) / xpForNextLevel * 100)
                );
                return (
                  <div
                    key={i}
                    style={{
                      padding: 12,
                      borderRadius: "var(--radius-sm)",
                      border: passion.isPrimary
                        ? `2px solid ${passion.color ?? "var(--ypp-purple)"}`
                        : "1px solid var(--border)",
                      background: "var(--surface-alt)",
                      position: "relative",
                    }}
                  >
                    {passion.isPrimary && (
                      <span
                        style={{
                          position: "absolute",
                          top: -8,
                          right: 8,
                          background: passion.color ?? "var(--ypp-purple)",
                          color: "#fff",
                          fontSize: 9,
                          fontWeight: 700,
                          padding: "2px 6px",
                          borderRadius: 8,
                        }}
                      >
                        PRIMARY
                      </span>
                    )}
                    <div style={{ fontSize: 20, marginBottom: 4 }}>
                      {passion.icon ?? "🌟"}
                    </div>
                    <div
                      style={{
                        fontWeight: 600,
                        fontSize: 13,
                        marginBottom: 4,
                        lineHeight: 1.3,
                      }}
                    >
                      {passion.name}
                    </div>
                    <div style={{ fontSize: 11, color: "var(--muted)", marginBottom: 8 }}>
                      {passion.category.replace(/_/g, " ")} · Level {passion.level}
                    </div>
                    {/* XP bar */}
                    <div
                      style={{
                        height: 4,
                        background: "var(--border)",
                        borderRadius: 2,
                        overflow: "hidden",
                      }}
                    >
                      <div
                        style={{
                          height: "100%",
                          width: `${xpPct}%`,
                          background: passion.color ?? "var(--ypp-purple)",
                          borderRadius: 2,
                          transition: "width 0.3s",
                        }}
                      />
                    </div>
                    <div
                      style={{
                        fontSize: 10,
                        color: "var(--muted)",
                        marginTop: 3,
                      }}
                    >
                      {passion.xpPoints} XP total
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <div className="card">
          <h3>Challenge Momentum</h3>
          <div style={{ display: "grid", gap: 10 }}>
            <div style={{ fontSize: 14 }}>
              <strong>Best Streak:</strong> {bestChallengeStreak} day(s)
            </div>
            {data.challenge?.lastCheckInAt ? (
              <div style={{ fontSize: 13, color: "var(--muted)" }}>
                Last check-in:{" "}
                {new Date(data.challenge.lastCheckInAt).toLocaleDateString()}
              </div>
            ) : (
              <div style={{ fontSize: 13, color: "var(--muted)" }}>
                No challenge check-ins yet.
              </div>
            )}
            {data.challenge?.activeChallenges?.length > 0 ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {data.challenge.activeChallenges.map((challenge) => (
                  <div
                    key={challenge.id}
                    style={{
                      padding: 10,
                      borderRadius: "var(--radius-sm)",
                      background: "var(--surface-alt)",
                      fontSize: 13,
                    }}
                  >
                    <div style={{ fontWeight: 600 }}>{challenge.title}</div>
                    <div style={{ color: "var(--muted)", fontSize: 12 }}>
                      {challenge.type.replace(/_/g, " ")} ·{" "}
                      {challenge.currentStreak} day streak
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ fontSize: 13, color: "var(--muted)" }}>
                No active challenges right now.
              </div>
            )}
          </div>
        </div>

        <div className="card">
          <h3>Incubator Snapshot</h3>
          {data.incubator?.latestProject ? (
            <div style={{ display: "grid", gap: 8 }}>
              <div style={{ fontSize: 14, fontWeight: 600 }}>
                {data.incubator.latestProject.title}
              </div>
              <div style={{ fontSize: 13, color: "var(--muted)" }}>
                Current phase: {incubatorPhase}
              </div>
              <div style={{ fontSize: 13, color: "var(--muted)" }}>
                Last updated:{" "}
                {new Date(
                  data.incubator.latestProject.updatedAt
                ).toLocaleDateString()}
              </div>
              {data.incubator.latestUpdate ? (
                <div style={{ fontSize: 13 }}>
                  Latest note:{" "}
                  <strong>{data.incubator.latestUpdate.title}</strong> (
                  {new Date(
                    data.incubator.latestUpdate.createdAt
                  ).toLocaleDateString()}
                  )
                </div>
              ) : (
                <div style={{ fontSize: 13, color: "var(--muted)" }}>
                  No incubator updates posted yet.
                </div>
              )}
            </div>
          ) : (
            <p className="empty">
              No incubator project activity yet. The Incubator is where students
              develop their own passion-driven projects with mentor support.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

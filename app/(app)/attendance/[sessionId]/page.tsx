import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth-supabase";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import {
  getSessionWithRecords,
  recordAttendance,
} from "@/lib/attendance-actions";
import {
  AttendanceRollCall,
  type RollCallStudent,
} from "@/components/instructor/attendance-roll-call";

function formatDate(date: Date): string {
  return new Date(date).toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

export default async function SessionDetailPage({
  params,
}: {
  params: Promise<{ sessionId: string }>;
}) {
  const { sessionId } = await params;
  const session = await getSession();

  if (!session?.user?.id) {
    redirect("/login");
  }

  const roles = session.user.roles ?? [];
  if (
    session.user.primaryRole === "INSTRUCTOR" ||
    (roles.includes("INSTRUCTOR") && !roles.includes("ADMIN") && !roles.includes("CHAPTER_PRESIDENT"))
  ) {
    redirect("/instructor/classes");
  }
  const isStaff =
    roles.includes("ADMIN") ||
    roles.includes("INSTRUCTOR") ||
    roles.includes("CHAPTER_PRESIDENT");

  let attendanceSession;
  try {
    attendanceSession = await getSessionWithRecords(sessionId);
  } catch {
    redirect("/attendance");
  }

  // For the "Add Student" section, look up users who are not already in this
  // session. When the session is tied to a course, scope the picker to that
  // course's roster instead of every student on the platform.
  let availableStudents: { id: string; name: string; email: string }[] = [];
  if (isStaff) {
    const existingUserIds = attendanceSession.records.map((r) => r.user.id);
    const excludeIds = existingUserIds.length > 0 ? existingUserIds : ["__none__"];
    if (attendanceSession.courseId) {
      const enrollments = await prisma.enrollment.findMany({
        where: {
          courseId: attendanceSession.courseId,
          status: "ENROLLED",
          userId: { notIn: excludeIds },
        },
        select: { user: { select: { id: true, name: true, email: true } } },
        orderBy: { user: { name: "asc" } },
      });
      availableStudents = enrollments.map((e) => e.user);
    } else {
      availableStudents = await prisma.user.findMany({
        where: {
          id: { notIn: excludeIds },
          roles: { some: { role: "STUDENT" } },
        },
        select: { id: true, name: true, email: true },
        orderBy: { name: "asc" },
        take: 100,
      });
    }
  }

  // Summary counts
  const totalRecords = attendanceSession.records.length;
  const presentCount = attendanceSession.records.filter((r) => r.status === "PRESENT").length;
  const absentCount = attendanceSession.records.filter((r) => r.status === "ABSENT").length;
  const lateCount = attendanceSession.records.filter((r) => r.status === "LATE").length;
  const excusedCount = attendanceSession.records.filter((r) => r.status === "EXCUSED").length;

  const rollCallStudents: RollCallStudent[] = attendanceSession.records.map((record) => ({
    userId: record.user.id,
    name: record.user.name,
    email: record.user.email,
    status: record.status,
    notes: record.notes ?? "",
  }));
  const rollCallKey = rollCallStudents.map((s) => s.userId).join("-");

  return (
    <div className="main-content">
      {/* Back Link */}
      <Link
        href="/attendance"
        className="back-link"
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
          color: "var(--muted, #6b7280)",
          fontSize: 13,
          fontWeight: 600,
          marginBottom: 8,
          textDecoration: "none",
        }}
      >
        &larr; Back to Attendance
      </Link>

      {/* Session Header */}
      <div className="page-header" style={{ marginBottom: 24 }}>
        <h1 className="page-title">{attendanceSession.title}</h1>
        <div
          style={{
            display: "flex",
            gap: 12,
            flexWrap: "wrap",
            alignItems: "center",
            marginTop: 8,
          }}
        >
          <span style={{ fontSize: 14, color: "var(--muted, #6b7280)" }}>
            {formatDate(attendanceSession.date)}
          </span>
          {attendanceSession.course && (
            <span
              className="badge"
              style={{
                padding: "2px 10px",
                fontSize: 12,
              }}
            >
              Course: {attendanceSession.course.title}
            </span>
          )}
          {attendanceSession.event && (
            <span
              className="badge"
              style={{
                padding: "2px 10px",
                fontSize: 12,
              }}
            >
              Event: {attendanceSession.event.title}
            </span>
          )}
          {attendanceSession.createdBy && (
            <span style={{ fontSize: 13, color: "var(--muted, #9ca3af)" }}>
              Created by {attendanceSession.createdBy.name}
            </span>
          )}
        </div>
      </div>

      {/* Stats Row */}
      <div className="stats-row" style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 24 }}>
        <div className="stat-card card" style={{ flex: "1 1 100px", textAlign: "center", padding: 12 }}>
          <div className="stat-value" style={{ fontSize: 22, fontWeight: 700, color: "var(--primary, #6b21a8)" }}>
            {totalRecords}
          </div>
          <div className="stat-label" style={{ fontSize: 12, color: "var(--muted, #6b7280)" }}>
            Total
          </div>
        </div>
        <div className="stat-card card" style={{ flex: "1 1 100px", textAlign: "center", padding: 12 }}>
          <div className="stat-value" style={{ fontSize: 22, fontWeight: 700, color: "#16a34a" }}>
            {presentCount}
          </div>
          <div className="stat-label" style={{ fontSize: 12, color: "var(--muted, #6b7280)" }}>
            Present
          </div>
        </div>
        <div className="stat-card card" style={{ flex: "1 1 100px", textAlign: "center", padding: 12 }}>
          <div className="stat-value" style={{ fontSize: 22, fontWeight: 700, color: "#dc2626" }}>
            {absentCount}
          </div>
          <div className="stat-label" style={{ fontSize: 12, color: "var(--muted, #6b7280)" }}>
            Absent
          </div>
        </div>
        <div className="stat-card card" style={{ flex: "1 1 100px", textAlign: "center", padding: 12 }}>
          <div className="stat-value" style={{ fontSize: 22, fontWeight: 700, color: "#d97706" }}>
            {lateCount}
          </div>
          <div className="stat-label" style={{ fontSize: 12, color: "var(--muted, #6b7280)" }}>
            Late
          </div>
        </div>
        <div className="stat-card card" style={{ flex: "1 1 100px", textAlign: "center", padding: 12 }}>
          <div className="stat-value" style={{ fontSize: 22, fontWeight: 700, color: "#2563eb" }}>
            {excusedCount}
          </div>
          <div className="stat-label" style={{ fontSize: 12, color: "var(--muted, #6b7280)" }}>
            Excused
          </div>
        </div>
      </div>

      {/* Roll Call */}
      <div className="card" style={{ marginBottom: 24 }}>
        <h3 style={{ margin: "0 0 16px", fontSize: 16, fontWeight: 600 }}>
          Roll Call ({totalRecords} student{totalRecords !== 1 ? "s" : ""})
        </h3>

        {rollCallStudents.length === 0 ? (
          <div className="empty-state" style={{ padding: "26px 16px" }}>
            <span className="empty-state-icon" aria-hidden="true">{"\ud83d\udccb"}</span>
            <p className="empty-state-title">No students on this session yet</p>
            <p className="empty-state-text">
              Add students with the form below \u2014 then mark everyone&apos;s
              attendance in one place and save the whole class at once.
            </p>
          </div>
        ) : (
          <AttendanceRollCall
            key={rollCallKey}
            sessionId={sessionId}
            initialStudents={rollCallStudents}
          />
        )}
      </div>

      {/* Add Student Section (Staff Only) */}
      {isStaff && (
        <div className="card">
          <h3 style={{ margin: "0 0 16px", fontSize: 16, fontWeight: 600 }}>
            Add Student to Session
          </h3>

          {availableStudents.length === 0 ? (
            <p className="empty">
              All enrolled students have already been added to this session, or
              no students are available.
            </p>
          ) : (
            <form action={recordAttendance}>
              <input type="hidden" name="sessionId" value={sessionId} />
              <div
                className="form-row"
                style={{
                  display: "flex",
                  gap: 12,
                  flexWrap: "wrap",
                  alignItems: "flex-end",
                }}
              >
                <div className="form-group" style={{ flex: "1 1 240px" }}>
                  <label
                    htmlFor="add-userId"
                    style={{
                      display: "block",
                      fontSize: 13,
                      fontWeight: 600,
                      marginBottom: 4,
                    }}
                  >
                    Student
                  </label>
                  <select
                    id="add-userId"
                    name="userId"
                    required
                    style={{
                      width: "100%",
                      padding: "8px 12px",
                      borderRadius: 6,
                      border: "1px solid var(--border, #d1d5db)",
                      fontSize: 14,
                      boxSizing: "border-box",
                    }}
                  >
                    <option value="">Select a student...</option>
                    {availableStudents.map((student) => (
                      <option key={student.id} value={student.id}>
                        {student.name} ({student.email})
                      </option>
                    ))}
                  </select>
                </div>
                <div className="form-group" style={{ flex: "0 1 160px" }}>
                  <label
                    htmlFor="add-status"
                    style={{
                      display: "block",
                      fontSize: 13,
                      fontWeight: 600,
                      marginBottom: 4,
                    }}
                  >
                    Status
                  </label>
                  <select
                    id="add-status"
                    name="status"
                    defaultValue="PRESENT"
                    style={{
                      width: "100%",
                      padding: "8px 12px",
                      borderRadius: 6,
                      border: "1px solid var(--border, #d1d5db)",
                      fontSize: 14,
                      boxSizing: "border-box",
                    }}
                  >
                    <option value="PRESENT">Present</option>
                    <option value="ABSENT">Absent</option>
                    <option value="LATE">Late</option>
                    <option value="EXCUSED">Excused</option>
                  </select>
                </div>
                <div className="form-group" style={{ flex: "1 1 180px" }}>
                  <label
                    htmlFor="add-notes"
                    style={{
                      display: "block",
                      fontSize: 13,
                      fontWeight: 600,
                      marginBottom: 4,
                    }}
                  >
                    Notes (optional)
                  </label>
                  <input
                    id="add-notes"
                    name="notes"
                    type="text"
                    placeholder="Optional notes..."
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
                    Add Student
                  </button>
                </div>
              </div>
            </form>
          )}
        </div>
      )}
    </div>
  );
}

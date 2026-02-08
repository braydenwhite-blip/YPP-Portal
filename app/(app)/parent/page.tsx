import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import {
  getLinkedStudents,
  getStudentProgress,
  linkStudent,
  unlinkStudent,
} from "@/lib/parent-actions";
import ParentEnroll from "@/components/parent-enroll";

export default async function ParentPortalPage() {
  const session = await getServerSession(authOptions);
  const roles = session?.user?.roles ?? [];

  if (!session?.user?.id) {
    redirect("/login");
  }

  if (!roles.includes("PARENT") && !roles.includes("ADMIN")) {
    redirect("/");
  }

  // Fetch all linked students and available courses
  const [linkedStudents, allCourses] = await Promise.all([
    getLinkedStudents(),
    prisma.course.findMany({
      select: { id: true, title: true, format: true, level: true },
      orderBy: { title: "asc" },
    }),
  ]);

  // Fetch progress data for each linked student in parallel
  const progressData = await Promise.all(
    linkedStudents.map(async (student) => {
      try {
        const progress = await getStudentProgress(student.studentId);
        return { studentId: student.studentId, progress };
      } catch {
        return { studentId: student.studentId, progress: null };
      }
    })
  );

  // Build a lookup map for easy access
  const progressMap = new Map(
    progressData.map((p) => [p.studentId, p.progress])
  );

  return (
    <div className="main-content">
      <div className="topbar">
        <div>
          <p className="badge">Parent Portal</p>
          <h1 className="page-title">Parent Dashboard</h1>
        </div>
      </div>

      <div className="page-header">
        <p className="subtitle">
          Monitor your children&apos;s progress, enrollments, and achievements
          across the Young People&apos;s Project.
        </p>
      </div>

      {/* ============================================
          LINK A NEW STUDENT
          ============================================ */}
      <div className="card">
        <h3>Link a Student</h3>
        <p>
          Enter your child&apos;s email address to link their account. They must
          already be registered as a student in the system.
        </p>
        <form action={linkStudent} className="form-grid">
          <div className="form-row">
            <label>Student Email</label>
            <input
              className="input"
              name="email"
              type="email"
              placeholder="student@example.com"
              required
            />
          </div>
          <div className="form-row">
            <label>Relationship</label>
            <select className="input" name="relationship" defaultValue="Parent">
              <option value="Parent">Parent</option>
              <option value="Guardian">Guardian</option>
              <option value="Grandparent">Grandparent</option>
              <option value="Other">Other</option>
            </select>
          </div>
          <button type="submit" className="button">
            Link Student
          </button>
        </form>
      </div>

      {/* ============================================
          LINKED STUDENTS
          ============================================ */}
      {linkedStudents.length === 0 ? (
        <div className="card">
          <p className="empty">
            No students are linked to your account yet. Use the form above to
            link your child&apos;s student account by their email address.
          </p>
        </div>
      ) : (
        <>
          <div className="section-title" style={{ marginTop: 24, marginBottom: 16 }}>
            Linked Students ({linkedStudents.length})
          </div>

          {linkedStudents.map((student) => {
            const progress = progressMap.get(student.studentId);

            // Compute summary stats
            const enrollmentCount = progress?.enrollments?.length ?? 0;
            const activeEnrollments =
              progress?.enrollments?.filter((e) => e.status === "ENROLLED")
                .length ?? 0;
            const trainingTotal = progress?.training?.total ?? 0;
            const trainingCompleted = progress?.training?.completed ?? 0;
            const trainingPct =
              trainingTotal > 0
                ? Math.round((trainingCompleted / trainingTotal) * 100)
                : 0;
            const certificateCount = progress?.certificates?.length ?? 0;
            const attendanceTotal = progress?.attendance?.totalSessions ?? 0;
            const attendancePresent = progress?.attendance?.presentCount ?? 0;
            const attendanceRate =
              attendanceTotal > 0
                ? Math.round((attendancePresent / attendanceTotal) * 100)
                : 0;

            return (
              <div key={student.id} className="card" style={{ marginBottom: 16 }}>
                {/* Student Header */}
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "flex-start",
                    marginBottom: 16,
                  }}
                >
                  <div>
                    <h3 style={{ margin: 0 }}>{student.name}</h3>
                    <p style={{ margin: "4px 0 0", fontSize: 13, color: "var(--muted)" }}>
                      {student.email}
                    </p>
                    <div style={{ display: "flex", gap: 12, marginTop: 8, flexWrap: "wrap" }}>
                      {student.chapter && (
                        <span className="pill">
                          {student.chapter.name}
                        </span>
                      )}
                      <span className="pill pill-pathway">
                        {student.relationship}
                      </span>
                      {student.grade && (
                        <span className="pill pill-pending">
                          Grade {student.grade}
                        </span>
                      )}
                      {student.school && (
                        <span className="pill">
                          {student.school}
                        </span>
                      )}
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    <Link href={`/parent/${student.studentId}`} className="button small">
                      View Details
                    </Link>
                    <form action={unlinkStudent} style={{ margin: 0 }}>
                      <input type="hidden" name="id" value={student.id} />
                      <button type="submit" className="button small secondary">
                        Unlink
                      </button>
                    </form>
                  </div>
                </div>

                {/* Stats Grid */}
                <div className="stats-grid">
                  <div className="stat-card">
                    <span className="stat-label">Enrollments</span>
                    <span className="stat-value">{enrollmentCount}</span>
                    <span className="stat-link">
                      {activeEnrollments} active
                    </span>
                  </div>
                  <div className="stat-card">
                    <span className="stat-label">Training Progress</span>
                    <span className="stat-value">{trainingPct}%</span>
                    <span className="stat-link">
                      {trainingCompleted}/{trainingTotal} complete
                    </span>
                  </div>
                  <div className="stat-card">
                    <span className="stat-label">Certificates</span>
                    <span className="stat-value">{certificateCount}</span>
                    <span className="stat-link">earned</span>
                  </div>
                  <div className="stat-card">
                    <span className="stat-label">Attendance Rate</span>
                    <span className="stat-value">
                      {attendanceTotal > 0 ? `${attendanceRate}%` : "N/A"}
                    </span>
                    <span className="stat-link">
                      {attendancePresent}/{attendanceTotal} sessions
                    </span>
                  </div>
                </div>

                {/* Goals Summary (if available) */}
                {progress?.goals && progress.goals.length > 0 && (
                  <div style={{ marginTop: 12 }}>
                    <div className="section-title" style={{ fontSize: 13, marginBottom: 8 }}>
                      Active Goals
                    </div>
                    <div className="enrollments-list">
                      {progress.goals.map((goal) => (
                        <div key={goal.id} className="enrollment-item">
                          <div>
                            <strong>{goal.title}</strong>
                            {goal.description && (
                              <p style={{ margin: "2px 0 0", fontSize: 12, color: "var(--muted)" }}>
                                {goal.description}
                              </p>
                            )}
                          </div>
                          {goal.latestStatus && (
                            <span
                              className={`pill ${
                                goal.latestStatus === "ON_TRACK"
                                  ? "pill-success"
                                  : goal.latestStatus === "BEHIND_SCHEDULE"
                                  ? "pill-pending"
                                  : goal.latestStatus === "ABOVE_AND_BEYOND"
                                  ? "pill-pathway"
                                  : ""
                              }`}
                            >
                              {goal.latestStatus.replace(/_/g, " ")}
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Recent Certificates (if available) */}
                {progress?.certificates && progress.certificates.length > 0 && (
                  <div style={{ marginTop: 12 }}>
                    <div className="section-title" style={{ fontSize: 13, marginBottom: 8 }}>
                      Recent Certificates
                    </div>
                    <div className="enrollments-list">
                      {progress.certificates.slice(0, 3).map((cert) => (
                        <div key={cert.id} className="enrollment-item">
                          <strong>{cert.title}</strong>
                          <span style={{ fontSize: 12, color: "var(--muted)" }}>
                            {new Date(cert.issuedAt).toLocaleDateString()}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Enroll in Course */}
                {student.isPrimary && (
                  <ParentEnroll
                    studentId={student.studentId}
                    studentName={student.name}
                    courses={allCourses}
                    enrolledCourseIds={
                      progress?.enrollments?.map((e) => e.course.id) ?? []
                    }
                  />
                )}
              </div>
            );
          })}
        </>
      )}
    </div>
  );
}

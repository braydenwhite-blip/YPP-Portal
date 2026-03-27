import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth-supabase";
import Link from "next/link";
import {
  getLinkedStudents,
  getStudentProgress,
  linkStudent,
  unlinkStudent,
  getAvailableClassOfferings,
} from "@/lib/parent-actions";
import { getParentStudentIntakeCases } from "@/lib/student-intake-actions";
import { getStudentIntakeStatusMeta } from "@/lib/student-intake-shared";
import ParentEnrollOffering from "@/components/parent-enroll-offering";

export default async function ParentPortalPage() {
  const session = await getSession();
  const roles = session?.user?.roles ?? [];

  if (!session?.user?.id) {
    redirect("/login");
  }

  if (!roles.includes("PARENT") && !roles.includes("ADMIN")) {
    redirect("/");
  }

  // Fetch all linked students
  const linkedStudents = await getLinkedStudents();
  const intakeCases = await getParentStudentIntakeCases();

  // Fetch progress + available offerings for each linked student in parallel
  const [progressData, offeringsData] = await Promise.all([
    Promise.all(
      linkedStudents.map(async (student) => {
        try {
          const progress = await getStudentProgress(student.studentId);
          return { studentId: student.studentId, progress };
        } catch {
          return { studentId: student.studentId, progress: null };
        }
      })
    ),
    Promise.all(
      linkedStudents.map(async (student) => {
        try {
          const offerings = await getAvailableClassOfferings(student.studentId);
          return { studentId: student.studentId, offerings };
        } catch {
          return { studentId: student.studentId, offerings: [] };
        }
      })
    ),
  ]);

  const progressMap = new Map(progressData.map((p) => [p.studentId, p.progress]));
  const offeringsMap = new Map(offeringsData.map((o) => [o.studentId, o.offerings]));

  return (
    <div className="main-content">
      <div className="topbar">
        <div>
          <p className="badge">Parent Portal</p>
          <h1 className="page-title">Parent Dashboard</h1>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <Link href="/parent/student-intake/new" className="button small">
            Start Student Journey
          </Link>
          <Link href="/parent/messages" className="button small secondary">
            ✉ Messages
          </Link>
        </div>
      </div>

      <div className="page-header">
        <p className="subtitle">
          Monitor your children&apos;s progress, enrollments, and achievements
          across the Young People&apos;s Project.
        </p>
      </div>

      {/* ============================================
          ONBOARDING EMPTY STATE
          ============================================ */}
      {linkedStudents.length === 0 ? (
        <div className="card" style={{ marginBottom: 24 }}>
          <h3 style={{ margin: "0 0 16px" }}>Get Started</h3>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {[
              {
                step: "1",
                title: "Start a student journey",
                desc: "Use the new parent-led intake if your child is not in YPP yet. The chapter will review it and launch the first support plan.",
                done: false,
              },
              {
                step: "2",
                title: "Or link an existing student",
                desc: "If your child already has a YPP student account, use the email-link option lower on this page.",
                done: false,
              },
              {
                step: "3",
                title: "Track progress and next steps",
                desc: "Once the chapter approves access or intake, you can follow milestones, view progress, and enroll in classes.",
                done: false,
              },
            ].map((item) => (
              <div key={item.step} style={{ display: "flex", gap: 12 }}>
                <div
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: "50%",
                    background: "var(--ypp-purple)",
                    color: "#fff",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontWeight: 700,
                    fontSize: 13,
                    flexShrink: 0,
                    marginTop: 2,
                  }}
                >
                  {item.step}
                </div>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 14 }}>{item.title}</div>
                  <div style={{ fontSize: 13, color: "var(--text-secondary)" }}>
                    {item.desc}
                  </div>
                </div>
              </div>
            ))}
          </div>
          <div style={{ marginTop: 18, display: "flex", gap: 8, flexWrap: "wrap" }}>
            <Link href="/parent/student-intake/new" className="button">
              Start Student Journey
            </Link>
            <Link href="/parent/connect" className="button secondary">
              Manage Connections
            </Link>
          </div>
        </div>
      ) : null}

      {intakeCases.length > 0 ? (
        <div className="card" style={{ marginBottom: 24 }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
            <div>
              <h3 style={{ margin: 0 }}>Student Journey Cases</h3>
              <p style={{ margin: "6px 0 0", fontSize: 13, color: "var(--text-secondary)" }}>
                Follow each milestone from parent intake through chapter review and mentor-plan launch.
              </p>
            </div>
            <Link href="/parent/student-intake/new" className="button small">
              Start Another Journey
            </Link>
          </div>

          <div style={{ display: "grid", gap: 12, marginTop: 16 }}>
            {intakeCases.map((item) => {
              const statusMeta = getStudentIntakeStatusMeta(item.status);
              const latestMilestone = item.milestones[item.milestones.length - 1] ?? null;

              return (
                <Link
                  key={item.id}
                  href={`/parent/student-intake/${item.id}`}
                  style={{
                    textDecoration: "none",
                    color: "inherit",
                    border: "1px solid var(--border)",
                    borderRadius: "var(--radius)",
                    padding: "14px 16px",
                    background: "var(--surface-alt)",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                    <div>
                      <div style={{ fontWeight: 700 }}>{item.studentName}</div>
                      <div style={{ marginTop: 4, fontSize: 12, color: "var(--muted)" }}>
                        {item.chapter.name} · {item.studentEmail}
                      </div>
                    </div>
                    <span
                      className="pill"
                      style={{ background: statusMeta.background, color: statusMeta.color, fontSize: 12 }}
                    >
                      {statusMeta.label}
                    </span>
                  </div>

                  <div style={{ marginTop: 10, fontSize: 13, color: "var(--text-secondary)" }}>
                    {latestMilestone?.title ?? "Journey created"}
                  </div>
                  {latestMilestone?.body ? (
                    <div style={{ marginTop: 4, fontSize: 12, color: "var(--muted)" }}>
                      {latestMilestone.body}
                    </div>
                  ) : null}
                </Link>
              );
            })}
          </div>
        </div>
      ) : null}

      {/* ============================================
          ATTENDANCE ALERTS
          ============================================ */}
      {linkedStudents.map((student) => {
        const progress = progressMap.get(student.studentId);
        if (!progress) return null;
        const { totalSessions, presentCount, lateCount } = progress.attendance;
        if (totalSessions < 3) return null;
        const rate = Math.round(((presentCount + lateCount) / totalSessions) * 100);
        if (rate >= 80) return null;
        return (
          <div
            key={`alert-${student.studentId}`}
            style={{
              padding: "12px 16px",
              background: "#fffbeb",
              border: "1px solid #fcd34d",
              borderRadius: "var(--radius)",
              marginBottom: 12,
              display: "flex",
              gap: 12,
              alignItems: "center",
            }}
          >
            <span style={{ fontSize: 20 }}>⚠️</span>
            <div style={{ flex: 1 }}>
              <strong style={{ fontSize: 14, color: "#92400e" }}>
                Attendance Alert — {student.name}
              </strong>
              <p style={{ margin: "2px 0 0", fontSize: 13, color: "#78350f" }}>
                {student.name.split(" ")[0]}&apos;s attendance is at{" "}
                <strong>{rate}%</strong> this period ({presentCount + lateCount} of{" "}
                {totalSessions} sessions). 80%+ is considered strong. Consider
                reaching out to their instructor.
              </p>
            </div>
            <Link
              href={`/parent/${student.studentId}/messages`}
              className="button small"
              style={{ flexShrink: 0, fontSize: 12 }}
            >
              Message Instructor
            </Link>
          </div>
        );
      })}

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
      {linkedStudents.length > 0 && (
        <>
          <div
            className="section-title"
            style={{ marginTop: 24, marginBottom: 16 }}
          >
            Linked Students ({linkedStudents.length})
          </div>

          {linkedStudents.map((student) => {
            const progress = progressMap.get(student.studentId);
            const availableOfferings = offeringsMap.get(student.studentId) ?? [];

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
            const attendanceLate = progress?.attendance?.lateCount ?? 0;
            const attendanceRate =
              attendanceTotal > 0
                ? Math.round(
                    ((attendancePresent + attendanceLate) / attendanceTotal) * 100
                  )
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
                    <p
                      style={{
                        margin: "4px 0 0",
                        fontSize: 13,
                        color: "var(--muted)",
                      }}
                    >
                      {student.email}
                    </p>
                    <div
                      style={{
                        display: "flex",
                        gap: 12,
                        marginTop: 8,
                        flexWrap: "wrap",
                      }}
                    >
                      {student.chapter && (
                        <span className="pill">{student.chapter.name}</span>
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
                        <span className="pill">{student.school}</span>
                      )}
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                    <Link
                      href={`/parent/${student.studentId}/messages`}
                      className="button small secondary"
                    >
                      ✉ Message Instructor
                    </Link>
                    <Link
                      href={`/parent/${student.studentId}`}
                      className="button small"
                    >
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
                    <span className="stat-link">{activeEnrollments} active</span>
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
                  <div
                    className="stat-card"
                    style={
                      attendanceTotal > 0 && attendanceRate < 80
                        ? { borderColor: "#fcd34d", background: "#fffbeb" }
                        : {}
                    }
                  >
                    <span className="stat-label">Attendance Rate</span>
                    <span
                      className="stat-value"
                      style={
                        attendanceTotal > 0 && attendanceRate < 80
                          ? { color: "#d97706" }
                          : {}
                      }
                    >
                      {attendanceTotal > 0 ? `${attendanceRate}%` : "N/A"}
                    </span>
                    <span className="stat-link">
                      {attendancePresent}/{attendanceTotal} sessions
                    </span>
                  </div>
                </div>

                {/* Goals Summary */}
                {progress?.goals && progress.goals.length > 0 && (
                  <div style={{ marginTop: 12 }}>
                    <div
                      className="section-title"
                      style={{ fontSize: 13, marginBottom: 8 }}
                    >
                      Active Goals
                    </div>
                    <div className="enrollments-list">
                      {progress.goals.map((goal) => (
                        <div key={goal.id} className="enrollment-item">
                          <div>
                            <strong>{goal.title}</strong>
                            {goal.description && (
                              <p
                                style={{
                                  margin: "2px 0 0",
                                  fontSize: 12,
                                  color: "var(--muted)",
                                }}
                              >
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
                              title={
                                goal.latestStatus === "ON_TRACK"
                                  ? "Your child is meeting expectations for this goal."
                                  : goal.latestStatus === "BEHIND_SCHEDULE"
                                  ? "Progress is slower than expected. Consider discussing with their instructor."
                                  : goal.latestStatus === "ABOVE_AND_BEYOND"
                                  ? "Your child is exceeding expectations. Great work!"
                                  : goal.latestStatus === "GETTING_STARTED"
                                  ? "Your child is just getting started on this goal. Check in with their instructor."
                                  : ""
                              }
                            >
                              {goal.latestStatus.replace(/_/g, " ")}
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Recent Certificates */}
                {progress?.certificates && progress.certificates.length > 0 && (
                  <div style={{ marginTop: 12 }}>
                    <div
                      className="section-title"
                      style={{ fontSize: 13, marginBottom: 8 }}
                    >
                      Recent Certificates
                    </div>
                    <div className="enrollments-list">
                      {progress.certificates.slice(0, 3).map((cert) => (
                        <div key={cert.id} className="enrollment-item">
                          <strong>{cert.title}</strong>
                          <span
                            style={{ fontSize: 12, color: "var(--muted)" }}
                          >
                            {new Date(cert.issuedAt).toLocaleDateString()}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Enroll in Class Offering */}
                <ParentEnrollOffering
                  studentId={student.studentId}
                  studentName={student.name}
                  offerings={availableOfferings}
                />
              </div>
            );
          })}
        </>
      )}
    </div>
  );
}

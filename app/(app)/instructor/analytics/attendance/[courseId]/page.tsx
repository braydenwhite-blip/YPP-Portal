import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import Link from "next/link";

export default async function AttendanceAnalyticsPage({ params }: { params: { courseId: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    redirect("/public/login");
  }

  const course = await prisma.course.findUnique({
    where: { id: params.courseId },
    include: {
      leadInstructor: true,
      enrollments: {
        where: { status: "ENROLLED" },
        include: { user: true }
      },
      attendanceSessions: {
        include: {
          records: {
            include: { user: true }
          }
        },
        orderBy: { date: "desc" }
      }
    }
  });

  if (!course) {
    redirect("/courses");
  }

  const isInstructor =
    course.leadInstructorId === session.user.id ||
    session.user.primaryRole === "ADMIN";

  if (!isInstructor) {
    redirect(`/courses/${params.courseId}`);
  }

  // Calculate attendance stats
  const totalSessions = course.attendanceSessions.length;
  const enrolledStudents = course.enrollments.length;

  // Per-student attendance
  const studentAttendance = course.enrollments.map(enrollment => {
    const records = course.attendanceSessions.flatMap(session =>
      session.records.filter(r => r.userId === enrollment.userId)
    );

    const present = records.filter(r => r.status === "PRESENT").length;
    const late = records.filter(r => r.status === "LATE").length;
    const absent = records.filter(r => r.status === "ABSENT").length;
    const rate = totalSessions > 0 ? Math.round((present / totalSessions) * 100) : 0;

    return {
      student: enrollment.user,
      present,
      late,
      absent,
      rate
    };
  }).sort((a, b) => b.rate - a.rate);

  // Session attendance trends
  const sessionTrends = course.attendanceSessions.map(session => {
    const present = session.records.filter(r => r.status === "PRESENT").length;
    const rate = enrolledStudents > 0 ? Math.round((present / enrolledStudents) * 100) : 0;

    return {
      session: session.title,
      date: session.date,
      present,
      total: enrolledStudents,
      rate
    };
  });

  // Overall attendance rate
  const overallRate = studentAttendance.length > 0
    ? Math.round(studentAttendance.reduce((sum, s) => sum + s.rate, 0) / studentAttendance.length)
    : 0;

  // At-risk students (below 70% attendance)
  const atRiskStudents = studentAttendance.filter(s => s.rate < 70);

  return (
    <div>
      <div className="topbar">
        <div>
          <p className="badge">
            <Link href={`/courses/${params.courseId}`} style={{ color: "inherit", textDecoration: "none" }}>
              {course.title}
            </Link>
          </p>
          <h1 className="page-title">Attendance Analytics</h1>
        </div>
      </div>

      <div className="grid three" style={{ marginBottom: 28 }}>
        <div className="card">
          <div className="kpi">{overallRate}%</div>
          <div className="kpi-label">Overall Attendance</div>
        </div>
        <div className="card">
          <div className="kpi">{totalSessions}</div>
          <div className="kpi-label">Total Sessions</div>
        </div>
        <div className="card">
          <div className="kpi">{atRiskStudents.length}</div>
          <div className="kpi-label">At-Risk Students</div>
        </div>
      </div>

      {/* Session trends */}
      {sessionTrends.length > 0 && (
        <div style={{ marginBottom: 28 }}>
          <div className="section-title">Session Trends</div>
          <div className="card">
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {sessionTrends.map((trend, index) => (
                <div key={index}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                    <span style={{ fontWeight: 600 }}>{trend.session}</span>
                    <span>{trend.rate}%</span>
                  </div>
                  <div style={{ fontSize: 12, color: "var(--text-secondary)", marginBottom: 8 }}>
                    {new Date(trend.date).toLocaleDateString()} • {trend.present}/{trend.total} present
                  </div>
                  <div style={{
                    width: "100%",
                    height: 6,
                    backgroundColor: "var(--border-color)",
                    borderRadius: 3,
                    overflow: "hidden"
                  }}>
                    <div style={{
                      width: `${trend.rate}%`,
                      height: "100%",
                      backgroundColor: trend.rate >= 80 ? "var(--success-color)" :
                                     trend.rate >= 60 ? "var(--warning-color)" :
                                     "var(--error-color)"
                    }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Student attendance */}
      <div style={{ marginBottom: 28 }}>
        <div className="section-title">Student Attendance</div>
        <div className="grid two">
          {studentAttendance.map(({ student, present, late, absent, rate }) => (
            <div key={student.id} className="card">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start" }}>
                <div>
                  <h3>{student.name}</h3>
                  <div style={{ fontSize: 14, color: "var(--text-secondary)", marginTop: 4 }}>
                    {present} present • {late} late • {absent} absent
                  </div>
                </div>
                <div style={{
                  fontSize: 24,
                  fontWeight: 600,
                  color: rate >= 80 ? "var(--success-color)" :
                         rate >= 60 ? "var(--warning-color)" :
                         "var(--error-color)"
                }}>
                  {rate}%
                </div>
              </div>
              {rate < 70 && (
                <div style={{
                  marginTop: 12,
                  padding: 8,
                  backgroundColor: "var(--error-bg)",
                  borderRadius: 4,
                  fontSize: 12,
                  color: "var(--error-color)"
                }}>
                  ⚠️ At-risk: Consider reaching out
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

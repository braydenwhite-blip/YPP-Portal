import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import Link from "next/link";

export default async function EngagementIndicatorsPage({ params }: { params: { courseId: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    redirect("/login");
  }

  const course = await prisma.course.findUnique({
    where: { id: params.courseId },
    include: {
      enrollments: {
        where: { status: "ENROLLED" },
        include: {
          user: {
            include: {
              assignmentSubmissions: {
                where: {
                  assignment: { courseId: params.courseId }
                }
              },
              studyGroupMemberships: {
                where: {
                  group: { courseId: params.courseId }
                }
              }
            }
          }
        }
      },
      assignments: true,
      studyGroups: {
        include: {
          members: true
        }
      }
    }
  });

  if (!course) {
    redirect("/courses");
  }

  const isInstructor = course.leadInstructorId === session.user.id || session.user.primaryRole === "ADMIN";

  if (!isInstructor) {
    redirect(`/courses/${params.courseId}`);
  }

  const now = new Date();
  const twoWeeksAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);

  // Engagement metrics per student
  const studentMetrics = course.enrollments.map(enrollment => {
    const student = enrollment.user;

    // Assignment submission rate
    const submittedAssignments = student.assignmentSubmissions.filter(
      s => s.status === "SUBMITTED" || s.status === "GRADED"
    ).length;
    const assignmentRate = course.assignments.length > 0
      ? Math.round((submittedAssignments / course.assignments.length) * 100)
      : 0;

    // Study group participation
    const inStudyGroup = student.studyGroupMemberships.length > 0;

    // Recent activity (last login would need to be tracked)
    const recentSubmission = student.assignmentSubmissions.length > 0
      ? student.assignmentSubmissions[0].createdAt > twoWeeksAgo
      : false;

    // Engagement score
    let engagementScore = 0;
    if (assignmentRate >= 80) engagementScore += 40;
    else if (assignmentRate >= 60) engagementScore += 25;
    else if (assignmentRate >= 40) engagementScore += 15;

    if (inStudyGroup) engagementScore += 30;
    if (recentSubmission) engagementScore += 30;

    const status =
      engagementScore >= 70 ? "HIGH" :
      engagementScore >= 40 ? "MEDIUM" :
      "LOW";

    return {
      student,
      assignmentRate,
      inStudyGroup,
      recentSubmission,
      engagementScore,
      status,
      enrolledAt: enrollment.createdAt
    };
  }).sort((a, b) => a.engagementScore - b.engagementScore);

  const lowEngagement = studentMetrics.filter(m => m.status === "LOW");
  const mediumEngagement = studentMetrics.filter(m => m.status === "MEDIUM");
  const highEngagement = studentMetrics.filter(m => m.status === "HIGH");

  return (
    <div>
      <div className="topbar">
        <div>
          <p className="badge">
            <Link href={`/courses/${params.courseId}`} style={{ color: "inherit", textDecoration: "none" }}>
              {course.title}
            </Link>
          </p>
          <h1 className="page-title">Student Engagement</h1>
        </div>
      </div>

      <div className="grid three" style={{ marginBottom: 28 }}>
        <div className="card">
          <div className="kpi" style={{ color: "var(--error-color)" }}>{lowEngagement.length}</div>
          <div className="kpi-label">Low Engagement</div>
        </div>
        <div className="card">
          <div className="kpi" style={{ color: "var(--warning-color)" }}>{mediumEngagement.length}</div>
          <div className="kpi-label">Medium Engagement</div>
        </div>
        <div className="card">
          <div className="kpi" style={{ color: "var(--success-color)" }}>{highEngagement.length}</div>
          <div className="kpi-label">High Engagement</div>
        </div>
      </div>

      {/* Low engagement students (priority) */}
      {lowEngagement.length > 0 && (
        <div style={{ marginBottom: 28 }}>
          <div className="section-title">🚨 Low Engagement - Action Needed</div>
          <div className="grid two">
            {lowEngagement.map(({ student, assignmentRate, inStudyGroup, recentSubmission }) => (
              <div
                key={student.id}
                className="card"
                style={{ borderLeft: "4px solid var(--error-color)" }}
              >
                <h3>{student.name}</h3>
                <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 8 }}>
                  <div style={{ fontSize: 14 }}>
                    📝 Assignment completion: <strong>{assignmentRate}%</strong>
                  </div>
                  <div style={{ fontSize: 14 }}>
                    👥 Study group: <strong>{inStudyGroup ? "Yes" : "No"}</strong>
                  </div>
                  <div style={{ fontSize: 14 }}>
                    📅 Recent activity: <strong>{recentSubmission ? "Yes" : "No"}</strong>
                  </div>
                </div>
                <div style={{ marginTop: 12, display: "flex", gap: 8 }}>
                  <Link
                    href={`/messages/new?to=${student.id}`}
                    className="button primary small"
                    style={{ flex: 1 }}
                  >
                    Send Message
                  </Link>
                  <Link
                    href={`/students/${student.id}`}
                    className="button secondary small"
                    style={{ flex: 1 }}
                  >
                    View Profile
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Medium engagement */}
      {mediumEngagement.length > 0 && (
        <div style={{ marginBottom: 28 }}>
          <div className="section-title">⚠️ Medium Engagement</div>
          <div className="grid three">
            {mediumEngagement.map(({ student, assignmentRate, inStudyGroup }) => (
              <div key={student.id} className="card">
                <h4>{student.name}</h4>
                <div style={{ marginTop: 8, fontSize: 14 }}>
                  📝 {assignmentRate}% assignments
                </div>
                <div style={{ fontSize: 14 }}>
                  👥 {inStudyGroup ? "In study group" : "Not in group"}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* High engagement */}
      {highEngagement.length > 0 && (
        <div>
          <div className="section-title">✅ High Engagement</div>
          <div className="grid three">
            {highEngagement.map(({ student, assignmentRate }) => (
              <div key={student.id} className="card">
                <h4>{student.name}</h4>
                <div style={{ marginTop: 8, fontSize: 14, color: "var(--success-color)" }}>
                  ✓ {assignmentRate}% assignments
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

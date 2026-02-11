import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import Link from "next/link";

export default async function CourseAssignmentsPage({ params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    redirect("/login");
  }

  const course = await prisma.course.findUnique({
    where: { id: params.id },
    include: {
      leadInstructor: true,
      assignments: {
        include: {
          submissions: {
            where: { studentId: session.user.id }
          },
          _count: {
            select: { submissions: true }
          }
        },
        orderBy: { createdAt: "desc" }
      }
    }
  });

  if (!course) {
    redirect("/courses");
  }

  const isInstructor = course.leadInstructorId === session.user.id || session.user.primaryRole === "ADMIN";

  // Get enrollment
  const enrollment = await prisma.enrollment.findFirst({
    where: {
      userId: session.user.id,
      courseId: params.id
    }
  });

  const isEnrolled = !!enrollment;

  if (!isInstructor && !isEnrolled) {
    redirect(`/courses/${params.id}`);
  }

  return (
    <div>
      <div className="topbar">
        <div>
          <p className="badge">
            <Link href={`/courses/${params.id}`} style={{ color: "inherit", textDecoration: "none" }}>
              {course.title}
            </Link>
          </p>
          <h1 className="page-title">Assignments</h1>
        </div>
        {isInstructor && (
          <Link href={`/courses/${params.id}/assignments/create`} className="button primary">
            Create Assignment
          </Link>
        )}
      </div>

      {course.assignments.length === 0 ? (
        <div className="card">
          <h3>No Assignments Yet</h3>
          <p>
            {isInstructor
              ? "Create your first assignment to start tracking student work."
              : "No assignments have been posted for this course yet."}
          </p>
          {isInstructor && (
            <Link href={`/courses/${params.id}/assignments/create`} className="button primary" style={{ marginTop: 12 }}>
              Create Assignment
            </Link>
          )}
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {course.assignments.map(assignment => {
            const userSubmission = assignment.submissions[0];
            const isOverdue = assignment.dueDate && new Date(assignment.dueDate) < new Date() && !userSubmission?.submittedAt;

            return (
              <Link
                key={assignment.id}
                href={`/courses/${params.id}/assignments/${assignment.id}`}
                className="card"
                style={{ textDecoration: "none", color: "inherit" }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start" }}>
                  <div style={{ flex: 1 }}>
                    <h3>{assignment.title}</h3>
                    <p style={{ color: "var(--text-secondary)", marginTop: 4 }}>
                      {assignment.description.slice(0, 150)}
                      {assignment.description.length > 150 && "..."}
                    </p>
                  </div>

                  <div style={{ marginLeft: 20, textAlign: "right" }}>
                    {isInstructor ? (
                      <div>
                        <div className="kpi">{assignment._count.submissions}</div>
                        <div className="kpi-label">Submissions</div>
                      </div>
                    ) : userSubmission?.status === "GRADED" ? (
                      <div>
                        <div className="kpi">{userSubmission.grade}/{assignment.maxPoints || "?"}</div>
                        <div className="kpi-label">Graded</div>
                      </div>
                    ) : userSubmission?.status === "SUBMITTED" ? (
                      <span className="pill primary">Submitted</span>
                    ) : isOverdue ? (
                      <span className="pill" style={{ backgroundColor: "var(--error-bg)", color: "var(--error-color)" }}>
                        Overdue
                      </span>
                    ) : (
                      <span className="pill">Not Submitted</span>
                    )}
                  </div>
                </div>

                <div style={{ marginTop: 16, display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
                  <span className="pill">
                    {assignment.type.replace("_", " ")}
                  </span>
                  {assignment.maxPoints && (
                    <span style={{ fontSize: 14, color: "var(--text-secondary)" }}>
                      {assignment.maxPoints} points
                    </span>
                  )}
                  {assignment.dueDate && (
                    <span style={{ fontSize: 14, color: isOverdue ? "var(--error-color)" : "var(--text-secondary)" }}>
                      Due: {new Date(assignment.dueDate).toLocaleString()}
                    </span>
                  )}
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

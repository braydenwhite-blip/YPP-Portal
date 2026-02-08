import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import Link from "next/link";

export default async function CurriculumFeedbackPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    redirect("/public/login");
  }

  const isInstructor = session.user.primaryRole === "INSTRUCTOR" || session.user.primaryRole === "ADMIN";

  if (!isInstructor) {
    redirect("/");
  }

  // Get feedback submitted by this instructor
  const myFeedback = await prisma.curriculumFeedback.findMany({
    where: { instructorId: session.user.id },
    include: { course: true },
    orderBy: { createdAt: "desc" }
  });

  const pendingFeedback = myFeedback.filter(f => f.status === "SUBMITTED");
  const reviewedFeedback = myFeedback.filter(f => f.status === "UNDER_REVIEW");
  const implementedFeedback = myFeedback.filter(f => f.status === "IMPLEMENTED");

  return (
    <div>
      <div className="topbar">
        <div>
          <p className="badge">Instructor Tools</p>
          <h1 className="page-title">Curriculum Feedback</h1>
        </div>
        <Link href="/instructor/curriculum-feedback/new" className="button primary">
          Submit Feedback
        </Link>
      </div>

      <div className="card" style={{ marginBottom: 28 }}>
        <h3>Improve Our Curriculum Together</h3>
        <p>
          Share your insights on lessons, assignments, and course materials. Your feedback helps
          improve the quality of education for all students and instructors.
        </p>
      </div>

      <div className="grid three" style={{ marginBottom: 28 }}>
        <div className="card">
          <div className="kpi">{pendingFeedback.length}</div>
          <div className="kpi-label">Pending Review</div>
        </div>
        <div className="card">
          <div className="kpi">{reviewedFeedback.length}</div>
          <div className="kpi-label">Under Review</div>
        </div>
        <div className="card">
          <div className="kpi" style={{ color: "var(--success-color)" }}>{implementedFeedback.length}</div>
          <div className="kpi-label">Implemented</div>
        </div>
      </div>

      {/* Feedback submissions */}
      <div>
        <div className="section-title">Your Feedback Submissions</div>
        {myFeedback.length === 0 ? (
          <div className="card">
            <p style={{ color: "var(--text-secondary)" }}>
              No feedback submitted yet. Share your insights to help improve our curriculum!
            </p>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {myFeedback.map(feedback => {
              const statusConfig = {
                SUBMITTED: { color: "warning", label: "Submitted" },
                UNDER_REVIEW: { color: "primary", label: "Under Review" },
                IMPLEMENTED: { color: "success", label: "Implemented" },
                ARCHIVED: { color: "secondary", label: "Archived" }
              };

              const config = statusConfig[feedback.status as keyof typeof statusConfig];

              const typeLabels = {
                LESSON_PLAN: "Lesson Plan",
                ASSIGNMENT: "Assignment",
                RESOURCE: "Resource",
                PACING: "Pacing",
                CONTENT_GAP: "Content Gap",
                IMPROVEMENT: "General Improvement",
                OTHER: "Other"
              };

              return (
                <div key={feedback.id} className="card">
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start" }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                        <h3>{feedback.subject}</h3>
                        <span className={`pill ${config.color}`}>
                          {config.label}
                        </span>
                        <span className="pill">
                          {typeLabels[feedback.type as keyof typeof typeLabels] || feedback.type}
                        </span>
                      </div>

                      {feedback.course && (
                        <div style={{ fontSize: 14, color: "var(--text-secondary)", marginBottom: 8 }}>
                          Course: {feedback.course.title}
                        </div>
                      )}

                      <p style={{ fontSize: 14, marginBottom: 8, whiteSpace: "pre-wrap" }}>
                        {feedback.details}
                      </p>

                      <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>
                        Submitted {new Date(feedback.createdAt).toLocaleDateString()}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

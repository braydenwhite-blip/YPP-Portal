import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";

export default async function NewCurriculumFeedbackPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    redirect("/login");
  }

  const isInstructor = session.user.primaryRole === "INSTRUCTOR" || session.user.primaryRole === "ADMIN";

  if (!isInstructor) {
    redirect("/");
  }

  // Get instructor's courses
  const courses = await prisma.course.findMany({
    where: { leadInstructorId: session.user.id },
    orderBy: { title: "asc" }
  });

  return (
    <div>
      <div className="topbar">
        <div>
          <p className="badge">Instructor Tools</p>
          <h1 className="page-title">Submit Curriculum Feedback</h1>
        </div>
      </div>

      <div className="card">
        <h3>Share Your Curriculum Insights</h3>
        <p style={{ marginBottom: 20, color: "var(--text-secondary)" }}>
          Your feedback helps improve lessons, assignments, and course materials for everyone.
          Be specific and constructive in your suggestions.
        </p>

        <form action="/api/curriculum-feedback/create" method="POST">
          <div style={{ marginBottom: 20 }}>
            <label htmlFor="type" style={{ display: "block", marginBottom: 8, fontWeight: 600 }}>
              Feedback Type *
            </label>
            <select
              id="type"
              name="type"
              required
              style={{
                width: "100%",
                padding: "8px 12px",
                border: "1px solid var(--border-color)",
                borderRadius: 6,
                fontSize: 14
              }}
            >
              <option value="">Select type</option>
              <option value="LESSON_PLAN">Lesson Plan</option>
              <option value="ASSIGNMENT">Assignment</option>
              <option value="RESOURCE">Resource</option>
              <option value="PACING">Pacing</option>
              <option value="CONTENT_GAP">Content Gap</option>
              <option value="IMPROVEMENT">General Improvement</option>
              <option value="OTHER">Other</option>
            </select>
          </div>

          <div style={{ marginBottom: 20 }}>
            <label htmlFor="courseId" style={{ display: "block", marginBottom: 8, fontWeight: 600 }}>
              Related Course (Optional)
            </label>
            <select
              id="courseId"
              name="courseId"
              style={{
                width: "100%",
                padding: "8px 12px",
                border: "1px solid var(--border-color)",
                borderRadius: 6,
                fontSize: 14
              }}
            >
              <option value="">General feedback (not course-specific)</option>
              {courses.map(course => (
                <option key={course.id} value={course.id}>
                  {course.title}
                </option>
              ))}
            </select>
          </div>

          <div style={{ marginBottom: 20 }}>
            <label htmlFor="subject" style={{ display: "block", marginBottom: 8, fontWeight: 600 }}>
              Subject/Title *
            </label>
            <input
              type="text"
              id="subject"
              name="subject"
              required
              placeholder="e.g., Week 3 Assignment needs clearer instructions"
              style={{
                width: "100%",
                padding: "8px 12px",
                border: "1px solid var(--border-color)",
                borderRadius: 6,
                fontSize: 14
              }}
            />
          </div>

          <div style={{ marginBottom: 24 }}>
            <label htmlFor="details" style={{ display: "block", marginBottom: 8, fontWeight: 600 }}>
              Detailed Feedback *
            </label>
            <textarea
              id="details"
              name="details"
              required
              rows={10}
              placeholder="Provide specific details about the issue and suggestions for improvement...

Examples:
- What's not working well?
- Why is it problematic?
- How could it be improved?
- What would make it more effective?"
              style={{
                width: "100%",
                padding: "8px 12px",
                border: "1px solid var(--border-color)",
                borderRadius: 6,
                fontSize: 14,
                fontFamily: "inherit",
                resize: "vertical"
              }}
            />
          </div>

          <div style={{ display: "flex", gap: 12 }}>
            <button type="submit" className="button primary">
              Submit Feedback
            </button>
            <a href="/instructor/curriculum-feedback" className="button secondary">
              Cancel
            </a>
          </div>
        </form>
      </div>
    </div>
  );
}

import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";

export default async function DuplicateCoursePage({ params }: { params: { courseId: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    redirect("/login");
  }

  const course = await prisma.course.findUnique({
    where: { id: params.courseId },
    include: {
      assignments: true,
      resources: true,
      studyGroups: true
    }
  });

  if (!course) {
    redirect("/courses");
  }

  const isInstructor =
    course.leadInstructorId === session.user.id ||
    session.user.primaryRole === "ADMIN";

  if (!isInstructor) {
    redirect("/");
  }

  return (
    <div>
      <div className="topbar">
        <div>
          <p className="badge">Instructor Tools</p>
          <h1 className="page-title">Duplicate Course</h1>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 28 }}>
        <h3>Duplicating: {course.title}</h3>
        <p style={{ color: "var(--text-secondary)" }}>
          Create a copy of this course with all its structure, assignments, and resources.
          Customize the new course details below.
        </p>
      </div>

      <div className="card" style={{ marginBottom: 28 }}>
        <h4>What Will Be Duplicated</h4>
        <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 8 }}>
          <div style={{ fontSize: 14 }}>
            ✓ Course information and description
          </div>
          <div style={{ fontSize: 14 }}>
            ✓ {course.assignments.length} assignments (without submissions)
          </div>
          <div style={{ fontSize: 14 }}>
            ✓ {course.resources.length} resources
          </div>
          <div style={{ fontSize: 14, color: "var(--text-secondary)" }}>
            ✗ Student enrollments (new course starts fresh)
          </div>
          <div style={{ fontSize: 14, color: "var(--text-secondary)" }}>
            ✗ Grades and submissions
          </div>
          <div style={{ fontSize: 14, color: "var(--text-secondary)" }}>
            ✗ Attendance records
          </div>
        </div>
      </div>

      <div className="card">
        <h3>New Course Settings</h3>
        <form action="/api/course/duplicate" method="POST" style={{ marginTop: 16 }}>
          <input type="hidden" name="courseId" value={params.courseId} />

          <div style={{ marginBottom: 20 }}>
            <label htmlFor="title" style={{ display: "block", marginBottom: 8, fontWeight: 600 }}>
              Course Title *
            </label>
            <input
              type="text"
              id="title"
              name="title"
              required
              defaultValue={`${course.title} (Copy)`}
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
            <label htmlFor="description" style={{ display: "block", marginBottom: 8, fontWeight: 600 }}>
              Description
            </label>
            <textarea
              id="description"
              name="description"
              rows={4}
              defaultValue={course.description || ""}
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

          <div style={{
            marginBottom: 24,
            padding: 16,
            backgroundColor: "var(--warning-bg)",
            borderRadius: 6,
            fontSize: 14
          }}>
            <strong>Note:</strong> The duplicated course will copy the original course structure,
            assignments, and resources. Student enrollments and submissions are not copied.
          </div>

          <div style={{ display: "flex", gap: 12 }}>
            <button type="submit" className="button primary">
              Duplicate Course
            </button>
            <a href={`/courses/${params.courseId}`} className="button secondary">
              Cancel
            </a>
          </div>
        </form>
      </div>
    </div>
  );
}

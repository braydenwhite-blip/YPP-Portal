import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import Link from "next/link";

export default async function CreateStudyGroupPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    redirect("/login");
  }

  // Get user's enrolled courses
  const enrollments = await prisma.enrollment.findMany({
    where: {
      userId: session.user.id,
      status: { not: "DROPPED" }
    },
    include: { course: true },
    orderBy: { createdAt: "desc" }
  });

  if (enrollments.length === 0) {
    redirect("/courses");
  }

  return (
    <div>
      <div className="topbar">
        <div>
          <p className="badge">
            <Link href="/study-groups" style={{ color: "inherit", textDecoration: "none" }}>
              Study Groups
            </Link>
          </p>
          <h1 className="page-title">Create Study Group</h1>
        </div>
      </div>

      <div className="grid" style={{ maxWidth: 600, margin: "0 auto" }}>
        <div className="card">
          <form action="/api/study-groups/create" method="POST">
            <div style={{ marginBottom: 20 }}>
              <label htmlFor="name" style={{ display: "block", fontWeight: 600, marginBottom: 8 }}>
                Group Name *
              </label>
              <input
                type="text"
                id="name"
                name="name"
                required
                placeholder="e.g., Web Dev Study Crew"
                style={{
                  width: "100%",
                  padding: 10,
                  border: "1px solid var(--border-color)",
                  borderRadius: 4,
                  fontSize: 14
                }}
              />
            </div>

            <div style={{ marginBottom: 20 }}>
              <label htmlFor="courseId" style={{ display: "block", fontWeight: 600, marginBottom: 8 }}>
                Course *
              </label>
              <select
                id="courseId"
                name="courseId"
                required
                style={{
                  width: "100%",
                  padding: 10,
                  border: "1px solid var(--border-color)",
                  borderRadius: 4,
                  fontSize: 14,
                  backgroundColor: "var(--bg-primary)"
                }}
              >
                <option value="">Select a course</option>
                {enrollments.map((enrollment) => (
                  <option key={enrollment.courseId} value={enrollment.courseId}>
                    {enrollment.course.title}
                  </option>
                ))}
              </select>
              <p style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 4 }}>
                Only students enrolled in this course can join the group
              </p>
            </div>

            <div style={{ marginBottom: 20 }}>
              <label htmlFor="description" style={{ display: "block", fontWeight: 600, marginBottom: 8 }}>
                Description
              </label>
              <textarea
                id="description"
                name="description"
                placeholder="What's this study group about?"
                style={{
                  width: "100%",
                  minHeight: 100,
                  padding: 10,
                  border: "1px solid var(--border-color)",
                  borderRadius: 4,
                  fontSize: 14,
                  fontFamily: "inherit",
                  resize: "vertical"
                }}
              />
            </div>

            <div style={{ marginBottom: 20 }}>
              <label htmlFor="maxMembers" style={{ display: "block", fontWeight: 600, marginBottom: 8 }}>
                Maximum Members (Optional)
              </label>
              <input
                type="number"
                id="maxMembers"
                name="maxMembers"
                min="2"
                max="50"
                placeholder="Leave empty for unlimited"
                style={{
                  width: "100%",
                  padding: 10,
                  border: "1px solid var(--border-color)",
                  borderRadius: 4,
                  fontSize: 14
                }}
              />
              <p style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 4 }}>
                Limit the size of your study group (2-50 members)
              </p>
            </div>

            <div style={{ display: "flex", gap: 12 }}>
              <button type="submit" className="button primary" style={{ flex: 1 }}>
                Create Study Group
              </button>
              <Link href="/study-groups" className="button secondary" style={{ flex: 1 }}>
                Cancel
              </Link>
            </div>
          </form>
        </div>

        <div className="card">
          <h3>Study Group Tips</h3>
          <ul style={{ marginTop: 12, paddingLeft: 20, color: "var(--text-secondary)" }}>
            <li style={{ marginBottom: 8 }}>Keep your group name clear and descriptive</li>
            <li style={{ marginBottom: 8 }}>Set expectations in the description (meeting times, goals, etc.)</li>
            <li style={{ marginBottom: 8 }}>Smaller groups (4-8 members) tend to be more engaged</li>
            <li>Use the shared resources to organize study materials</li>
          </ul>
        </div>
      </div>
    </div>
  );
}

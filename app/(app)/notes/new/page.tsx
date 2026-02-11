import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import Link from "next/link";

export default async function NewNotePage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    redirect("/login");
  }

  // Get user's enrolled courses
  const enrollments = await prisma.enrollment.findMany({
    where: { userId: session.user.id },
    include: { course: true },
    orderBy: { createdAt: "desc" }
  });

  return (
    <div>
      <div className="topbar">
        <div>
          <p className="badge">
            <Link href="/notes" style={{ color: "inherit", textDecoration: "none" }}>
              Learning Notes
            </Link>
          </p>
          <h1 className="page-title">New Note</h1>
        </div>
      </div>

      <div style={{ maxWidth: 800, margin: "0 auto" }}>
        <div className="card">
          <form action="/api/notes/create" method="POST">
            <div style={{ marginBottom: 20 }}>
              <label htmlFor="courseId" style={{ display: "block", fontWeight: 600, marginBottom: 8 }}>
                Course (Optional)
              </label>
              <select
                id="courseId"
                name="courseId"
                style={{
                  width: "100%",
                  padding: 10,
                  border: "1px solid var(--border-color)",
                  borderRadius: 4,
                  fontSize: 14,
                  backgroundColor: "var(--bg-primary)"
                }}
              >
                <option value="">General note (not tied to a course)</option>
                {enrollments.map((enrollment) => (
                  <option key={enrollment.courseId} value={enrollment.courseId}>
                    {enrollment.course.title}
                  </option>
                ))}
              </select>
            </div>

            <div style={{ marginBottom: 20 }}>
              <label htmlFor="lessonTitle" style={{ display: "block", fontWeight: 600, marginBottom: 8 }}>
                Lesson or Topic
              </label>
              <input
                type="text"
                id="lessonTitle"
                name="lessonTitle"
                placeholder="e.g., Introduction to React Hooks"
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
              <label htmlFor="content" style={{ display: "block", fontWeight: 600, marginBottom: 8 }}>
                Note Content *
              </label>
              <textarea
                id="content"
                name="content"
                required
                placeholder="Write your notes here..."
                style={{
                  width: "100%",
                  minHeight: 300,
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
              <label htmlFor="tags" style={{ display: "block", fontWeight: 600, marginBottom: 8 }}>
                Tags (comma-separated)
              </label>
              <input
                type="text"
                id="tags"
                name="tags"
                placeholder="e.g., javascript, react, hooks"
                style={{
                  width: "100%",
                  padding: 10,
                  border: "1px solid var(--border-color)",
                  borderRadius: 4,
                  fontSize: 14
                }}
              />
              <p style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 4 }}>
                Add tags to organize your notes
              </p>
            </div>

            <div style={{ marginBottom: 20 }}>
              <label style={{ display: "flex", alignItems: "center", cursor: "pointer" }}>
                <input
                  type="checkbox"
                  name="isPinned"
                  value="true"
                  style={{ marginRight: 8, width: 18, height: 18, cursor: "pointer" }}
                />
                <span style={{ fontWeight: 600 }}>📌 Pin this note</span>
              </label>
              <p style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 4, marginLeft: 26 }}>
                Pinned notes appear at the top of your notes list
              </p>
            </div>

            <div style={{ display: "flex", gap: 12 }}>
              <button type="submit" className="button primary" style={{ flex: 1 }}>
                Save Note
              </button>
              <Link href="/notes" className="button secondary" style={{ flex: 1 }}>
                Cancel
              </Link>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

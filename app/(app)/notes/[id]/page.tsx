import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import Link from "next/link";

export default async function NoteDetailPage({ params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    redirect("/public/login");
  }

  const note = await prisma.learningNote.findUnique({
    where: { id: params.id },
    include: { course: true }
  });

  if (!note || note.userId !== session.user.id) {
    redirect("/notes");
  }

  // Get user's enrolled courses for editing
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
          <h1 className="page-title">
            {note.lessonTitle || "Note"}
          </h1>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <form action="/api/notes/delete" method="POST">
            <input type="hidden" name="noteId" value={note.id} />
            <button
              type="submit"
              className="button"
              style={{ backgroundColor: "var(--error-bg)", color: "var(--error-color)" }}
              onClick={(e) => {
                if (!confirm("Are you sure you want to delete this note?")) {
                  e.preventDefault();
                }
              }}
            >
              Delete
            </button>
          </form>
        </div>
      </div>

      <div style={{ maxWidth: 800, margin: "0 auto" }}>
        <div className="card">
          <form action="/api/notes/update" method="POST">
            <input type="hidden" name="noteId" value={note.id} />

            <div style={{ marginBottom: 20 }}>
              <label htmlFor="courseId" style={{ display: "block", fontWeight: 600, marginBottom: 8 }}>
                Course (Optional)
              </label>
              <select
                id="courseId"
                name="courseId"
                defaultValue={note.courseId || ""}
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
                defaultValue={note.lessonTitle || ""}
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
                defaultValue={note.content}
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
                defaultValue={note.tags.join(", ")}
                placeholder="e.g., javascript, react, hooks"
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
              <label style={{ display: "flex", alignItems: "center", cursor: "pointer" }}>
                <input
                  type="checkbox"
                  name="isPinned"
                  value="true"
                  defaultChecked={note.isPinned}
                  style={{ marginRight: 8, width: 18, height: 18, cursor: "pointer" }}
                />
                <span style={{ fontWeight: 600 }}>📌 Pin this note</span>
              </label>
            </div>

            <div style={{ marginBottom: 20, paddingTop: 16, borderTop: "1px solid var(--border-color)" }}>
              <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>
                Created: {new Date(note.createdAt).toLocaleString()}
              </div>
              <div style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 4 }}>
                Last updated: {new Date(note.updatedAt).toLocaleString()}
              </div>
            </div>

            <div style={{ display: "flex", gap: 12 }}>
              <button type="submit" className="button primary" style={{ flex: 1 }}>
                Save Changes
              </button>
              <Link href="/notes" className="button secondary" style={{ flex: 1 }}>
                Back to Notes
              </Link>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

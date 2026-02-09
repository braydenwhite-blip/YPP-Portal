import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import Link from "next/link";

export default async function LearningNotesPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    redirect("/public/login");
  }

  // Get all notes
  const notes = await prisma.learningNote.findMany({
    where: { userId: session.user.id },
    include: { course: true },
    orderBy: [
      { isPinned: "desc" },
      { updatedAt: "desc" }
    ]
  });

  // Get user's enrolled courses for filtering
  const enrollments = await prisma.enrollment.findMany({
    where: { userId: session.user.id },
    include: { course: true },
    orderBy: { createdAt: "desc" }
  });

  // Get all unique tags
  const allTags = Array.from(new Set(notes.flatMap(note => note.tags)));

  // Group notes by course
  const notesByCourse = notes.reduce((acc, note) => {
    const courseId = note.courseId || "general";
    if (!acc[courseId]) {
      acc[courseId] = [];
    }
    acc[courseId].push(note);
    return acc;
  }, {} as Record<string, typeof notes>);

  return (
    <div>
      <div className="topbar">
        <div>
          <p className="badge">My Learning</p>
          <h1 className="page-title">Learning Notes</h1>
        </div>
        <Link href="/notes/new" className="button primary">
          New Note
        </Link>
      </div>

      <div className="grid two" style={{ marginBottom: 28 }}>
        <div className="card">
          <h3>About Learning Notes</h3>
          <p>
            Keep all your course notes in one place. Take notes during lessons, organize them with tags,
            and pin important notes for quick access.
          </p>
        </div>
        <div className="card">
          <div className="grid two">
            <div>
              <div className="kpi">{notes.length}</div>
              <div className="kpi-label">Total Notes</div>
            </div>
            <div>
              <div className="kpi">{allTags.length}</div>
              <div className="kpi-label">Tags Used</div>
            </div>
          </div>
        </div>
      </div>

      {/* Tags filter */}
      {allTags.length > 0 && (
        <div style={{ marginBottom: 20 }}>
          <div className="section-title">Tags</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {allTags.map(tag => (
              <span key={tag} className="pill">
                {tag}
              </span>
            ))}
          </div>
        </div>
      )}

      {notes.length === 0 ? (
        <div className="card">
          <h3>No Notes Yet</h3>
          <p>Start taking notes to keep track of what you're learning!</p>
          <Link href="/notes/new" className="button primary" style={{ marginTop: 12 }}>
            Create Your First Note
          </Link>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          {/* Pinned notes */}
          {notes.some(n => n.isPinned) && (
            <div>
              <div className="section-title">📌 Pinned Notes</div>
              <div className="grid two">
                {notes.filter(n => n.isPinned).map(note => (
                  <Link
                    key={note.id}
                    href={`/notes/${note.id}`}
                    className="card"
                    style={{ textDecoration: "none", color: "inherit" }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", marginBottom: 8 }}>
                      <div style={{ fontWeight: 600, fontSize: 16 }}>
                        {note.lessonTitle || "General Note"}
                      </div>
                      <span style={{ fontSize: 20 }}>📌</span>
                    </div>

                    {note.course && (
                      <div style={{ marginBottom: 8 }}>
                        <span className="pill">{note.course.title}</span>
                      </div>
                    )}

                    <p style={{
                      color: "var(--text-secondary)",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      display: "-webkit-box",
                      WebkitLineClamp: 3,
                      WebkitBoxOrient: "vertical",
                      whiteSpace: "pre-wrap"
                    }}>
                      {note.content}
                    </p>

                    {note.tags.length > 0 && (
                      <div style={{ marginTop: 12, display: "flex", flexWrap: "wrap", gap: 4 }}>
                        {note.tags.map(tag => (
                          <span key={tag} className="pill" style={{ fontSize: 11 }}>
                            {tag}
                          </span>
                        ))}
                      </div>
                    )}

                    <div style={{ marginTop: 12, fontSize: 12, color: "var(--text-secondary)" }}>
                      Updated {new Date(note.updatedAt).toLocaleDateString()}
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          )}

          {/* Notes by course */}
          {Object.entries(notesByCourse).map(([courseId, courseNotes]) => {
            const unpinnedNotes = courseNotes.filter(n => !n.isPinned);
            if (unpinnedNotes.length === 0) return null;

            const courseName = courseId === "general"
              ? "General Notes"
              : courseNotes[0].course?.title || "Unknown Course";

            return (
              <div key={courseId}>
                <div className="section-title">{courseName}</div>
                <div className="grid two">
                  {unpinnedNotes.map(note => (
                    <Link
                      key={note.id}
                      href={`/notes/${note.id}`}
                      className="card"
                      style={{ textDecoration: "none", color: "inherit" }}
                    >
                      <div style={{ fontWeight: 600, fontSize: 16, marginBottom: 8 }}>
                        {note.lessonTitle || "General Note"}
                      </div>

                      <p style={{
                        color: "var(--text-secondary)",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        display: "-webkit-box",
                        WebkitLineClamp: 3,
                        WebkitBoxOrient: "vertical",
                        whiteSpace: "pre-wrap"
                      }}>
                        {note.content}
                      </p>

                      {note.tags.length > 0 && (
                        <div style={{ marginTop: 12, display: "flex", flexWrap: "wrap", gap: 4 }}>
                          {note.tags.map(tag => (
                            <span key={tag} className="pill" style={{ fontSize: 11 }}>
                              {tag}
                            </span>
                          ))}
                        </div>
                      )}

                      <div style={{ marginTop: 12, fontSize: 12, color: "var(--text-secondary)" }}>
                        Updated {new Date(note.updatedAt).toLocaleDateString()}
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

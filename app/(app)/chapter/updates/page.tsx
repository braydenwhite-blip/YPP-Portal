import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import {
  getChapterUpdates,
  createChapterUpdate,
  deleteChapterUpdate,
} from "@/lib/chapter-actions";
import { prisma } from "@/lib/prisma";
import Link from "next/link";

export default async function ChapterUpdatesPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    include: { roles: true },
  });

  const isChapterLead = user?.roles.some((r) => r.role === "CHAPTER_LEAD");
  const isAdmin = user?.roles.some((r) => r.role === "ADMIN");
  const canPost = isChapterLead || isAdmin;

  const updates = await getChapterUpdates();

  return (
    <main className="main-content">
      <div className="page-header">
        <div>
          <Link href="/chapter" className="back-link">
            ← Back to Dashboard
          </Link>
          <h1>Chapter Updates</h1>
        </div>
      </div>

      {canPost && (
        <section className="card create-section">
          <h2>Post New Update</h2>
          <form action={createChapterUpdate}>
            <div className="form-row">
              <div className="form-group">
                <label>Title</label>
                <input
                  type="text"
                  name="title"
                  required
                  placeholder="Update title"
                />
              </div>
              <div className="form-group">
                <label>Target Roles (optional, leave empty for all)</label>
                <select name="targetRoles" multiple>
                  <option value="INSTRUCTOR">Instructors</option>
                  <option value="STUDENT">Students</option>
                  <option value="MENTOR">Mentors</option>
                </select>
              </div>
            </div>
            <div className="form-group">
              <label>Content</label>
              <textarea
                name="content"
                rows={4}
                required
                placeholder="Write your update here..."
              />
            </div>
            <div className="form-row">
              <label className="checkbox-label">
                <input type="checkbox" name="isPinned" value="true" />
                Pin this update to top
              </label>
              <button type="submit" className="btn btn-primary">
                Post Update
              </button>
            </div>
          </form>
        </section>
      )}

      <section className="updates-section">
        <h2>Recent Updates</h2>
        {updates.length === 0 ? (
          <div className="card">
            <p className="empty">No updates yet.</p>
          </div>
        ) : (
          <div className="updates-list">
            {updates.map((update) => (
              <div
                key={update.id}
                className={`card update-card ${update.isPinned ? "pinned" : ""}`}
              >
                <div className="update-header">
                  <div>
                    {update.isPinned && <span className="pin-badge">📌 Pinned</span>}
                    <h3>{update.title}</h3>
                    <p className="meta">
                      Posted by {update.author.name} on{" "}
                      {new Date(update.publishedAt).toLocaleDateString()}
                    </p>
                  </div>
                  {canPost && (
                    <form action={deleteChapterUpdate.bind(null, update.id)}>
                      <button type="submit" className="btn btn-sm btn-danger">
                        Delete
                      </button>
                    </form>
                  )}
                </div>
                <div className="update-content">
                  <p>{update.content}</p>
                </div>
                {update.targetRoles.length > 0 && (
                  <div className="target-roles">
                    <span className="label">Visible to:</span>
                    {update.targetRoles.map((role) => (
                      <span key={role} className="role-badge">
                        {role}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

    </main>
  );
}

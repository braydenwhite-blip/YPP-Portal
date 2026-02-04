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

      <style jsx>{`
        .page-header {
          margin-bottom: 2rem;
        }
        .back-link {
          color: var(--muted);
          text-decoration: none;
          font-size: 0.875rem;
        }
        .back-link:hover {
          color: var(--primary);
        }
        .create-section {
          padding: 1.5rem;
          margin-bottom: 2rem;
        }
        .create-section h2 {
          margin: 0 0 1rem 0;
        }
        .form-row {
          display: flex;
          gap: 1rem;
          align-items: flex-end;
        }
        .form-group {
          flex: 1;
          margin-bottom: 1rem;
        }
        .form-group label {
          display: block;
          font-weight: 600;
          margin-bottom: 0.5rem;
          font-size: 0.875rem;
        }
        input[type="text"],
        textarea,
        select {
          width: 100%;
          padding: 0.75rem;
          border: 1px solid var(--border);
          border-radius: 0.5rem;
        }
        select[multiple] {
          height: auto;
          min-height: 80px;
        }
        .checkbox-label {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          cursor: pointer;
        }
        .updates-section h2 {
          margin: 0 0 1rem 0;
        }
        .updates-list {
          display: flex;
          flex-direction: column;
          gap: 1rem;
        }
        .update-card {
          padding: 1.5rem;
        }
        .update-card.pinned {
          border-color: var(--primary);
          border-width: 2px;
        }
        .update-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          margin-bottom: 1rem;
        }
        .update-header h3 {
          margin: 0;
        }
        .pin-badge {
          font-size: 0.75rem;
          color: var(--primary);
          display: block;
          margin-bottom: 0.25rem;
        }
        .meta {
          font-size: 0.875rem;
          color: var(--muted);
          margin: 0.25rem 0 0;
        }
        .update-content p {
          margin: 0;
          white-space: pre-wrap;
        }
        .target-roles {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          margin-top: 1rem;
          padding-top: 1rem;
          border-top: 1px solid var(--border);
        }
        .target-roles .label {
          font-size: 0.75rem;
          color: var(--muted);
        }
        .role-badge {
          font-size: 0.75rem;
          padding: 0.25rem 0.5rem;
          background: var(--background);
          border-radius: 0.25rem;
        }
        .empty {
          color: var(--muted);
          font-style: italic;
        }
        .btn-sm {
          padding: 0.25rem 0.75rem;
          font-size: 0.75rem;
        }
        .btn-danger {
          background: #fee2e2;
          color: #991b1b;
          border: none;
        }
        .btn-danger:hover {
          background: #fecaca;
        }
      `}</style>
    </main>
  );
}

import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { getAllReflectionSubmissions } from "@/lib/reflection-actions";
import { prisma } from "@/lib/prisma";

export default async function AdminReflectionsPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    include: { roles: true },
  });

  const isAdmin = user?.roles.some((r) => r.role === "ADMIN");
  const isChapterLead = user?.roles.some((r) => r.role === "CHAPTER_LEAD");
  const isMentor = user?.roles.some((r) => r.role === "MENTOR");

  if (!isAdmin && !isChapterLead && !isMentor) {
    redirect("/");
  }

  const submissions = await getAllReflectionSubmissions();

  // Group by user for easier viewing
  const groupedByUser = submissions.reduce(
    (acc, sub) => {
      const userId = sub.user.id;
      if (!acc[userId]) {
        acc[userId] = {
          user: sub.user,
          submissions: [],
        };
      }
      acc[userId].submissions.push(sub);
      return acc;
    },
    {} as Record<string, { user: any; submissions: any[] }>
  );

  return (
    <main className="main-content">
      <div className="page-header">
        <h1>View Reflections</h1>
        {isAdmin && (
          <a href="/admin/reflection-forms" className="btn btn-secondary">
            Manage Forms
          </a>
        )}
      </div>

      <div className="stats-row">
        <div className="stat-card">
          <span className="stat-value">{submissions.length}</span>
          <span className="stat-label">Total Submissions</span>
        </div>
        <div className="stat-card">
          <span className="stat-value">{Object.keys(groupedByUser).length}</span>
          <span className="stat-label">Users Submitted</span>
        </div>
      </div>

      {Object.keys(groupedByUser).length === 0 ? (
        <div className="card">
          <p>No reflections have been submitted yet.</p>
        </div>
      ) : (
        <div className="users-list">
          {Object.values(groupedByUser).map(({ user: u, submissions: subs }) => (
            <div key={u.id} className="card user-card">
              <div className="user-header">
                <div className="user-info">
                  <h3>{u.name}</h3>
                  <span className="email">{u.email}</span>
                </div>
                <span className="role-badge">{u.primaryRole}</span>
              </div>

              <div className="submissions-list">
                {subs.map((sub) => (
                  <details key={sub.id} className="submission-details">
                    <summary>
                      <span className="form-title">{sub.form.title}</span>
                      <span className="submission-date">
                        {new Date(sub.month).toLocaleDateString("en-US", {
                          month: "long",
                          year: "numeric",
                        })}
                      </span>
                    </summary>

                    <div className="responses-content">
                      {sub.responses.map((resp: any) => (
                        <div key={resp.id} className="response-item">
                          <p className="question">{resp.question.question}</p>
                          <p className="answer">
                            {resp.question.type === "RATING_1_5" ? (
                              <span className="rating">
                                {[1, 2, 3, 4, 5].map((n) => (
                                  <span
                                    key={n}
                                    className={
                                      n <= parseInt(resp.value)
                                        ? "star filled"
                                        : "star"
                                    }
                                  >
                                    ★
                                  </span>
                                ))}
                                ({resp.value}/5)
                              </span>
                            ) : (
                              resp.value
                            )}
                          </p>
                        </div>
                      ))}
                    </div>
                  </details>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      <style jsx>{`
        .page-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 2rem;
        }
        .stats-row {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
          gap: 1rem;
          margin-bottom: 2rem;
        }
        .stat-card {
          background: var(--card-bg);
          border: 1px solid var(--border);
          border-radius: 0.5rem;
          padding: 1rem;
          text-align: center;
        }
        .stat-value {
          display: block;
          font-size: 2rem;
          font-weight: 700;
          color: var(--primary);
        }
        .stat-label {
          color: var(--muted);
          font-size: 0.875rem;
        }
        .users-list {
          display: flex;
          flex-direction: column;
          gap: 1.5rem;
        }
        .user-card {
          padding: 1.5rem;
        }
        .user-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          margin-bottom: 1rem;
          padding-bottom: 1rem;
          border-bottom: 1px solid var(--border);
        }
        .user-info h3 {
          margin: 0 0 0.25rem 0;
        }
        .email {
          color: var(--muted);
          font-size: 0.875rem;
        }
        .role-badge {
          background: var(--background);
          padding: 0.25rem 0.75rem;
          border-radius: 1rem;
          font-size: 0.75rem;
          text-transform: uppercase;
        }
        .submissions-list {
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
        }
        .submission-details {
          border: 1px solid var(--border);
          border-radius: 0.5rem;
          overflow: hidden;
        }
        .submission-details summary {
          display: flex;
          justify-content: space-between;
          padding: 0.75rem 1rem;
          cursor: pointer;
          background: var(--background);
        }
        .submission-details summary:hover {
          background: var(--border);
        }
        .form-title {
          font-weight: 600;
        }
        .submission-date {
          color: var(--muted);
          font-size: 0.875rem;
        }
        .responses-content {
          padding: 1rem;
          display: flex;
          flex-direction: column;
          gap: 1rem;
        }
        .response-item {
          padding: 0.75rem;
          background: var(--background);
          border-radius: 0.5rem;
        }
        .question {
          font-weight: 600;
          font-size: 0.875rem;
          margin-bottom: 0.5rem;
        }
        .answer {
          margin: 0;
          white-space: pre-wrap;
        }
        .rating {
          display: inline-flex;
          align-items: center;
          gap: 0.25rem;
        }
        .star {
          color: var(--border);
          font-size: 1.25rem;
        }
        .star.filled {
          color: #eab308;
        }
      `}</style>
    </main>
  );
}

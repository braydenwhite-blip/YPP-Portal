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

    </main>
  );
}

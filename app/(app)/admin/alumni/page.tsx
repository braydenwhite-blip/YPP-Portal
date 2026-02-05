import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import {
  getAllAlumniProfiles,
  grantAward,
  createCollegeAdvisor,
} from "@/lib/alumni-actions";
import { prisma } from "@/lib/prisma";

export default async function AdminAlumniPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    include: { roles: true },
  });

  if (!user?.roles.some((r) => r.role === "ADMIN")) {
    redirect("/");
  }

  const alumniProfiles = await getAllAlumniProfiles();

  // Get all users for award/advisor assignment
  const allUsers = await prisma.user.findMany({
    select: { id: true, name: true, email: true, primaryRole: true },
    orderBy: { name: "asc" },
  });

  // Get existing advisors
  const advisors = await prisma.collegeAdvisor.findMany({
    include: {
      user: { select: { id: true, name: true } },
      _count: { select: { advisees: true } },
    },
  });

  return (
    <main className="main-content admin-alumni-page">
      <h1>Manage Alumni & Awards</h1>

      <div className="admin-grid">
        {/* Grant Award */}
        <section className="card">
          <h2>Grant Award</h2>
          <form action={grantAward}>
            <div className="form-group">
              <label>Recipient</label>
              <select name="recipientId" required>
                <option value="">Select a user...</option>
                {allUsers.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name} ({u.email})
                  </option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label>Award Name</label>
              <input
                type="text"
                name="name"
                required
                placeholder="e.g., Bronze Instructor Award"
              />
            </div>
            <div className="form-group">
              <label>Award Type (for tier benefits)</label>
              <select name="type">
                <option value="">No tier (custom award)</option>
                <option value="BRONZE_INSTRUCTOR">Bronze Instructor</option>
                <option value="BRONZE_ACHIEVEMENT">Bronze Achievement</option>
                <option value="SILVER_INSTRUCTOR">Silver Instructor</option>
                <option value="SILVER_ACHIEVEMENT">Silver Achievement</option>
                <option value="GOLD_INSTRUCTOR">Gold Instructor</option>
                <option value="GOLD_ACHIEVEMENT">Gold Achievement</option>
              </select>
            </div>
            <div className="form-group">
              <label>Description</label>
              <textarea
                name="description"
                rows={2}
                placeholder="Award description..."
              />
            </div>
            <button type="submit" className="btn btn-primary">
              Grant Award
            </button>
          </form>
        </section>

        {/* Create College Advisor */}
        <section className="card">
          <h2>Create College Advisor</h2>
          <form action={createCollegeAdvisor}>
            <div className="form-group">
              <label>User</label>
              <select name="userId" required>
                <option value="">Select a user...</option>
                {allUsers.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name} ({u.primaryRole})
                  </option>
                ))}
              </select>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label>College</label>
                <input type="text" name="college" required placeholder="College name" />
              </div>
              <div className="form-group">
                <label>Major</label>
                <input type="text" name="major" placeholder="Major" />
              </div>
            </div>
            <div className="form-group">
              <label>Availability</label>
              <input
                type="text"
                name="availability"
                placeholder="e.g., Weekends, Evenings"
              />
            </div>
            <div className="form-group">
              <label>Bio</label>
              <textarea name="bio" rows={2} placeholder="Advisor bio..." />
            </div>
            <button type="submit" className="btn btn-primary">
              Create Advisor
            </button>
          </form>
        </section>

        {/* Current Advisors */}
        <section className="card advisors-section">
          <h2>College Advisors ({advisors.length})</h2>
          {advisors.length === 0 ? (
            <p className="empty">No college advisors created yet.</p>
          ) : (
            <div className="advisors-list">
              {advisors.map((advisor) => (
                <div key={advisor.id} className="advisor-item">
                  <div className="advisor-info">
                    <strong>{advisor.user.name}</strong>
                    <span className="college">{advisor.college}</span>
                  </div>
                  <div className="advisor-stats">
                    <span>{advisor._count.advisees} advisees</span>
                    <span
                      className={`status ${advisor.isActive ? "active" : "inactive"}`}
                    >
                      {advisor.isActive ? "Active" : "Inactive"}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Alumni Profiles */}
        <section className="card profiles-section">
          <h2>Alumni Profiles ({alumniProfiles.length})</h2>
          {alumniProfiles.length === 0 ? (
            <p className="empty">No alumni profiles created yet.</p>
          ) : (
            <div className="profiles-table-wrapper">
              <table className="profiles-table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Graduation</th>
                    <th>College</th>
                    <th>Awards</th>
                    <th>Visible</th>
                  </tr>
                </thead>
                <tbody>
                  {alumniProfiles.map((profile) => (
                    <tr key={profile.id}>
                      <td>
                        <strong>{profile.user.name}</strong>
                        <span className="email">{profile.user.email}</span>
                      </td>
                      <td>{profile.graduationYear || "-"}</td>
                      <td>{profile.college || "-"}</td>
                      <td>
                        {profile.user.awards.length > 0 ? (
                          <div className="awards">
                            {profile.user.awards.slice(0, 2).map((a) => (
                              <span key={a.id} className="award-badge">
                                {a.name}
                              </span>
                            ))}
                            {profile.user.awards.length > 2 && (
                              <span className="more">
                                +{profile.user.awards.length - 2}
                              </span>
                            )}
                          </div>
                        ) : (
                          "-"
                        )}
                      </td>
                      <td>
                        {profile.isVisible ? (
                          <span className="visible">Yes</span>
                        ) : (
                          <span className="hidden">No</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>

      <style>{`

        .admin-alumni-page .admin-grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 1.5rem;
        }
        @media (max-width: 768px) {
          .admin-alumni-page .admin-grid {
            grid-template-columns: 1fr;
          }
        }
        .admin-alumni-page .card {
          padding: 1.5rem;
        }
        .admin-alumni-page .card h2 {
          margin: 0 0 1rem;
        }
        .admin-alumni-page .form-group {
          margin-bottom: 1rem;
        }
        .admin-alumni-page .form-group label {
          display: block;
          font-weight: 600;
          margin-bottom: 0.5rem;
          font-size: 0.875rem;
        }
        .admin-alumni-page input,
        .admin-alumni-page textarea,
        .admin-alumni-page select {
          width: 100%;
          padding: 0.75rem;
          border: 1px solid var(--border);
          border-radius: 0.5rem;
        }
        .admin-alumni-page .form-row {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 1rem;
        }
        .admin-alumni-page .advisors-section,
        .admin-alumni-page .profiles-section {
          grid-column: span 2;
        }
        .admin-alumni-page .empty {
          color: var(--muted);
          font-style: italic;
        }
        .admin-alumni-page .advisors-list {
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
        }
        .admin-alumni-page .advisor-item {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 1rem;
          background: var(--background);
          border-radius: 0.5rem;
        }
        .admin-alumni-page .advisor-info {
          display: flex;
          flex-direction: column;
        }
        .admin-alumni-page .college {
          font-size: 0.875rem;
          color: var(--muted);
        }
        .admin-alumni-page .advisor-stats {
          display: flex;
          gap: 1rem;
          align-items: center;
          font-size: 0.875rem;
        }
        .admin-alumni-page .status {
          padding: 0.25rem 0.5rem;
          border-radius: 0.25rem;
          font-size: 0.75rem;
        }
        .admin-alumni-page .status.active {
          background: #dcfce7;
          color: #166534;
        }
        .admin-alumni-page .status.inactive {
          background: #fee2e2;
          color: #991b1b;
        }
        .admin-alumni-page .profiles-table-wrapper {
          overflow-x: auto;
        }
        .admin-alumni-page .profiles-table {
          width: 100%;
          border-collapse: collapse;
        }
        .admin-alumni-page .profiles-table th,
        .admin-alumni-page .profiles-table td {
          padding: 0.75rem;
          text-align: left;
          border-bottom: 1px solid var(--border);
        }
        .admin-alumni-page .profiles-table th {
          font-weight: 600;
          font-size: 0.875rem;
          color: var(--muted);
          background: var(--background);
        }
        .admin-alumni-page .email {
          display: block;
          font-size: 0.75rem;
          color: var(--muted);
        }
        .admin-alumni-page .awards {
          display: flex;
          flex-wrap: wrap;
          gap: 0.25rem;
        }
        .admin-alumni-page .award-badge {
          font-size: 0.75rem;
          padding: 0.125rem 0.5rem;
          background: #fef3c7;
          color: #92400e;
          border-radius: 0.25rem;
        }
        .admin-alumni-page .more {
          font-size: 0.75rem;
          color: var(--muted);
        }
        .admin-alumni-page .visible {
          color: #166534;
        }
        .admin-alumni-page .hidden {
          color: #991b1b;
        }
      
`}</style>
    </main>
  );
}

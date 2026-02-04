import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { getChapterApplicants } from "@/lib/chapter-actions";
import Link from "next/link";

export default async function ChapterApplicantsPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  const applications = await getChapterApplicants();

  // Group by status
  const statusGroups = {
    pending: applications.filter(
      (a) =>
        a.status === "SUBMITTED" ||
        a.status === "UNDER_REVIEW" ||
        a.status === "INTERVIEW_SCHEDULED"
    ),
    completed: applications.filter(
      (a) => a.status === "ACCEPTED" || a.status === "REJECTED"
    ),
    withdrawn: applications.filter((a) => a.status === "WITHDRAWN"),
  };

  const statusColors: Record<string, string> = {
    SUBMITTED: "blue",
    UNDER_REVIEW: "yellow",
    INTERVIEW_SCHEDULED: "purple",
    INTERVIEW_COMPLETED: "indigo",
    ACCEPTED: "green",
    REJECTED: "red",
    WITHDRAWN: "gray",
  };

  return (
    <main className="main-content">
      <div className="page-header">
        <div>
          <Link href="/chapter" className="back-link">
            ← Back to Dashboard
          </Link>
          <h1>Chapter Applicants</h1>
        </div>
      </div>

      {/* Stats */}
      <div className="stats-row">
        <div className="stat-card">
          <span className="stat-value">{applications.length}</span>
          <span className="stat-label">Total Applications</span>
        </div>
        <div className="stat-card highlight">
          <span className="stat-value">{statusGroups.pending.length}</span>
          <span className="stat-label">Pending Review</span>
        </div>
        <div className="stat-card">
          <span className="stat-value">
            {applications.filter((a) => a.status === "ACCEPTED").length}
          </span>
          <span className="stat-label">Accepted</span>
        </div>
        <div className="stat-card">
          <span className="stat-value">
            {applications.filter((a) => a.status === "REJECTED").length}
          </span>
          <span className="stat-label">Rejected</span>
        </div>
      </div>

      {applications.length === 0 ? (
        <div className="card">
          <p className="empty">No applications received yet.</p>
        </div>
      ) : (
        <>
          {/* Pending Applications */}
          {statusGroups.pending.length > 0 && (
            <section className="applications-section">
              <h2>Pending Applications ({statusGroups.pending.length})</h2>
              <div className="applications-grid">
                {statusGroups.pending.map((app) => (
                  <div key={app.id} className="card application-card">
                    <div className="application-header">
                      <div>
                        <h3>{app.applicant.name}</h3>
                        <p className="email">{app.applicant.email}</p>
                      </div>
                      <span className={`status status-${statusColors[app.status]}`}>
                        {app.status.replace(/_/g, " ")}
                      </span>
                    </div>
                    <div className="position-info">
                      <span className="position-title">{app.position.title}</span>
                      <span className="position-type">{app.position.type}</span>
                    </div>
                    <div className="application-meta">
                      <span>
                        Applied:{" "}
                        {new Date(app.submittedAt).toLocaleDateString()}
                      </span>
                      {app.interviewSlots.length > 0 && (
                        <span>
                          Interview:{" "}
                          {new Date(
                            app.interviewSlots[0].scheduledAt
                          ).toLocaleDateString()}
                        </span>
                      )}
                    </div>
                    <div className="application-actions">
                      {app.resumeUrl && (
                        <a
                          href={app.resumeUrl}
                          target="_blank"
                          className="btn btn-sm btn-secondary"
                        >
                          View Resume
                        </a>
                      )}
                      <Link
                        href={`/applications/${app.id}`}
                        className="btn btn-sm btn-primary"
                      >
                        Review
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Completed Applications */}
          {statusGroups.completed.length > 0 && (
            <section className="applications-section">
              <h2>Completed ({statusGroups.completed.length})</h2>
              <div className="applications-table-wrapper">
                <table className="applications-table">
                  <thead>
                    <tr>
                      <th>Applicant</th>
                      <th>Position</th>
                      <th>Status</th>
                      <th>Decision Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {statusGroups.completed.map((app) => (
                      <tr key={app.id}>
                        <td>
                          <strong>{app.applicant.name}</strong>
                          <span className="email">{app.applicant.email}</span>
                        </td>
                        <td>{app.position.title}</td>
                        <td>
                          <span
                            className={`status status-${statusColors[app.status]}`}
                          >
                            {app.status}
                          </span>
                        </td>
                        <td>
                          {app.decision
                            ? new Date(
                                app.decision.decidedAt
                              ).toLocaleDateString()
                            : "-"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {/* Withdrawn */}
          {statusGroups.withdrawn.length > 0 && (
            <section className="applications-section">
              <h2>Withdrawn ({statusGroups.withdrawn.length})</h2>
              <div className="applications-table-wrapper">
                <table className="applications-table">
                  <thead>
                    <tr>
                      <th>Applicant</th>
                      <th>Position</th>
                      <th>Applied Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {statusGroups.withdrawn.map((app) => (
                      <tr key={app.id} className="withdrawn">
                        <td>{app.applicant.name}</td>
                        <td>{app.position.title}</td>
                        <td>
                          {new Date(app.submittedAt).toLocaleDateString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}
        </>
      )}

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
        .stat-card.highlight {
          border-color: var(--primary);
          background: linear-gradient(
            135deg,
            rgba(124, 58, 237, 0.05),
            rgba(124, 58, 237, 0.1)
          );
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
        .applications-section {
          margin-bottom: 2rem;
        }
        .applications-section h2 {
          margin: 0 0 1rem 0;
          font-size: 1.125rem;
        }
        .applications-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
          gap: 1rem;
        }
        .application-card {
          padding: 1.5rem;
        }
        .application-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          margin-bottom: 1rem;
        }
        .application-header h3 {
          margin: 0;
        }
        .email {
          display: block;
          font-size: 0.875rem;
          color: var(--muted);
        }
        .status {
          padding: 0.25rem 0.75rem;
          border-radius: 1rem;
          font-size: 0.75rem;
          font-weight: 500;
        }
        .status-blue {
          background: #dbeafe;
          color: #1e40af;
        }
        .status-yellow {
          background: #fef9c3;
          color: #854d0e;
        }
        .status-purple {
          background: #f3e8ff;
          color: #6b21a8;
        }
        .status-indigo {
          background: #e0e7ff;
          color: #3730a3;
        }
        .status-green {
          background: #dcfce7;
          color: #166534;
        }
        .status-red {
          background: #fee2e2;
          color: #991b1b;
        }
        .status-gray {
          background: #f3f4f6;
          color: #6b7280;
        }
        .position-info {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          margin-bottom: 1rem;
        }
        .position-title {
          font-weight: 600;
        }
        .position-type {
          font-size: 0.75rem;
          color: var(--muted);
          background: var(--background);
          padding: 0.125rem 0.5rem;
          border-radius: 0.25rem;
        }
        .application-meta {
          display: flex;
          justify-content: space-between;
          font-size: 0.875rem;
          color: var(--muted);
          margin-bottom: 1rem;
          padding-bottom: 1rem;
          border-bottom: 1px solid var(--border);
        }
        .application-actions {
          display: flex;
          gap: 0.5rem;
        }
        .btn-sm {
          padding: 0.5rem 1rem;
          font-size: 0.875rem;
        }
        .applications-table-wrapper {
          background: var(--card-bg);
          border: 1px solid var(--border);
          border-radius: 0.5rem;
          overflow-x: auto;
        }
        .applications-table {
          width: 100%;
          border-collapse: collapse;
        }
        .applications-table th,
        .applications-table td {
          padding: 1rem;
          text-align: left;
          border-bottom: 1px solid var(--border);
        }
        .applications-table th {
          background: var(--background);
          font-weight: 600;
          font-size: 0.875rem;
          color: var(--muted);
        }
        .applications-table tr:last-child td {
          border-bottom: none;
        }
        .applications-table td .email {
          display: block;
        }
        .withdrawn td {
          color: var(--muted);
        }
        .empty {
          color: var(--muted);
          font-style: italic;
        }
      `}</style>
    </main>
  );
}

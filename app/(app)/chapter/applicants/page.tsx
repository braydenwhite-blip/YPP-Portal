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

    </main>
  );
}

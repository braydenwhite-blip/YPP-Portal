import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import {
  getChapterMarketing,
  addMarketingStats,
  addMarketingGoal,
} from "@/lib/chapter-actions";
import Link from "next/link";

export default async function ChapterMarketingPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  const { stats, goals } = await getChapterMarketing();

  // Calculate totals for the year
  const yearStats = stats.reduce(
    (acc, s) => ({
      socialReach: acc.socialReach + (s.socialReach || 0),
      newInquiries: acc.newInquiries + (s.newInquiries || 0),
      enrollments: acc.enrollments + (s.enrollments || 0),
    }),
    { socialReach: 0, newInquiries: 0, enrollments: 0 }
  );

  return (
    <main className="main-content">
      <div className="page-header">
        <div>
          <Link href="/chapter" className="back-link">
            ← Back to Dashboard
          </Link>
          <h1>Marketing Dashboard</h1>
        </div>
      </div>

      {/* Year-to-date Stats */}
      <div className="stats-row">
        <div className="stat-card">
          <span className="stat-value">
            {yearStats.socialReach.toLocaleString()}
          </span>
          <span className="stat-label">Total Social Reach</span>
        </div>
        <div className="stat-card">
          <span className="stat-value">{yearStats.newInquiries}</span>
          <span className="stat-label">Total Inquiries</span>
        </div>
        <div className="stat-card">
          <span className="stat-value">{yearStats.enrollments}</span>
          <span className="stat-label">Total Enrollments</span>
        </div>
        <div className="stat-card">
          <span className="stat-value">
            {stats.length > 0
              ? Math.round(
                  (yearStats.enrollments / yearStats.newInquiries) * 100
                ) || 0
              : 0}
            %
          </span>
          <span className="stat-label">Conversion Rate</span>
        </div>
      </div>

      <div className="dashboard-grid">
        {/* Add Monthly Stats */}
        <section className="card">
          <h2>Log Monthly Stats</h2>
          <form action={addMarketingStats}>
            <div className="form-group">
              <label>Month</label>
              <input
                type="month"
                name="month"
                required
                defaultValue={new Date().toISOString().slice(0, 7)}
              />
            </div>
            <div className="form-row">
              <div className="form-group">
                <label>Social Reach</label>
                <input
                  type="number"
                  name="socialReach"
                  placeholder="0"
                  min="0"
                />
              </div>
              <div className="form-group">
                <label>New Inquiries</label>
                <input
                  type="number"
                  name="newInquiries"
                  placeholder="0"
                  min="0"
                />
              </div>
              <div className="form-group">
                <label>Enrollments</label>
                <input
                  type="number"
                  name="enrollments"
                  placeholder="0"
                  min="0"
                />
              </div>
            </div>
            <div className="form-group">
              <label>Notes</label>
              <textarea
                name="notes"
                rows={2}
                placeholder="Any notes about this month..."
              />
            </div>
            <button type="submit" className="btn btn-primary">
              Save Stats
            </button>
          </form>
        </section>

        {/* Goals */}
        <section className="card">
          <h2>Marketing Goals</h2>
          {goals.length === 0 ? (
            <p className="empty">No goals set yet.</p>
          ) : (
            <div className="goals-list">
              {goals.map((goal) => (
                <div key={goal.id} className="goal-item">
                  <div className="goal-info">
                    <strong>{goal.metric}</strong>
                    <span className="target">Target: {goal.target}</span>
                  </div>
                  {goal.deadline && (
                    <span className="deadline">
                      Due: {new Date(goal.deadline).toLocaleDateString()}
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}

          <details className="add-goal">
            <summary>Add New Goal</summary>
            <form action={addMarketingGoal} className="goal-form">
              <div className="form-group">
                <label>Metric</label>
                <input
                  type="text"
                  name="metric"
                  required
                  placeholder="e.g., Monthly Enrollments"
                />
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>Target</label>
                  <input type="number" name="target" required min="1" />
                </div>
                <div className="form-group">
                  <label>Deadline (optional)</label>
                  <input type="date" name="deadline" />
                </div>
              </div>
              <button type="submit" className="btn btn-primary btn-sm">
                Add Goal
              </button>
            </form>
          </details>
        </section>

        {/* Monthly Stats History */}
        <section className="card stats-history">
          <h2>Monthly History</h2>
          {stats.length === 0 ? (
            <p className="empty">No stats recorded yet.</p>
          ) : (
            <div className="stats-table-wrapper">
              <table className="stats-table">
                <thead>
                  <tr>
                    <th>Month</th>
                    <th>Social Reach</th>
                    <th>Inquiries</th>
                    <th>Enrollments</th>
                    <th>Notes</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.map((s) => (
                    <tr key={s.id}>
                      <td>
                        {new Date(s.month).toLocaleDateString("en-US", {
                          month: "short",
                          year: "numeric",
                        })}
                      </td>
                      <td>{s.socialReach?.toLocaleString() || "-"}</td>
                      <td>{s.newInquiries || "-"}</td>
                      <td>{s.enrollments || "-"}</td>
                      <td className="notes">{s.notes || "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* Chart placeholder */}
        <section className="card chart-section">
          <h2>Trend Chart</h2>
          <div className="chart-placeholder">
            <div className="chart-bars">
              {stats
                .slice(0, 6)
                .reverse()
                .map((s, i) => (
                  <div key={s.id} className="chart-bar-group">
                    <div
                      className="chart-bar enrollments"
                      style={{
                        height: `${Math.min((s.enrollments || 0) * 10, 100)}px`,
                      }}
                    />
                    <div
                      className="chart-bar inquiries"
                      style={{
                        height: `${Math.min((s.newInquiries || 0) * 5, 100)}px`,
                      }}
                    />
                    <span className="chart-label">
                      {new Date(s.month).toLocaleDateString("en-US", {
                        month: "short",
                      })}
                    </span>
                  </div>
                ))}
            </div>
            <div className="chart-legend">
              <span className="legend-item">
                <span className="legend-color enrollments" /> Enrollments
              </span>
              <span className="legend-item">
                <span className="legend-color inquiries" /> Inquiries
              </span>
            </div>
          </div>
        </section>
      </div>

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
          padding: 1.5rem;
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
        .dashboard-grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 1.5rem;
        }
        @media (max-width: 768px) {
          .dashboard-grid {
            grid-template-columns: 1fr;
          }
        }
        .card {
          padding: 1.5rem;
        }
        .card h2 {
          margin: 0 0 1rem 0;
          font-size: 1.125rem;
        }
        .empty {
          color: var(--muted);
          font-style: italic;
        }
        .form-group {
          margin-bottom: 1rem;
        }
        .form-group label {
          display: block;
          font-weight: 600;
          margin-bottom: 0.5rem;
          font-size: 0.875rem;
        }
        input,
        textarea {
          width: 100%;
          padding: 0.75rem;
          border: 1px solid var(--border);
          border-radius: 0.5rem;
        }
        .form-row {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 0.5rem;
        }
        .goals-list {
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
          margin-bottom: 1rem;
        }
        .goal-item {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 0.75rem;
          background: var(--background);
          border-radius: 0.5rem;
        }
        .goal-info {
          display: flex;
          flex-direction: column;
        }
        .target {
          font-size: 0.875rem;
          color: var(--muted);
        }
        .deadline {
          font-size: 0.75rem;
          color: var(--muted);
        }
        .add-goal {
          margin-top: 1rem;
        }
        .add-goal summary {
          cursor: pointer;
          color: var(--primary);
          font-weight: 600;
        }
        .goal-form {
          margin-top: 1rem;
          padding: 1rem;
          background: var(--background);
          border-radius: 0.5rem;
        }
        .goal-form .form-row {
          grid-template-columns: repeat(2, 1fr);
        }
        .btn-sm {
          padding: 0.5rem 1rem;
          font-size: 0.875rem;
        }
        .stats-history {
          grid-column: span 2;
        }
        .stats-table-wrapper {
          overflow-x: auto;
        }
        .stats-table {
          width: 100%;
          border-collapse: collapse;
        }
        .stats-table th,
        .stats-table td {
          padding: 0.75rem;
          text-align: left;
          border-bottom: 1px solid var(--border);
        }
        .stats-table th {
          font-weight: 600;
          font-size: 0.875rem;
          color: var(--muted);
        }
        .notes {
          max-width: 200px;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .chart-section {
          grid-column: span 2;
        }
        .chart-placeholder {
          padding: 1rem;
          background: var(--background);
          border-radius: 0.5rem;
        }
        .chart-bars {
          display: flex;
          justify-content: space-around;
          align-items: flex-end;
          height: 120px;
          padding: 0 1rem;
        }
        .chart-bar-group {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 0.25rem;
        }
        .chart-bar {
          width: 20px;
          border-radius: 2px;
          min-height: 4px;
        }
        .chart-bar.enrollments {
          background: var(--primary);
        }
        .chart-bar.inquiries {
          background: #eab308;
        }
        .chart-label {
          font-size: 0.75rem;
          color: var(--muted);
          margin-top: 0.5rem;
        }
        .chart-legend {
          display: flex;
          justify-content: center;
          gap: 2rem;
          margin-top: 1rem;
        }
        .legend-item {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          font-size: 0.875rem;
        }
        .legend-color {
          width: 12px;
          height: 12px;
          border-radius: 2px;
        }
        .legend-color.enrollments {
          background: var(--primary);
        }
        .legend-color.inquiries {
          background: #eab308;
        }
      `}</style>
    </main>
  );
}

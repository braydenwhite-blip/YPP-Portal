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

    </main>
  );
}

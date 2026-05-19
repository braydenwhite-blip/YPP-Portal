import { requirePageRoles } from "@/lib/page-guards";
import {
  getChapterMarketing,
  addMarketingStats,
  addMarketingGoal,
} from "@/lib/chapter-actions";
import Link from "next/link";

export const dynamic = "force-dynamic";

const fieldLabel = { fontSize: 13, fontWeight: 600 } as const;
const fieldWrap = { display: "grid", gap: 4 } as const;

export default async function ChapterMarketingPage() {
  await requirePageRoles(["CHAPTER_PRESIDENT", "ADMIN"]);

  const { stats, goals } = await getChapterMarketing();

  const yearStats = stats.reduce(
    (acc, s) => ({
      socialReach: acc.socialReach + (s.socialReach || 0),
      newInquiries: acc.newInquiries + (s.newInquiries || 0),
      enrollments: acc.enrollments + (s.enrollments || 0),
    }),
    { socialReach: 0, newInquiries: 0, enrollments: 0 },
  );

  // Guard against divide-by-zero — an Infinity/NaN conversion rate.
  const conversionRate =
    yearStats.newInquiries > 0
      ? Math.round((yearStats.enrollments / yearStats.newInquiries) * 100)
      : 0;

  // Honest bar chart: every bar shares one scale (the largest value shown),
  // so enrollments and inquiries are directly comparable.
  const recentStats = [...stats].slice(0, 6).reverse();
  const chartMax = Math.max(
    1,
    ...recentStats.flatMap((s) => [s.enrollments || 0, s.newInquiries || 0]),
  );

  return (
    <main className="main-content">
      <div className="page-header">
        <div>
          <Link href="/chapter" className="back-link">
            ← Command Center
          </Link>
          <h1>Chapter Marketing</h1>
          <p className="page-subtitle">
            Log outreach each month and track progress toward your growth goals.
          </p>
        </div>
      </div>

      <div className="stats-grid">
        <div className="stat-card">
          <span className="stat-value">{yearStats.socialReach.toLocaleString()}</span>
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
          <span className="stat-value">{conversionRate}%</span>
          <span className="stat-label">Inquiry → Enrollment</span>
        </div>
      </div>

      <div className="grid two" style={{ alignItems: "start", marginTop: 16 }}>
        <section className="card">
          <h2 style={{ marginTop: 0, fontSize: 16 }}>Log Monthly Stats</h2>
          <form action={addMarketingStats} style={{ display: "grid", gap: 12 }}>
            <label style={fieldWrap}>
              <span style={fieldLabel}>Month</span>
              <input
                type="month"
                name="month"
                required
                className="input"
                defaultValue={new Date().toISOString().slice(0, 7)}
              />
            </label>
            <div className="grid three" style={{ gap: 10 }}>
              <label style={fieldWrap}>
                <span style={fieldLabel}>Social Reach</span>
                <input type="number" name="socialReach" placeholder="0" min="0" className="input" />
              </label>
              <label style={fieldWrap}>
                <span style={fieldLabel}>Inquiries</span>
                <input type="number" name="newInquiries" placeholder="0" min="0" className="input" />
              </label>
              <label style={fieldWrap}>
                <span style={fieldLabel}>Enrollments</span>
                <input type="number" name="enrollments" placeholder="0" min="0" className="input" />
              </label>
            </div>
            <label style={fieldWrap}>
              <span style={fieldLabel}>Notes</span>
              <textarea
                name="notes"
                rows={2}
                className="input"
                placeholder="What worked this month?"
              />
            </label>
            <button type="submit" className="button">
              Save Month
            </button>
          </form>
        </section>

        <section className="card">
          <h2 style={{ marginTop: 0, fontSize: 16 }}>Growth Goals</h2>
          {goals.length === 0 ? (
            <p style={{ color: "var(--muted)", fontSize: 14 }}>
              No goals set yet — add one below to give your outreach a target.
            </p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {goals.map((goal) => (
                <div
                  key={goal.id}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    gap: 10,
                    padding: "8px 12px",
                    borderRadius: 8,
                    background: "var(--surface-alt, #f1f5f9)",
                  }}
                >
                  <div>
                    <strong style={{ fontSize: 14 }}>{goal.metric}</strong>
                    <div style={{ fontSize: 12, color: "var(--muted)" }}>
                      Target: {goal.target}
                    </div>
                  </div>
                  {goal.deadline && (
                    <span style={{ fontSize: 12, color: "var(--muted)" }}>
                      Due {new Date(goal.deadline).toLocaleDateString()}
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}

          <details style={{ marginTop: 12 }}>
            <summary style={{ cursor: "pointer", fontSize: 13, fontWeight: 600, color: "var(--ypp-purple)" }}>
              + Add a goal
            </summary>
            <form action={addMarketingGoal} style={{ display: "grid", gap: 10, marginTop: 10 }}>
              <label style={fieldWrap}>
                <span style={fieldLabel}>Metric</span>
                <input
                  type="text"
                  name="metric"
                  required
                  className="input"
                  placeholder="e.g. Monthly Enrollments"
                />
              </label>
              <div className="grid two" style={{ gap: 10 }}>
                <label style={fieldWrap}>
                  <span style={fieldLabel}>Target</span>
                  <input type="number" name="target" required min="1" className="input" />
                </label>
                <label style={fieldWrap}>
                  <span style={fieldLabel}>Deadline (optional)</span>
                  <input type="date" name="deadline" className="input" />
                </label>
              </div>
              <button type="submit" className="button small">
                Add Goal
              </button>
            </form>
          </details>
        </section>
      </div>

      <section className="card" style={{ marginTop: 16 }}>
        <h2 style={{ marginTop: 0, fontSize: 16 }}>Recent Trend</h2>
        {recentStats.length === 0 ? (
          <p style={{ color: "var(--muted)", fontSize: 14, margin: 0 }}>
            Log a month above to start seeing your trend.
          </p>
        ) : (
          <>
            <div
              style={{
                display: "flex",
                gap: 16,
                alignItems: "flex-end",
                height: 150,
                padding: "8px 4px 0",
              }}
            >
              {recentStats.map((s) => (
                <div
                  key={s.id}
                  style={{
                    flex: 1,
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    gap: 6,
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      gap: 4,
                      alignItems: "flex-end",
                      height: 110,
                      width: "100%",
                      justifyContent: "center",
                    }}
                  >
                    <div
                      title={`${s.enrollments || 0} enrollments`}
                      style={{
                        width: 14,
                        borderRadius: "3px 3px 0 0",
                        background: "var(--ypp-purple)",
                        height: `${((s.enrollments || 0) / chartMax) * 100}%`,
                        minHeight: 2,
                      }}
                    />
                    <div
                      title={`${s.newInquiries || 0} inquiries`}
                      style={{
                        width: 14,
                        borderRadius: "3px 3px 0 0",
                        background: "#93c5fd",
                        height: `${((s.newInquiries || 0) / chartMax) * 100}%`,
                        minHeight: 2,
                      }}
                    />
                  </div>
                  <span style={{ fontSize: 11, color: "var(--muted)" }}>
                    {new Date(s.month).toLocaleDateString("en-US", { month: "short" })}
                  </span>
                </div>
              ))}
            </div>
            <div style={{ display: "flex", gap: 16, marginTop: 10, fontSize: 12 }}>
              <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{ width: 10, height: 10, borderRadius: 2, background: "var(--ypp-purple)" }} />
                Enrollments
              </span>
              <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{ width: 10, height: 10, borderRadius: 2, background: "#93c5fd" }} />
                Inquiries
              </span>
            </div>
          </>
        )}
      </section>

      <section className="card" style={{ marginTop: 16 }}>
        <h2 style={{ marginTop: 0, fontSize: 16 }}>Monthly History</h2>
        {stats.length === 0 ? (
          <p style={{ color: "var(--muted)", fontSize: 14, margin: 0 }}>
            No stats recorded yet.
          </p>
        ) : (
          <div className="table-scroll">
            <table className="table">
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
                    <td>{s.socialReach?.toLocaleString() || "—"}</td>
                    <td>{s.newInquiries || "—"}</td>
                    <td>{s.enrollments || "—"}</td>
                    <td>{s.notes || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}

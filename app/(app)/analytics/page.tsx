import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { getStudentAnalytics } from "@/lib/ai-personalization-actions";
import { LEVELS } from "@/lib/xp-config";
import Link from "next/link";

export default async function AnalyticsDashboardPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");

  const { snapshot, historicalSnapshots, learningPaths, predictions } =
    await getStudentAnalytics(session.user.id);

  const currentLevel = LEVELS.find((l) => l.level === (snapshot?.level || 1));
  const nextLevel = LEVELS.find((l) => l.level === (snapshot?.level || 1) + 1);
  const xpToNext = nextLevel ? nextLevel.xpRequired - (snapshot?.totalXP || 0) : 0;
  const levelProgress = nextLevel
    ? (((snapshot?.totalXP || 0) - (currentLevel?.xpRequired || 0)) /
        (nextLevel.xpRequired - (currentLevel?.xpRequired || 0))) *
      100
    : 100;

  const practiceChange = snapshot
    ? snapshot.practiceMinutesThisWeek - snapshot.practiceMinutesLastWeek
    : 0;
  const xpChange = snapshot
    ? snapshot.xpGainedThisWeek - snapshot.xpGainedLastWeek
    : 0;

  const formatHours = (minutes: number) => {
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return h > 0 ? `${h}h ${m}m` : `${m}m`;
  };

  return (
    <div>
      <div className="topbar">
        <div>
          <p className="badge">Personal</p>
          <h1 className="page-title">Analytics Dashboard</h1>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <Link href="/analytics/predictions" className="button secondary">
            Predictions
          </Link>
          <Link href="/learn/path-generator" className="button primary">
            Learning Paths
          </Link>
        </div>
      </div>

      {/* Level & XP */}
      <div className="card" style={{ marginBottom: 24 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 16 }}>
          <div>
            <div style={{ fontSize: 14, color: "var(--text-secondary)" }}>Current Level</div>
            <div style={{ fontSize: 36, fontWeight: 700, color: "var(--ypp-purple)" }}>
              {currentLevel?.title || "Explorer"}
            </div>
            <div style={{ fontSize: 14, color: "var(--text-secondary)" }}>
              Level {snapshot?.level || 1} | {snapshot?.totalXP || 0} XP
            </div>
          </div>

          {nextLevel && (
            <div style={{ textAlign: "right", minWidth: 200 }}>
              <div style={{ fontSize: 13, color: "var(--text-secondary)" }}>
                Next: {nextLevel.title} ({xpToNext} XP to go)
              </div>
              <div style={{ width: 200, height: 10, background: "var(--gray-200)", borderRadius: 5, marginTop: 4, overflow: "hidden" }}>
                <div style={{ width: `${Math.min(levelProgress, 100)}%`, height: "100%", background: "var(--ypp-purple)", borderRadius: 5 }} />
              </div>
              <div style={{ fontSize: 12, color: "var(--ypp-purple)", marginTop: 4, fontWeight: 600 }}>
                {Math.round(levelProgress)}%
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid four" style={{ marginBottom: 24 }}>
        <div className="card">
          <div style={{ fontSize: 28, fontWeight: 700, color: "var(--ypp-purple)" }}>
            {formatHours(snapshot?.practiceMinutesThisWeek || 0)}
          </div>
          <div style={{ fontSize: 14, color: "var(--text-secondary)" }}>Practice This Week</div>
          {practiceChange !== 0 && (
            <div style={{ fontSize: 12, marginTop: 4, color: practiceChange > 0 ? "#16a34a" : "#ef4444" }}>
              {practiceChange > 0 ? "+" : ""}{formatHours(practiceChange)} vs last week
            </div>
          )}
        </div>

        <div className="card">
          <div style={{ fontSize: 28, fontWeight: 700, color: "var(--ypp-purple)" }}>
            {snapshot?.currentStreak || 0}
          </div>
          <div style={{ fontSize: 14, color: "var(--text-secondary)" }}>Day Streak</div>
          <div style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 4 }}>
            Best: {snapshot?.longestStreak || 0} days
          </div>
        </div>

        <div className="card">
          <div style={{ fontSize: 28, fontWeight: 700, color: "var(--ypp-purple)" }}>
            {snapshot?.xpGainedThisWeek || 0}
          </div>
          <div style={{ fontSize: 14, color: "var(--text-secondary)" }}>XP This Week</div>
          {xpChange !== 0 && (
            <div style={{ fontSize: 12, marginTop: 4, color: xpChange > 0 ? "#16a34a" : "#ef4444" }}>
              {xpChange > 0 ? "+" : ""}{xpChange} vs last week
            </div>
          )}
        </div>

        <div className="card">
          <div style={{ fontSize: 28, fontWeight: 700, color: "var(--ypp-purple)" }}>
            {snapshot?.activePassions || 0}
          </div>
          <div style={{ fontSize: 14, color: "var(--text-secondary)" }}>Active Passions</div>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24, marginBottom: 24 }}>
        {/* Productivity Insights */}
        <div className="card">
          <h3>Productivity Insights</h3>
          <div style={{ marginTop: 16, display: "flex", flexDirection: "column", gap: 12 }}>
            {snapshot?.mostProductiveDay && (
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0", borderBottom: "1px solid var(--border-light)" }}>
                <span style={{ fontSize: 14, color: "var(--text-secondary)" }}>Most productive day</span>
                <span style={{ fontWeight: 600 }}>{snapshot.mostProductiveDay}</span>
              </div>
            )}
            {snapshot?.mostProductiveHour !== null && snapshot?.mostProductiveHour !== undefined && (
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0", borderBottom: "1px solid var(--border-light)" }}>
                <span style={{ fontSize: 14, color: "var(--text-secondary)" }}>Peak hour</span>
                <span style={{ fontWeight: 600 }}>
                  {snapshot.mostProductiveHour > 12
                    ? `${snapshot.mostProductiveHour - 12}:00 PM`
                    : `${snapshot.mostProductiveHour}:00 AM`}
                </span>
              </div>
            )}
            {snapshot?.preferredSessionLength && (
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0", borderBottom: "1px solid var(--border-light)" }}>
                <span style={{ fontSize: 14, color: "var(--text-secondary)" }}>Avg session length</span>
                <span style={{ fontWeight: 600 }}>{formatHours(snapshot.preferredSessionLength)}</span>
              </div>
            )}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0", borderBottom: "1px solid var(--border-light)" }}>
              <span style={{ fontSize: 14, color: "var(--text-secondary)" }}>Sessions this month</span>
              <span style={{ fontWeight: 600 }}>{snapshot?.totalSessionsThisMonth || 0}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0" }}>
              <span style={{ fontSize: 14, color: "var(--text-secondary)" }}>Weekly average</span>
              <span style={{ fontWeight: 600 }}>{formatHours(Math.round(snapshot?.practiceMinutesAvg || 0))}</span>
            </div>
          </div>
        </div>

        {/* Class Engagement */}
        <div className="card">
          <h3>Class Engagement</h3>
          <div style={{ marginTop: 16, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            <div style={{ textAlign: "center", padding: 16, background: "var(--surface-alt)", borderRadius: "var(--radius-md)" }}>
              <div style={{ fontSize: 32, fontWeight: 700, color: "var(--ypp-purple)" }}>
                {snapshot?.classesEnrolled || 0}
              </div>
              <div style={{ fontSize: 13, color: "var(--text-secondary)" }}>Enrolled</div>
            </div>
            <div style={{ textAlign: "center", padding: 16, background: "var(--surface-alt)", borderRadius: "var(--radius-md)" }}>
              <div style={{ fontSize: 32, fontWeight: 700, color: "#16a34a" }}>
                {snapshot?.classesCompleted || 0}
              </div>
              <div style={{ fontSize: 13, color: "var(--text-secondary)" }}>Completed</div>
            </div>
            <div style={{ textAlign: "center", padding: 16, background: "var(--surface-alt)", borderRadius: "var(--radius-md)" }}>
              <div style={{ fontSize: 32, fontWeight: 700, color: "#3b82f6" }}>
                {snapshot?.assignmentsCompleted || 0}
              </div>
              <div style={{ fontSize: 13, color: "var(--text-secondary)" }}>Assignments Done</div>
            </div>
            <div style={{ textAlign: "center", padding: 16, background: "var(--surface-alt)", borderRadius: "var(--radius-md)" }}>
              <div style={{ fontSize: 32, fontWeight: 700, color: "#d97706" }}>
                {snapshot?.averageEnjoymentRating ? snapshot.averageEnjoymentRating.toFixed(1) : "—"}
              </div>
              <div style={{ fontSize: 13, color: "var(--text-secondary)" }}>Avg Enjoyment</div>
            </div>
          </div>
        </div>
      </div>

      {/* XP Trend (text-based since no chart library) */}
      {historicalSnapshots.length > 1 && (
        <div className="card" style={{ marginBottom: 24 }}>
          <h3>XP Growth Trend</h3>
          <div style={{ marginTop: 12, display: "flex", gap: 8, alignItems: "flex-end", height: 120 }}>
            {historicalSnapshots.slice(0, 10).reverse().map((snap, i) => {
              const maxXP = Math.max(...historicalSnapshots.map((s) => s.totalXP), 1);
              const height = Math.max((snap.totalXP / maxXP) * 100, 4);
              return (
                <div key={snap.id} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center" }}>
                  <div
                    style={{
                      width: "100%",
                      maxWidth: 40,
                      height: `${height}%`,
                      background: i === historicalSnapshots.length - 1 ? "var(--ypp-purple)" : "var(--ypp-purple-200)",
                      borderRadius: "4px 4px 0 0",
                      minHeight: 4,
                    }}
                    title={`${snap.totalXP} XP`}
                  />
                  <div style={{ fontSize: 10, color: "var(--text-secondary)", marginTop: 4 }}>
                    {new Date(snap.date).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Upcoming Predictions Preview */}
      {predictions.length > 0 && (
        <div className="card" style={{ marginBottom: 24 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <h3>Progress Predictions</h3>
            <Link href="/analytics/predictions" style={{ fontSize: 13, color: "var(--ypp-purple)" }}>
              View All &rarr;
            </Link>
          </div>
          <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 8 }}>
            {predictions.slice(0, 3).map((pred) => (
              <div
                key={pred.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  padding: "10px 12px",
                  background: "var(--surface-alt)",
                  borderRadius: "var(--radius-sm)",
                }}
              >
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 500, fontSize: 14 }}>{pred.title}</div>
                  <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>
                    Predicted: {new Date(pred.predictedDate).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                  </div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: "var(--ypp-purple)" }}>
                    {Math.round(pred.progressPct)}%
                  </div>
                  <div style={{ fontSize: 11, color: "var(--text-secondary)" }}>
                    {Math.round(pred.confidence * 100)}% confident
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Learning Paths Summary */}
      {learningPaths.length > 0 && (
        <div className="card">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <h3>Active Learning Paths</h3>
            <Link href="/learn/path-generator" style={{ fontSize: 13, color: "var(--ypp-purple)" }}>
              Manage Paths &rarr;
            </Link>
          </div>
          <div style={{ marginTop: 12, display: "flex", gap: 12, flexWrap: "wrap" }}>
            {learningPaths.map((path) => (
              <div
                key={path.id}
                style={{
                  padding: "8px 16px",
                  background: "var(--ypp-purple-50)",
                  borderRadius: "var(--radius-md)",
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                }}
              >
                <span style={{ fontWeight: 600 }}>{path.passionArea}</span>
                <span style={{ fontSize: 12, color: "var(--ypp-purple)" }}>
                  {Math.round(path.completionPct)}%
                </span>
                <span className={`pill ${path.status === "ACTIVE" ? "primary" : ""}`} style={{ fontSize: 10 }}>
                  {path.status}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

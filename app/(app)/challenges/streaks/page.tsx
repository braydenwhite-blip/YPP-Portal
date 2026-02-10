import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { getStreakData } from "@/lib/engagement-actions";
import Link from "next/link";

const MILESTONES = [7, 14, 30, 60, 90];
const MILESTONE_LABELS: Record<number, string> = {
  7: "1 Week", 14: "2 Weeks", 30: "1 Month", 60: "2 Months", 90: "3 Months",
};
const MILESTONE_COLORS: Record<number, string> = {
  7: "#3b82f6", 14: "#7c3aed", 30: "#d97706", 60: "#ec4899", 90: "#ef4444",
};

export default async function StreaksPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");

  const streakData = await getStreakData();

  return (
    <div>
      <div className="topbar">
        <div>
          <h1 className="page-title">Achievement Streaks</h1>
          <p style={{ fontSize: 13, color: "var(--text-secondary)", marginTop: 2 }}>
            Keep your momentum going and unlock milestones
          </p>
        </div>
        <Link href="/challenges" className="button secondary">All Challenges</Link>
      </div>

      {/* Overall Best Streak */}
      <div className="card" style={{ textAlign: "center", marginBottom: 24, background: "linear-gradient(135deg, #fff 60%, #fef3c7)" }}>
        <div style={{ fontSize: 13, color: "var(--text-secondary)" }}>Your Best Streak</div>
        <div style={{ fontSize: 56, fontWeight: 800, color: "#d97706", lineHeight: 1.1, margin: "8px 0" }}>
          {streakData.overallBestStreak}
        </div>
        <div style={{ fontSize: 16, color: "var(--text-secondary)" }}>days</div>
      </div>

      {/* Milestone Progress */}
      <div style={{ marginBottom: 32 }}>
        <h2 style={{ fontSize: 18, marginBottom: 12 }}>Milestones</h2>
        <div className="grid" style={{ gridTemplateColumns: `repeat(${MILESTONES.length}, 1fr)`, display: "grid", gap: 12 }}>
          {streakData.milestones.map((m: any) => {
            const pct = Math.min(100, (streakData.overallBestStreak / m.target) * 100);
            const achieved = streakData.overallBestStreak >= m.target;
            return (
              <div
                key={m.target}
                className="card"
                style={{
                  textAlign: "center",
                  border: achieved ? `2px solid ${MILESTONE_COLORS[m.target]}` : undefined,
                  opacity: achieved ? 1 : 0.7,
                }}
              >
                <div style={{ fontSize: 24, marginBottom: 4 }}>
                  {achieved ? "★" : "☆"}
                </div>
                <div style={{ fontSize: 14, fontWeight: 700, color: MILESTONE_COLORS[m.target] }}>
                  {MILESTONE_LABELS[m.target]}
                </div>
                <div style={{ fontSize: 12, color: "var(--text-secondary)", marginBottom: 8 }}>
                  {m.target} days
                </div>
                <div style={{ width: "100%", height: 6, background: "var(--gray-200)", borderRadius: 3 }}>
                  <div style={{
                    width: `${pct}%`,
                    height: "100%",
                    background: MILESTONE_COLORS[m.target],
                    borderRadius: 3,
                  }} />
                </div>
                <div style={{ fontSize: 11, color: "var(--text-secondary)", marginTop: 4 }}>
                  {achieved ? "Achieved!" : `${Math.round(pct)}%`}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Active Streaks */}
      {streakData.activeStreaks.length > 0 && (
        <div style={{ marginBottom: 32 }}>
          <h2 style={{ fontSize: 18, marginBottom: 12 }}>Active Streaks</h2>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {streakData.activeStreaks.map((s: any) => (
              <Link key={s.id} href={`/challenges/${s.challengeId}`} style={{ textDecoration: "none", color: "inherit" }}>
                <div className="card" style={{ borderLeft: "4px solid #16a34a" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div>
                      <h4 style={{ margin: 0 }}>{s.challenge.title}</h4>
                      <div style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 2 }}>
                        {s.daysCompleted} days completed
                      </div>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <div style={{ fontSize: 24, fontWeight: 700, color: "#d97706" }}>
                        {s.currentStreak}
                      </div>
                      <div style={{ fontSize: 11, color: "var(--text-secondary)" }}>day streak</div>
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Best Streaks History */}
      {streakData.bestStreaks.length > 0 && (
        <div>
          <h2 style={{ fontSize: 18, marginBottom: 12 }}>All Streak Records</h2>
          <div className="grid two">
            {streakData.bestStreaks.map((s: any) => (
              <div key={s.id} className="card">
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div>
                    <h4 style={{ margin: 0, fontSize: 14 }}>{s.challenge.title}</h4>
                    <span className="pill" style={{ fontSize: 11, marginTop: 4 }}>
                      {s.challenge.type}
                    </span>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontSize: 20, fontWeight: 700, color: "var(--ypp-purple)" }}>
                      {s.longestStreak}
                    </div>
                    <div style={{ fontSize: 11, color: "var(--text-secondary)" }}>best streak</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {streakData.bestStreaks.length === 0 && streakData.activeStreaks.length === 0 && (
        <div className="card" style={{ textAlign: "center", padding: 32 }}>
          <p style={{ color: "var(--text-secondary)" }}>
            No streaks yet! Join a challenge and start building your streak.
          </p>
          <Link href="/challenges" className="button primary" style={{ marginTop: 12 }}>
            Browse Challenges
          </Link>
        </div>
      )}
    </div>
  );
}

import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";

export default async function AwardsPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    redirect("/login");
  }

  // Sample data - in production, fetch from database
  const myAwards = [
    {
      id: "1",
      awardName: "Passion Pursuit Award",
      category: "PURSUIT",
      icon: "🏆",
      passionArea: "Visual Arts",
      reason: "Demonstrated exceptional dedication to watercolor painting with 45 practice sessions in one month",
      awardedAt: "2024-03-15",
      awardedBy: "Coach Rivera",
      xpAwarded: 200
    },
    {
      id: "2",
      awardName: "Breakthrough Moment",
      category: "BREAKTHROUGH",
      icon: "💡",
      passionArea: "Music",
      reason: "Mastered complex chord progressions after weeks of practice",
      awardedAt: "2024-02-28",
      awardedBy: "Mentor Johnson",
      xpAwarded: 150
    },
    {
      id: "3",
      awardName: "Persistence Champion",
      category: "PERSISTENCE",
      icon: "💪",
      passionArea: "Sports",
      reason: "Logged practice every single day for 60 consecutive days",
      awardedAt: "2024-01-20",
      awardedBy: "System Award",
      xpAwarded: 300
    }
  ];

  const availableAwards = [
    {
      id: "1",
      name: "Most Improved",
      category: "IMPROVEMENT",
      icon: "📈",
      description: "Show significant improvement in your passion area",
      criteria: "Demonstrate measurable improvement over 30 days with before/after documentation",
      xpReward: 250,
      earnedCount: 0
    },
    {
      id: "2",
      name: "Community Champion",
      category: "COLLABORATION",
      icon: "🤝",
      description: "Help and support fellow students",
      criteria: "Provide helpful feedback or mentoring to 5+ students",
      xpReward: 200,
      earnedCount: 0
    },
    {
      id: "3",
      name: "Innovation Award",
      category: "SHOWCASE",
      icon: "🌟",
      description: "Create something unique and innovative",
      criteria: "Present an original project at a showcase event that receives top votes",
      xpReward: 500,
      earnedCount: 0
    },
    {
      id: "4",
      name: "100-Day Streak",
      category: "PERSISTENCE",
      icon: "🔥",
      description: "Practice consistently for 100 days",
      criteria: "Log practice activity for 100 consecutive days",
      xpReward: 500,
      earnedCount: 0
    }
  ];

  const categoryColors: Record<string, string> = {
    PURSUIT: "#8b5cf6",
    BREAKTHROUGH: "#f59e0b",
    PERSISTENCE: "#ef4444",
    IMPROVEMENT: "#10b981",
    SHOWCASE: "#3b82f6",
    COLLABORATION: "#ec4899"
  };

  return (
    <div>
      <div className="topbar">
        <div>
          <p className="badge">Recognition</p>
          <h1 className="page-title">Awards & Achievements</h1>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 28 }}>
        <h3>🏆 Celebrate Excellence</h3>
        <p>
          Recognition for dedication, breakthrough moments, persistence, improvement, and innovation.
          Awards celebrate your journey and inspire others!
        </p>
      </div>

      {/* Stats */}
      <div className="grid four" style={{ marginBottom: 28 }}>
        <div className="card">
          <div className="kpi">{myAwards.length}</div>
          <div className="kpi-label">Awards Earned</div>
        </div>
        <div className="card">
          <div className="kpi">{myAwards.reduce((sum, a) => sum + a.xpAwarded, 0)}</div>
          <div className="kpi-label">Total XP from Awards</div>
        </div>
        <div className="card">
          <div className="kpi">{availableAwards.length}</div>
          <div className="kpi-label">Awards Available</div>
        </div>
        <div className="card">
          <div className="kpi">
            {Math.round((myAwards.length / (myAwards.length + availableAwards.length)) * 100)}%
          </div>
          <div className="kpi-label">Completion Rate</div>
        </div>
      </div>

      {/* My Awards */}
      <div style={{ marginBottom: 40 }}>
        <div className="section-title" style={{ marginBottom: 20 }}>
          My Awards
        </div>
        {myAwards.length > 0 ? (
          <div className="grid three">
            {myAwards.map((award) => (
              <div key={award.id} className="card" style={{
                borderTop: `4px solid ${categoryColors[award.category]}`
              }}>
                <div style={{ textAlign: "center", marginBottom: 16 }}>
                  <div style={{ fontSize: 64, marginBottom: 12 }}>
                    {award.icon}
                  </div>
                  <span className="pill" style={{
                    backgroundColor: categoryColors[award.category],
                    color: "white",
                    border: "none"
                  }}>
                    {award.category}
                  </span>
                </div>
                <h3 style={{ textAlign: "center", marginBottom: 8 }}>
                  {award.awardName}
                </h3>
                <p style={{
                  textAlign: "center",
                  fontSize: 13,
                  color: "var(--text-secondary)",
                  marginBottom: 12
                }}>
                  {award.passionArea}
                </p>
                <div style={{
                  backgroundColor: "var(--bg-secondary)",
                  padding: 12,
                  borderRadius: 8,
                  marginBottom: 12,
                  fontSize: 14
                }}>
                  {award.reason}
                </div>
                <div style={{
                  fontSize: 13,
                  color: "var(--text-secondary)",
                  marginBottom: 12,
                  textAlign: "center"
                }}>
                  Awarded by {award.awardedBy}<br />
                  {new Date(award.awardedAt).toLocaleDateString('en-US', {
                    month: 'long',
                    day: 'numeric',
                    year: 'numeric'
                  })}
                </div>
                <div style={{
                  display: "flex",
                  justifyContent: "center",
                  gap: 8,
                  fontSize: 14,
                  fontWeight: 600
                }}>
                  <span>⭐ +{award.xpAwarded} XP</span>
                </div>
                <div style={{ marginTop: 12, display: "flex", gap: 8 }}>
                  <button className="button secondary" style={{ flex: 1, fontSize: 13 }}>
                    📤 Share
                  </button>
                  <button className="button secondary" style={{ flex: 1, fontSize: 13 }}>
                    📄 Certificate
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="card" style={{ textAlign: "center", padding: 40 }}>
            <div style={{ fontSize: 60, marginBottom: 16 }}>🏆</div>
            <h3 style={{ marginBottom: 12 }}>No Awards Yet</h3>
            <p style={{ color: "var(--text-secondary)", marginBottom: 20 }}>
              Keep pursuing your passions! Awards are earned through dedication,
              improvement, and community contributions.
            </p>
          </div>
        )}
      </div>

      {/* Available Awards */}
      <div>
        <div className="section-title" style={{ marginBottom: 20 }}>
          Available Awards to Earn
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {availableAwards.map((award) => (
            <div key={award.id} className="card">
              <div style={{ display: "flex", gap: 20, alignItems: "start" }}>
                <div style={{
                  fontSize: 60,
                  flexShrink: 0,
                  opacity: 0.5,
                  filter: "grayscale(100%)"
                }}>
                  {award.icon}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 8 }}>
                    <h3>{award.name}</h3>
                    <span className="pill" style={{
                      backgroundColor: categoryColors[award.category],
                      color: "white",
                      border: "none"
                    }}>
                      {award.category}
                    </span>
                  </div>
                  <p style={{ fontSize: 14, marginBottom: 12 }}>
                    {award.description}
                  </p>
                  <div style={{
                    backgroundColor: "var(--bg-secondary)",
                    padding: 12,
                    borderRadius: 8,
                    marginBottom: 12
                  }}>
                    <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 6 }}>
                      How to Earn:
                    </div>
                    <div style={{ fontSize: 14 }}>
                      {award.criteria}
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 16, fontSize: 14, color: "var(--text-secondary)" }}>
                    <span>⭐ {award.xpReward} XP</span>
                    {award.earnedCount > 0 && (
                      <span>👥 {award.earnedCount} students earned this</span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Recent Awards Across Community */}
      <div style={{ marginTop: 40 }}>
        <div className="section-title" style={{ marginBottom: 20 }}>
          Recent Community Awards
        </div>
        <div className="card">
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {[
              { student: "Maya R.", award: "Breakthrough Moment", passion: "Photography", time: "2 hours ago" },
              { student: "Jake L.", award: "100-Day Streak", passion: "Guitar", time: "5 hours ago" },
              { student: "Emma W.", award: "Most Improved", passion: "Dance", time: "1 day ago" },
              { student: "Carlos M.", award: "Community Champion", passion: "Service", time: "2 days ago" }
            ].map((item, i) => (
              <div key={i} style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                paddingBottom: 16,
                borderBottom: i < 3 ? "1px solid var(--border-color)" : "none"
              }}>
                <div>
                  <div style={{ fontWeight: 600, marginBottom: 4 }}>
                    {item.student} earned {item.award}
                  </div>
                  <div style={{ fontSize: 13, color: "var(--text-secondary)" }}>
                    {item.passion} • {item.time}
                  </div>
                </div>
                <button className="button secondary" style={{ padding: "4px 12px", fontSize: 13 }}>
                  👏 Celebrate
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

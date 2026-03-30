import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth-supabase";
import { getChapterXpLeaderboard } from "@/lib/chapter-gamification-actions";
import { LEVELS } from "@/lib/xp-config";
import Link from "next/link";

const ROLE_COLORS: Record<string, string> = {
  CHAPTER_PRESIDENT: "#5a1da8",
  ADMIN: "#dc2626",
  INSTRUCTOR: "#0369a1",
  MENTOR: "#ca8a04",
  STUDENT: "#6b7280",
  STAFF: "#059669",
};

export default async function ChapterLeaderboardPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const members = await getChapterXpLeaderboard();
  const totalXp = members.reduce((s, m) => s + m.xp, 0);

  return (
    <main className="main-content">
      <div className="page-header">
        <div>
          <h1>Chapter Presidenterboard</h1>
          <p className="subtitle">See who&apos;s leading in XP within your chapter</p>
        </div>
        <Link href="/my-chapter" style={{ fontSize: 13, color: "var(--ypp-purple)" }}>
          ← Chapter Home
        </Link>
      </div>

      {/* Chapter XP Stats */}
      <div className="stats-grid" style={{ marginBottom: 24 }}>
        <div className="stat-card">
          <div className="kpi">{totalXp.toLocaleString()}</div>
          <div className="kpi-label">Total Chapter XP</div>
        </div>
        <div className="stat-card">
          <div className="kpi">{members.length}</div>
          <div className="kpi-label">Members</div>
        </div>
        <div className="stat-card">
          <div className="kpi">{members.length > 0 ? Math.round(totalXp / members.length) : 0}</div>
          <div className="kpi-label">Avg XP per Member</div>
        </div>
      </div>

      {/* Level Legend */}
      <div className="card" style={{ marginBottom: 20 }}>
        <h3 style={{ margin: "0 0 10px", fontSize: 14 }}>Level Guide</h3>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {LEVELS.map((lvl) => (
            <span
              key={lvl.level}
              style={{
                fontSize: 12,
                padding: "3px 8px",
                borderRadius: 6,
                background: "var(--bg)",
                color: "var(--muted)",
              }}
            >
              Lv.{lvl.level} {lvl.title} ({lvl.xpRequired}+ XP)
            </span>
          ))}
        </div>
      </div>

      {/* Leaderboard */}
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {members.map((member) => {
          const isTop3 = member.rank <= 3;
          const medal = member.rank === 1 ? "🥇" : member.rank === 2 ? "🥈" : member.rank === 3 ? "🥉" : null;

          return (
            <div
              key={member.id}
              className="card"
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                border: member.isCurrentUser
                  ? "2px solid var(--ypp-purple)"
                  : isTop3
                  ? "1px solid var(--ypp-purple)"
                  : undefined,
                background: member.isCurrentUser ? "rgba(109, 40, 217, 0.03)" : undefined,
              }}
            >
              {/* Rank */}
              <div
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: "50%",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontWeight: 700,
                  fontSize: medal ? 18 : 13,
                  background: isTop3 ? "var(--ypp-purple)" : "var(--bg)",
                  color: isTop3 ? "white" : "var(--muted)",
                  flexShrink: 0,
                }}
              >
                {medal ?? member.rank}
              </div>

              {/* Avatar */}
              <div
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: "50%",
                  background: ROLE_COLORS[member.primaryRole] ?? "#6b7280",
                  color: "white",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontWeight: 600,
                  fontSize: 14,
                  flexShrink: 0,
                }}
              >
                {member.name.charAt(0)}
              </div>

              {/* Info */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <strong style={{ fontSize: 14 }}>
                    {member.name}
                    {member.isCurrentUser && (
                      <span style={{ fontWeight: 400, color: "var(--muted)", fontSize: 12 }}> (You)</span>
                    )}
                  </strong>
                  <span
                    style={{
                      fontSize: 11,
                      padding: "1px 6px",
                      borderRadius: 4,
                      background: "var(--bg)",
                      color: "var(--muted)",
                    }}
                  >
                    Lv.{member.level} {member.title}
                  </span>
                </div>
                {/* XP Progress Bar */}
                <div style={{ marginTop: 4, display: "flex", alignItems: "center", gap: 8 }}>
                  <div
                    style={{
                      flex: 1,
                      height: 6,
                      background: "var(--border)",
                      borderRadius: 3,
                      overflow: "hidden",
                      maxWidth: 160,
                    }}
                  >
                    <div
                      style={{
                        width: `${member.progress * 100}%`,
                        height: "100%",
                        borderRadius: 3,
                        background: isTop3
                          ? "linear-gradient(90deg, var(--ypp-purple), var(--ypp-pink))"
                          : "var(--ypp-purple)",
                      }}
                    />
                  </div>
                  <span style={{ fontSize: 11, color: "var(--muted)" }}>
                    {member.xpIntoLevel}/{member.xpForNextLevel || "MAX"} to next
                  </span>
                </div>
              </div>

              {/* XP */}
              <div style={{ textAlign: "right", flexShrink: 0 }}>
                <div style={{ fontWeight: 700, fontSize: 16, color: "var(--ypp-purple)" }}>
                  {member.xp.toLocaleString()}
                </div>
                <div style={{ fontSize: 11, color: "var(--muted)" }}>XP</div>
              </div>
            </div>
          );
        })}

        {members.length === 0 && (
          <div className="card" style={{ textAlign: "center", padding: 32, color: "var(--muted)" }}>
            No members yet.
          </div>
        )}
      </div>
    </main>
  );
}

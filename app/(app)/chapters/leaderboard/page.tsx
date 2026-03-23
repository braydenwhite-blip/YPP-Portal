import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { getGrowthLeaderboard } from "@/lib/chapter-invite-actions";
import Link from "next/link";

export default async function ChapterLeaderboardPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  const leaderboard = await getGrowthLeaderboard();

  // Compute network totals
  const totalMembers = leaderboard.reduce((s, c) => s + c.memberCount, 0);
  const totalCourses = leaderboard.reduce((s, c) => s + c.courseCount, 0);
  const totalNewMembers = leaderboard.reduce((s, c) => s + c.newMembers30d, 0);

  return (
    <main className="main-content">
      <div className="page-header">
        <div>
          <h1>Chapter Leaderboard</h1>
          <p className="subtitle">See how chapters across the network are growing</p>
        </div>
        <Link href="/chapters" style={{ fontSize: 13, color: "var(--ypp-purple)" }}>
          ← Chapter Directory
        </Link>
      </div>

      {/* Network Totals */}
      <div className="stats-grid" style={{ marginBottom: 28 }}>
        <div className="stat-card">
          <div className="kpi">{totalMembers}</div>
          <div className="kpi-label">Total Members</div>
        </div>
        <div className="stat-card">
          <div className="kpi">{leaderboard.length}</div>
          <div className="kpi-label">Active Chapters</div>
        </div>
        <div className="stat-card">
          <div className="kpi">{totalNewMembers}</div>
          <div className="kpi-label">New Members (30d)</div>
        </div>
        <div className="stat-card">
          <div className="kpi">{totalCourses}</div>
          <div className="kpi-label">Total Courses</div>
        </div>
      </div>

      {/* Leaderboard */}
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {leaderboard.map((chapter, index) => {
          const location = [chapter.city, chapter.region].filter(Boolean).join(", ");
          const isTop3 = index < 3;
          const medal = index === 0 ? "🥇" : index === 1 ? "🥈" : index === 2 ? "🥉" : null;

          return (
            <div
              key={chapter.id}
              className="card"
              style={{
                display: "flex",
                alignItems: "center",
                gap: 14,
                border: isTop3 ? "1px solid var(--ypp-purple)" : undefined,
                background: isTop3 ? "rgba(109, 40, 217, 0.02)" : undefined,
              }}
            >
              {/* Rank */}
              <div
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: "50%",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontWeight: 700,
                  fontSize: medal ? 20 : 14,
                  background: isTop3 ? "var(--ypp-purple)" : "var(--bg)",
                  color: isTop3 ? "white" : "var(--muted)",
                  flexShrink: 0,
                }}
              >
                {medal ?? (index + 1)}
              </div>

              {/* Logo */}
              {chapter.logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={chapter.logoUrl}
                  alt=""
                  style={{ width: 40, height: 40, borderRadius: 8, objectFit: "cover", flexShrink: 0 }}
                />
              ) : (
                <div
                  style={{
                    width: 40, height: 40, borderRadius: 8,
                    background: "var(--ypp-purple)", color: "white",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontWeight: 700, fontSize: 16, flexShrink: 0,
                  }}
                >
                  {chapter.name.charAt(0)}
                </div>
              )}

              {/* Chapter Info */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <Link
                    href={chapter.slug ? `/chapters/${chapter.slug}` : "/chapters"}
                    style={{ fontWeight: 600, fontSize: 15, color: "inherit", textDecoration: "none" }}
                  >
                    {chapter.name}
                  </Link>
                </div>
                {location && (
                  <p style={{ margin: "2px 0 0", fontSize: 12, color: "var(--muted)" }}>{location}</p>
                )}
              </div>

              {/* Metrics */}
              <div style={{ display: "flex", gap: 20, flexShrink: 0 }}>
                <div style={{ textAlign: "center" }}>
                  <div style={{ fontWeight: 700, fontSize: 16 }}>{chapter.memberCount}</div>
                  <div style={{ fontSize: 11, color: "var(--muted)" }}>Members</div>
                </div>
                <div style={{ textAlign: "center" }}>
                  <div
                    style={{
                      fontWeight: 700,
                      fontSize: 16,
                      color: chapter.newMembers30d > 0 ? "#16a34a" : "inherit",
                    }}
                  >
                    {chapter.newMembers30d > 0 ? `+${chapter.newMembers30d}` : "0"}
                  </div>
                  <div style={{ fontSize: 11, color: "var(--muted)" }}>New (30d)</div>
                </div>
                <div style={{ textAlign: "center" }}>
                  <div style={{ fontWeight: 700, fontSize: 16 }}>{chapter.courseCount}</div>
                  <div style={{ fontSize: 11, color: "var(--muted)" }}>Courses</div>
                </div>
                {chapter.avgRetention !== null && (
                  <div style={{ textAlign: "center" }}>
                    <div style={{ fontWeight: 700, fontSize: 16 }}>{chapter.avgRetention}%</div>
                    <div style={{ fontSize: 11, color: "var(--muted)" }}>Retention</div>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {leaderboard.length === 0 && (
        <div className="card" style={{ textAlign: "center", padding: 40, color: "var(--muted)" }}>
          <p>No chapters to display yet.</p>
        </div>
      )}
    </main>
  );
}

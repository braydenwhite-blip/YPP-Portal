import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { getMyRankings } from "@/lib/engagement-actions";
import Link from "next/link";
import { LeaderboardTabs } from "./client";

export default async function LeaderboardsPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");

  const myRankings = await getMyRankings();

  const categoryLabels: Record<string, string> = {
    XP: "Total XP", STREAKS: "Longest Streak", CHALLENGES: "Challenges Won", PRACTICE_HOURS: "Practice Hours",
  };
  const categoryColors: Record<string, string> = {
    XP: "#7c3aed", STREAKS: "#d97706", CHALLENGES: "#3b82f6", PRACTICE_HOURS: "#16a34a",
  };

  // Group my rankings by category for the summary
  const myBestByCategory: Record<string, any> = {};
  (myRankings as any[]).forEach((r) => {
    if (!myBestByCategory[r.category] || (r.rank && r.rank < (myBestByCategory[r.category].rank || Infinity))) {
      myBestByCategory[r.category] = r;
    }
  });

  return (
    <div>
      <div className="topbar">
        <div>
          <h1 className="page-title">Leaderboards</h1>
          <p style={{ fontSize: 13, color: "var(--text-secondary)", marginTop: 2 }}>
            See how you stack up against fellow students
          </p>
        </div>
        <Link href="/challenges" className="button secondary">Challenges</Link>
      </div>

      {/* My Rankings Summary */}
      <div className="grid" style={{ gridTemplateColumns: "repeat(4, 1fr)", display: "grid", gap: 12, marginBottom: 28 }}>
        {["XP", "STREAKS", "CHALLENGES", "PRACTICE_HOURS"].map((cat) => {
          const ranking = myBestByCategory[cat];
          return (
            <div key={cat} className="card" style={{ textAlign: "center", borderTop: `3px solid ${categoryColors[cat]}` }}>
              <div style={{ fontSize: 11, color: "var(--text-secondary)", marginBottom: 4 }}>
                {categoryLabels[cat]}
              </div>
              <div style={{ fontSize: 28, fontWeight: 700, color: categoryColors[cat] }}>
                {ranking?.rank ? `#${ranking.rank}` : "--"}
              </div>
              {ranking?.score != null && (
                <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>
                  Score: {Math.round(ranking.score)}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Interactive Leaderboard */}
      <LeaderboardTabs />
    </div>
  );
}

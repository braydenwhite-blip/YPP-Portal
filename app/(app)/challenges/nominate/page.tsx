import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { getNominatedChallenges } from "@/lib/engagement-actions";
import Link from "next/link";
import { VoteButton, PromoteButton } from "./client";

const DIFFICULTY_COLORS: Record<string, string> = {
  EASY: "#16a34a", MEDIUM: "#d97706", HARD: "#ef4444",
};

export default async function NominateChallengesPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");

  const nominations = await getNominatedChallenges();
  const isAdmin = (session.user as any).roles?.includes("ADMIN") || (session.user as any).primaryRole === "ADMIN";

  const pending = (nominations as any[]).filter((n) => n.status === "PENDING");
  const approved = (nominations as any[]).filter((n) => n.status === "APPROVED" || n.status === "PROMOTED");

  return (
    <div>
      <div className="topbar">
        <div>
          <h1 className="page-title">Student-Nominated Challenges</h1>
          <p style={{ fontSize: 13, color: "var(--text-secondary)", marginTop: 2 }}>
            Propose and vote on challenges created by students
          </p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <Link href="/challenges/nominate/submit" className="button primary">
            Nominate a Challenge
          </Link>
          <Link href="/challenges" className="button secondary">
            All Challenges
          </Link>
        </div>
      </div>

      {/* Pending Nominations - Vote on them */}
      <div style={{ marginBottom: 32 }}>
        <h2 style={{ fontSize: 18, marginBottom: 12 }}>
          Vote on Nominations ({pending.length})
        </h2>
        {pending.length > 0 ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {pending.map((nom: any) => (
              <div key={nom.id} className="card">
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start" }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                      <h3 style={{ margin: 0 }}>{nom.title}</h3>
                      <span
                        className="pill"
                        style={{
                          background: `${DIFFICULTY_COLORS[nom.difficulty]}15`,
                          color: DIFFICULTY_COLORS[nom.difficulty],
                          fontSize: 11,
                        }}
                      >
                        {nom.difficulty}
                      </span>
                      {nom.category && (
                        <span className="pill" style={{ fontSize: 11 }}>{nom.category}</span>
                      )}
                    </div>
                    <p style={{ fontSize: 13, color: "var(--text-secondary)", margin: "0 0 8px" }}>
                      {nom.description.length > 200 ? nom.description.slice(0, 200) + "..." : nom.description}
                    </p>
                    <div style={{ display: "flex", gap: 16, fontSize: 12, color: "var(--text-secondary)" }}>
                      <span>by {nom.nominator?.name || "Unknown"}</span>
                      <span>{nom.suggestedXp} XP suggested</span>
                      {nom.suggestedDuration && <span>{nom.suggestedDuration}</span>}
                    </div>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4, marginLeft: 16 }}>
                    <VoteButton nominationId={nom.id} initialUpvotes={nom.upvotes} initialDownvotes={nom.downvotes} />
                    {isAdmin && <PromoteButton nominationId={nom.id} />}
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="card">
            <p style={{ color: "var(--text-secondary)" }}>
              No pending nominations. Be the first to suggest a challenge!
            </p>
          </div>
        )}
      </div>

      {/* Approved / Promoted */}
      {approved.length > 0 && (
        <div>
          <h2 style={{ fontSize: 18, marginBottom: 12 }}>Approved Challenges</h2>
          <div className="grid two">
            {approved.map((nom: any) => (
              <div
                key={nom.id}
                className="card"
                style={{ borderLeft: `4px solid ${nom.status === "PROMOTED" ? "#16a34a" : "#3b82f6"}` }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                  <span
                    className="pill"
                    style={{
                      background: nom.status === "PROMOTED" ? "#dcfce7" : "#dbeafe",
                      color: nom.status === "PROMOTED" ? "#16a34a" : "#3b82f6",
                      fontSize: 11,
                    }}
                  >
                    {nom.status === "PROMOTED" ? "Now Active!" : "Approved"}
                  </span>
                </div>
                <h4 style={{ margin: "4px 0" }}>{nom.title}</h4>
                <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>
                  by {nom.nominator?.name || "Unknown"} &middot; {nom.upvotes} upvotes
                </div>
                {nom.promotedChallengeId && (
                  <Link
                    href={`/challenges/${nom.promotedChallengeId}`}
                    className="button primary small"
                    style={{ marginTop: 8 }}
                  >
                    View Challenge
                  </Link>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

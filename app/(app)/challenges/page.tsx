import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { getActiveChallenges, getMyChallengeProgress } from "@/lib/challenge-gamification-actions";
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { ChallengeCard } from "./client";
import { isFeatureEnabledForUser } from "@/lib/feature-gates";

export default async function ChallengesPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");
  const featureEnabled = await isFeatureEnabledForUser("CHALLENGES", {
    userId: session.user.id,
  });

  if (!featureEnabled) {
    return (
      <div>
        <div className="topbar">
          <div>
            <h1 className="page-title">Challenges</h1>
            <p style={{ fontSize: 13, color: "var(--text-secondary)", marginTop: 2 }}>
              This section is not enabled for your chapter yet.
            </p>
          </div>
        </div>
        <div className="card">
          <h3 style={{ marginTop: 0 }}>Pilot rollout in progress</h3>
          <p style={{ color: "var(--text-secondary)", marginBottom: 12 }}>
            Keep exploring through curriculum and activity tools while this chapter pilot completes.
          </p>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <Link href="/activities" className="button secondary">Activity Hub</Link>
            <Link href="/curriculum" className="button secondary">Curriculum</Link>
            <Link href="/world" className="button secondary">Passion World</Link>
          </div>
        </div>
      </div>
    );
  }

  const [challenges, myProgress, passionAreas] = await Promise.all([
    getActiveChallenges(),
    getMyChallengeProgress(),
    prisma.passionArea
      .findMany({
        where: { isActive: true },
        select: { id: true, name: true },
      })
      .catch(() => []),
  ]);
  const passionNameById = new Map(passionAreas.map((passion) => [passion.id, passion.name]));
  const resolvePassionLabel = (value: string | null | undefined) =>
    value ? (passionNameById.get(value) ?? value) : null;

  const activeChallenges = challenges.filter((c) => c.type !== "WEEKLY");
  const myActive = myProgress.filter((p) => p.status === "ACTIVE");
  const myCompleted = myProgress.filter((p) => p.status === "COMPLETED");

  const typeLabels: Record<string, string> = {
    DAILY: "Daily",
    WEEKLY: "Weekly",
    THIRTY_DAY: "30-Day",
    SEASONAL: "Seasonal",
  };

  const typeColors: Record<string, string> = {
    DAILY: "#3b82f6",
    WEEKLY: "#d97706",
    THIRTY_DAY: "#7c3aed",
    SEASONAL: "#16a34a",
  };

  return (
    <div>
      <div className="topbar">
        <div>
          <h1 className="page-title">Challenges</h1>
          <p style={{ fontSize: 13, color: "var(--text-secondary)", marginTop: 2 }}>
            Push yourself, build streaks, and earn rewards
          </p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <Link href="/challenges/weekly" className="button secondary">
            Weekly Challenges
          </Link>
          <Link href="/challenges/passport" className="button secondary">
            Passion Passport
          </Link>
        </div>
      </div>

      {/* My Progress Summary */}
      <div className="grid three" style={{ marginBottom: 24 }}>
        <div className="card">
          <div style={{ fontSize: 13, color: "var(--text-secondary)" }}>Active Challenges</div>
          <div style={{ fontSize: 28, fontWeight: 700, color: "var(--ypp-purple)" }}>
            {myActive.length}
          </div>
        </div>
        <div className="card">
          <div style={{ fontSize: 13, color: "var(--text-secondary)" }}>Completed</div>
          <div style={{ fontSize: 28, fontWeight: 700, color: "#16a34a" }}>
            {myCompleted.length}
          </div>
        </div>
        <div className="card">
          <div style={{ fontSize: 13, color: "var(--text-secondary)" }}>Best Streak</div>
          <div style={{ fontSize: 28, fontWeight: 700, color: "#d97706" }}>
            {Math.max(0, ...myProgress.map((p) => p.longestStreak))} days
          </div>
        </div>
      </div>

      {/* My Active Challenges */}
      {myActive.length > 0 && (
        <div style={{ marginBottom: 32 }}>
          <h2 style={{ fontSize: 18, marginBottom: 12 }}>My Active Challenges</h2>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {myActive.map((p) => (
              <Link
                key={p.id}
                href={`/challenges/${p.challenge.id}`}
                style={{ textDecoration: "none", color: "inherit" }}
              >
                <div className="card" style={{ borderLeft: `4px solid ${typeColors[p.challenge.type] || "#7c3aed"}` }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                        <span
                          className="pill"
                          style={{
                            background: `${typeColors[p.challenge.type]}15`,
                            color: typeColors[p.challenge.type],
                            fontSize: 11,
                            fontWeight: 600,
                          }}
                        >
                          {typeLabels[p.challenge.type] || p.challenge.type}
                        </span>
                        <span style={{ fontSize: 12, color: "var(--text-secondary)" }}>
                          {p.challenge.xpReward} XP reward
                        </span>
                      </div>
                      <h4 style={{ margin: 0 }}>{p.challenge.title}</h4>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <div style={{ fontSize: 24, fontWeight: 700, color: "var(--ypp-purple)" }}>
                        {Math.round(p.totalProgress * 100)}%
                      </div>
                      <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>
                        {p.currentStreak} day streak
                      </div>
                    </div>
                  </div>
                  {/* Progress bar */}
                  <div style={{ marginTop: 8, width: "100%", height: 6, background: "var(--gray-200)", borderRadius: 3 }}>
                    <div
                      style={{
                        width: `${Math.min(p.totalProgress * 100, 100)}%`,
                        height: "100%",
                        background: typeColors[p.challenge.type] || "var(--ypp-purple)",
                        borderRadius: 3,
                      }}
                    />
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Available Challenges */}
      <div>
        <h2 style={{ fontSize: 18, marginBottom: 12 }}>Available Challenges</h2>
        {activeChallenges.length > 0 ? (
          <div className="grid two">
            {activeChallenges.map((challenge) => {
              const isJoined = challenge.participants.length > 0;
              const daysLeft = Math.ceil(
                (new Date(challenge.endDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
              );

              return (
                <div key={challenge.id} className="card">
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", marginBottom: 8 }}>
                    <span
                      className="pill"
                      style={{
                        background: `${typeColors[challenge.type]}15`,
                        color: typeColors[challenge.type],
                        fontSize: 11,
                        fontWeight: 600,
                      }}
                    >
                      {typeLabels[challenge.type] || challenge.type}
                    </span>
                    <span style={{ fontSize: 12, color: "var(--text-secondary)" }}>
                      {daysLeft} days left
                    </span>
                  </div>
                  <h3 style={{ margin: "4px 0 8px" }}>{challenge.title}</h3>
                  <p style={{ fontSize: 13, color: "var(--text-secondary)", margin: "0 0 8px" }}>
                    {challenge.description.length > 120
                      ? challenge.description.slice(0, 120) + "..."
                      : challenge.description}
                  </p>
                  {challenge.dailyGoal && (
                    <div style={{ fontSize: 12, marginBottom: 4 }}>
                      <strong>Daily Goal:</strong> {challenge.dailyGoal}
                    </div>
                  )}
                  {challenge.passionArea && (
                    <span className="pill" style={{ fontSize: 11, marginBottom: 8 }}>
                      {resolvePassionLabel(challenge.passionArea)}
                    </span>
                  )}
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 12 }}>
                    <span style={{ fontSize: 12, color: "var(--text-secondary)" }}>
                      {challenge._count.participants} participants
                    </span>
                    <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                      <span style={{ fontSize: 13, fontWeight: 600, color: "var(--ypp-purple)" }}>
                        {challenge.xpReward} XP
                      </span>
                      {isJoined ? (
                        <Link href={`/challenges/${challenge.id}`} className="button primary small">
                          Continue
                        </Link>
                      ) : (
                        <ChallengeCard challengeId={challenge.id} />
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="card">
            <p style={{ color: "var(--text-secondary)" }}>
              No active challenges right now. Check back soon!
            </p>
          </div>
        )}
      </div>

      {/* Completed Challenges */}
      {myCompleted.length > 0 && (
        <div style={{ marginTop: 32 }}>
          <h2 style={{ fontSize: 18, marginBottom: 12 }}>Completed Challenges</h2>
          <div className="grid three">
            {myCompleted.map((p) => (
              <div key={p.id} className="card" style={{ opacity: 0.85, borderLeft: "4px solid #16a34a" }}>
                <div style={{ fontSize: 12, color: "#16a34a", fontWeight: 600, marginBottom: 4 }}>
                  Completed
                </div>
                <h4 style={{ margin: "0 0 4px" }}>{p.challenge.title}</h4>
                <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>
                  {p.daysCompleted} days | Best streak: {p.longestStreak}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

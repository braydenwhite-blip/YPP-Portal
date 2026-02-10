import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { getDailyChallenges, getTodaysDailyChallenge } from "@/lib/engagement-actions";
import { getMyChallengeProgress } from "@/lib/challenge-gamification-actions";
import Link from "next/link";
import { JoinDailyChallengeButton } from "./client";

export default async function DailyChallengesPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");

  const [todaysChallenge, allDaily, myProgress] = await Promise.all([
    getTodaysDailyChallenge(),
    getDailyChallenges(),
    getMyChallengeProgress(),
  ]);

  const myDailyProgress = myProgress.filter(
    (p) => p.challenge.type === "DAILY" && p.status === "ACTIVE"
  );
  const bestStreak = Math.max(0, ...myProgress.map((p) => p.longestStreak));

  return (
    <div>
      <div className="topbar">
        <div>
          <h1 className="page-title">Daily Challenges</h1>
          <p style={{ fontSize: 13, color: "var(--text-secondary)", marginTop: 2 }}>
            Fresh challenges every day to keep you growing
          </p>
        </div>
        <Link href="/challenges" className="button secondary">All Challenges</Link>
      </div>

      {/* Stats */}
      <div className="grid three" style={{ marginBottom: 24 }}>
        <div className="card" style={{ textAlign: "center" }}>
          <div style={{ fontSize: 28, fontWeight: 700, color: "#3b82f6" }}>
            {myDailyProgress.length}
          </div>
          <div style={{ fontSize: 13, color: "var(--text-secondary)" }}>Active Daily</div>
        </div>
        <div className="card" style={{ textAlign: "center" }}>
          <div style={{ fontSize: 28, fontWeight: 700, color: "#d97706" }}>
            {bestStreak}
          </div>
          <div style={{ fontSize: 13, color: "var(--text-secondary)" }}>Best Streak</div>
        </div>
        <div className="card" style={{ textAlign: "center" }}>
          <div style={{ fontSize: 28, fontWeight: 700, color: "#16a34a" }}>
            {myProgress.filter((p) => p.challenge.type === "DAILY" && p.status === "COMPLETED").length}
          </div>
          <div style={{ fontSize: 13, color: "var(--text-secondary)" }}>Completed</div>
        </div>
      </div>

      {/* Today's Challenge - Hero Card */}
      <div style={{ marginBottom: 32 }}>
        <h2 style={{ fontSize: 18, marginBottom: 12 }}>Today&apos;s Challenge</h2>
        {todaysChallenge ? (
          <div className="card" style={{ borderLeft: "4px solid #3b82f6", background: "linear-gradient(135deg, #fff 80%, #eff6ff)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start" }}>
              <div>
                <span className="pill" style={{ background: "#3b82f615", color: "#3b82f6", fontSize: 11, fontWeight: 600, marginBottom: 8 }}>
                  Daily Challenge
                </span>
                <h3 style={{ margin: "8px 0 4px" }}>{todaysChallenge.title}</h3>
                <p style={{ fontSize: 13, color: "var(--text-secondary)", margin: 0 }}>
                  {todaysChallenge.description}
                </p>
                {todaysChallenge.dailyGoal && (
                  <div style={{ marginTop: 8, fontSize: 13 }}>
                    <strong>Goal:</strong> {todaysChallenge.dailyGoal}
                  </div>
                )}
              </div>
              <div style={{ textAlign: "right", minWidth: 100 }}>
                <div style={{ fontSize: 24, fontWeight: 700, color: "var(--ypp-purple)" }}>
                  {todaysChallenge.xpReward} XP
                </div>
                {(todaysChallenge as any).participants?.length > 0 ? (
                  <Link href={`/challenges/${todaysChallenge.id}`} className="button primary small" style={{ marginTop: 8 }}>
                    Continue
                  </Link>
                ) : (
                  <JoinDailyChallengeButton challengeId={todaysChallenge.id} />
                )}
              </div>
            </div>
          </div>
        ) : (
          <div className="card" style={{ textAlign: "center", padding: 32 }}>
            <p style={{ color: "var(--text-secondary)" }}>
              No daily challenge today. Check back tomorrow!
            </p>
          </div>
        )}
      </div>

      {/* All Active Daily Challenges */}
      <div>
        <h2 style={{ fontSize: 18, marginBottom: 12 }}>All Active Daily Challenges</h2>
        {allDaily.length > 0 ? (
          <div className="grid two">
            {allDaily.map((challenge: any) => {
              const isJoined = challenge.participants?.length > 0;
              return (
                <div key={challenge.id} className="card">
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start" }}>
                    <div>
                      <h4 style={{ margin: "0 0 4px" }}>{challenge.title}</h4>
                      <p style={{ fontSize: 12, color: "var(--text-secondary)", margin: 0 }}>
                        {challenge.description?.slice(0, 100)}{challenge.description?.length > 100 ? "..." : ""}
                      </p>
                    </div>
                    <span style={{ fontSize: 13, fontWeight: 600, color: "var(--ypp-purple)" }}>
                      {challenge.xpReward} XP
                    </span>
                  </div>
                  <div style={{ marginTop: 12, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ fontSize: 12, color: "var(--text-secondary)" }}>
                      {challenge._count?.participants || 0} participants
                    </span>
                    {isJoined ? (
                      <Link href={`/challenges/${challenge.id}`} className="button primary small">Continue</Link>
                    ) : (
                      <JoinDailyChallengeButton challengeId={challenge.id} />
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="card">
            <p style={{ color: "var(--text-secondary)" }}>No daily challenges available right now.</p>
          </div>
        )}
      </div>
    </div>
  );
}

import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { getChallengeDetail } from "@/lib/challenge-gamification-actions";
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { CheckInForm, DropButton } from "../client";

export default async function ChallengeDetailPage({ params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");

  const { challenge, myParticipation } = await getChallengeDetail(params.id);
  const passionLabel = challenge.passionArea
    ? (await prisma.passionArea
      .findUnique({
        where: { id: challenge.passionArea },
        select: { name: true },
      })
      .then((passion) => passion?.name ?? null)
      .catch(() => null)) ?? challenge.passionArea
    : null;

  const daysLeft = Math.ceil(
    (new Date(challenge.endDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
  );
  const totalDays = Math.ceil(
    (new Date(challenge.endDate).getTime() - new Date(challenge.startDate).getTime()) / (1000 * 60 * 60 * 24)
  );

  const typeColors: Record<string, string> = {
    DAILY: "#3b82f6",
    WEEKLY: "#d97706",
    THIRTY_DAY: "#7c3aed",
    SEASONAL: "#16a34a",
  };
  const color = typeColors[challenge.type] || "#7c3aed";

  return (
    <div>
      <div className="topbar">
        <div>
          <Link href="/challenges" style={{ fontSize: 13, color: "var(--ypp-purple)" }}>
            &larr; All Challenges
          </Link>
          <h1 className="page-title" style={{ marginTop: 4 }}>{challenge.title}</h1>
          <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 4 }}>
            <span className="pill" style={{ background: `${color}15`, color, fontSize: 11, fontWeight: 600 }}>
              {challenge.type.replace("_", "-")}
            </span>
            {passionLabel && (
              <span className="pill" style={{ fontSize: 11 }}>{passionLabel}</span>
            )}
            <span style={{ fontSize: 12, color: "var(--text-secondary)" }}>
              {daysLeft > 0 ? `${daysLeft} days left` : "Ended"}
            </span>
          </div>
        </div>
        {myParticipation && myParticipation.status === "ACTIVE" && (
          <DropButton challengeId={challenge.id} />
        )}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 340px", gap: 24 }}>
        {/* Left column */}
        <div>
          {/* Description */}
          <div className="card" style={{ marginBottom: 16 }}>
            <h3 style={{ marginBottom: 8 }}>About This Challenge</h3>
            <p style={{ fontSize: 14, color: "var(--text-secondary)", whiteSpace: "pre-wrap" }}>
              {challenge.description}
            </p>
            {challenge.dailyGoal && (
              <div style={{ marginTop: 12, padding: 12, background: "var(--surface-alt)", borderRadius: "var(--radius-md)" }}>
                <div style={{ fontSize: 12, color: "var(--text-secondary)", marginBottom: 2 }}>Daily Goal</div>
                <div style={{ fontWeight: 600 }}>{challenge.dailyGoal}</div>
              </div>
            )}
            {challenge.weeklyGoal && (
              <div style={{ marginTop: 8, padding: 12, background: "var(--surface-alt)", borderRadius: "var(--radius-md)" }}>
                <div style={{ fontSize: 12, color: "var(--text-secondary)", marginBottom: 2 }}>Weekly Goal</div>
                <div style={{ fontWeight: 600 }}>{challenge.weeklyGoal}</div>
              </div>
            )}
            <div style={{ display: "flex", gap: 16, marginTop: 16 }}>
              <div>
                <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>XP Reward</div>
                <div style={{ fontWeight: 700, color: "var(--ypp-purple)" }}>{challenge.xpReward} XP</div>
              </div>
              <div>
                <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>Duration</div>
                <div style={{ fontWeight: 600 }}>{totalDays} days</div>
              </div>
              <div>
                <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>Participants</div>
                <div style={{ fontWeight: 600 }}>{challenge._count.participants}</div>
              </div>
              {challenge.specialRecognition && (
                <div>
                  <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>Special Reward</div>
                  <div style={{ fontWeight: 600, color: "#d97706" }}>{challenge.specialRecognition}</div>
                </div>
              )}
            </div>
          </div>

          {/* Check-in / Progress */}
          {myParticipation && myParticipation.status === "ACTIVE" && (
            <div className="card" style={{ marginBottom: 16 }}>
              <h3 style={{ marginBottom: 8 }}>Today&apos;s Check-In</h3>
              <div style={{ display: "flex", gap: 16, marginBottom: 16 }}>
                <div style={{ textAlign: "center" }}>
                  <div style={{ fontSize: 28, fontWeight: 700, color }}>
                    {myParticipation.daysCompleted}
                  </div>
                  <div style={{ fontSize: 11, color: "var(--text-secondary)" }}>days done</div>
                </div>
                <div style={{ textAlign: "center" }}>
                  <div style={{ fontSize: 28, fontWeight: 700, color: "#d97706" }}>
                    {myParticipation.currentStreak}
                  </div>
                  <div style={{ fontSize: 11, color: "var(--text-secondary)" }}>day streak</div>
                </div>
                <div style={{ textAlign: "center" }}>
                  <div style={{ fontSize: 28, fontWeight: 700, color: "#16a34a" }}>
                    {Math.round(myParticipation.totalProgress * 100)}%
                  </div>
                  <div style={{ fontSize: 11, color: "var(--text-secondary)" }}>progress</div>
                </div>
              </div>
              {/* Progress bar */}
              <div style={{ width: "100%", height: 8, background: "var(--gray-200)", borderRadius: 4, marginBottom: 16 }}>
                <div style={{ width: `${Math.min(myParticipation.totalProgress * 100, 100)}%`, height: "100%", background: color, borderRadius: 4 }} />
              </div>
              <CheckInForm
                challengeId={challenge.id}
                dayNumber={myParticipation.daysCompleted}
              />
            </div>
          )}

          {myParticipation?.status === "COMPLETED" && (
            <div className="card" style={{ marginBottom: 16, background: "#dcfce7", borderLeft: "4px solid #16a34a" }}>
              <h3 style={{ color: "#16a34a" }}>Challenge Complete!</h3>
              <p style={{ fontSize: 14, color: "var(--text-secondary)", marginTop: 4 }}>
                You finished in {myParticipation.daysCompleted} days with a best streak of {myParticipation.longestStreak} days.
                You earned <strong>{challenge.xpReward} XP</strong>!
              </p>
            </div>
          )}

          {/* My Submissions */}
          {challenge.submissions.length > 0 && (
            <div className="card">
              <h3 style={{ marginBottom: 12 }}>My Check-In History</h3>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {challenge.submissions.map((sub) => (
                  <div
                    key={sub.id}
                    style={{
                      padding: "8px 12px",
                      background: "var(--surface-alt)",
                      borderRadius: "var(--radius-sm)",
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                    }}
                  >
                    <div>
                      <span style={{ fontWeight: 600, fontSize: 13 }}>
                        Day {sub.dayNumber || "?"}
                      </span>
                      {sub.reflection && (
                        <span style={{ fontSize: 12, color: "var(--text-secondary)", marginLeft: 8 }}>
                          {sub.reflection.length > 60 ? sub.reflection.slice(0, 60) + "..." : sub.reflection}
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>
                      {sub.minutesPracticed && `${sub.minutesPracticed} min`}
                      {" | "}
                      {new Date(sub.submittedAt).toLocaleDateString()}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right column - Leaderboard */}
        <div>
          {challenge.showLeaderboard && (
            <div className="card" style={{ position: "sticky", top: 16 }}>
              <h3 style={{ marginBottom: 12 }}>Leaderboard</h3>
              {challenge.participants.length > 0 ? (
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {challenge.participants
                    .filter((p) => p.status !== "DROPPED")
                    .map((p, i) => {
                      const isMe = p.studentId === session.user.id;
                      return (
                        <div
                          key={p.id}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 8,
                            padding: "8px 10px",
                            background: isMe ? "var(--ypp-purple-50)" : "var(--surface-alt)",
                            borderRadius: "var(--radius-sm)",
                            border: isMe ? "1px solid var(--ypp-purple)" : "none",
                          }}
                        >
                          <span style={{
                            width: 24,
                            height: 24,
                            borderRadius: "50%",
                            background: i === 0 ? "#fbbf24" : i === 1 ? "#9ca3af" : i === 2 ? "#d97706" : "var(--gray-200)",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            fontSize: 11,
                            fontWeight: 700,
                            color: i < 3 ? "white" : "var(--text-secondary)",
                          }}>
                            {(p.leaderboardRank || i + 1)}
                          </span>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 13, fontWeight: isMe ? 700 : 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                              {p.student.name} {isMe && "(you)"}
                            </div>
                          </div>
                          <div style={{ textAlign: "right", fontSize: 12 }}>
                            <div style={{ fontWeight: 600 }}>{p.daysCompleted}d</div>
                            <div style={{ color: "var(--text-secondary)", fontSize: 11 }}>
                              {p.currentStreak} streak
                            </div>
                          </div>
                        </div>
                      );
                    })}
                </div>
              ) : (
                <p style={{ fontSize: 13, color: "var(--text-secondary)" }}>
                  No participants yet. Be the first!
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

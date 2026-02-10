import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { getWeeklyChallenges } from "@/lib/challenge-gamification-actions";
import Link from "next/link";
import { WeeklySubmitForm, VoteButton } from "./client";

export default async function WeeklyChallengesPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");

  const challenges = await getWeeklyChallenges();

  return (
    <div>
      <div className="topbar">
        <div>
          <Link href="/challenges" style={{ fontSize: 13, color: "var(--ypp-purple)" }}>
            &larr; All Challenges
          </Link>
          <h1 className="page-title" style={{ marginTop: 4 }}>Weekly Challenges</h1>
          <p style={{ fontSize: 13, color: "var(--text-secondary)", marginTop: 2 }}>
            Creative prompts every week. Submit your work and vote for your favorites!
          </p>
        </div>
      </div>

      {challenges.length > 0 ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          {challenges.map((challenge) => {
            const isJoined = challenge.participants.length > 0;
            const daysLeft = Math.ceil(
              (new Date(challenge.endDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
            );
            const votingOpen = challenge.votingEnabled && challenge.votingDeadline
              ? new Date() < new Date(challenge.votingDeadline)
              : false;

            return (
              <div key={challenge.id} className="card" style={{ borderLeft: "4px solid #d97706" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", marginBottom: 12 }}>
                  <div>
                    <h3 style={{ margin: 0 }}>{challenge.title}</h3>
                    {challenge.passionArea && (
                      <span className="pill" style={{ fontSize: 11, marginTop: 4 }}>
                        {challenge.passionArea}
                      </span>
                    )}
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>
                      {daysLeft} days left
                    </div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: "var(--ypp-purple)" }}>
                      {challenge.xpReward} XP
                    </div>
                  </div>
                </div>

                {/* Prompt */}
                {challenge.promptText && (
                  <div style={{
                    padding: 16,
                    background: "#fffbeb",
                    borderRadius: "var(--radius-md)",
                    borderLeft: "3px solid #d97706",
                    marginBottom: 16,
                  }}>
                    <div style={{ fontSize: 11, fontWeight: 600, color: "#d97706", marginBottom: 4 }}>
                      This Week&apos;s Prompt
                    </div>
                    <div style={{ fontSize: 14, fontStyle: "italic" }}>
                      {challenge.promptText}
                    </div>
                  </div>
                )}

                <p style={{ fontSize: 14, color: "var(--text-secondary)", margin: "0 0 16px" }}>
                  {challenge.description}
                </p>

                <div style={{ fontSize: 12, color: "var(--text-secondary)", marginBottom: 16 }}>
                  {challenge._count.participants} participants | {challenge._count.submissions} submissions
                </div>

                {/* Submissions Gallery */}
                {challenge.submissions.length > 0 && (
                  <div style={{ marginBottom: 16 }}>
                    <h4 style={{ fontSize: 14, marginBottom: 8 }}>
                      Top Submissions {votingOpen && <span style={{ color: "#d97706", fontWeight: 400 }}>- Voting Open!</span>}
                    </h4>
                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                      {challenge.submissions.map((sub, i) => (
                        <div
                          key={sub.id}
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                            padding: "10px 12px",
                            background: "var(--surface-alt)",
                            borderRadius: "var(--radius-sm)",
                          }}
                        >
                          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                            <span style={{
                              fontSize: 16,
                              fontWeight: 700,
                              color: i === 0 ? "#fbbf24" : i === 1 ? "#9ca3af" : i === 2 ? "#d97706" : "var(--text-secondary)",
                              width: 20,
                            }}>
                              {i + 1}
                            </span>
                            <div>
                              <div style={{ fontWeight: 500, fontSize: 13 }}>{sub.title}</div>
                              <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>
                                by {sub.student.name}
                                {sub.workUrl && (
                                  <>
                                    {" | "}
                                    <a href={sub.workUrl} target="_blank" rel="noopener noreferrer" style={{ color: "var(--ypp-purple)" }}>
                                      View work
                                    </a>
                                  </>
                                )}
                              </div>
                            </div>
                          </div>
                          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <span style={{ fontSize: 13, fontWeight: 600 }}>
                              {sub.voteCount} votes
                            </span>
                            {votingOpen && sub.student.id !== session.user.id && (
                              <VoteButton submissionId={sub.id} />
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Submit Form */}
                {isJoined && (
                  <WeeklySubmitForm challengeId={challenge.id} />
                )}

                {!isJoined && (
                  <div style={{ fontSize: 13, color: "var(--text-secondary)" }}>
                    <Link href={`/challenges/${challenge.id}`} className="button primary small">
                      Join to Submit
                    </Link>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <div className="card">
          <h3>No Weekly Challenges Right Now</h3>
          <p style={{ color: "var(--text-secondary)", marginTop: 8 }}>
            Check back soon for new creative prompts!
          </p>
        </div>
      )}
    </div>
  );
}

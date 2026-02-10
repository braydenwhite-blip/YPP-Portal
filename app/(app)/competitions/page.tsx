import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { getCompetitions } from "@/lib/challenge-gamification-actions";
import Link from "next/link";
import { CompetitionEntryForm, CompetitionVoteForm } from "./client";

export default async function CompetitionsPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");

  const { competitions, myEntryMap } = await getCompetitions();

  const statusLabels: Record<string, string> = {
    UPCOMING: "Coming Soon",
    OPEN_FOR_SUBMISSIONS: "Open for Submissions",
    JUDGING: "Judging in Progress",
    VOTING: "Community Voting",
    COMPLETED: "Completed",
  };

  const statusColors: Record<string, string> = {
    UPCOMING: "#6b7280",
    OPEN_FOR_SUBMISSIONS: "#16a34a",
    JUDGING: "#d97706",
    VOTING: "#3b82f6",
    COMPLETED: "#7c3aed",
  };

  return (
    <div>
      <div className="topbar">
        <div>
          <h1 className="page-title">Seasonal Competitions</h1>
          <p style={{ fontSize: 13, color: "var(--text-secondary)", marginTop: 2 }}>
            Themed quarterly competitions. Show off your skills and win recognition!
          </p>
        </div>
      </div>

      {competitions.length > 0 ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          {competitions.map((comp) => {
            const color = statusColors[comp.status] || "#6b7280";
            const hasEntered = !!myEntryMap[comp.id];
            const daysUntilDeadline = Math.ceil(
              (new Date(comp.submissionDeadline).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
            );
            const criteria = Array.isArray(comp.judgingCriteria) ? comp.judgingCriteria as { name: string; weight: number; description: string }[] : [];

            return (
              <div key={comp.id} className="card" style={{ borderTop: `4px solid ${color}` }}>
                {/* Header */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", marginBottom: 12 }}>
                  <div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                      <span className="pill" style={{ background: `${color}15`, color, fontSize: 11, fontWeight: 600 }}>
                        {statusLabels[comp.status] || comp.status}
                      </span>
                      <span style={{ fontSize: 12, color: "var(--text-secondary)" }}>
                        {comp.season}
                      </span>
                    </div>
                    <h2 style={{ margin: "4px 0" }}>{comp.theme}</h2>
                    {comp.passionArea && (
                      <span className="pill" style={{ fontSize: 11 }}>{comp.passionArea}</span>
                    )}
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: "var(--ypp-purple)" }}>
                      {comp.xpReward} XP
                    </div>
                    <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>
                      {comp._count.entries} entries
                    </div>
                  </div>
                </div>

                {/* Rules */}
                <div style={{ fontSize: 14, color: "var(--text-secondary)", marginBottom: 16, whiteSpace: "pre-wrap" }}>
                  {comp.rules.length > 200 ? comp.rules.slice(0, 200) + "..." : comp.rules}
                </div>

                {/* Timeline */}
                <div style={{ display: "flex", gap: 16, marginBottom: 16, flexWrap: "wrap" }}>
                  <div style={{ padding: "8px 12px", background: "var(--surface-alt)", borderRadius: "var(--radius-sm)" }}>
                    <div style={{ fontSize: 11, color: "var(--text-secondary)" }}>Start</div>
                    <div style={{ fontSize: 13, fontWeight: 600 }}>
                      {new Date(comp.startDate).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                    </div>
                  </div>
                  <div style={{ padding: "8px 12px", background: "var(--surface-alt)", borderRadius: "var(--radius-sm)" }}>
                    <div style={{ fontSize: 11, color: "var(--text-secondary)" }}>Submission Deadline</div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: daysUntilDeadline <= 3 && daysUntilDeadline > 0 ? "#ef4444" : undefined }}>
                      {new Date(comp.submissionDeadline).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                      {daysUntilDeadline > 0 && ` (${daysUntilDeadline} days)`}
                    </div>
                  </div>
                  <div style={{ padding: "8px 12px", background: "var(--surface-alt)", borderRadius: "var(--radius-sm)" }}>
                    <div style={{ fontSize: 11, color: "var(--text-secondary)" }}>End</div>
                    <div style={{ fontSize: 13, fontWeight: 600 }}>
                      {new Date(comp.endDate).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                    </div>
                  </div>
                </div>

                {/* Judging Criteria */}
                {criteria.length > 0 && (
                  <div style={{ marginBottom: 16 }}>
                    <h4 style={{ fontSize: 13, marginBottom: 8 }}>Judging Criteria</h4>
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                      {criteria.map((c, i) => (
                        <div key={i} style={{ padding: "6px 10px", background: "var(--surface-alt)", borderRadius: "var(--radius-sm)", fontSize: 12 }}>
                          <strong>{c.name}</strong> ({c.weight}%)
                          {c.description && <span style={{ color: "var(--text-secondary)" }}> - {c.description}</span>}
                        </div>
                      ))}
                    </div>
                    {comp.votingEnabled && (
                      <div style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 6 }}>
                        Community vote weight: {Math.round(comp.communityVoteWeight * 100)}%
                      </div>
                    )}
                  </div>
                )}

                {/* Rewards */}
                {(comp.firstPlaceReward || comp.secondPlaceReward || comp.thirdPlaceReward) && (
                  <div style={{ display: "flex", gap: 12, marginBottom: 16 }}>
                    {comp.firstPlaceReward && (
                      <div style={{ padding: "8px 12px", background: "#fef3c7", borderRadius: "var(--radius-sm)", textAlign: "center" }}>
                        <div style={{ fontSize: 18 }}>1st</div>
                        <div style={{ fontSize: 12, fontWeight: 600 }}>{comp.firstPlaceReward}</div>
                      </div>
                    )}
                    {comp.secondPlaceReward && (
                      <div style={{ padding: "8px 12px", background: "var(--gray-100)", borderRadius: "var(--radius-sm)", textAlign: "center" }}>
                        <div style={{ fontSize: 18 }}>2nd</div>
                        <div style={{ fontSize: 12, fontWeight: 600 }}>{comp.secondPlaceReward}</div>
                      </div>
                    )}
                    {comp.thirdPlaceReward && (
                      <div style={{ padding: "8px 12px", background: "#fed7aa", borderRadius: "var(--radius-sm)", textAlign: "center" }}>
                        <div style={{ fontSize: 18 }}>3rd</div>
                        <div style={{ fontSize: 12, fontWeight: 600 }}>{comp.thirdPlaceReward}</div>
                      </div>
                    )}
                  </div>
                )}

                {/* Entries (for completed/voting) */}
                {(comp.status === "COMPLETED" || comp.status === "VOTING") && comp.entries.length > 0 && (
                  <div style={{ marginBottom: 16 }}>
                    <h4 style={{ fontSize: 13, marginBottom: 8 }}>
                      {comp.status === "COMPLETED" ? "Results" : "Entries - Vote Now!"}
                    </h4>
                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                      {comp.entries.slice(0, 10).map((entry, i) => (
                        <div
                          key={entry.id}
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                            padding: "10px 12px",
                            background: entry.studentId === session.user.id ? "var(--ypp-purple-50)" : "var(--surface-alt)",
                            borderRadius: "var(--radius-sm)",
                            border: entry.placement && entry.placement <= 3 ? `2px solid ${entry.placement === 1 ? "#fbbf24" : entry.placement === 2 ? "#9ca3af" : "#d97706"}` : "none",
                          }}
                        >
                          <div>
                            {entry.placement && (
                              <span style={{
                                display: "inline-block",
                                width: 22,
                                height: 22,
                                borderRadius: "50%",
                                background: entry.placement === 1 ? "#fbbf24" : entry.placement === 2 ? "#9ca3af" : entry.placement === 3 ? "#d97706" : "transparent",
                                color: "white",
                                textAlign: "center",
                                lineHeight: "22px",
                                fontSize: 11,
                                fontWeight: 700,
                                marginRight: 8,
                              }}>
                                {entry.placement}
                              </span>
                            )}
                            <strong style={{ fontSize: 13 }}>{entry.title}</strong>
                            <span style={{ fontSize: 12, color: "var(--text-secondary)", marginLeft: 8 }}>
                              by {entry.student.name}
                            </span>
                            {entry.workUrl && (
                              <a href={entry.workUrl} target="_blank" rel="noopener noreferrer" style={{ fontSize: 12, color: "var(--ypp-purple)", marginLeft: 8 }}>
                                View
                              </a>
                            )}
                          </div>
                          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            {entry.finalScore != null && (
                              <span style={{ fontSize: 13, fontWeight: 600 }}>
                                {entry.finalScore.toFixed(1)} pts
                              </span>
                            )}
                            {comp.status === "VOTING" && entry.studentId !== session.user.id && (
                              <CompetitionVoteForm entryId={entry.id} />
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Submit Entry */}
                {comp.status === "OPEN_FOR_SUBMISSIONS" && !hasEntered && (
                  <CompetitionEntryForm competitionId={comp.id} />
                )}

                {comp.status === "OPEN_FOR_SUBMISSIONS" && hasEntered && (
                  <div style={{ padding: 12, background: "#dcfce7", borderRadius: "var(--radius-md)", fontSize: 14, color: "#16a34a", fontWeight: 600 }}>
                    Entry submitted! Good luck!
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <div className="card">
          <h3>No Competitions Yet</h3>
          <p style={{ color: "var(--text-secondary)", marginTop: 8 }}>
            Seasonal competitions will appear here. Check back soon!
          </p>
        </div>
      )}
    </div>
  );
}

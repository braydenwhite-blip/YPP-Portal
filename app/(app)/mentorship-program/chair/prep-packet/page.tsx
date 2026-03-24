import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { generateCommitteePrepPacket } from "@/lib/committee-prep-actions";
import Link from "next/link";

export const metadata = { title: "Committee Prep Packet — YPP" };

const RATING_CONFIG: Record<string, { label: string; color: string }> = {
  BEHIND_SCHEDULE: { label: "Behind Schedule", color: "#ef4444" },
  GETTING_STARTED: { label: "Getting Started", color: "#d97706" },
  ACHIEVED: { label: "Achieved", color: "#16a34a" },
  ABOVE_AND_BEYOND: { label: "Above & Beyond", color: "#7c3aed" },
};

const TIER_LABELS: Record<string, string> = {
  BRONZE: "🥉 Bronze",
  SILVER: "🥈 Silver",
  GOLD: "🥇 Gold",
  LIFETIME: "👑 Lifetime",
};

const ROLE_LABELS: Record<string, string> = {
  INSTRUCTOR: "Instructor",
  CHAPTER_PRESIDENT: "Chapter President",
  ADMIN: "Global Leadership",
  STAFF: "Global Leadership",
};

export default async function PrepPacketPage({
  searchParams,
}: {
  searchParams: Promise<{ mentorshipId?: string }>;
}) {
  const { mentorshipId } = await searchParams;
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");

  const roles = session.user.roles ?? [];
  const isAuthorized = roles.includes("ADMIN") || roles.includes("CHAPTER_PRESIDENT");
  if (!isAuthorized) redirect("/");

  if (!mentorshipId) {
    return (
      <div>
        <div className="topbar">
          <h1 className="page-title">Committee Prep Packet</h1>
        </div>
        <div className="card" style={{ textAlign: "center", padding: "3rem" }}>
          <p style={{ color: "var(--muted)" }}>No mentorship selected. Go back and click "Generate Prep Packet" from a mentee's profile.</p>
          <Link href="/mentorship-program/chair" className="button secondary small" style={{ marginTop: "1rem", display: "inline-block" }}>
            ← Back to Chair Queue
          </Link>
        </div>
      </div>
    );
  }

  let packet;
  try {
    packet = await generateCommitteePrepPacket(mentorshipId);
  } catch {
    redirect("/mentorship-program/chair");
  }

  return (
    <div>
      <div className="topbar" style={{ marginBottom: "1.5rem" }}>
        <div>
          <p className="badge">Committee Meeting</p>
          <h1 className="page-title">Prep Packet — {packet.mentee.name}</h1>
          <p className="page-subtitle">
            Generated {new Date(packet.generatedAt).toLocaleDateString("en-US", {
              month: "long",
              day: "numeric",
              year: "numeric",
              hour: "numeric",
              minute: "2-digit",
            })}
          </p>
        </div>
        <div style={{ display: "flex", gap: "0.5rem" }}>
          <Link href="/mentorship-program/chair" className="button secondary small">
            ← Back
          </Link>
          <button
            className="button primary small"
            onClick={() => window.print()}
          >
            Print / Save PDF
          </button>
        </div>
      </div>

      {/* Mentee Profile */}
      <div className="card" style={{ marginBottom: "1.5rem" }}>
        <p style={{ fontWeight: 700, fontSize: "1rem", marginBottom: "1rem", borderBottom: "1px solid var(--border)", paddingBottom: "0.5rem" }}>
          Mentee Profile
        </p>
        <div className="grid two">
          <div>
            <p style={{ fontSize: "0.78rem", color: "var(--muted)" }}>Name</p>
            <p style={{ fontWeight: 600 }}>{packet.mentee.name}</p>
          </div>
          <div>
            <p style={{ fontSize: "0.78rem", color: "var(--muted)" }}>Email</p>
            <p>{packet.mentee.email}</p>
          </div>
          <div>
            <p style={{ fontSize: "0.78rem", color: "var(--muted)" }}>Role</p>
            <p style={{ fontWeight: 600 }}>{ROLE_LABELS[packet.mentee.role] ?? packet.mentee.role}</p>
          </div>
          <div>
            <p style={{ fontSize: "0.78rem", color: "var(--muted)" }}>Chapter</p>
            <p>{packet.mentee.chapter ?? "—"}</p>
          </div>
          <div>
            <p style={{ fontSize: "0.78rem", color: "var(--muted)" }}>Mentor</p>
            <p>{packet.mentor.name}</p>
          </div>
          <div>
            <p style={{ fontSize: "0.78rem", color: "var(--muted)" }}>Tenure</p>
            <p>{packet.mentee.tenureMonths} month{packet.mentee.tenureMonths !== 1 ? "s" : ""} in program</p>
          </div>
        </div>
      </div>

      {/* Achievement Progress */}
      <div className="card" style={{ marginBottom: "1.5rem" }}>
        <p style={{ fontWeight: 700, fontSize: "1rem", marginBottom: "1rem", borderBottom: "1px solid var(--border)", paddingBottom: "0.5rem" }}>
          Achievement Progress
        </p>
        <div className="grid four" style={{ marginBottom: "1rem" }}>
          <div>
            <p style={{ fontSize: "0.78rem", color: "var(--muted)" }}>Total Points</p>
            <p style={{ fontWeight: 800, fontSize: "1.3rem" }}>{packet.achievement.totalPoints}</p>
          </div>
          <div>
            <p style={{ fontSize: "0.78rem", color: "var(--muted)" }}>Current Tier</p>
            <p style={{ fontWeight: 700 }}>{packet.achievement.currentTier ? TIER_LABELS[packet.achievement.currentTier] : "None"}</p>
          </div>
          <div>
            <p style={{ fontSize: "0.78rem", color: "var(--muted)" }}>Next Tier Threshold</p>
            <p style={{ fontWeight: 600 }}>{packet.achievement.nextTierThreshold} pts</p>
          </div>
          <div>
            <p style={{ fontSize: "0.78rem", color: "var(--muted)" }}>Progress</p>
            <p style={{ fontWeight: 700, color: packet.achievement.progressPercent >= 75 ? "#16a34a" : "inherit" }}>
              {packet.achievement.progressPercent}%
            </p>
          </div>
        </div>
        {/* Progress bar */}
        <div style={{ height: "8px", background: "var(--surface-alt)", borderRadius: "99px", overflow: "hidden", marginBottom: "0.75rem" }}>
          <div style={{ height: "100%", width: `${packet.achievement.progressPercent}%`, background: "var(--ypp-purple-500)", borderRadius: "99px" }} />
        </div>
        {packet.achievement.recentPointLogs.length > 0 && (
          <div>
            <p style={{ fontSize: "0.78rem", color: "var(--muted)", marginBottom: "0.4rem" }}>Recent point history:</p>
            {packet.achievement.recentPointLogs.map((log, i) => (
              <div key={i} style={{ display: "flex", justifyContent: "space-between", fontSize: "0.82rem", padding: "0.2rem 0" }}>
                <span>Cycle {log.cycleNumber}{log.reason ? ` — ${log.reason}` : ""}</span>
                <span style={{ fontWeight: 700, color: "#16a34a" }}>+{log.points}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Last 3 Reviews Side-by-Side */}
      {packet.last3Reviews.length > 0 && (
        <div style={{ marginBottom: "1.5rem" }}>
          <p style={{ fontWeight: 700, fontSize: "1rem", marginBottom: "1rem" }}>Last 3 Monthly Reviews</p>
          <div style={{ display: "flex", gap: "1rem", overflowX: "auto" }}>
            {packet.last3Reviews.map((review) => {
              const ratingCfg = RATING_CONFIG[review.overallRating];
              return (
                <div
                  key={review.cycleNumber}
                  className="card"
                  style={{
                    flex: 1,
                    minWidth: "220px",
                    borderTop: `3px solid ${ratingCfg?.color ?? "var(--border)"}`,
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.6rem" }}>
                    <span style={{ fontWeight: 700, fontSize: "0.9rem" }}>Cycle {review.cycleNumber}</span>
                    {ratingCfg && (
                      <span style={{ fontSize: "0.72rem", color: ratingCfg.color, fontWeight: 700 }}>
                        {ratingCfg.label}
                      </span>
                    )}
                  </div>
                  <p style={{ fontSize: "0.72rem", color: "var(--muted)", marginBottom: "0.5rem" }}>
                    {new Date(review.cycleMonth).toLocaleDateString("en-US", { month: "long", year: "numeric" })}
                  </p>
                  {review.goalRatings.map((gr) => {
                    const grCfg = RATING_CONFIG[gr.rating];
                    return (
                      <div key={gr.goalTitle} style={{ display: "flex", justifyContent: "space-between", fontSize: "0.75rem", marginBottom: "0.15rem" }}>
                        <span style={{ flex: 1, marginRight: "0.4rem", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {gr.goalTitle}
                        </span>
                        <span style={{ color: grCfg?.color, fontWeight: 600, flexShrink: 0 }}>
                          {grCfg?.label ?? gr.rating}
                        </span>
                      </div>
                    );
                  })}
                  {review.pointsAwarded !== null && (
                    <p style={{ fontSize: "0.78rem", color: "#16a34a", fontWeight: 700, marginTop: "0.4rem" }}>
                      +{review.pointsAwarded} pts
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Stakeholder Feedback */}
      <div className="card" style={{ marginBottom: "1.5rem" }}>
        <p style={{ fontWeight: 700, fontSize: "1rem", marginBottom: "1rem", borderBottom: "1px solid var(--border)", paddingBottom: "0.5rem" }}>
          Stakeholder Feedback Summary
        </p>
        {packet.stakeholderFeedback.totalResponses === 0 ? (
          <p style={{ color: "var(--muted)", fontSize: "0.85rem" }}>No stakeholder feedback collected for this quarter.</p>
        ) : (
          <div>
            <div style={{ display: "flex", gap: "2rem", marginBottom: "1rem" }}>
              <div>
                <p style={{ fontSize: "0.78rem", color: "var(--muted)" }}>Responses</p>
                <p style={{ fontWeight: 700, fontSize: "1.2rem" }}>{packet.stakeholderFeedback.totalResponses}</p>
              </div>
              <div>
                <p style={{ fontSize: "0.78rem", color: "var(--muted)" }}>Avg Rating</p>
                <p style={{ fontWeight: 700, fontSize: "1.2rem" }}>
                  {packet.stakeholderFeedback.avgRating !== null ? `${packet.stakeholderFeedback.avgRating}/5` : "—"}
                </p>
              </div>
            </div>
            {packet.stakeholderFeedback.strengthsHighlights.length > 0 && (
              <div style={{ marginBottom: "0.75rem" }}>
                <p style={{ fontSize: "0.75rem", fontWeight: 700, color: "#16a34a", textTransform: "uppercase", marginBottom: "0.35rem" }}>
                  Key Strengths
                </p>
                {packet.stakeholderFeedback.strengthsHighlights.map((s, i) => (
                  <p key={i} style={{ fontSize: "0.82rem", lineHeight: 1.5, marginBottom: "0.25rem" }}>"{s}"</p>
                ))}
              </div>
            )}
            {packet.stakeholderFeedback.growthHighlights.length > 0 && (
              <div>
                <p style={{ fontSize: "0.75rem", fontWeight: 700, color: "#d97706", textTransform: "uppercase", marginBottom: "0.35rem" }}>
                  Growth Areas
                </p>
                {packet.stakeholderFeedback.growthHighlights.map((s, i) => (
                  <p key={i} style={{ fontSize: "0.82rem", lineHeight: 1.5, marginBottom: "0.25rem" }}>"{s}"</p>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Open Action Items */}
      {packet.openActionItems.length > 0 && (
        <div className="card" style={{ marginBottom: "1.5rem" }}>
          <p style={{ fontWeight: 700, fontSize: "1rem", marginBottom: "0.75rem" }}>
            Open Action Items ({packet.openActionItems.length})
          </p>
          {packet.openActionItems.map((item) => (
            <div
              key={item.id}
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                padding: "0.5rem 0",
                borderBottom: "1px solid var(--border)",
              }}
            >
              <span style={{ fontSize: "0.85rem" }}>{item.title}</span>
              <span
                className="pill"
                style={{
                  fontSize: "0.7rem",
                  background: item.status === "IN_PROGRESS" ? "#fffbeb" : "var(--surface-alt)",
                  color: item.status === "IN_PROGRESS" ? "#d97706" : "var(--muted)",
                }}
              >
                {item.status.replace(/_/g, " ")}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Suggested Discussion Topics */}
      {packet.suggestedDiscussionTopics.length > 0 && (
        <div className="card">
          <p style={{ fontWeight: 700, fontSize: "1rem", marginBottom: "0.75rem" }}>
            Suggested Discussion Topics
          </p>
          <ol style={{ margin: 0, paddingLeft: "1.25rem" }}>
            {packet.suggestedDiscussionTopics.map((topic, i) => (
              <li key={i} style={{ fontSize: "0.88rem", lineHeight: 1.6, marginBottom: "0.35rem" }}>
                {topic}
              </li>
            ))}
          </ol>
        </div>
      )}
    </div>
  );
}

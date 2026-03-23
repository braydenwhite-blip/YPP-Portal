import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { getAchievementJourneyData } from "@/lib/achievement-journey-actions";
import { TIER_THRESHOLDS } from "@/lib/achievement-tier-config";
import { toMenteeRoleType } from "@/lib/mentee-role-utils";
import Link from "next/link";

export const metadata = { title: "Achievement Journey — YPP Mentorship" };

const TIER_CONFIG: Record<string, { label: string; color: string; bg: string; emoji: string }> = {
  BRONZE: { label: "Bronze", color: "#cd7f32", bg: "#fdf6ec", emoji: "🥉" },
  SILVER: { label: "Silver", color: "#a8a9ad", bg: "#f5f5f5", emoji: "🥈" },
  GOLD: { label: "Gold", color: "#d4af37", bg: "#fffbeb", emoji: "🥇" },
  LIFETIME: { label: "Lifetime", color: "#7c3aed", bg: "#faf5ff", emoji: "👑" },
};

const RATING_CONFIG: Record<string, { label: string; color: string }> = {
  BEHIND_SCHEDULE: { label: "Behind Schedule", color: "#ef4444" },
  GETTING_STARTED: { label: "Getting Started", color: "#d97706" },
  ACHIEVED: { label: "Achieved", color: "#16a34a" },
  ABOVE_AND_BEYOND: { label: "Above & Beyond", color: "#7c3aed" },
};

const TIER_BENEFITS: Record<string, string[]> = {
  BRONZE: [
    "Recognition at quarterly chapter meetings",
    "Bronze digital badge for your profile",
    "Access to alumni networking events",
    "Volunteer hours certification (25 hrs)",
  ],
  SILVER: [
    "All Bronze benefits",
    "Silver digital badge + certificate",
    "Priority consideration for leadership openings",
    "Mentor spotlight feature on chapter page",
    "Volunteer hours certification (50 hrs)",
  ],
  GOLD: [
    "All Silver benefits",
    "Gold digital badge + framed certificate",
    "Invitation to Global YPP Leadership Summit",
    "Recommendation letter from program director",
    "Volunteer hours certification (100 hrs)",
  ],
  LIFETIME: [
    "All Gold benefits",
    "Lifetime Achievement Award plaque",
    "Permanent alumni advisor designation",
    "Named in YPP annual report",
    "Keynote invitation opportunities",
    "Volunteer hours certification (150+ hrs)",
  ],
};

export default async function AchievementJourneyPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");

  const primaryRole = session.user.primaryRole ?? "";
  if (!toMenteeRoleType(primaryRole)) redirect("/");

  const data = await getAchievementJourneyData();
  if (!data) redirect("/my-program");

  const currentTierCfg = data.currentTier ? TIER_CONFIG[data.currentTier] : null;
  const nextTierCfg = data.nextTier ? TIER_CONFIG[data.nextTier.tier] : null;

  const TIER_ORDER = ["BRONZE", "SILVER", "GOLD", "LIFETIME"] as const;

  return (
    <div>
      <div className="topbar">
        <div>
          <p className="badge">My Program</p>
          <h1 className="page-title">Achievement Journey</h1>
          <p className="page-subtitle">Your path through the YPP Mentorship Award tiers</p>
        </div>
        <Link href="/my-program" className="button secondary small">
          ← Back to My Program
        </Link>
      </div>

      {/* Milestone celebration banner */}
      {data.milestoneMessage && (
        <div
          style={{
            background: "linear-gradient(135deg, var(--ypp-purple-100) 0%, #fdf6ec 100%)",
            border: "1px solid var(--ypp-purple-200)",
            borderRadius: "var(--radius)",
            padding: "1rem 1.25rem",
            marginBottom: "1.5rem",
            display: "flex",
            alignItems: "center",
            gap: "0.75rem",
          }}
        >
          <span style={{ fontSize: "1.5rem" }}>🎉</span>
          <p style={{ fontWeight: 600, color: "var(--ypp-purple-700)", margin: 0 }}>
            {data.milestoneMessage}
          </p>
        </div>
      )}

      {/* Progress Ring + KPIs */}
      <div className="grid two" style={{ marginBottom: "2rem", alignItems: "start" }}>
        {/* Progress ring card */}
        <div className="card" style={{ textAlign: "center", padding: "2rem" }}>
          <p style={{ fontWeight: 700, fontSize: "1rem", marginBottom: "1.25rem" }}>Tier Progress</p>
          {/* SVG progress ring */}
          <div style={{ position: "relative", display: "inline-block", marginBottom: "1.25rem" }}>
            <svg width="160" height="160" viewBox="0 0 160 160">
              {/* Background ring */}
              <circle
                cx="80"
                cy="80"
                r="64"
                fill="none"
                stroke="var(--surface-alt)"
                strokeWidth="14"
              />
              {/* Progress ring */}
              <circle
                cx="80"
                cy="80"
                r="64"
                fill="none"
                stroke={nextTierCfg?.color ?? currentTierCfg?.color ?? "var(--ypp-purple-400)"}
                strokeWidth="14"
                strokeDasharray={`${(data.progressPercent / 100) * 402} 402`}
                strokeDashoffset="100"
                strokeLinecap="round"
                transform="rotate(-90 80 80)"
                style={{ transition: "stroke-dasharray 0.6s ease" }}
              />
              {/* Center text */}
              <text x="80" y="72" textAnchor="middle" fontSize="28" fontWeight="700" fill="var(--foreground)">
                {data.progressPercent}%
              </text>
              <text x="80" y="92" textAnchor="middle" fontSize="11" fill="var(--muted)">
                to {nextTierCfg?.label ?? "top tier"}
              </text>
            </svg>
          </div>
          <div style={{ display: "flex", justifyContent: "center", gap: "1.5rem" }}>
            <div>
              <p style={{ fontSize: "1.5rem", fontWeight: 800, color: nextTierCfg?.color ?? "var(--foreground)" }}>
                {data.totalPoints.toLocaleString()}
              </p>
              <p style={{ fontSize: "0.78rem", color: "var(--muted)" }}>Total Points</p>
            </div>
            <div>
              <p style={{ fontSize: "1.5rem", fontWeight: 800, color: "#ef4444" }}>
                {data.pointsToNextTier.toLocaleString()}
              </p>
              <p style={{ fontSize: "0.78rem", color: "var(--muted)" }}>Needed</p>
            </div>
          </div>
        </div>

        {/* Velocity + current tier */}
        <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          <div className="card">
            <p style={{ fontWeight: 700, marginBottom: "0.5rem" }}>Current Tier</p>
            {currentTierCfg ? (
              <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                <span style={{ fontSize: "2rem" }}>{currentTierCfg.emoji}</span>
                <div>
                  <p style={{ fontWeight: 700, color: currentTierCfg.color, fontSize: "1.15rem" }}>
                    {currentTierCfg.label}
                  </p>
                  <p style={{ fontSize: "0.8rem", color: "var(--muted)" }}>
                    {data.totalPoints} points earned
                  </p>
                </div>
              </div>
            ) : (
              <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                <span style={{ fontSize: "2rem" }}>🎯</span>
                <div>
                  <p style={{ fontWeight: 700, fontSize: "1rem" }}>No tier yet</p>
                  <p style={{ fontSize: "0.8rem", color: "var(--muted)" }}>
                    Earn {175 - data.totalPoints} more points to reach Bronze
                  </p>
                </div>
              </div>
            )}
          </div>

          {data.monthsToNextTier !== null && (
            <div
              className="card"
              style={{ borderLeft: "4px solid var(--ypp-purple-400)", background: "var(--ypp-purple-50, #faf5ff)" }}
            >
              <p style={{ fontWeight: 700, marginBottom: "0.35rem" }}>Earning Velocity</p>
              <p style={{ fontSize: "1.1rem", fontWeight: 600, color: "var(--ypp-purple-700)" }}>
                ~{data.monthsToNextTier} cycle{data.monthsToNextTier !== 1 ? "s" : ""} to{" "}
                {nextTierCfg?.label ?? "next tier"}
              </p>
              <p style={{ fontSize: "0.78rem", color: "var(--muted)", marginTop: "0.2rem" }}>
                Based on your recent earning pace
              </p>
            </div>
          )}

          {data.earnedThisCycle > 0 && (
            <div className="card" style={{ borderLeft: "4px solid #16a34a" }}>
              <p style={{ fontWeight: 700, marginBottom: "0.35rem" }}>Last Cycle Earned</p>
              <p style={{ fontSize: "1.4rem", fontWeight: 800, color: "#16a34a" }}>
                +{data.earnedThisCycle} pts
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Tier progression timeline */}
      <div style={{ marginBottom: "2rem" }}>
        <p className="section-title" style={{ marginBottom: "1rem" }}>Tier Progression</p>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 0,
            overflowX: "auto",
            paddingBottom: "0.25rem",
          }}
        >
          {TIER_ORDER.map((tier, i) => {
            const cfg = TIER_CONFIG[tier];
            const threshold = TIER_THRESHOLDS.find((t) => t.tier === tier)!;
            const reached = data.totalPoints >= threshold.min;
            const isCurrent = data.currentTier === tier;
            return (
              <div
                key={tier}
                style={{ display: "flex", alignItems: "center", flex: 1, minWidth: "100px" }}
              >
                <div
                  style={{
                    textAlign: "center",
                    flex: 1,
                    padding: "0.75rem 0.5rem",
                    borderRadius: "var(--radius)",
                    background: reached ? cfg.bg : "var(--surface-alt)",
                    border: isCurrent ? `2px solid ${cfg.color}` : "2px solid transparent",
                    transition: "all 0.2s",
                  }}
                >
                  <div style={{ fontSize: "1.4rem" }}>{cfg.emoji}</div>
                  <p style={{ fontWeight: 700, fontSize: "0.8rem", color: reached ? cfg.color : "var(--muted)" }}>
                    {cfg.label}
                  </p>
                  <p style={{ fontSize: "0.7rem", color: "var(--muted)" }}>{threshold.min} pts</p>
                  {reached && (
                    <span style={{ fontSize: "0.65rem", color: cfg.color, fontWeight: 600 }}>
                      {isCurrent ? "CURRENT" : "ACHIEVED"}
                    </span>
                  )}
                </div>
                {i < TIER_ORDER.length - 1 && (
                  <div
                    style={{
                      height: "2px",
                      width: "24px",
                      background: data.totalPoints >= TIER_THRESHOLDS[TIER_ORDER.length - 2 - i]?.min ?? 0
                        ? "var(--ypp-purple-400)"
                        : "var(--border)",
                      flexShrink: 0,
                    }}
                  />
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Tier Benefits Preview */}
      <div style={{ marginBottom: "2rem" }}>
        <p className="section-title" style={{ marginBottom: "1rem" }}>Tier Benefits</p>
        <div style={{ display: "flex", flexDirection: "column", gap: "0.65rem" }}>
          {TIER_ORDER.map((tier) => {
            const cfg = TIER_CONFIG[tier];
            const threshold = TIER_THRESHOLDS.find((t) => t.tier === tier)!;
            const reached = data.totalPoints >= threshold.min;
            const benefits = TIER_BENEFITS[tier] ?? [];
            return (
              <details
                key={tier}
                style={{
                  border: `1px solid ${reached ? cfg.color + "44" : "var(--border)"}`,
                  borderRadius: "var(--radius)",
                  overflow: "hidden",
                }}
              >
                <summary
                  style={{
                    padding: "0.85rem 1rem",
                    cursor: "pointer",
                    background: reached ? cfg.bg : "var(--surface)",
                    display: "flex",
                    alignItems: "center",
                    gap: "0.6rem",
                    fontWeight: 600,
                    fontSize: "0.9rem",
                    listStyle: "none",
                  }}
                >
                  <span>{cfg.emoji}</span>
                  <span style={{ color: reached ? cfg.color : "var(--muted)", flex: 1 }}>
                    {cfg.label} — {threshold.min}+ points
                  </span>
                  {reached ? (
                    <span
                      className="pill"
                      style={{ background: cfg.bg, color: cfg.color, fontSize: "0.7rem" }}
                    >
                      Unlocked
                    </span>
                  ) : (
                    <span style={{ fontSize: "0.75rem", color: "var(--muted)" }}>
                      {threshold.min - data.totalPoints} pts away ▾
                    </span>
                  )}
                </summary>
                <div style={{ padding: "0.75rem 1rem", background: "var(--surface)" }}>
                  <ul style={{ margin: 0, paddingLeft: "1.2rem" }}>
                    {benefits.map((b) => (
                      <li
                        key={b}
                        style={{ fontSize: "0.85rem", color: "var(--foreground)", marginBottom: "0.3rem" }}
                      >
                        {b}
                      </li>
                    ))}
                  </ul>
                </div>
              </details>
            );
          })}
        </div>
      </div>

      {/* Point History Timeline */}
      <div style={{ marginBottom: "2rem" }}>
        <p className="section-title" style={{ marginBottom: "1rem" }}>Point History</p>
        {data.pointLogs.length === 0 ? (
          <div className="card" style={{ textAlign: "center", padding: "2.5rem" }}>
            <p style={{ color: "var(--muted)" }}>No points earned yet. Complete your first review cycle to start your journey.</p>
          </div>
        ) : (
          <div style={{ position: "relative" }}>
            {/* Timeline line */}
            <div
              style={{
                position: "absolute",
                left: "24px",
                top: "8px",
                bottom: "8px",
                width: "2px",
                background: "var(--border)",
              }}
            />
            <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
              {data.pointLogs.map((log, i) => {
                const ratingCfg = RATING_CONFIG[log.overallRating];
                return (
                  <div
                    key={log.id}
                    style={{
                      display: "flex",
                      alignItems: "flex-start",
                      gap: "1rem",
                      paddingLeft: "0.5rem",
                    }}
                  >
                    {/* Dot */}
                    <div
                      style={{
                        width: "12px",
                        height: "12px",
                        borderRadius: "50%",
                        background: ratingCfg?.color ?? "var(--ypp-purple-400)",
                        flexShrink: 0,
                        marginTop: "0.3rem",
                        border: "2px solid var(--surface)",
                        boxShadow: `0 0 0 2px ${ratingCfg?.color ?? "var(--ypp-purple-400)"}44`,
                        zIndex: 1,
                      }}
                    />
                    <div
                      className="card"
                      style={{
                        flex: 1,
                        padding: "0.65rem 0.85rem",
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                      }}
                    >
                      <div>
                        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                          <span style={{ fontWeight: 600, fontSize: "0.88rem" }}>
                            Cycle {log.cycleNumber}
                          </span>
                          {ratingCfg && (
                            <span
                              className="pill"
                              style={{ fontSize: "0.7rem", background: ratingCfg.color + "22", color: ratingCfg.color }}
                            >
                              {ratingCfg.label}
                            </span>
                          )}
                        </div>
                        <p style={{ fontSize: "0.75rem", color: "var(--muted)", margin: "0.1rem 0 0" }}>
                          {new Date(log.cycleMonth).toLocaleDateString("en-US", {
                            month: "long",
                            year: "numeric",
                          })}
                          {log.reason ? ` · ${log.reason}` : ""}
                        </p>
                      </div>
                      <span
                        style={{
                          fontWeight: 800,
                          fontSize: "1.05rem",
                          color: "#16a34a",
                        }}
                      >
                        +{log.points}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Recent Reviews */}
      {data.recentReviews.length > 0 && (
        <div>
          <p className="section-title" style={{ marginBottom: "1rem" }}>Recent Reviews</p>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.65rem" }}>
            {data.recentReviews.map((review) => {
              const ratingCfg = RATING_CONFIG[review.overallRating];
              return (
                <div
                  key={review.id}
                  className="card"
                  style={{ padding: "0.85rem 1rem", display: "flex", justifyContent: "space-between", alignItems: "center" }}
                >
                  <div>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                      <span style={{ fontWeight: 600 }}>Cycle {review.cycleNumber}</span>
                      {review.cycleNumber % 3 === 0 && (
                        <span className="pill" style={{ fontSize: "0.7rem", background: "var(--ypp-purple-100)", color: "var(--ypp-purple-700)" }}>
                          Quarterly
                        </span>
                      )}
                    </div>
                    <p style={{ fontSize: "0.78rem", color: "var(--muted)", marginTop: "0.1rem" }}>
                      {new Date(review.cycleMonth).toLocaleDateString("en-US", { month: "long", year: "numeric" })}
                    </p>
                  </div>
                  <div style={{ textAlign: "right", display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "0.25rem" }}>
                    {ratingCfg && (
                      <span
                        className="pill"
                        style={{ fontSize: "0.75rem", background: ratingCfg.color + "22", color: ratingCfg.color }}
                      >
                        {ratingCfg.label}
                      </span>
                    )}
                    {review.pointsAwarded !== null && (
                      <span style={{ fontSize: "0.78rem", fontWeight: 700, color: "#16a34a" }}>
                        +{review.pointsAwarded} pts
                      </span>
                    )}
                    {review.bonusPoints > 0 && (
                      <span style={{ fontSize: "0.72rem", color: "var(--ypp-purple-600)" }}>
                        +{review.bonusPoints} bonus
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

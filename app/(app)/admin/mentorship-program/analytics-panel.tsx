"use client";

const TIER_CONFIG: Record<string, { label: string; color: string; bg: string; emoji: string }> = {
  NONE: { label: "No Tier", color: "var(--muted)", bg: "var(--surface-alt)", emoji: "—" },
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

const ROLE_LABELS: Record<string, string> = {
  INSTRUCTOR: "Instructor",
  CHAPTER_LEAD: "Chapter President",
  ADMIN: "Global Leadership",
  STAFF: "Global Leadership",
};

interface AnalyticsData {
  activePairs: number;
  totalReflections: number;
  reviews: {
    draft: number;
    pendingChair: number;
    changesRequested: number;
    approved: number;
  };
  totalPointsAwarded: number;
  tierDistribution: {
    NONE: number;
    BRONZE: number;
    SILVER: number;
    GOLD: number;
    LIFETIME: number;
  };
  nominationsByTier: { tier: string; status: string; count: number }[];
  recentApprovals: {
    id: string;
    cycleNumber: number;
    overallRating: string;
    pointsAwarded: number | null;
    chairApprovedAt: string | null;
    menteeName: string;
    menteeRole: string;
    mentorName: string;
  }[];
  reflectionsByCycle: { cycleNumber: number; count: number }[];
}

interface Props {
  analytics: AnalyticsData;
}

export default function AnalyticsPanel({ analytics }: Props) {
  const {
    activePairs,
    totalReflections,
    reviews,
    totalPointsAwarded,
    tierDistribution,
    nominationsByTier,
    recentApprovals,
    reflectionsByCycle,
  } = analytics;

  const totalReviews = reviews.draft + reviews.pendingChair + reviews.changesRequested + reviews.approved;
  const approvalRate = totalReviews > 0 ? Math.round((reviews.approved / totalReviews) * 100) : 0;

  const tierOrder = ["NONE", "BRONZE", "SILVER", "GOLD", "LIFETIME"] as const;
  const totalMenteesWithPoints = Object.values(tierDistribution).reduce((a, b) => a + b, 0);

  // Aggregate nominations by tier
  const nomTierMap: Record<string, { approved: number; pending: number }> = {};
  for (const n of nominationsByTier) {
    if (!nomTierMap[n.tier]) nomTierMap[n.tier] = { approved: 0, pending: 0 };
    if (n.status === "APPROVED") nomTierMap[n.tier].approved += n.count;
    else if (n.status === "PENDING_CHAIR" || n.status === "PENDING_BOARD")
      nomTierMap[n.tier].pending += n.count;
  }

  return (
    <div>
      {/* Program Health KPIs */}
      <div className="grid four" style={{ marginBottom: "1.5rem" }}>
        <div className="card">
          <p className="kpi">{totalReflections}</p>
          <p className="kpi-label">Total Reflections</p>
        </div>
        <div className="card">
          <p className="kpi">{reviews.approved}</p>
          <p className="kpi-label">Reviews Approved</p>
        </div>
        <div className="card">
          <p className="kpi" style={{ color: "var(--ypp-purple-700)" }}>
            {totalPointsAwarded.toLocaleString()}
          </p>
          <p className="kpi-label">Total Points Awarded</p>
        </div>
        <div className="card">
          <p className="kpi" style={{ color: approvalRate > 70 ? "#16a34a" : "#d97706" }}>
            {approvalRate}%
          </p>
          <p className="kpi-label">Review Approval Rate</p>
        </div>
      </div>

      <div className="grid two" style={{ marginBottom: "1.5rem" }}>
        {/* Review pipeline */}
        <div className="card">
          <p style={{ fontWeight: 700, marginBottom: "1rem" }}>Review Pipeline</p>
          {[
            { label: "Draft", value: reviews.draft, color: "var(--muted)" },
            { label: "Pending Chair", value: reviews.pendingChair, color: "#d97706" },
            { label: "Changes Requested", value: reviews.changesRequested, color: "#ef4444" },
            { label: "Approved", value: reviews.approved, color: "#16a34a" },
          ].map(({ label, value, color }) => (
            <div
              key={label}
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                padding: "0.5rem 0",
                borderBottom: "1px solid var(--border)",
              }}
            >
              <span style={{ fontSize: "0.88rem" }}>{label}</span>
              <span style={{ fontWeight: 700, color, fontSize: "1rem" }}>{value}</span>
            </div>
          ))}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              padding: "0.5rem 0 0",
            }}
          >
            <span style={{ fontSize: "0.88rem", fontWeight: 600 }}>Total</span>
            <span style={{ fontWeight: 700, fontSize: "1rem" }}>{totalReviews}</span>
          </div>
        </div>

        {/* Tier distribution */}
        <div className="card">
          <p style={{ fontWeight: 700, marginBottom: "1rem" }}>Mentee Tier Distribution</p>
          {tierOrder.map((tier) => {
            const count = tierDistribution[tier];
            if (tier === "NONE" && count === 0) return null;
            const cfg = TIER_CONFIG[tier];
            const pct = totalMenteesWithPoints > 0 ? Math.round((count / totalMenteesWithPoints) * 100) : 0;
            return (
              <div key={tier} style={{ marginBottom: "0.65rem" }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.2rem" }}>
                  <span style={{ fontSize: "0.82rem", color: cfg.color, fontWeight: 600 }}>
                    {cfg.emoji} {cfg.label}
                  </span>
                  <span style={{ fontSize: "0.82rem", color: "var(--muted)" }}>
                    {count} mentee{count !== 1 ? "s" : ""} ({pct}%)
                  </span>
                </div>
                <div
                  style={{
                    height: "6px",
                    background: "var(--surface-alt)",
                    borderRadius: "99px",
                    overflow: "hidden",
                  }}
                >
                  <div
                    style={{
                      height: "100%",
                      width: `${pct}%`,
                      background: cfg.color,
                      borderRadius: "99px",
                    }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Award nominations by tier */}
      {Object.keys(nomTierMap).length > 0 && (
        <div className="card" style={{ marginBottom: "1.5rem" }}>
          <p style={{ fontWeight: 700, marginBottom: "1rem" }}>Award Nominations by Tier</p>
          <div style={{ overflowX: "auto" }}>
            <table className="table" style={{ width: "100%" }}>
              <thead>
                <tr>
                  <th className="th">Tier</th>
                  <th className="th">Approved</th>
                  <th className="th">Pending</th>
                </tr>
              </thead>
              <tbody>
                {["BRONZE", "SILVER", "GOLD", "LIFETIME"].map((tier) => {
                  const d = nomTierMap[tier];
                  if (!d) return null;
                  const cfg = TIER_CONFIG[tier];
                  return (
                    <tr key={tier}>
                      <td className="td">
                        <span className="pill" style={{ background: cfg.bg, color: cfg.color, fontSize: "0.78rem" }}>
                          {cfg.emoji} {cfg.label}
                        </span>
                      </td>
                      <td className="td" style={{ fontWeight: 600, color: "#16a34a" }}>{d.approved}</td>
                      <td className="td" style={{ fontWeight: 600, color: d.pending > 0 ? "#d97706" : "inherit" }}>
                        {d.pending}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Reflections per cycle */}
      {reflectionsByCycle.length > 0 && (
        <div className="card" style={{ marginBottom: "1.5rem" }}>
          <p style={{ fontWeight: 700, marginBottom: "1rem" }}>Reflections per Cycle (Recent)</p>
          <div style={{ display: "flex", gap: "0.5rem", alignItems: "flex-end", flexWrap: "wrap" }}>
            {[...reflectionsByCycle].reverse().map(({ cycleNumber, count }) => {
              const maxCount = Math.max(...reflectionsByCycle.map((r) => r.count), 1);
              const height = Math.max(20, Math.round((count / maxCount) * 80));
              const isQuarterly = cycleNumber % 3 === 0;
              return (
                <div key={cycleNumber} style={{ textAlign: "center", flex: "1 1 40px" }}>
                  <div style={{ fontSize: "0.72rem", color: "var(--muted)", marginBottom: "0.25rem" }}>
                    {count}
                  </div>
                  <div
                    style={{
                      height: `${height}px`,
                      background: isQuarterly ? "var(--ypp-purple-400)" : "var(--ypp-purple-200)",
                      borderRadius: "4px 4px 0 0",
                      minWidth: "28px",
                    }}
                  />
                  <div style={{ fontSize: "0.7rem", color: "var(--muted)", marginTop: "0.25rem" }}>
                    C{cycleNumber}
                    {isQuarterly && <span style={{ color: "var(--ypp-purple-600)" }}> Q</span>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Recent approvals */}
      {recentApprovals.length > 0 && (
        <div className="card">
          <p style={{ fontWeight: 700, marginBottom: "1rem" }}>Recent Approvals</p>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem" }}>
            {recentApprovals.map((r) => {
              const ratingCfg = RATING_CONFIG[r.overallRating];
              return (
                <div
                  key={r.id}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    padding: "0.6rem 0.75rem",
                    background: "var(--surface-alt)",
                    borderRadius: "var(--radius-sm)",
                  }}
                >
                  <div>
                    <span style={{ fontWeight: 600, fontSize: "0.88rem" }}>{r.menteeName}</span>
                    <span style={{ color: "var(--muted)", fontSize: "0.78rem", marginLeft: "0.4rem" }}>
                      {ROLE_LABELS[r.menteeRole] ?? r.menteeRole} · Cycle {r.cycleNumber} · {r.mentorName}
                    </span>
                  </div>
                  <div style={{ display: "flex", gap: "0.4rem", alignItems: "center" }}>
                    {ratingCfg && (
                      <span style={{ fontSize: "0.75rem", color: ratingCfg.color, fontWeight: 600 }}>
                        {ratingCfg.label}
                      </span>
                    )}
                    {r.pointsAwarded != null && (
                      <span className="pill" style={{ background: "#f0fdf4", color: "#16a34a", fontSize: "0.72rem" }}>
                        +{r.pointsAwarded} pts
                      </span>
                    )}
                    {r.chairApprovedAt && (
                      <span style={{ fontSize: "0.72rem", color: "var(--muted)" }}>
                        {new Date(r.chairApprovedAt).toLocaleDateString()}
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

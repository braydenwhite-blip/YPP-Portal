import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth-supabase";
import { getMyAwardsData } from "@/lib/award-nomination-actions";
import { TIER_CONFIG } from "@/lib/award-tier-config";
import Link from "next/link";

export const metadata = { title: "My Awards — My Program" };

const TIER_ORDER = ["BRONZE", "SILVER", "GOLD", "LIFETIME"] as const;

const STATUS_CONFIG: Record<string, { label: string; cls: string }> = {
  PENDING_CHAIR: { label: "Pending Chair", cls: "pill pill-pending" },
  PENDING_BOARD: { label: "Pending Board", cls: "pill pill-pending" },
  APPROVED: { label: "Approved", cls: "pill pill-success" },
  REJECTED: { label: "Rejected", cls: "pill pill-declined" },
};

const RATING_LABELS: Record<string, string> = {
  BEHIND_SCHEDULE: "Behind Schedule",
  GETTING_STARTED: "Getting Started",
  ACHIEVED: "Achieved",
  ABOVE_AND_BEYOND: "Above & Beyond",
};

export default async function MyAwardsPage() {
  const session = await getSession();
  if (!session?.user?.id) redirect("/login");

  const data = await getMyAwardsData();
  if (!data) redirect("/my-program");

  const { totalPoints, currentTier, pointLogs, nominations, tierProgress, volunteerHoursAwarded } = data;

  const approvedNominations = nominations.filter((n) => n.status === "APPROVED");
  const pendingNominations = nominations.filter(
    (n) => n.status === "PENDING_CHAIR" || n.status === "PENDING_BOARD"
  );

  return (
    <div>
      <div className="topbar">
        <div>
          <p className="badge">My Program</p>
          <h1 className="page-title">My Achievement Awards</h1>
          <p className="page-subtitle">Track your points, tier progress, and award nominations</p>
        </div>
        <Link href="/my-program" className="button ghost small">
          ← My Program
        </Link>
      </div>

      {/* Volunteer hours badge */}
      {volunteerHoursAwarded > 0 && (
        <div
          className="card"
          style={{
            marginBottom: "1.5rem",
            display: "flex",
            alignItems: "center",
            gap: "1rem",
            background: "#f0fdf4",
            border: "1px solid #bbf7d0",
          }}
        >
          <div style={{ fontSize: "2rem" }}>🤝</div>
          <div>
            <p style={{ fontWeight: 700, margin: 0, color: "#16a34a" }}>
              {volunteerHoursAwarded} Volunteer Hours Recognized
            </p>
            <p style={{ color: "var(--muted)", fontSize: "0.82rem", margin: "0.2rem 0 0" }}>
              Based on your {currentTier ? TIER_CONFIG[currentTier].label : ""} Achievement Award tier
            </p>
          </div>
        </div>
      )}

      {/* Points + Tier summary */}
      <div className="grid two" style={{ marginBottom: "1.5rem" }}>
        <div className="card">
          <p style={{ fontWeight: 600, marginBottom: "0.5rem" }}>Total Achievement Points</p>
          <p
            className="kpi"
            style={{ color: "var(--ypp-purple-700)", margin: "0 0 0.25rem" }}
          >
            {totalPoints}
          </p>
          {currentTier ? (
            <div style={{ display: "flex", alignItems: "center", gap: "0.4rem", marginTop: "0.4rem" }}>
              <span
                className="pill"
                style={{
                  background: TIER_CONFIG[currentTier].bg,
                  color: TIER_CONFIG[currentTier].color,
                  fontSize: "0.85rem",
                }}
              >
                {TIER_CONFIG[currentTier].emoji} {TIER_CONFIG[currentTier].label} Award
              </span>
            </div>
          ) : (
            <p style={{ color: "var(--muted)", fontSize: "0.82rem", marginTop: "0.3rem" }}>
              No award tier reached yet
            </p>
          )}
        </div>

        {/* Tier progress */}
        <div className="card">
          <p style={{ fontWeight: 600, marginBottom: "0.75rem" }}>
            {tierProgress.nextTier ? `Progress to ${TIER_CONFIG[tierProgress.nextTier].label}` : "All Tiers Reached!"}
          </p>
          {tierProgress.nextTier ? (
            <>
              <div
                style={{
                  height: "10px",
                  background: "var(--surface-alt)",
                  borderRadius: "99px",
                  overflow: "hidden",
                  marginBottom: "0.5rem",
                }}
              >
                <div
                  style={{
                    height: "100%",
                    width: `${tierProgress.progressPct}%`,
                    background: TIER_CONFIG[tierProgress.nextTier].color,
                    borderRadius: "99px",
                    transition: "width 0.3s ease",
                  }}
                />
              </div>
              <p style={{ fontSize: "0.82rem", color: "var(--muted)" }}>
                <strong>{tierProgress.progressPct}%</strong> —{" "}
                {tierProgress.pointsNeeded} more pts needed for{" "}
                {TIER_CONFIG[tierProgress.nextTier].emoji} {TIER_CONFIG[tierProgress.nextTier].label} ({TIER_CONFIG[tierProgress.nextTier].min} pts)
              </p>
            </>
          ) : (
            <p style={{ color: "#16a34a", fontWeight: 600, fontSize: "0.9rem" }}>
              👑 You've earned the Lifetime Achievement Award!
            </p>
          )}
        </div>
      </div>

      {/* Tier roadmap */}
      <div className="card" style={{ marginBottom: "1.5rem", padding: "0.9rem 1.1rem" }}>
        <p style={{ fontWeight: 600, fontSize: "0.85rem", marginBottom: "0.75rem" }}>Award Tier Roadmap</p>
        <div style={{ display: "flex", gap: "0", flexWrap: "nowrap", overflowX: "auto" }}>
          {TIER_ORDER.map((tier, idx) => {
            const cfg = TIER_CONFIG[tier];
            const isEarned = approvedNominations.some((n) => n.tier === tier);
            const isPending = pendingNominations.some((n) => n.tier === tier);
            const isReached = totalPoints >= cfg.min;
            return (
              <div
                key={tier}
                style={{
                  flex: "1 1 0",
                  minWidth: "110px",
                  textAlign: "center",
                  padding: "0.75rem 0.5rem",
                  background: isEarned ? cfg.bg : isPending ? "#fffbeb" : "transparent",
                  border: `2px solid ${isEarned ? cfg.color : isPending ? "#fbbf24" : isReached ? cfg.color + "66" : "var(--border)"}`,
                  borderRadius: idx === 0 ? "var(--radius-sm) 0 0 var(--radius-sm)" : idx === TIER_ORDER.length - 1 ? "0 var(--radius-sm) var(--radius-sm) 0" : "0",
                  borderLeft: idx > 0 ? "none" : undefined,
                }}
              >
                <div style={{ fontSize: "1.5rem", marginBottom: "0.25rem" }}>{cfg.emoji}</div>
                <div style={{ fontWeight: 700, fontSize: "0.82rem", color: isEarned ? cfg.color : "inherit" }}>
                  {cfg.label}
                </div>
                <div style={{ fontSize: "0.72rem", color: "var(--muted)", marginTop: "0.15rem" }}>
                  {cfg.min}+ pts
                </div>
                {isEarned && (
                  <div style={{ fontSize: "0.7rem", color: cfg.color, fontWeight: 600, marginTop: "0.25rem" }}>
                    ✓ Earned
                  </div>
                )}
                {isPending && !isEarned && (
                  <div style={{ fontSize: "0.7rem", color: "#d97706", fontWeight: 600, marginTop: "0.25rem" }}>
                    ⏳ Pending
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Nominations */}
      {nominations.length > 0 && (
        <div className="card" style={{ marginBottom: "1.5rem" }}>
          <p style={{ fontWeight: 700, marginBottom: "1rem" }}>My Nominations</p>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
            {nominations.map((n) => {
              const cfg = TIER_CONFIG[n.tier];
              const statusCfg = STATUS_CONFIG[n.status];
              return (
                <div
                  key={n.id}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    padding: "0.75rem 1rem",
                    background: "var(--surface-alt)",
                    borderRadius: "var(--radius-sm)",
                    borderLeft: `4px solid ${cfg.color}`,
                  }}
                >
                  <div>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                      <span
                        className="pill"
                        style={{ background: cfg.bg, color: cfg.color, fontSize: "0.78rem" }}
                      >
                        {cfg.emoji} {cfg.label}
                      </span>
                      <span className={statusCfg?.cls ?? "pill"} style={{ fontSize: "0.75rem" }}>
                        {statusCfg?.label ?? n.status}
                      </span>
                    </div>
                    <p style={{ color: "var(--muted)", fontSize: "0.78rem", margin: "0.2rem 0 0" }}>
                      Nominated by {n.nominatorName} · {new Date(n.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                  {n.boardApprovedAt && (
                    <p style={{ fontSize: "0.78rem", color: "var(--muted)" }}>
                      Approved {new Date(n.boardApprovedAt).toLocaleDateString()}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Points log */}
      <div>
        <p className="section-title" style={{ marginBottom: "0.75rem" }}>
          Points History ({pointLogs.length})
        </p>
        {pointLogs.length === 0 ? (
          <div className="card" style={{ textAlign: "center", padding: "2.5rem" }}>
            <p style={{ fontWeight: 600 }}>No points earned yet</p>
            <p style={{ color: "var(--muted)", fontSize: "0.85rem", marginTop: "0.5rem" }}>
              Points are awarded when your mentor's goal review is approved by the chair.
            </p>
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table className="table" style={{ width: "100%" }}>
              <thead>
                <tr>
                  <th className="th">Cycle</th>
                  <th className="th">Rating</th>
                  <th className="th">Points</th>
                  <th className="th">Month</th>
                </tr>
              </thead>
              <tbody>
                {pointLogs.map((log) => (
                  <tr key={log.id}>
                    <td className="td" style={{ fontWeight: 500 }}>Cycle {log.cycleNumber}</td>
                    <td className="td" style={{ fontSize: "0.85rem" }}>
                      {RATING_LABELS[log.overallRating] ?? log.overallRating}
                    </td>
                    <td className="td">
                      <span style={{ fontWeight: 700, color: log.points > 0 ? "#16a34a" : "var(--muted)" }}>
                        +{log.points}
                      </span>
                    </td>
                    <td className="td" style={{ fontSize: "0.82rem", color: "var(--muted)", whiteSpace: "nowrap" }}>
                      {new Date(log.cycleMonth).toLocaleDateString("en-US", { month: "long", year: "numeric" })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

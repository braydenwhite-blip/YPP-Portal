import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth-supabase";
import { getMyAwardsData } from "@/lib/award-nomination-actions";
import { TIER_CONFIG } from "@/lib/award-tier-config";
import { getGoalRatingCopy } from "@/lib/mentorship-rubric-copy";
import { getGrowthConnectLine } from "@/lib/growth-model";
import { ActionSummaryHeader } from "@/components/mentorship/action-summary-header";
import { LearnMore } from "@/components/mentorship/learn-more";
import { MyMentorSubnav } from "../_components/my-mentor-subnav";

export const metadata = { title: "My Awards — My Mentor" };

const TIER_ORDER = ["BRONZE", "SILVER", "GOLD", "LIFETIME"] as const;

export default async function MyMentorAwardsPage() {
  const session = await getSession();
  if (!session?.user?.id) redirect("/login");

  const data = await getMyAwardsData();
  if (!data) redirect("/my-mentor");

  const { totalPoints, currentTier, pointLogs, nominations, tierProgress, volunteerHoursAwarded } =
    data;

  const approvedNominations = nominations.filter((n) => n.status === "APPROVED");
  const pendingNominations = nominations.filter(
    (n) => n.status === "PENDING_CHAIR" || n.status === "PENDING_BOARD"
  );

  const statusLabel = currentTier
    ? `${TIER_CONFIG[currentTier].label} Award · ${totalPoints} points`
    : tierProgress.nextTier
    ? `${totalPoints} points · ${tierProgress.pointsNeeded} to ${TIER_CONFIG[tierProgress.nextTier].label}`
    : `${totalPoints} points`;

  return (
    <div>
      <ActionSummaryHeader
        badge="My Mentor"
        title="My Recognition & Awards"
        purpose="A celebration of your consistency, growth, and reflection — not a grade."
        status={{ label: statusLabel, tone: currentTier ? "success" : "info" }}
        nextAction={
          tierProgress.nextTier
            ? { label: "Submit this month's reflection →", href: "/my-mentor/reflection" }
            : undefined
        }
        secondaryAction={{ label: "← My Progress", href: "/my-mentor/progress" }}
        connects={getGrowthConnectLine("awards")}
      />

      <MyMentorSubnav />

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

      {/* Points + next-tier progress */}
      <div className="grid two" style={{ marginBottom: "1.5rem" }}>
        <div className="card">
          <p style={{ fontWeight: 600, marginBottom: "0.5rem" }}>Recognition points earned</p>
          <p className="kpi" style={{ color: "var(--ypp-purple-700)", margin: "0 0 0.25rem" }}>
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
              Your first award tier is just ahead — keep going.
            </p>
          )}
        </div>

        <div className="card">
          <p style={{ fontWeight: 600, marginBottom: "0.75rem" }}>
            {tierProgress.nextTier
              ? `On your way to ${TIER_CONFIG[tierProgress.nextTier].label}`
              : "Every tier reached!"}
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
                <strong>{tierProgress.progressPct}%</strong> there —{" "}
                {tierProgress.pointsNeeded} more points reach{" "}
                {TIER_CONFIG[tierProgress.nextTier].emoji} {TIER_CONFIG[tierProgress.nextTier].label}.
                Submitting your reflection and meeting with your mentor each cycle is the surest way to get there.
              </p>
            </>
          ) : (
            <p style={{ color: "#16a34a", fontWeight: 600, fontSize: "0.9rem" }}>
              👑 You&apos;ve earned the Lifetime Achievement Award!
            </p>
          )}
        </div>
      </div>

      {/* Tier roadmap */}
      <div className="card" style={{ marginBottom: "1.5rem", padding: "0.9rem 1.1rem" }}>
        <p style={{ fontWeight: 600, fontSize: "0.85rem", marginBottom: "0.75rem" }}>Award tiers</p>
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
                  border: `2px solid ${
                    isEarned ? cfg.color : isPending ? "#fbbf24" : isReached ? cfg.color + "66" : "var(--border)"
                  }`,
                  borderRadius:
                    idx === 0
                      ? "var(--radius-sm) 0 0 var(--radius-sm)"
                      : idx === TIER_ORDER.length - 1
                      ? "0 var(--radius-sm) var(--radius-sm) 0"
                      : "0",
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
                    ⏳ Being confirmed
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Nominations (recognition in progress) */}
      {nominations.length > 0 && (
        <div className="card" style={{ marginBottom: "1.5rem" }}>
          <p style={{ fontWeight: 700, marginBottom: "0.35rem" }}>Awards in progress</p>
          <p style={{ margin: "0 0 1rem", color: "var(--muted)", fontSize: "0.82rem" }}>
            When you reach a tier, your mentor or chair confirms it. Anything marked
            &quot;being confirmed&quot; is on its way — nothing more is needed from you.
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
            {nominations.map((n) => {
              const cfg = TIER_CONFIG[n.tier];
              const isApproved = n.status === "APPROVED";
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
                      <span className="pill" style={{ background: cfg.bg, color: cfg.color, fontSize: "0.78rem" }}>
                        {cfg.emoji} {cfg.label}
                      </span>
                      <span
                        className={isApproved ? "pill pill-success" : "pill pill-pending"}
                        style={{ fontSize: "0.75rem" }}
                      >
                        {isApproved ? "Confirmed 🎉" : "Being confirmed"}
                      </span>
                    </div>
                    <p style={{ color: "var(--muted)", fontSize: "0.78rem", margin: "0.2rem 0 0" }}>
                      Recognized by {n.nominatorName} · {new Date(n.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                  {n.boardApprovedAt && (
                    <p style={{ fontSize: "0.78rem", color: "var(--muted)" }}>
                      {new Date(n.boardApprovedAt).toLocaleDateString()}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Points history — framed as a record of recognition */}
      <div>
        <p className="section-title" style={{ marginBottom: "0.75rem" }}>
          Where your points came from ({pointLogs.length})
        </p>
        {pointLogs.length === 0 ? (
          <div className="card" style={{ textAlign: "center", padding: "2.5rem" }}>
            <p style={{ fontWeight: 600 }}>Your recognition story starts soon</p>
            <p style={{ color: "var(--muted)", fontSize: "0.85rem", marginTop: "0.5rem", maxWidth: 460, margin: "0.5rem auto 0" }}>
              Once your mentor&apos;s first monthly review is approved, you&apos;ll
              start seeing points here. The best next step is to keep your reflection
              and check-ins up to date.
            </p>
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table className="table" style={{ width: "100%" }}>
              <thead>
                <tr>
                  <th className="th">Cycle</th>
                  <th className="th">Recognition</th>
                  <th className="th">Points</th>
                  <th className="th">Month</th>
                </tr>
              </thead>
              <tbody>
                {pointLogs.map((log) => {
                  const cfg = getGoalRatingCopy(log.overallRating);
                  return (
                    <tr key={log.id}>
                      <td className="td" style={{ fontWeight: 500 }}>Cycle {log.cycleNumber}</td>
                      <td className="td" style={{ fontSize: "0.85rem", color: cfg.color }}>
                        {cfg.menteeLabel}
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
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div style={{ marginTop: 20 }}>
        <LearnMore summary="How recognition works">
          <p style={{ margin: 0, fontSize: 13, lineHeight: 1.6 }}>
            Every time your mentor&apos;s monthly review is approved, you earn
            achievement points that recognize the work you&apos;ve put in — showing
            up, reflecting honestly, and making progress on your goals. As points
            add up, you reach award tiers. There&apos;s no penalty for a slower
            month; points only ever move forward.
          </p>
        </LearnMore>
      </div>
    </div>
  );
}

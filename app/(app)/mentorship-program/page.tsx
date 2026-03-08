import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { getMentorOverview } from "@/lib/mentorship-overview-actions";
import Link from "next/link";

export const metadata = { title: "Mentorship Program — Overview" };

const TIER_CONFIG: Record<string, { label: string; color: string; bg: string; emoji: string }> = {
  BRONZE: { label: "Bronze", color: "#cd7f32", bg: "#fdf6ec", emoji: "🥉" },
  SILVER: { label: "Silver", color: "#a8a9ad", bg: "#f5f5f5", emoji: "🥈" },
  GOLD: { label: "Gold", color: "#d4af37", bg: "#fffbeb", emoji: "🥇" },
  LIFETIME: { label: "Lifetime", color: "#7c3aed", bg: "#faf5ff", emoji: "👑" },
};

const RATING_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  BEHIND_SCHEDULE: { label: "Behind Schedule", color: "#ef4444", bg: "#fef2f2" },
  GETTING_STARTED: { label: "Getting Started", color: "#d97706", bg: "#fffbeb" },
  ACHIEVED: { label: "Achieved", color: "#16a34a", bg: "#f0fdf4" },
  ABOVE_AND_BEYOND: { label: "Above & Beyond", color: "#7c3aed", bg: "#faf5ff" },
};

const REVIEW_STATUS_CONFIG: Record<string, { label: string; cls: string }> = {
  DRAFT: { label: "Draft", cls: "pill" },
  PENDING_CHAIR_APPROVAL: { label: "Pending Chair", cls: "pill pill-pending" },
  CHANGES_REQUESTED: { label: "Changes Requested", cls: "pill pill-declined" },
  APPROVED: { label: "Approved", cls: "pill pill-success" },
};

const ROLE_LABELS: Record<string, string> = {
  INSTRUCTOR: "Instructor",
  CHAPTER_LEAD: "Chapter President",
  ADMIN: "Global Leadership",
  STAFF: "Global Leadership",
};

export default async function MentorshipProgramPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");
  const roles = session.user.roles ?? [];
  if (!roles.includes("ADMIN") && !roles.includes("MENTOR") && !roles.includes("CHAPTER_LEAD")) {
    redirect("/");
  }

  const data = await getMentorOverview();
  if (!data) redirect("/");

  const { pairs, kpi, isAdmin } = data;

  // Split pairs into action-needed vs up-to-date
  const needsAction = pairs.filter(
    (p) =>
      !p.latestCycle ||
      p.latestCycle.reviewStatus === null ||
      p.latestCycle.reviewStatus === "DRAFT" ||
      p.latestCycle.reviewStatus === "CHANGES_REQUESTED"
  );
  const upToDate = pairs.filter(
    (p) =>
      p.latestCycle &&
      (p.latestCycle.reviewStatus === "PENDING_CHAIR_APPROVAL" ||
        p.latestCycle.reviewStatus === "APPROVED")
  );

  return (
    <div>
      <div className="topbar">
        <div>
          <p className="badge">Mentorship Program</p>
          <h1 className="page-title">Program Overview</h1>
          <p className="page-subtitle">
            {isAdmin ? "All active mentorship pairs" : "Your active mentees — monthly cycle status"}
          </p>
        </div>
        <div style={{ display: "flex", gap: "0.5rem" }}>
          <Link href="/mentorship-program/reviews" className="button ghost small">
            Review Queue
          </Link>
          <Link href="/mentorship-program/chair" className="button ghost small">
            Chair Queue
          </Link>
          <Link href="/mentorship-program/awards" className="button ghost small">
            Awards
          </Link>
        </div>
      </div>

      {/* KPI row */}
      <div className="grid four" style={{ marginBottom: "1.75rem" }}>
        <div className="card">
          <p className="kpi">{kpi.activePairs}</p>
          <p className="kpi-label">Active {isAdmin ? "Pairs" : "Mentees"}</p>
        </div>
        <div className="card">
          <p className="kpi" style={{ color: kpi.pendingReflections > 0 ? "#d97706" : "inherit" }}>
            {kpi.pendingReflections}
          </p>
          <p className="kpi-label">Awaiting Review</p>
        </div>
        <div className="card">
          <p className="kpi" style={{ color: kpi.pendingChair > 0 ? "#d97706" : "inherit" }}>
            {kpi.pendingChair}
          </p>
          <p className="kpi-label">Pending Chair Approval</p>
        </div>
        <div className="card">
          <p className="kpi" style={{ color: kpi.pendingBoard > 0 ? "var(--ypp-purple-700)" : "inherit" }}>
            {kpi.pendingBoard}
          </p>
          <p className="kpi-label">Pending Board (Awards)</p>
        </div>
      </div>

      {pairs.length === 0 ? (
        <div className="card" style={{ textAlign: "center", padding: "3rem" }}>
          <p style={{ fontWeight: 600 }}>No active mentees</p>
          <p style={{ color: "var(--muted)", marginTop: "0.5rem", fontSize: "0.9rem" }}>
            You have no active mentorship pairings in the program.
          </p>
        </div>
      ) : (
        <>
          {/* Action required section */}
          {needsAction.length > 0 && (
            <div style={{ marginBottom: "1.75rem" }}>
              <p className="section-title" style={{ marginBottom: "0.75rem" }}>
                Action Required ({needsAction.length})
              </p>
              <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem" }}>
                {needsAction.map((pair) => (
                  <MenteeCard key={pair.mentorshipId} pair={pair} isAdmin={isAdmin} actionNeeded />
                ))}
              </div>
            </div>
          )}

          {/* Up to date */}
          {upToDate.length > 0 && (
            <div>
              <p className="section-title" style={{ marginBottom: "0.75rem" }}>
                Up to Date ({upToDate.length})
              </p>
              <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem" }}>
                {upToDate.map((pair) => (
                  <MenteeCard key={pair.mentorshipId} pair={pair} isAdmin={isAdmin} actionNeeded={false} />
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

type PairData = {
  mentorshipId: string;
  menteeId: string;
  menteeName: string;
  menteeEmail: string;
  menteeRole: string;
  mentorId: string;
  mentorName: string;
  startDate: string;
  totalPoints: number;
  currentTier: string | null;
  latestCycle: {
    cycleNumber: number;
    reflectionId: string;
    submittedAt: string;
    isQuarterly: boolean;
    reviewStatus: string | null;
    reviewId: string | null;
    overallRating: string | null;
    released: boolean;
    pointsAwarded: number | null;
  } | null;
};

function MenteeCard({
  pair,
  isAdmin,
  actionNeeded,
}: {
  pair: PairData;
  isAdmin: boolean;
  actionNeeded: boolean;
}) {
  const tierCfg = pair.currentTier ? TIER_CONFIG[pair.currentTier] : null;
  const cycle = pair.latestCycle;
  const reviewStatusCfg = cycle?.reviewStatus ? REVIEW_STATUS_CONFIG[cycle.reviewStatus] : null;
  const ratingCfg = cycle?.overallRating ? RATING_CONFIG[cycle.overallRating] : null;

  // Determine primary action button
  let actionHref: string | null = null;
  let actionLabel: string | null = null;
  if (cycle && !cycle.reviewId) {
    actionHref = `/mentorship-program/reviews/${cycle.reflectionId}`;
    actionLabel = "Write Review";
  } else if (cycle?.reviewId && cycle.reviewStatus === "DRAFT") {
    actionHref = `/mentorship-program/reviews/${cycle.reflectionId}`;
    actionLabel = "Continue Draft";
  } else if (cycle?.reviewId && cycle.reviewStatus === "CHANGES_REQUESTED") {
    actionHref = `/mentorship-program/reviews/${cycle.reflectionId}`;
    actionLabel = "Revise Review";
  } else if (cycle?.reviewId) {
    actionHref = `/mentorship-program/reviews/${cycle.reflectionId}`;
    actionLabel = "View Review";
  }

  return (
    <div
      className="card"
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        padding: "0.9rem 1.1rem",
        borderLeft: actionNeeded ? "4px solid #d97706" : "4px solid #16a34a",
      }}
    >
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexWrap: "wrap" }}>
          <span style={{ fontWeight: 700 }}>{pair.menteeName}</span>
          <span className="pill" style={{ fontSize: "0.72rem" }}>
            {ROLE_LABELS[pair.menteeRole] ?? pair.menteeRole}
          </span>
          {tierCfg && (
            <span
              className="pill"
              style={{ background: tierCfg.bg, color: tierCfg.color, fontSize: "0.72rem" }}
            >
              {tierCfg.emoji} {tierCfg.label}
            </span>
          )}
          {cycle?.isQuarterly && (
            <span
              className="pill"
              style={{
                background: "var(--ypp-purple-100)",
                color: "var(--ypp-purple-700)",
                fontSize: "0.72rem",
              }}
            >
              Quarterly
            </span>
          )}
        </div>

        <div style={{ color: "var(--muted)", fontSize: "0.8rem", marginTop: "0.25rem" }}>
          {isAdmin && <span>Mentor: {pair.mentorName} · </span>}
          <span>{pair.totalPoints} pts</span>
          {cycle ? (
            <>
              <span> · Cycle {cycle.cycleNumber}</span>
              {cycle.reviewStatus === null ? (
                <span style={{ color: "#d97706", fontWeight: 600 }}> · Reflection pending review</span>
              ) : (
                <>
                  {reviewStatusCfg && (
                    <span> · </span>
                  )}
                </>
              )}
            </>
          ) : (
            <span style={{ color: "var(--muted)" }}> · No reflections yet</span>
          )}
        </div>

        <div style={{ display: "flex", gap: "0.4rem", marginTop: "0.35rem", flexWrap: "wrap" }}>
          {reviewStatusCfg && (
            <span className={reviewStatusCfg.cls} style={{ fontSize: "0.72rem" }}>
              {reviewStatusCfg.label}
            </span>
          )}
          {ratingCfg && cycle?.released && (
            <span
              className="pill"
              style={{ background: ratingCfg.bg, color: ratingCfg.color, fontSize: "0.72rem" }}
            >
              {ratingCfg.label}
            </span>
          )}
          {cycle?.pointsAwarded != null && cycle.released && (
            <span
              className="pill"
              style={{ background: "#f0fdf4", color: "#16a34a", fontSize: "0.72rem" }}
            >
              +{cycle.pointsAwarded} pts
            </span>
          )}
        </div>
      </div>

      <div style={{ display: "flex", gap: "0.5rem", marginLeft: "1rem", flexShrink: 0 }}>
        {actionHref && (
          <Link
            href={actionHref}
            className={`button small ${actionNeeded && actionLabel !== "View Review" ? "primary" : "ghost"}`}
          >
            {actionLabel}
          </Link>
        )}
      </div>
    </div>
  );
}

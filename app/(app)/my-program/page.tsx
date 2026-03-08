import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { getMyProgramData } from "@/lib/self-reflection-actions";
import { toMenteeRoleType } from "@/lib/mentee-role-utils";
import Link from "next/link";

export const metadata = { title: "My Program — YPP Mentorship" };

const TIER_COLORS: Record<string, string> = {
  BRONZE: "#cd7f32",
  SILVER: "#a8a9ad",
  GOLD: "#d4af37",
  LIFETIME: "#7c3aed",
};

const RATING_CONFIG: Record<string, { label: string; color: string }> = {
  BEHIND_SCHEDULE: { label: "Behind Schedule", color: "#ef4444" },
  GETTING_STARTED: { label: "Getting Started", color: "#eab308" },
  ACHIEVED: { label: "Achieved", color: "#22c55e" },
  ABOVE_AND_BEYOND: { label: "Above & Beyond", color: "#7c3aed" },
};

const ROLE_LABELS: Record<string, string> = {
  INSTRUCTOR: "Instructor",
  CHAPTER_PRESIDENT: "Chapter President",
  GLOBAL_LEADERSHIP: "Global Leadership",
};

export default async function MyProgramPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");

  const primaryRole = session.user.primaryRole ?? "";
  const menteeRoleType = toMenteeRoleType(primaryRole);

  // Only program participants can access this page
  if (!menteeRoleType) redirect("/");

  const data = await getMyProgramData();
  if (!data) redirect("/");

  const { mentorship, goals, reflections, achievementSummary } = data;

  const nextCycle = (mentorship?.lastReflectionCycle ?? 0) + 1;
  const isQuarterlyNext = nextCycle % 3 === 0;

  // Determine if a reflection is due (first of any month that hasn't been submitted yet)
  const latestReflection = reflections[0] ?? null;

  return (
    <div>
      <div className="topbar">
        <div>
          <p className="badge">Mentorship Program</p>
          <h1 className="page-title">My Program</h1>
          <p className="page-subtitle">
            {ROLE_LABELS[menteeRoleType]} track — monthly reflections, goal reviews, and achievement awards
          </p>
        </div>
        {mentorship && (
          <Link href="/my-program/reflect" className="button primary">
            Submit Reflection
          </Link>
        )}
      </div>

      {/* KPI bar */}
      <div className="grid four" style={{ marginBottom: "2rem" }}>
        <div className="card">
          <p className="kpi">{reflections.length}</p>
          <p className="kpi-label">Reflections Submitted</p>
        </div>
        <div className="card">
          <p className="kpi">{reflections.filter((r) => r.hasReleasedReview).length}</p>
          <p className="kpi-label">Reviews Received</p>
        </div>
        <div className="card">
          <p className="kpi" style={{ color: achievementSummary.currentTier ? TIER_COLORS[achievementSummary.currentTier] : "inherit" }}>
            {achievementSummary.totalPoints}
          </p>
          <p className="kpi-label">Achievement Points</p>
        </div>
        <div className="card">
          <p
            className="kpi"
            style={{ color: achievementSummary.currentTier ? TIER_COLORS[achievementSummary.currentTier] : "var(--muted)" }}
          >
            {achievementSummary.currentTier ?? "—"}
          </p>
          <p className="kpi-label">Current Award Tier</p>
        </div>
      </div>

      <div className="grid two" style={{ marginBottom: "2rem" }}>
        {/* Mentor card */}
        <div className="card">
          <p className="section-title" style={{ marginBottom: "0.75rem" }}>
            My Mentor
          </p>
          {mentorship ? (
            <>
              <p style={{ fontWeight: 600, fontSize: "1.05rem" }}>{mentorship.mentorName}</p>
              <p style={{ color: "var(--muted)", fontSize: "0.85rem" }}>{mentorship.mentorEmail}</p>
              <p style={{ color: "var(--muted)", fontSize: "0.8rem", marginTop: "0.4rem" }}>
                Since {new Date(mentorship.startDate).toLocaleDateString("en-US", { month: "long", year: "numeric" })}
              </p>
            </>
          ) : (
            <p style={{ color: "var(--muted)", fontStyle: "italic" }}>
              No mentor assigned yet. Contact your administrator.
            </p>
          )}
        </div>

        {/* Next cycle card */}
        <div className="card" style={{ borderLeft: "4px solid var(--ypp-purple-500)" }}>
          <p className="section-title" style={{ marginBottom: "0.75rem" }}>
            {latestReflection ? "Next Cycle" : "First Reflection"}
          </p>
          {mentorship ? (
            <>
              <div style={{ display: "flex", alignItems: "baseline", gap: "0.5rem", marginBottom: "0.4rem" }}>
                <span style={{ fontSize: "1.75rem", fontWeight: 700 }}>Cycle {nextCycle}</span>
                {isQuarterlyNext && (
                  <span className="pill" style={{ background: "var(--ypp-purple-100)", color: "var(--ypp-purple-700)" }}>
                    Quarterly
                  </span>
                )}
              </div>
              <p style={{ color: "var(--muted)", fontSize: "0.85rem" }}>
                {isQuarterlyNext
                  ? "This is a quarterly cycle — additional fields on projected path and promotion readiness will appear in your review."
                  : "Monthly cycle — cover your goals, engagement, and collaboration."}
              </p>
              <Link href="/my-program/reflect" className="button primary small" style={{ marginTop: "1rem", display: "inline-block" }}>
                Start Reflection →
              </Link>
            </>
          ) : (
            <p style={{ color: "var(--muted)", fontStyle: "italic" }}>
              Assign a mentor first before submitting reflections.
            </p>
          )}
        </div>
      </div>

      {/* Goals for this role */}
      {goals.length > 0 && (
        <div style={{ marginBottom: "2rem" }}>
          <p className="section-title" style={{ marginBottom: "0.75rem" }}>
            My Goals ({goals.length})
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
            {goals.map((goal, i) => (
              <div key={goal.id} className="card" style={{ padding: "0.75rem 1rem", display: "flex", gap: "0.75rem", alignItems: "flex-start" }}>
                <span style={{ fontWeight: 700, color: "var(--ypp-purple-500)", minWidth: "1.5rem" }}>{i + 1}.</span>
                <div>
                  <p style={{ fontWeight: 600, margin: 0 }}>{goal.title}</p>
                  {goal.description && (
                    <p style={{ color: "var(--muted)", fontSize: "0.85rem", margin: "0.2rem 0 0" }}>{goal.description}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Reflections history */}
      <div>
        <p className="section-title" style={{ marginBottom: "0.75rem" }}>
          Reflection History
        </p>
        {reflections.length === 0 ? (
          <div className="card" style={{ textAlign: "center", padding: "2.5rem" }}>
            <p style={{ color: "var(--muted)" }}>No reflections submitted yet.</p>
            {mentorship && (
              <Link href="/my-program/reflect" className="button primary small" style={{ marginTop: "1rem", display: "inline-block" }}>
                Submit Your First Reflection
              </Link>
            )}
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
            {reflections.map((r) => {
              const rating = r.reviewRating ? RATING_CONFIG[r.reviewRating] : null;
              return (
                <Link
                  key={r.id}
                  href={`/my-program/reflect/${r.id}`}
                  style={{ textDecoration: "none", color: "inherit" }}
                >
                  <div
                    className="card"
                    style={{ padding: "0.75rem 1rem", cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center" }}
                  >
                    <div>
                      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                        <span style={{ fontWeight: 600 }}>Cycle {r.cycleNumber}</span>
                        {r.cycleNumber % 3 === 0 && (
                          <span className="pill" style={{ fontSize: "0.7rem", background: "var(--ypp-purple-100)", color: "var(--ypp-purple-700)" }}>
                            Quarterly
                          </span>
                        )}
                      </div>
                      <p style={{ color: "var(--muted)", fontSize: "0.8rem", margin: "0.15rem 0 0" }}>
                        {new Date(r.cycleMonth).toLocaleDateString("en-US", { month: "long", year: "numeric" })} ·{" "}
                        Submitted {new Date(r.submittedAt).toLocaleDateString()}
                      </p>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                      {r.hasReleasedReview ? (
                        <div style={{ textAlign: "right" }}>
                          {rating && (
                            <span
                              className="pill"
                              style={{ background: `${rating.color}22`, color: rating.color, fontSize: "0.75rem" }}
                            >
                              {rating.label}
                            </span>
                          )}
                          {r.pointsAwarded !== null && (
                            <p style={{ fontSize: "0.75rem", color: "var(--muted)", margin: "0.2rem 0 0" }}>
                              +{r.pointsAwarded} pts
                            </p>
                          )}
                        </div>
                      ) : (
                        <span className="pill pill-pending" style={{ fontSize: "0.75rem" }}>
                          Pending Review
                        </span>
                      )}
                      <span style={{ color: "var(--muted)" }}>›</span>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

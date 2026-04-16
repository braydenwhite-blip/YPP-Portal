import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getGoalsForMentee } from "@/lib/mentorship-gr-binding";

const TIER_THRESHOLDS = [
  { tier: "BRONZE", pts: 175, label: "Bronze", color: "#92400e", bg: "#fef3c7" },
  { tier: "SILVER", pts: 350, label: "Silver", color: "#374151", bg: "#f3f4f6" },
  { tier: "GOLD", pts: 700, label: "Gold", color: "#78350f", bg: "#fef9c3" },
  { tier: "LIFETIME", pts: 1800, label: "Lifetime", color: "#4c1d95", bg: "#f5f3ff" },
] as const;

const RATING_LABEL: Record<string, string> = {
  BEHIND_SCHEDULE: "Red — Behind Schedule",
  GETTING_STARTED: "Yellow — Getting Started",
  ACHIEVED: "Green — Achieved",
  ABOVE_AND_BEYOND: "Purple — Above & Beyond",
};

const RATING_COLOR: Record<string, string> = {
  BEHIND_SCHEDULE: "#ef4444",
  GETTING_STARTED: "#f59e0b",
  ACHIEVED: "#22c55e",
  ABOVE_AND_BEYOND: "#a855f7",
};

type Props = { userId: string };

async function loadMenteeDashboardData(userId: string) {
  const [mentorship, pointSummary, goals] = await Promise.all([
    prisma.mentorship.findFirst({
      where: { menteeId: userId, status: "ACTIVE" },
      select: {
        id: true,
        cycleStage: true,
        kickoffCompletedAt: true,
        mentor: { select: { id: true, name: true, email: true } },
        selfReflections: {
          orderBy: { cycleNumber: "desc" },
          take: 1,
          select: { id: true, cycleNumber: true, submittedAt: true, cycleMonth: true },
        },
        goalReviews: {
          where: { status: "APPROVED" },
          orderBy: { cycleNumber: "desc" },
          take: 4,
          select: {
            id: true,
            cycleNumber: true,
            cycleMonth: true,
            overallRating: true,
            overallComments: true,
            planOfAction: true,
            releasedToMenteeAt: true,
            goalRatings: {
              select: {
                rating: true,
                comments: true,
                goal: { select: { title: true } },
              },
            },
          },
        },
      },
    }),
    prisma.achievementPointSummary.findUnique({
      where: { userId },
      select: { totalPoints: true, currentTier: true },
    }),
    getGoalsForMentee(userId),
  ]);

  return { mentorship, pointSummary, goals };
}

function AwardBar({ totalPoints, currentTier }: { totalPoints: number; currentTier: string | null }) {
  const nextTier = TIER_THRESHOLDS.find((t) => t.pts > totalPoints);
  const pct = nextTier ? Math.min(100, (totalPoints / nextTier.pts) * 100) : 100;

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6, fontSize: 13 }}>
        <span>
          {currentTier ? (
            <strong style={{ color: TIER_THRESHOLDS.find((t) => t.tier === currentTier)?.color }}>
              {TIER_THRESHOLDS.find((t) => t.tier === currentTier)?.label} Award
            </strong>
          ) : (
            <span style={{ color: "var(--muted)" }}>No tier yet</span>
          )}
        </span>
        <span style={{ color: "var(--muted)" }}>
          {totalPoints} pts{nextTier ? ` / ${nextTier.pts} for ${nextTier.label}` : " — Lifetime"}
        </span>
      </div>
      <div
        style={{
          height: 8,
          background: "var(--border, #e2e8f0)",
          borderRadius: 999,
          overflow: "hidden",
        }}
      >
        <div
          style={{
            height: "100%",
            width: `${pct}%`,
            background: "var(--color-primary, #6b21c8)",
            borderRadius: 999,
            transition: "width 0.4s ease",
          }}
        />
      </div>
      <div style={{ display: "flex", gap: 4, marginTop: 8, flexWrap: "wrap" }}>
        {TIER_THRESHOLDS.map((t) => (
          <span
            key={t.tier}
            style={{
              fontSize: "0.68rem",
              padding: "2px 7px",
              borderRadius: 999,
              background: totalPoints >= t.pts ? t.bg : "var(--surface-alt)",
              color: totalPoints >= t.pts ? t.color : "var(--muted)",
              fontWeight: totalPoints >= t.pts ? 700 : 400,
              border: `1px solid ${totalPoints >= t.pts ? t.color : "var(--border)"}`,
            }}
          >
            {t.label} {t.pts}+
          </span>
        ))}
      </div>
    </div>
  );
}

export async function MenteeDashboard({ userId }: Props) {
  const { mentorship, pointSummary, goals } = await loadMenteeDashboardData(userId);

  if (!mentorship) {
    return (
      <div className="card" style={{ textAlign: "center", padding: "2.5rem 1.5rem" }}>
        <h3 style={{ marginTop: 0 }}>No active mentorship</h3>
        <p style={{ color: "var(--muted)", maxWidth: 480, margin: "0 auto" }}>
          You have not been assigned a mentor yet. Reach out to your chapter leadership for more information.
        </p>
      </div>
    );
  }

  const latestReflection = mentorship.selfReflections[0] ?? null;
  const latestApprovedReview = mentorship.goalReviews[0] ?? null;
  const historyReviews = mentorship.goalReviews.slice(1);

  const reflectionDue =
    mentorship.cycleStage === "REFLECTION_DUE" ||
    mentorship.cycleStage === "KICKOFF_PENDING";
  const reflectionSubmitted =
    mentorship.cycleStage !== "REFLECTION_DUE" &&
    mentorship.cycleStage !== "KICKOFF_PENDING";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {/* Mentor card */}
      <div className="card" style={{ display: "flex", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
        <div>
          <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: 1, color: "var(--muted)", marginBottom: 4 }}>
            Your Mentor
          </div>
          <div style={{ fontSize: 18, fontWeight: 700 }}>{mentorship.mentor.name ?? mentorship.mentor.email}</div>
          <div style={{ fontSize: 13, color: "var(--muted)", marginTop: 3 }}>{mentorship.mentor.email}</div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8, alignItems: "flex-end" }}>
          <a href={`mailto:${mentorship.mentor.email}`} className="button secondary small">
            Send email →
          </a>
        </div>
      </div>

      {/* Reflection CTA */}
      <div
        className="card"
        style={{
          borderLeft: reflectionDue
            ? "4px solid #f59e0b"
            : reflectionSubmitted
            ? "4px solid #22c55e"
            : "4px solid var(--border)",
          background: reflectionDue ? "#fffbeb" : undefined,
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <div>
            <div style={{ fontWeight: 700, marginBottom: 4 }}>Monthly Reflection</div>
            {reflectionDue && (
              <p style={{ margin: 0, fontSize: 13, color: "#92400e" }}>
                Your reflection for this month is due. Complete it so your mentor can review your progress.
              </p>
            )}
            {reflectionSubmitted && latestReflection && (
              <p style={{ margin: 0, fontSize: 13, color: "var(--muted)" }}>
                Submitted {new Date(latestReflection.submittedAt!).toLocaleDateString()} — your mentor is reviewing it.
              </p>
            )}
          </div>
          {reflectionDue && (
            <Link href="/mentorship-program/reviews" className="button primary small">
              Submit Reflection →
            </Link>
          )}
          {reflectionSubmitted && (
            <Link href="/mentorship-program/reviews" className="button secondary small">
              View Reflection
            </Link>
          )}
        </div>
      </div>

      {/* This month's goals */}
      {goals.length > 0 && (
        <div className="card">
          <div style={{ fontWeight: 700, marginBottom: 12 }}>This Month's Goals</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {goals.map((goal) => {
              const rating = latestApprovedReview?.goalRatings.find(
                (gr) => gr.goal.title === goal.title
              );
              return (
                <div
                  key={goal.id}
                  style={{
                    display: "flex",
                    gap: 10,
                    alignItems: "flex-start",
                    padding: "0.6rem 0.8rem",
                    background: "var(--surface-alt)",
                    borderRadius: "var(--radius-md, 8px)",
                    borderLeft: rating
                      ? `3px solid ${RATING_COLOR[rating.rating]}`
                      : "3px solid var(--border)",
                  }}
                >
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600, fontSize: 14 }}>{goal.title}</div>
                    {goal.description && (
                      <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 3 }}>
                        {goal.description}
                      </div>
                    )}
                  </div>
                  {rating && (
                    <span
                      style={{
                        fontSize: "0.68rem",
                        padding: "2px 7px",
                        borderRadius: 999,
                        background: RATING_COLOR[rating.rating] + "22",
                        color: RATING_COLOR[rating.rating],
                        fontWeight: 700,
                        whiteSpace: "nowrap",
                      }}
                    >
                      {RATING_LABEL[rating.rating]}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Latest feedback */}
      {latestApprovedReview && (
        <div className="card">
          <div style={{ fontWeight: 700, marginBottom: 12 }}>
            Latest Feedback —{" "}
            <span style={{ fontWeight: 400, color: "var(--muted)", fontSize: 13 }}>
              {new Date(latestApprovedReview.cycleMonth).toLocaleDateString("en-US", { month: "long", year: "numeric" })}
            </span>
          </div>
          <div style={{ marginBottom: 10 }}>
            <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 4 }}>Overall Rating</div>
            <span
              style={{
                display: "inline-block",
                fontSize: "0.75rem",
                padding: "3px 10px",
                borderRadius: 999,
                background: RATING_COLOR[latestApprovedReview.overallRating] + "22",
                color: RATING_COLOR[latestApprovedReview.overallRating],
                fontWeight: 700,
              }}
            >
              {RATING_LABEL[latestApprovedReview.overallRating]}
            </span>
          </div>
          {latestApprovedReview.overallComments && (
            <div style={{ marginBottom: 10 }}>
              <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 4 }}>Comments</div>
              <p style={{ margin: 0, fontSize: 14, lineHeight: 1.6 }}>{latestApprovedReview.overallComments}</p>
            </div>
          )}
          {latestApprovedReview.planOfAction && (
            <div>
              <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 4 }}>Plan for Next Month</div>
              <p style={{ margin: 0, fontSize: 14, lineHeight: 1.6 }}>{latestApprovedReview.planOfAction}</p>
            </div>
          )}
        </div>
      )}

      {/* Awards progress */}
      <div className="card">
        <div style={{ fontWeight: 700, marginBottom: 12 }}>Achievement Progress</div>
        <AwardBar
          totalPoints={pointSummary?.totalPoints ?? 0}
          currentTier={pointSummary?.currentTier ?? null}
        />
      </div>

      {/* History */}
      {historyReviews.length > 0 && (
        <details className="card">
          <summary style={{ cursor: "pointer", fontWeight: 700, fontSize: "0.9rem" }}>
            Review History ({historyReviews.length} previous)
          </summary>
          <div style={{ marginTop: 14, display: "flex", flexDirection: "column", gap: 14 }}>
            {historyReviews.map((review) => (
              <div
                key={review.id}
                style={{
                  padding: "0.75rem",
                  background: "var(--surface-alt)",
                  borderRadius: "var(--radius-md, 8px)",
                  borderLeft: `3px solid ${RATING_COLOR[review.overallRating]}`,
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8, flexWrap: "wrap", gap: 6 }}>
                  <strong style={{ fontSize: 14 }}>
                    {new Date(review.cycleMonth).toLocaleDateString("en-US", { month: "long", year: "numeric" })}
                  </strong>
                  <span
                    style={{
                      fontSize: "0.68rem",
                      padding: "2px 7px",
                      borderRadius: 999,
                      background: RATING_COLOR[review.overallRating] + "22",
                      color: RATING_COLOR[review.overallRating],
                      fontWeight: 700,
                    }}
                  >
                    {RATING_LABEL[review.overallRating]}
                  </span>
                </div>
                {review.overallComments && (
                  <p style={{ margin: 0, fontSize: 13, color: "var(--muted)", lineHeight: 1.5 }}>
                    {review.overallComments.length > 180
                      ? review.overallComments.slice(0, 177) + "…"
                      : review.overallComments}
                  </p>
                )}
              </div>
            ))}
          </div>
        </details>
      )}
    </div>
  );
}

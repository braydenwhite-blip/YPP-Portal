import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth-supabase";
import { getMyGRDocument } from "@/lib/gr-actions";
import { toMenteeRoleType } from "@/lib/mentee-role-utils";
import { getGoalRatingCopy } from "@/lib/mentorship-rubric-copy";
import { getGrowthConnectLine } from "@/lib/growth-model";
import { GoalTrajectory, type TrajectoryGoal } from "@/components/mentorship/goal-trajectory";
import { RatingLegend } from "@/components/mentorship/rating-legend";
import { LearnMore } from "@/components/mentorship/learn-more";
import {
  ActionSummaryHeader,
  type HeaderStatusTone,
} from "@/components/mentorship/action-summary-header";
import { MyMentorSubnav } from "../_components/my-mentor-subnav";

const RATING_TONE: Record<string, HeaderStatusTone> = {
  ABOVE_AND_BEYOND: "success",
  ACHIEVED: "success",
  GETTING_STARTED: "pending",
  BEHIND_SCHEDULE: "warning",
};

export const metadata = { title: "My Progress — My Mentorship" };

function formatMonth(value: Date | string) {
  return new Date(value).toLocaleDateString("en-US", { month: "long", year: "numeric" });
}

export default async function MyProgressPage() {
  const session = await getSession();
  if (!session?.user?.id) redirect("/login");

  const primaryRole = session.user.primaryRole ?? "";
  const menteeRoleType = toMenteeRoleType(primaryRole);
  if (!menteeRoleType) redirect("/");

  const doc = await getMyGRDocument();

  // Build trajectory from released-review rating history (oldest → newest).
  const trajectoryGoals: TrajectoryGoal[] = [];
  if (doc) {
    for (const goal of doc.goals) {
      const history = doc.ratingHistoryByGoal[goal.id];
      if (history && history.length > 0) {
        const points = [...history]
          .sort((a, b) => a.cycleNumber - b.cycleNumber)
          .map((h) => ({ label: `C${h.cycleNumber}`, rating: h.rating }));
        trajectoryGoals.push({ title: goal.title, points });
      }
    }
  }

  const releasedReviews = doc
    ? [doc.latestReview, ...doc.pastReviews].filter(
        (r): r is NonNullable<typeof r> => !!r && !!r.releasedToMenteeAt
      )
    : [];

  const latestReleased = releasedReviews[0] ?? null;
  const statusCfg = latestReleased ? getGoalRatingCopy(latestReleased.overallRating) : null;

  return (
    <div>
      <ActionSummaryHeader
        badge="My Mentorship"
        title="My Progress"
        purpose="How far you've come — and the feedback your mentor has shared with you."
        status={
          statusCfg
            ? {
                label: statusCfg.menteeLabel,
                tone: RATING_TONE[String(latestReleased?.overallRating)] ?? "info",
              }
            : undefined
        }
        nextAction={{ label: "Update this month's reflection →", href: "/my-mentor/reflection" }}
        secondaryAction={{ label: "Points & Awards →", href: "/my-mentor/awards" }}
        connects={getGrowthConnectLine("progress")}
      />

      <MyMentorSubnav />

      {!doc || (trajectoryGoals.length === 0 && releasedReviews.length === 0) ? (
        <div className="card" style={{ textAlign: "center", padding: "2.5rem" }}>
          <p style={{ fontWeight: 600, margin: "0 0 6px" }}>Your progress story starts soon</p>
          <p className="muted" style={{ margin: "0 auto", maxWidth: 400, fontSize: 13 }}>
            After your first monthly review is shared with you, you&apos;ll see how your goals are
            trending and the encouragement your mentor wrote. Nothing here is a grade — it&apos;s a
            picture of your growth.
          </p>
        </div>
      ) : (
        <div style={{ display: "grid", gap: 20 }}>
          {trajectoryGoals.length > 0 && <GoalTrajectory goals={trajectoryGoals} />}

          {releasedReviews.length > 0 && (
            <section style={{ display: "grid", gap: 12 }}>
              <h2 style={{ margin: 0, fontSize: "1rem", fontWeight: 700 }}>Feedback shared with you</h2>
              {releasedReviews.map((review) => {
                const cfg = getGoalRatingCopy(review.overallRating);
                return (
                  <div key={review.id} className="card" style={{ borderLeft: `4px solid ${cfg.color}` }}>
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        gap: 12,
                        alignItems: "center",
                        flexWrap: "wrap",
                      }}
                    >
                      <strong>{formatMonth(review.cycleMonth)}</strong>
                      <span
                        title={cfg.menteeDescription}
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 6,
                          background: cfg.background,
                          color: cfg.color,
                          borderRadius: 999,
                          padding: "0.2rem 0.6rem",
                          fontSize: "0.75rem",
                          fontWeight: 600,
                        }}
                      >
                        <span aria-hidden style={{ width: 8, height: 8, borderRadius: "50%", background: cfg.color }} />
                        {cfg.menteeLabel}
                      </span>
                    </div>
                    {review.overallComments && (
                      <p style={{ margin: "10px 0 0", fontSize: "0.88rem", lineHeight: 1.55 }}>
                        {review.overallComments}
                      </p>
                    )}
                    {review.planOfAction && (
                      <div
                        style={{
                          marginTop: 10,
                          padding: "10px 12px",
                          borderRadius: 8,
                          background: "var(--surface-alt, #f8fafc)",
                        }}
                      >
                        <p style={{ margin: 0, fontSize: "0.72rem", fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                          Your next steps
                        </p>
                        <p style={{ margin: "4px 0 0", fontSize: "0.85rem" }}>{review.planOfAction}</p>
                      </div>
                    )}
                  </div>
                );
              })}
            </section>
          )}

          <LearnMore summary="What do these status colors mean?">
            <RatingLegend audience="mentee" />
          </LearnMore>
        </div>
      )}
    </div>
  );
}

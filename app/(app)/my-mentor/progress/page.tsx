import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth-supabase";
import { getMyGRDocument } from "@/lib/gr-actions";
import { toMenteeRoleType } from "@/lib/mentee-role-utils";
import { getGoalRatingCopy } from "@/lib/mentorship-rubric-copy";
import { getGrowthConnectLine } from "@/lib/growth-model";
import { GoalTrajectory, type TrajectoryGoal } from "@/components/mentorship/goal-trajectory";
import { RatingLegend } from "@/components/mentorship/rating-legend";
import { LearnMore } from "@/components/mentorship/learn-more";
import skin from "@/components/ui-v2/portal-skin.module.css";
import {
  ButtonLink,
  CardV2,
  PageHeaderV2,
  StatusBadge,
  type StatusTone,
} from "@/components/ui-v2";
import { MyMentorSubnav } from "../_components/my-mentor-subnav";

const RATING_TONE: Record<string, StatusTone> = {
  ABOVE_AND_BEYOND: "brand",
  ACHIEVED: "success",
  GETTING_STARTED: "warning",
  BEHIND_SCHEDULE: "danger",
};

const RATING_ACCENT: Record<string, string> = {
  ABOVE_AND_BEYOND: "border-l-brand-600",
  ACHIEVED: "border-l-complete-700",
  GETTING_STARTED: "border-l-progress-700",
  BEHIND_SCHEDULE: "border-l-blocked-700",
};

export const metadata = { title: "Progress — My development" };

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
    <div className={`${skin.portalSkin} flex flex-col gap-6`}>
      <PageHeaderV2
        eyebrow="Mentorship · My development"
        title="Progress & reviews"
        subtitle="How far you've come — and the feedback your mentor has released to you."
        actions={
          <>
            <ButtonLink href="/my-mentor/reflection" size="sm">
              Update this month&apos;s reflection →
            </ButtonLink>
            <ButtonLink href="/my-mentor/awards" variant="secondary" size="sm">
              Awards →
            </ButtonLink>
          </>
        }
      >
        <div className="flex flex-wrap items-center gap-3">
          {statusCfg ? (
            <StatusBadge
              tone={RATING_TONE[String(latestReleased?.overallRating)] ?? "info"}
              title={statusCfg.menteeDescription}
              withDot
            >
              {statusCfg.menteeLabel}
            </StatusBadge>
          ) : null}
          <p className="m-0 max-w-[70ch] text-[13px] leading-relaxed text-ink-muted">
            {getGrowthConnectLine("progress")}
          </p>
        </div>
      </PageHeaderV2>

      <MyMentorSubnav />

      {!doc || (trajectoryGoals.length === 0 && releasedReviews.length === 0) ? (
        <CardV2 padding="lg" className="text-center">
          <p className="m-0 text-[15px] font-semibold text-ink">
            Your progress story starts soon
          </p>
          <p className="mx-auto mt-1 max-w-md text-[13px] text-ink-muted">
            After your first monthly review is shared with you, you&apos;ll see how your
            goals are trending and the encouragement your mentor wrote. Nothing here is a
            grade — it&apos;s a picture of your growth.
          </p>
        </CardV2>
      ) : (
        <div className="grid gap-5">
          {trajectoryGoals.length > 0 && <GoalTrajectory goals={trajectoryGoals} />}

          {releasedReviews.length > 0 && (
            <section className="grid gap-3">
              <h2 className="m-0 text-[16px] font-bold text-ink">Feedback released to you</h2>
              {releasedReviews.map((review) => {
                const cfg = getGoalRatingCopy(review.overallRating);
                const rating = String(review.overallRating);
                return (
                  <CardV2
                    key={review.id}
                    padding="md"
                    className={`border-l-4 ${RATING_ACCENT[rating] ?? "border-l-brand-600"}`}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <strong className="text-[14px] text-ink">
                        {formatMonth(review.cycleMonth)}
                      </strong>
                      <StatusBadge
                        tone={RATING_TONE[rating] ?? "info"}
                        title={cfg.menteeDescription}
                        withDot
                      >
                        {cfg.menteeLabel}
                      </StatusBadge>
                    </div>
                    {review.overallComments && (
                      <p className="m-0 mt-2.5 text-[13px] leading-relaxed text-ink">
                        {review.overallComments}
                      </p>
                    )}
                    {review.planOfAction && (
                      <div className="mt-2.5 rounded-lg bg-surface-soft px-3 py-2.5">
                        <p className="m-0 text-[11.5px] font-bold uppercase tracking-[0.05em] text-ink-muted">
                          Your next steps
                        </p>
                        <p className="m-0 mt-1 text-[13px] text-ink">{review.planOfAction}</p>
                      </div>
                    )}
                  </CardV2>
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

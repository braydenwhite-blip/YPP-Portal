import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { getReviewForChair } from "@/lib/goal-review-actions";
import { projectAwardOutcome } from "@/lib/award-projection";
import { toMenteeRoleType } from "@/lib/mentee-role-utils";
import { POINT_TABLE } from "@/lib/mentorship-point-table";
import { AwardsSummaryPanel } from "@/components/mentorship/awards-summary-panel";
import { formatEnum } from "@/lib/format-utils";
import ChairActionsPanel from "./chair-actions-panel";

export const metadata = { title: "Approve Review — Mentorship Program" };

function ratingLabel(rating: string): string {
  const map: Record<string, string> = {
    BEHIND_SCHEDULE: "Behind Schedule",
    GETTING_STARTED: "Getting Started",
    ACHIEVED: "Achieved",
    ABOVE_AND_BEYOND: "Above & Beyond",
  };
  return map[rating] ?? formatEnum(rating);
}

export default async function ChairReviewDetailPage({
  params,
}: {
  params: Promise<{ reviewId: string }>;
}) {
  const { reviewId } = await params;

  const review = await getReviewForChair(reviewId);
  if (!review) {
    // Either the review doesn't exist, or this user doesn't chair its lane.
    // Fall back to the inbox so the user sees a coherent next step.
    redirect("/mentorship/reviews");
  }

  // Preview what approval will trigger (read-only).
  const projection = await projectAwardOutcome({
    id: review.id,
    overallRating: review.overallRating,
    bonusPoints: review.bonusPoints,
    chairAdjustedBonusPoints: review.chairAdjustedBonusPoints,
    pointsAwarded: review.pointsAwarded,
    menteeId: review.menteeId,
    mentee: { primaryRole: review.mentee.primaryRole },
  });

  const menteeRoleType = toMenteeRoleType(review.mentee.primaryRole);
  const basePoints = menteeRoleType
    ? POINT_TABLE[review.overallRating][menteeRoleType]
    : 0;

  if (!menteeRoleType) {
    notFound();
  }

  return (
    <div>
      <div className="topbar">
        <div>
          <Link href="/mentorship/reviews" style={{ color: "var(--muted)", fontSize: 13 }}>
            &larr; Monthly Review Inbox
          </Link>
          <p className="badge">Chair Approval</p>
          <h1 className="page-title">Review: {review.mentee.name}</h1>
          <p className="page-subtitle">
            Mentor {review.mentor.name} · Cycle {review.selfReflection.cycleNumber} ·{" "}
            {review.selfReflection.cycleMonth.toLocaleDateString("en-US", {
              month: "long",
              year: "numeric",
            })}
          </p>
        </div>
      </div>

      <AwardsSummaryPanel projection={projection} menteeName={review.mentee.name} />

      <div className="grid" style={{ gridTemplateColumns: "2fr 1fr", gap: 16 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <section className="card">
            <div className="section-title">Overall Rating</div>
            <p style={{ margin: "8px 0 0", fontSize: "1.05rem", fontWeight: 600 }}>
              {ratingLabel(review.overallRating)}
            </p>
            {review.overallComments && (
              <p style={{ margin: "10px 0 0", whiteSpace: "pre-wrap" }}>
                {review.overallComments}
              </p>
            )}
            {review.planOfAction && (
              <>
                <div className="section-title" style={{ marginTop: 16 }}>
                  Plan of Action
                </div>
                <p style={{ margin: "6px 0 0", whiteSpace: "pre-wrap" }}>
                  {review.planOfAction}
                </p>
              </>
            )}
          </section>

          {review.goalRatings.length > 0 && (
            <section className="card">
              <div className="section-title">Per-Goal Ratings</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 8 }}>
                {review.goalRatings.map((gr) => (
                  <div key={gr.id} style={{ padding: "0.6rem 0.75rem", background: "var(--surface-alt)", borderRadius: 6 }}>
                    <div style={{ fontWeight: 600, fontSize: "0.9rem" }}>{gr.goal.title}</div>
                    <div className="muted" style={{ fontSize: "0.8rem" }}>{ratingLabel(gr.rating)}</div>
                    {gr.comments && (
                      <p style={{ margin: "4px 0 0", fontSize: "0.85rem", whiteSpace: "pre-wrap" }}>
                        {gr.comments}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </section>
          )}

          {review.selfReflection.goalResponses.length > 0 && (
            <section className="card">
              <div className="section-title">Mentee&apos;s Self-Reflection</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 8 }}>
                {review.selfReflection.goalResponses.map((gr) => (
                  <div key={gr.id}>
                    <div style={{ fontWeight: 600, fontSize: "0.9rem" }}>{gr.goal.title}</div>
                    {gr.progressMade && (
                      <p style={{ margin: "4px 0 0", fontSize: "0.85rem", whiteSpace: "pre-wrap", color: "var(--muted)" }}>
                        <strong>Progress:</strong> {gr.progressMade}
                      </p>
                    )}
                    {gr.accomplishments && (
                      <p style={{ margin: "4px 0 0", fontSize: "0.85rem", whiteSpace: "pre-wrap", color: "var(--muted)" }}>
                        <strong>Accomplishments:</strong> {gr.accomplishments}
                      </p>
                    )}
                    {gr.blockers && (
                      <p style={{ margin: "4px 0 0", fontSize: "0.85rem", whiteSpace: "pre-wrap", color: "var(--muted)" }}>
                        <strong>Blockers:</strong> {gr.blockers}
                      </p>
                    )}
                    {gr.nextMonthPlans && (
                      <p style={{ margin: "4px 0 0", fontSize: "0.85rem", whiteSpace: "pre-wrap", color: "var(--muted)" }}>
                        <strong>Next month:</strong> {gr.nextMonthPlans}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>

        <div>
          <ChairActionsPanel
            reviewId={review.id}
            currentStatus={review.status}
            pointsToAward={basePoints + review.bonusPoints}
            menteeName={review.mentee.name ?? "the mentee"}
            bonusPoints={review.bonusPoints}
            bonusReason={review.bonusReason}
          />
        </div>
      </div>
    </div>
  );
}

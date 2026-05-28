import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { getReviewForChair } from "@/lib/goal-review-actions";
import { projectAwardOutcome } from "@/lib/award-projection";
import { toMenteeRoleType } from "@/lib/mentee-role-utils";
import { POINT_TABLE } from "@/lib/mentorship-point-table";
import { AwardsSummaryPanel } from "@/components/mentorship/awards-summary-panel";
import { ReviewStateStrip } from "@/components/mentorship/review-state-strip";
import { formatEnum } from "@/lib/format-utils";
import { getGoalRatingCopy } from "@/lib/mentorship-rubric-copy";
import { getReviewHeadlineState, getReviewStateTonePalette } from "@/lib/mentorship-review-state";
import { RatingLegend } from "@/components/mentorship/rating-legend";
import ChairActionsPanel from "./chair-actions-panel";

export const metadata = { title: "Approve Review — Mentorship Program" };

function ratingLabel(rating: string): string {
  return getGoalRatingCopy(rating).label ?? formatEnum(rating);
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

  const headlineState = getReviewHeadlineState({
    status: review.status,
    releasedToMenteeAt: review.releasedToMenteeAt,
    pointsAwarded: review.pointsAwarded,
  });
  const headlinePalette = getReviewStateTonePalette(headlineState.tone);

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
        <span
          title={headlineState.description}
          style={{
            alignSelf: "flex-start",
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            background: headlinePalette.background,
            color: headlinePalette.color,
            borderRadius: 999,
            padding: "0.3rem 0.8rem",
            fontSize: "0.8rem",
            fontWeight: 700,
          }}
        >
          {headlineState.label}
        </span>
      </div>

      <section
        className="card"
        style={{ marginBottom: 16, borderLeft: "4px solid var(--color-primary)", display: "grid", gap: 8 }}
      >
        <strong style={{ fontSize: "0.95rem" }}>What you&apos;re approving</strong>
        <ul style={{ margin: 0, paddingLeft: "1.1rem", fontSize: "0.83rem", display: "grid", gap: 4 }}>
          <li>
            <strong>{review.mentor.name}</strong>&apos;s monthly review of{" "}
            <strong>{review.mentee.name}</strong> ({formatEnum(review.mentee.primaryRole)} lane).
          </li>
          <li>
            Overall rating: <strong>{ratingLabel(review.overallRating)}</strong>. This sets the
            achievement points awarded for the cycle.
          </li>
          <li>
            <strong>Approve</strong> → points/awards are calculated and the mentor&apos;s summary,
            ratings, and plan of action are released to {review.mentee.name}.
          </li>
          <li>
            <strong>Request changes</strong> → it goes back to the mentor; nothing is released and no
            points are awarded yet.
          </li>
          <li className="muted">
            The mentee never sees this approval screen, chair notes, or pre-release drafts — only the
            released summary once you approve.
          </li>
        </ul>
      </section>

      <AwardsSummaryPanel projection={projection} menteeName={review.mentee.name} />

      <div className="grid" style={{ gridTemplateColumns: "2fr 1fr", gap: 16 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <section className="card">
            <div className="section-title">Overall Rating</div>
            {(() => {
              const cfg = getGoalRatingCopy(review.overallRating);
              return (
                <div style={{ margin: "8px 0 0", display: "grid", gap: 6 }}>
                  <span
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 8,
                      alignSelf: "start",
                      background: cfg.background,
                      color: cfg.color,
                      borderRadius: 999,
                      padding: "0.25rem 0.7rem",
                      fontSize: "0.95rem",
                      fontWeight: 700,
                    }}
                  >
                    <span aria-hidden style={{ width: 10, height: 10, borderRadius: "50%", background: cfg.color }} />
                    {cfg.shortLabel} — {cfg.label}
                  </span>
                  <span className="muted" style={{ fontSize: "0.8rem" }}>{cfg.adminDescription}</span>
                </div>
              );
            })()}
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
                    <div style={{ fontWeight: 600, fontSize: "0.9rem" }}>{gr.goal?.title ?? "(goal removed)"}</div>
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

        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <ChairActionsPanel
            reviewId={review.id}
            currentStatus={review.status}
            pointsToAward={basePoints + review.bonusPoints}
            menteeName={review.mentee.name ?? "the mentee"}
            bonusPoints={review.bonusPoints}
            bonusReason={review.bonusReason}
          />
          <ReviewStateStrip
            status={review.status}
            releasedToMenteeAt={review.releasedToMenteeAt}
            pointsAwarded={review.pointsAwarded}
          />
          <RatingLegend audience="admin" title="Rating scale you're approving against" />
        </div>
      </div>
    </div>
  );
}

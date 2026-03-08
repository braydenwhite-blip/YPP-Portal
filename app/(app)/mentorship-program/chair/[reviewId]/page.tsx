import { getServerSession } from "next-auth";
import { redirect, notFound } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { getReviewForChair } from "@/lib/goal-review-actions";
import ChairActionsPanel from "./chair-actions-panel";
import Link from "next/link";

export const metadata = { title: "Approve Review — Mentorship Program" };

const RATING_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  BEHIND_SCHEDULE: { label: "Behind Schedule", color: "#ef4444", bg: "#fef2f2" },
  GETTING_STARTED: { label: "Getting Started", color: "#d97706", bg: "#fffbeb" },
  ACHIEVED: { label: "Achieved", color: "#16a34a", bg: "#f0fdf4" },
  ABOVE_AND_BEYOND: { label: "Above & Beyond", color: "#7c3aed", bg: "#faf5ff" },
};

// Matches POINT_TABLE in goal-review-actions.ts
const POINT_TABLE: Record<string, Record<string, number>> = {
  BEHIND_SCHEDULE: { INSTRUCTOR: 0, CHAPTER_PRESIDENT: 0, GLOBAL_LEADERSHIP: 0 },
  GETTING_STARTED: { INSTRUCTOR: 5, CHAPTER_PRESIDENT: 8, GLOBAL_LEADERSHIP: 10 },
  ACHIEVED: { INSTRUCTOR: 10, CHAPTER_PRESIDENT: 15, GLOBAL_LEADERSHIP: 20 },
  ABOVE_AND_BEYOND: { INSTRUCTOR: 15, CHAPTER_PRESIDENT: 22, GLOBAL_LEADERSHIP: 30 },
};

function toMenteeRoleKey(primaryRole: string): string {
  if (primaryRole === "INSTRUCTOR") return "INSTRUCTOR";
  if (primaryRole === "CHAPTER_LEAD") return "CHAPTER_PRESIDENT";
  return "GLOBAL_LEADERSHIP";
}

function SectionBlock({ label, value }: { label: string; value: string | null | undefined }) {
  if (!value) return null;
  return (
    <div style={{ marginBottom: "0.9rem" }}>
      <p style={{ fontWeight: 600, fontSize: "0.8rem", color: "var(--muted)", marginBottom: "0.25rem" }}>{label}</p>
      <p style={{ whiteSpace: "pre-wrap", lineHeight: 1.6, margin: 0, fontSize: "0.9rem" }}>{value}</p>
    </div>
  );
}

export default async function ChairReviewDetailPage({ params }: { params: Promise<{ reviewId: string }> }) {
  const { reviewId } = await params;

  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");
  const roles = session.user.roles ?? [];
  if (!roles.includes("ADMIN") && !roles.includes("MENTOR") && !roles.includes("CHAPTER_LEAD")) {
    redirect("/");
  }

  const review = await getReviewForChair(reviewId);
  if (!review) notFound();

  const overallRating = RATING_CONFIG[review.overallRating];
  const roleKey = toMenteeRoleKey(review.mentee.primaryRole);
  const pointsToAward = POINT_TABLE[review.overallRating]?.[roleKey] ?? 0;
  const cycleLabel = `Cycle ${review.cycleNumber}${review.isQuarterly ? " (Quarterly)" : ""}`;

  return (
    <div>
      <div className="topbar">
        <div>
          <p className="badge">Chair Review</p>
          <h1 className="page-title">Approve Goal Review</h1>
          <p className="page-subtitle">
            {review.mentee.name} · {cycleLabel} · Mentor: {review.mentor.name}
          </p>
        </div>
        <Link href="/mentorship-program/chair" className="button ghost small">
          ← Chair Queue
        </Link>
      </div>

      <div className="grid two" style={{ marginBottom: "1.5rem" }}>
        {/* Mentee + cycle info */}
        <div className="card">
          <p style={{ fontWeight: 600, marginBottom: "0.5rem" }}>Mentee</p>
          <p style={{ fontWeight: 600, fontSize: "1rem" }}>{review.mentee.name}</p>
          <p style={{ color: "var(--muted)", fontSize: "0.82rem" }}>{review.mentee.email}</p>
          <p style={{ color: "var(--muted)", fontSize: "0.82rem", marginTop: "0.25rem" }}>
            {review.mentee.primaryRole} · {cycleLabel}
          </p>
          <p style={{ color: "var(--muted)", fontSize: "0.82rem" }}>
            Mentor: {review.mentor.name}
          </p>
        </div>

        {/* Overall rating summary */}
        <div
          className="card"
          style={{
            background: overallRating?.bg ?? "var(--surface)",
            border: `1px solid ${overallRating?.color ?? "var(--border)"}44`,
          }}
        >
          <p style={{ fontWeight: 600, marginBottom: "0.5rem" }}>Overall Rating</p>
          <p style={{ fontWeight: 700, fontSize: "1.3rem", color: overallRating?.color }}>
            {overallRating?.label ?? review.overallRating}
          </p>
          <p style={{ color: "var(--muted)", fontSize: "0.82rem", marginTop: "0.25rem" }}>
            Will award <strong>{pointsToAward} achievement points</strong> on approval
          </p>
        </div>
      </div>

      {/* Per-goal ratings */}
      <div className="card" style={{ marginBottom: "1.25rem" }}>
        <p style={{ fontWeight: 700, marginBottom: "1rem" }}>Per-Goal Ratings</p>
        <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
          {review.goalRatings.map((gr, idx) => {
            const ratingCfg = RATING_CONFIG[gr.rating];
            return (
              <div
                key={gr.id}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "flex-start",
                  padding: "0.75rem 1rem",
                  background: ratingCfg?.bg ?? "var(--surface-alt)",
                  borderRadius: "var(--radius-sm)",
                  border: `1px solid ${ratingCfg?.color ?? "var(--border)"}33`,
                }}
              >
                <div>
                  <p style={{ fontWeight: 600, margin: 0 }}>
                    Goal {idx + 1}: {gr.goal.title}
                  </p>
                  {gr.comments && (
                    <p style={{ color: "var(--muted)", fontSize: "0.82rem", margin: "0.2rem 0 0" }}>
                      {gr.comments}
                    </p>
                  )}
                </div>
                <span
                  className="pill"
                  style={{ background: ratingCfg?.bg, color: ratingCfg?.color, flexShrink: 0 }}
                >
                  {ratingCfg?.label ?? gr.rating}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Mentor's written review */}
      <div className="card" style={{ marginBottom: "1.25rem" }}>
        <p style={{ fontWeight: 700, marginBottom: "1rem" }}>Mentor's Written Review</p>
        <SectionBlock label="Overall Comments" value={review.overallComments} />
        <SectionBlock label="Plan of Action" value={review.planOfAction} />
        {review.isQuarterly && (
          <>
            <SectionBlock label="Projected Future Path" value={review.projectedFuturePath} />
            <SectionBlock label="Promotion Readiness" value={review.promotionReadiness} />
          </>
        )}
      </div>

      {/* Self-reflection summary */}
      <details className="card" style={{ marginBottom: "1.25rem" }}>
        <summary style={{ fontWeight: 600, cursor: "pointer", userSelect: "none" }}>
          Mentee's Self-Reflection (click to expand)
        </summary>
        <div style={{ marginTop: "1rem" }}>
          <SectionBlock label="Overall Reflection" value={review.selfReflection.overallReflection} />
          <SectionBlock label="Engagement & Fulfillment" value={review.selfReflection.engagementOverall} />
          <SectionBlock label="What's Working Well" value={review.selfReflection.workingWell} />
          <SectionBlock label="Support Needed" value={review.selfReflection.supportNeeded} />
          <SectionBlock label="Mentor Helpfulness" value={review.selfReflection.mentorHelpfulness} />
          <SectionBlock label="Team Collaboration" value={review.selfReflection.collaborationAssessment} />
          {review.selfReflection.teamMembersAboveAndBeyond && (
            <SectionBlock label="Above & Beyond" value={review.selfReflection.teamMembersAboveAndBeyond} />
          )}
          {review.selfReflection.additionalReflections && (
            <SectionBlock label="Additional Notes" value={review.selfReflection.additionalReflections} />
          )}
          <div style={{ marginTop: "1rem" }}>
            <p style={{ fontWeight: 600, fontSize: "0.8rem", color: "var(--muted)", marginBottom: "0.5rem" }}>
              Per-Goal Responses
            </p>
            {review.selfReflection.goalResponses.map((gr, idx) => (
              <div
                key={gr.id}
                style={{
                  padding: "0.75rem",
                  background: "var(--surface-alt)",
                  borderRadius: "var(--radius-sm)",
                  border: "1px solid var(--border)",
                  marginBottom: "0.5rem",
                }}
              >
                <p style={{ fontWeight: 700, marginBottom: "0.5rem" }}>
                  Goal {idx + 1}: {gr.goal.title}
                </p>
                <SectionBlock label="Progress Made" value={gr.progressMade} />
                <p style={{ fontSize: "0.82rem", marginBottom: "0.5rem" }}>
                  <strong>Objective achieved:</strong>{" "}
                  <span style={{ color: gr.objectiveAchieved ? "#16a34a" : "#ef4444" }}>
                    {gr.objectiveAchieved ? "Yes" : "No"}
                  </span>
                </p>
                <SectionBlock label="Accomplishments" value={gr.accomplishments} />
                {gr.blockers && <SectionBlock label="Blockers" value={gr.blockers} />}
                <SectionBlock label="Next Month's Plans" value={gr.nextMonthPlans} />
              </div>
            ))}
          </div>
        </div>
      </details>

      {/* Chair action panel */}
      <ChairActionsPanel
        reviewId={reviewId}
        currentStatus={review.status}
        pointsToAward={pointsToAward}
        menteeName={review.mentee.name}
      />
    </div>
  );
}

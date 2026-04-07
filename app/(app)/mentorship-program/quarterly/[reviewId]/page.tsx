import { redirect, notFound } from "next/navigation";
import { getSession } from "@/lib/auth-supabase";
import { getQuarterlyReviewData, createFeedbackRequest } from "@/lib/goal-review-actions";
import Link from "next/link";

export const metadata = { title: "Quarterly Review — YPP Mentorship" };

const RATING_CONFIG: Record<string, { label: string; color: string }> = {
  BEHIND_SCHEDULE: { label: "Behind Schedule", color: "#ef4444" },
  GETTING_STARTED: { label: "Getting Started", color: "#d97706" },
  ACHIEVED: { label: "Achieved", color: "#16a34a" },
  ABOVE_AND_BEYOND: { label: "Above & Beyond", color: "#6b21c8" },
};

const ROLE_LABELS: Record<string, string> = {
  INSTRUCTOR: "Instructor",
  CHAPTER_PRESIDENT: "Chapter President",
  ADMIN: "Global Leadership",
  STAFF: "Global Leadership",
};

interface ReviewColumn {
  id: string;
  cycleNumber: number;
  cycleMonth: string;
  overallRating: string;
  pointsAwarded: number | null;
  overallComments: string;
  planOfAction: string;
  bonusPoints: number;
  bonusReason: string | null;
  isQuarterly: boolean;
  projectedFuturePath: string | null;
  promotionReadiness: string | null;
  chairComments: string | null;
  goalRatings: Array<{ goalTitle: string; rating: string; comments: string | null }>;
}

function ReviewCard({ review, isQuarterly }: { review: ReviewColumn; isQuarterly: boolean }) {
  const ratingCfg = RATING_CONFIG[review.overallRating];
  return (
    <div
      className="card"
      style={{
        flex: 1,
        minWidth: "260px",
        borderTop: isQuarterly ? `3px solid var(--ypp-purple-500)` : `3px solid ${ratingCfg?.color ?? "var(--border)"}`,
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "0.75rem" }}>
        <div>
          <span style={{ fontWeight: 700, fontSize: "1rem" }}>Cycle {review.cycleNumber}</span>
          {isQuarterly && (
            <span className="pill" style={{ marginLeft: "0.4rem", fontSize: "0.7rem", background: "var(--ypp-purple-100)", color: "var(--ypp-purple-700)" }}>
              Quarterly
            </span>
          )}
          <p style={{ fontSize: "0.75rem", color: "var(--muted)", marginTop: "0.1rem" }}>
            {new Date(review.cycleMonth).toLocaleDateString("en-US", { month: "long", year: "numeric" })}
          </p>
        </div>
        <div style={{ textAlign: "right" }}>
          {ratingCfg && (
            <span
              className="pill"
              style={{ fontSize: "0.72rem", background: ratingCfg.color + "22", color: ratingCfg.color }}
            >
              {ratingCfg.label}
            </span>
          )}
          {review.pointsAwarded !== null && (
            <p style={{ fontSize: "0.75rem", color: "#16a34a", fontWeight: 700, marginTop: "0.2rem" }}>
              +{review.pointsAwarded} pts
            </p>
          )}
        </div>
      </div>

      {/* Per-goal ratings */}
      {review.goalRatings.length > 0 && (
        <div style={{ marginBottom: "0.75rem" }}>
          <p style={{ fontSize: "0.72rem", fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "0.4rem" }}>
            Goals
          </p>
          {review.goalRatings.map((gr) => {
            const grCfg = RATING_CONFIG[gr.rating];
            return (
              <div key={gr.goalTitle} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.2rem" }}>
                <span style={{ fontSize: "0.78rem", flex: 1, marginRight: "0.5rem" }}>{gr.goalTitle}</span>
                <span style={{ fontSize: "0.7rem", color: grCfg?.color ?? "var(--muted)", fontWeight: 600, whiteSpace: "nowrap" }}>
                  {grCfg?.label ?? gr.rating}
                </span>
              </div>
            );
          })}
        </div>
      )}

      {/* Overall comments */}
      <div style={{ marginBottom: "0.6rem" }}>
        <p style={{ fontSize: "0.72rem", fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "0.25rem" }}>
          Overall Comments
        </p>
        <p style={{ fontSize: "0.82rem", lineHeight: 1.5 }}>{review.overallComments}</p>
      </div>

      {/* Plan of action */}
      <div style={{ marginBottom: "0.6rem" }}>
        <p style={{ fontSize: "0.72rem", fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "0.25rem" }}>
          Plan of Action
        </p>
        <p style={{ fontSize: "0.82rem", lineHeight: 1.5 }}>{review.planOfAction}</p>
      </div>

      {/* Character & Culture */}
      {review.bonusPoints > 0 && (
        <div style={{ marginBottom: "0.6rem", padding: "0.5rem 0.65rem", background: "var(--ypp-purple-50, #faf5ff)", borderRadius: "var(--radius-sm)" }}>
          <p style={{ fontSize: "0.72rem", fontWeight: 700, color: "var(--ypp-purple-600)", marginBottom: "0.2rem" }}>
            Character & Culture +{review.bonusPoints}
          </p>
          {review.bonusReason && (
            <p style={{ fontSize: "0.78rem", color: "var(--ypp-purple-700)" }}>{review.bonusReason}</p>
          )}
        </div>
      )}

      {/* Quarterly-only fields */}
      {isQuarterly && review.projectedFuturePath && (
        <div style={{ marginBottom: "0.6rem" }}>
          <p style={{ fontSize: "0.72rem", fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "0.25rem" }}>
            Projected Pathway
          </p>
          <p style={{ fontSize: "0.82rem", lineHeight: 1.5 }}>{review.projectedFuturePath}</p>
        </div>
      )}
      {isQuarterly && review.promotionReadiness && (
        <div style={{ marginBottom: "0.6rem" }}>
          <p style={{ fontSize: "0.72rem", fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "0.25rem" }}>
            Promotion Readiness
          </p>
          <p style={{ fontSize: "0.82rem", lineHeight: 1.5 }}>{review.promotionReadiness}</p>
        </div>
      )}

      {/* Chair comments */}
      {review.chairComments && (
        <div style={{ padding: "0.5rem 0.65rem", background: "#f0f9ff", borderRadius: "var(--radius-sm)", borderLeft: "3px solid #0ea5e9" }}>
          <p style={{ fontSize: "0.72rem", fontWeight: 700, color: "#0369a1", marginBottom: "0.2rem" }}>Chair Notes</p>
          <p style={{ fontSize: "0.78rem", color: "#0c4a6e" }}>{review.chairComments}</p>
        </div>
      )}
    </div>
  );
}

export default async function QuarterlyReviewPage({ params }: { params: Promise<{ reviewId: string }> }) {
  const { reviewId } = await params;
  const session = await getSession();
  if (!session?.user?.id) redirect("/login");

  const data = await getQuarterlyReviewData(reviewId);
  if (!data) notFound();

  const allReviews: ReviewColumn[] = [
    ...data.precedingReviews,
    data.quarterlyReview,
  ];

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://portal.ypp.com";

  return (
    <div>
      <div className="topbar">
        <div>
          <p className="badge">Quarterly Review</p>
          <h1 className="page-title">Q{Math.ceil(data.quarterlyReview.cycleNumber / 3)} Review — {data.mentee.name}</h1>
          <p className="page-subtitle">
            {ROLE_LABELS[data.mentee.role ?? ""] ?? data.mentee.role} ·
            Cycles {allReviews.map((r) => r.cycleNumber).join(", ")}
          </p>
        </div>
        <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", justifyContent: "flex-end" }}>
          <Link href="/mentorship-program/reviews" className="button secondary small">
            ← Back
          </Link>
          {data.isMentor && (
            <Link
              href={`/mentorship-program/quarterly/${reviewId}/prep-packet`}
              className="button secondary small"
            >
              Generate Prep Packet
            </Link>
          )}
        </div>
      </div>

      {/* 3-column side-by-side review comparison */}
      <div style={{ marginBottom: "2rem" }}>
        <p className="section-title" style={{ marginBottom: "1rem" }}>
          Monthly Reviews — Side by Side
        </p>
        <div style={{ display: "flex", gap: "1rem", overflowX: "auto", alignItems: "flex-start" }}>
          {allReviews.map((review) => (
            <ReviewCard
              key={review.id}
              review={review}
              isQuarterly={review.isQuarterly}
            />
          ))}
          {allReviews.length === 0 && (
            <div className="card" style={{ width: "100%", textAlign: "center", padding: "2.5rem" }}>
              <p style={{ color: "var(--muted)" }}>No reviews found for this quarter.</p>
            </div>
          )}
        </div>
      </div>

      {/* Stakeholder Feedback Section */}
      <div style={{ marginBottom: "2rem" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
          <p className="section-title">Stakeholder Feedback (360°)</p>
          {data.isMentor && (
            <form action={createFeedbackRequest}>
              <input type="hidden" name="mentorshipId" value={data.mentorshipId} />
              <input type="hidden" name="reviewId" value={reviewId} />
              <input type="hidden" name="quarterNumber" value={String(Math.ceil(data.quarterlyReview.cycleNumber / 3))} />
              <button type="submit" className="button primary small">
                + Collect Stakeholder Feedback
              </button>
            </form>
          )}
        </div>

        {data.feedbackSummary ? (
          <div>
            <div className="grid four" style={{ marginBottom: "1.25rem" }}>
              <div className="card">
                <p className="kpi">{data.feedbackSummary.totalResponses}</p>
                <p className="kpi-label">Responses</p>
              </div>
              <div className="card">
                <p className="kpi" style={{ color: (data.feedbackSummary.avgRating ?? 0) >= 4 ? "#16a34a" : "#d97706" }}>
                  {data.feedbackSummary.avgRating !== null ? data.feedbackSummary.avgRating.toFixed(1) : "—"}/5
                </p>
                <p className="kpi-label">Avg Rating</p>
              </div>
              <div className="card" style={{ gridColumn: "span 2" }}>
                <p style={{ fontSize: "0.8rem", color: "var(--muted)" }}>Shareable Link</p>
                <p
                  style={{
                    fontSize: "0.78rem",
                    background: "var(--surface-alt)",
                    padding: "0.3rem 0.5rem",
                    borderRadius: "var(--radius-sm)",
                    fontFamily: "monospace",
                    marginTop: "0.25rem",
                    wordBreak: "break-all",
                  }}
                >
                  {baseUrl}/feedback/{data.feedbackSummary.token}
                </p>
              </div>
            </div>

            {data.feedbackSummary.responses.length > 0 && (
              <div style={{ display: "flex", flexDirection: "column", gap: "0.65rem" }}>
                {data.feedbackSummary.responses.map((r, i) => (
                  <div key={i} className="card" style={{ padding: "0.85rem 1rem" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "0.5rem" }}>
                      <div>
                        <span style={{ fontWeight: 600, fontSize: "0.88rem" }}>{r.respondentName}</span>
                        <span className="pill" style={{ marginLeft: "0.5rem", fontSize: "0.7rem", background: "var(--surface-alt)" }}>
                          {r.respondentRole}
                        </span>
                      </div>
                      <div style={{ display: "flex", gap: "2px" }}>
                        {Array.from({ length: 5 }).map((_, si) => (
                          <span key={si} style={{ color: si < r.overallRating ? "#d4af37" : "var(--border)", fontSize: "0.9rem" }}>★</span>
                        ))}
                      </div>
                    </div>
                    <div className="grid two" style={{ gap: "0.75rem" }}>
                      <div>
                        <p style={{ fontSize: "0.7rem", fontWeight: 700, color: "#16a34a", textTransform: "uppercase", marginBottom: "0.2rem" }}>
                          Strengths
                        </p>
                        <p style={{ fontSize: "0.82rem", lineHeight: 1.5 }}>{r.strengths}</p>
                      </div>
                      <div>
                        <p style={{ fontSize: "0.7rem", fontWeight: 700, color: "#d97706", textTransform: "uppercase", marginBottom: "0.2rem" }}>
                          Growth Areas
                        </p>
                        <p style={{ fontSize: "0.82rem", lineHeight: 1.5 }}>{r.areasForGrowth}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="card" style={{ textAlign: "center", padding: "2rem" }}>
            <p style={{ color: "var(--muted)", marginBottom: "0.75rem" }}>
              No stakeholder feedback collected yet for this quarterly cycle.
            </p>
            {data.isMentor && (
              <p style={{ fontSize: "0.82rem", color: "var(--muted)" }}>
                Use the "Collect Stakeholder Feedback" button above to generate a shareable link for parents, school officials, or other stakeholders.
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

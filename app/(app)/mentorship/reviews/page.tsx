import Link from "next/link";
import { getSession } from "@/lib/auth-supabase";
import { redirect } from "next/navigation";

import { FieldLabel } from "@/components/field-help";
import { MentorshipGuideCard } from "@/components/mentorship-guide-card";
import { ProgressBar } from "@/components/progress-bar";
import { formatEnum } from "@/lib/format-utils";
import { PROGRESS_STATUS_META } from "@/lib/mentorship-review-helpers";
import {
  approveMonthlyGoalReview,
  getPendingChairReviews,
  returnMonthlyGoalReview,
} from "@/lib/mentorship-program-actions";

const CHAIR_QUEUE_GUIDE_ITEMS = [
  {
    label: "Queue Overview",
    meaning:
      "Each card is one monthly review waiting for a chair-level decision before it becomes final.",
    howToUse:
      "Read the mentee, mentor, month, and progress summary first so you know what case you are about to review.",
  },
  {
    label: "Evidence and reasoning",
    meaning:
      "These sections show the scored goal evidence, the mentee's own reflection, and the mentor's written reasoning.",
    howToUse:
      "Use them to judge whether the review is complete, fair, and strong enough to release without confusion.",
  },
  {
    label: "Goal Ratings and Linked Reflection",
    meaning:
      "This is the supporting evidence for the decision. Goal ratings show scored progress and the reflection shows the mentee's own voice.",
    howToUse:
      "Compare these two areas when you want to see whether the review matches the evidence from the month.",
  },
  {
    label: "Approve or Return",
    meaning:
      "The last forms decide whether the review moves forward or goes back for edits.",
    howToUse:
      "Approve when the review is ready to stand on its own. Return it when the mentor needs to clarify ratings, evidence, or next steps.",
  },
] as const;

export default async function ChairReviewQueuePage() {
  const session = await getSession();
  if (!session?.user?.id) {
    redirect("/login");
  }

  const roles = session.user.roles ?? [];
  if (
    !roles.includes("ADMIN") &&
    !roles.includes("CHAPTER_PRESIDENT") &&
    !roles.includes("MENTOR")
  ) {
    redirect("/mentorship");
  }

  const reviews = await getPendingChairReviews();

  return (
    <div>
      <div className="topbar">
        <div>
          <Link href="/mentorship" style={{ color: "var(--muted)", fontSize: 13 }}>
            &larr; Support Hub
          </Link>
          <p className="badge">Review Approval</p>
          <h1 className="page-title">Chair Review Queue</h1>
          <p className="page-subtitle">
            Review the evidence, decide if the monthly write-up is ready, and either approve it or return it with clear guidance.
          </p>
        </div>
      </div>

      <MentorshipGuideCard
        title="How To Review And Approve Monthly Reviews"
        intro="This page is the quality-control step for monthly reviews that require chair approval."
        items={CHAIR_QUEUE_GUIDE_ITEMS}
      />

      {reviews.length === 0 ? (
        <div className="card">
          <h3 style={{ marginTop: 0 }}>No reviews waiting on approval</h3>
          <p style={{ marginBottom: 0, color: "var(--muted)" }}>
            New monthly goal reviews will appear here once mentors submit them.
          </p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          {reviews.map((review) => (
            <article
              key={review.id}
              className="card"
              style={{ padding: 0, overflow: "hidden" }}
            >
              <div
                style={{
                  padding: 24,
                  borderBottom: "1px solid var(--border)",
                  background: "linear-gradient(180deg, rgba(59, 130, 246, 0.06), transparent)",
                }}
              >
                <div className="section-title" style={{ marginBottom: 12 }}>
                  Review Context
                </div>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    gap: 20,
                    flexWrap: "wrap",
                    alignItems: "flex-start",
                  }}
                >
                  <div style={{ flex: "1 1 340px" }}>
                    <h3 style={{ margin: "0 0 6px" }}>{review.mentee.name}</h3>
                    <p style={{ margin: 0, fontSize: 13, color: "var(--muted)" }}>
                      {formatEnum(review.mentee.primaryRole)} · Mentor: {review.mentor.name}
                      {review.mentorship.track ? ` · ${review.mentorship.track.name}` : ""}
                    </p>
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 12 }}>
                      <span className="pill pill-info">
                        {new Date(review.month).toLocaleDateString("en-US", {
                          month: "long",
                          year: "numeric",
                        })}
                      </span>
                      <span className="pill">Pending approval</span>
                      {review.mentorSubmittedAt && (
                        <span
                          className="pill pill-small"
                          style={{ background: "var(--surface-alt)", color: "var(--muted)" }}
                        >
                          Submitted {new Date(review.mentorSubmittedAt).toLocaleDateString()}
                        </span>
                      )}
                    </div>
                  </div>

                  <div
                    style={{
                      flex: "1 1 300px",
                      minWidth: 260,
                      padding: 16,
                      borderRadius: "var(--radius-md)",
                      background: "var(--surface)",
                      border: "1px solid var(--border)",
                    }}
                  >
                    <div className="section-title" style={{ marginBottom: 10 }}>
                      Overall Progress
                    </div>
                    {review.overallStatus ? (
                      <>
                        <ProgressBar status={review.overallStatus} />
                        <p style={{ marginTop: 10, fontSize: 13, color: "var(--muted)" }}>
                          <strong style={{ color: "var(--foreground)" }}>
                            {PROGRESS_STATUS_META[review.overallStatus].label}:
                          </strong>{" "}
                          {PROGRESS_STATUS_META[review.overallStatus].description}
                        </p>
                      </>
                    ) : (
                      <p style={{ margin: 0, color: "var(--muted)" }}>
                        No overall progress selected.
                      </p>
                    )}
                  </div>
                </div>
              </div>

              <div style={{ padding: 24 }}>
                <div className="section-title" style={{ marginBottom: 12 }}>
                  Evidence To Review
                </div>
                <div className="grid two" style={{ marginBottom: 20 }}>
                  <section
                    style={{
                      padding: 18,
                      background: "#f8fafc",
                      borderRadius: "var(--radius-md)",
                      border: "1px solid #cbd5e1",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "flex-start",
                        gap: 12,
                        marginBottom: 8,
                      }}
                    >
                      <div>
                        <h3 style={{ margin: 0, fontSize: 16 }}>Goal-by-goal evidence</h3>
                        <p style={{ marginTop: 6, fontSize: 13 }}>
                          Read each rating and comment before deciding whether the final summary is supported.
                        </p>
                      </div>
                      <span className="pill pill-small">
                        {review.goalRatings.length} goal{review.goalRatings.length === 1 ? "" : "s"}
                      </span>
                    </div>

                    {review.goalRatings.length === 0 ? (
                      <p style={{ color: "var(--muted)", margin: 0 }}>
                        No goal ratings were submitted with this review.
                      </p>
                    ) : (
                      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                        {review.goalRatings.map((rating) => (
                          <div
                            key={rating.id}
                            style={{
                              padding: 14,
                              background: "white",
                              borderRadius: "var(--radius-sm)",
                              border: "1px solid var(--border)",
                            }}
                          >
                            <div style={{ fontWeight: 700 }}>{rating.goal.template.title}</div>
                            <div style={{ marginTop: 8 }}>
                              <ProgressBar status={rating.status} />
                            </div>
                            <p style={{ marginTop: 8, fontSize: 13, color: "var(--muted)" }}>
                              {rating.comments || "No goal comment provided."}
                            </p>
                          </div>
                        ))}
                      </div>
                    )}
                  </section>

                  <section
                    style={{
                      padding: 18,
                      background: "#f8fafc",
                      borderRadius: "var(--radius-md)",
                      border: "1px solid #cbd5e1",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "flex-start",
                        gap: 12,
                        marginBottom: 8,
                      }}
                    >
                      <div>
                        <h3 style={{ margin: 0, fontSize: 16 }}>Mentee self-reflection</h3>
                        <p style={{ marginTop: 6, fontSize: 13 }}>
                          This is the mentee&apos;s voice from the same month and should line up with the mentor&apos;s write-up.
                        </p>
                      </div>
                      <span
                        className={`pill pill-small${review.reflectionSubmission ? " pill-info" : ""}`}
                        style={
                          review.reflectionSubmission
                            ? undefined
                            : { background: "#fee2e2", color: "#991b1b" }
                        }
                      >
                        {review.reflectionSubmission ? "Attached" : "Missing"}
                      </span>
                    </div>

                    {!review.reflectionSubmission ? (
                      <div
                        style={{
                          padding: 14,
                          borderRadius: "var(--radius-sm)",
                          background: "white",
                          border: "1px solid #fecaca",
                          color: "#991b1b",
                          fontSize: 13,
                        }}
                      >
                        No self-reflection was attached to this review.
                      </div>
                    ) : (
                      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                        {review.reflectionSubmission.responses.slice(0, 4).map((response) => (
                          <div
                            key={response.id}
                            style={{
                              padding: 14,
                              background: "white",
                              borderRadius: "var(--radius-sm)",
                              border: "1px solid var(--border)",
                            }}
                          >
                            <div style={{ fontSize: 12, color: "var(--muted)" }}>
                              {response.question.sectionTitle || "Reflection"}
                            </div>
                            <div style={{ marginTop: 4, fontWeight: 700, fontSize: 13 }}>
                              {response.question.question}
                            </div>
                            <div style={{ marginTop: 6, fontSize: 13 }}>{response.value}</div>
                          </div>
                        ))}
                      </div>
                    )}
                  </section>
                </div>

                <div className="section-title" style={{ marginBottom: 12 }}>
                  Mentor Reasoning
                </div>
                <div className="grid two" style={{ marginBottom: 20 }}>
                  <section
                    style={{
                      padding: 18,
                      background: "var(--surface-alt)",
                      borderRadius: "var(--radius-md)",
                      border: "1px solid var(--border)",
                    }}
                  >
                    <h3 style={{ margin: 0, fontSize: 16 }}>Summary the mentee will see</h3>
                    <p style={{ marginTop: 8, fontSize: 13 }}>
                      These fields become the readable version of the approved review.
                    </p>
                    <div style={{ display: "grid", gap: 12, marginTop: 14 }}>
                      <div>
                        <strong style={{ fontSize: 13 }}>Overall summary</strong>
                        <p style={{ marginTop: 6, fontSize: 13 }}>
                          {review.overallComments || "No overall summary provided."}
                        </p>
                      </div>
                      <div>
                        <strong style={{ fontSize: 13 }}>Strengths to keep building</strong>
                        <p style={{ marginTop: 6, fontSize: 13 }}>
                          {review.strengths || "No strengths recorded."}
                        </p>
                      </div>
                      <div>
                        <strong style={{ fontSize: 13 }}>Focus for next month</strong>
                        <p style={{ marginTop: 6, fontSize: 13 }}>
                          {review.focusAreas || "No focus area recorded."}
                        </p>
                      </div>
                      <div>
                        <strong style={{ fontSize: 13 }}>Next-month plan</strong>
                        <p style={{ marginTop: 6, fontSize: 13 }}>
                          {review.nextMonthPlan || "No next-month plan recorded."}
                        </p>
                      </div>
                    </div>
                  </section>

                  <section
                    style={{
                      padding: 18,
                      background: "var(--surface-alt)",
                      borderRadius: "var(--radius-md)",
                      border: "1px solid var(--border)",
                    }}
                  >
                    <h3 style={{ margin: 0, fontSize: 16 }}>Internal review notes</h3>
                    <p style={{ marginTop: 8, fontSize: 13 }}>
                      Use these notes to judge internal context, readiness, and anything the mentor chose not to phrase directly to the mentee.
                    </p>
                    <div style={{ display: "grid", gap: 12, marginTop: 14 }}>
                      <div>
                        <strong style={{ fontSize: 13 }}>Collaboration and communication</strong>
                        <p style={{ marginTop: 6, fontSize: 13 }}>
                          {review.collaborationNotes || "No collaboration notes provided."}
                        </p>
                      </div>
                      <div>
                        <strong style={{ fontSize: 13 }}>Readiness for promotion or added responsibility</strong>
                        <p style={{ marginTop: 6, fontSize: 13 }}>
                          {review.promotionReadiness || "No readiness note provided."}
                        </p>
                      </div>
                      <div>
                        <strong style={{ fontSize: 13 }}>Character and culture points</strong>
                        <p style={{ marginTop: 6, fontSize: 13 }}>
                          {review.characterCulturePoints}
                        </p>
                      </div>
                      <div>
                        <strong style={{ fontSize: 13 }}>Internal notes for reviewers only</strong>
                        <p style={{ marginTop: 6, fontSize: 13 }}>
                          {review.mentorInternalNotes || "No internal notes provided."}
                        </p>
                      </div>
                    </div>
                  </section>
                </div>

                <div className="section-title" style={{ marginBottom: 12 }}>
                  Decision
                </div>
                <div className="grid two">
                <form
                  action={approveMonthlyGoalReview}
                  style={{
                    padding: 18,
                    background: "#f0fdf4",
                    borderRadius: "var(--radius-md)",
                    border: "1px solid #86efac",
                  }}
                >
                  <input type="hidden" name="reviewId" value={review.id} />
                  <h3 style={{ margin: "0 0 8px", fontSize: 16 }}>Approve and publish</h3>
                  <p style={{ margin: "0 0 14px", fontSize: 13, color: "#166534" }}>
                    Use this when the evidence, summary, and next-step plan are ready to become the final published review.
                  </p>
                  <div style={{ marginBottom: 6 }}>
                    <FieldLabel
                      label="Approval Note"
                      help={{
                        title: "Approval Note",
                        guidance:
                          "This optional note is the final message you want attached to the approved review.",
                        example:
                          "Approved as written. Strong evidence and clear next-month plan.",
                      }}
                    />
                  </div>
                  <textarea
                    id={`${review.id}-approve-note`}
                    name="chairDecisionNotes"
                    className="input"
                    rows={3}
                    placeholder="Optional note shared with the approved review."
                    style={{ marginBottom: 10 }}
                  />
                  <button type="submit" className="button">
                    Approve Review
                  </button>
                </form>

                <form
                  action={returnMonthlyGoalReview}
                  style={{
                    padding: 18,
                    background: "#fff7ed",
                    borderRadius: "var(--radius-md)",
                    border: "1px solid #fdba74",
                  }}
                >
                  <input type="hidden" name="reviewId" value={review.id} />
                  <h3 style={{ margin: "0 0 8px", fontSize: 16 }}>Return for edits</h3>
                  <p style={{ margin: "0 0 14px", fontSize: 13, color: "#9a3412" }}>
                    Be specific about what needs to change so the mentor can strengthen the review and resubmit it without guessing.
                  </p>
                  <div style={{ marginBottom: 6 }}>
                    <FieldLabel
                      label="Return For Edits Note"
                      help={{
                        title: "Return For Edits Note",
                        guidance:
                          "Use this required note to explain exactly what the mentor needs to fix before the review can be approved.",
                        example:
                          "Please explain the yellow rating on Goal 2 and add a clearer next-month plan with measurable steps.",
                      }}
                    />
                  </div>
                  <textarea
                    id={`${review.id}-return-note`}
                    name="chairDecisionNotes"
                    className="input"
                    rows={3}
                    placeholder="Explain what needs to be updated before approval."
                    style={{ marginBottom: 10 }}
                    required
                  />
                  <button type="submit" className="button secondary">
                    Return Review
                  </button>
                </form>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}

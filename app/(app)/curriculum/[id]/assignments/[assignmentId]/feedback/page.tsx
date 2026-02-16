import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { getAssignmentDetail } from "@/lib/assignment-actions";
import Link from "next/link";
import { FeedbackClient } from "./feedback-client";

export default async function InstructorFeedbackPage({
  params,
}: {
  params: Promise<{ id: string; assignmentId: string }>;
}) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");

  const roles = session.user.roles ?? [];
  if (!roles.includes("ADMIN") && !roles.includes("INSTRUCTOR") && !roles.includes("CHAPTER_LEAD")) {
    redirect("/");
  }

  const { id: offeringId, assignmentId } = await params;
  const assignment = await getAssignmentDetail(assignmentId);

  if (!assignment || assignment.offeringId !== offeringId) redirect(`/curriculum/${offeringId}/assignments`);

  const submissions = assignment.submissions.filter((s) => s.status !== "NOT_STARTED");
  const needsFeedback = submissions.filter((s) => s.status === "SUBMITTED");
  const alreadyReviewed = submissions.filter((s) => s.status === "FEEDBACK_GIVEN");

  return (
    <div>
      <div className="topbar">
        <div>
          <Link href={`/curriculum/${offeringId}/assignments/${assignmentId}`} style={{ fontSize: 13, color: "var(--ypp-purple)" }}>
            &larr; {assignment.title}
          </Link>
          <h1 className="page-title" style={{ marginTop: 4 }}>Give Feedback</h1>
        </div>
      </div>

      {/* Feedback Philosophy */}
      <div className="card" style={{ marginBottom: 24, background: "#f0fdf4", borderLeft: "4px solid #16a34a" }}>
        <div style={{ fontWeight: 600, color: "#16a34a" }}>Celebrate Effort & Exploration</div>
        <p style={{ marginTop: 4, fontSize: 14, color: "var(--text-secondary)" }}>
          Focus on what the student did well first. Be specific with praise. Offer gentle suggestions
          framed as &quot;next time, try...&quot; rather than criticism. Remember: learning is the goal, not perfection!
        </p>
      </div>

      {/* Stats */}
      <div className="grid three" style={{ marginBottom: 24 }}>
        <div className="card">
          <div style={{ fontSize: 28, fontWeight: 700, color: "var(--ypp-purple)" }}>{submissions.length}</div>
          <div style={{ fontSize: 14, color: "var(--text-secondary)" }}>Total Submissions</div>
        </div>
        <div className="card">
          <div style={{ fontSize: 28, fontWeight: 700, color: "#f59e0b" }}>{needsFeedback.length}</div>
          <div style={{ fontSize: 14, color: "var(--text-secondary)" }}>Needs Feedback</div>
        </div>
        <div className="card">
          <div style={{ fontSize: 28, fontWeight: 700, color: "#16a34a" }}>{alreadyReviewed.length}</div>
          <div style={{ fontSize: 14, color: "var(--text-secondary)" }}>Reviewed</div>
        </div>
      </div>

      {/* Enjoyment Insights */}
      {submissions.length > 0 && (
        <div className="card" style={{ marginBottom: 24 }}>
          <h3>Student Enjoyment Insights</h3>
          <div style={{ marginTop: 12, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            <div>
              <div style={{ fontSize: 13, color: "var(--text-secondary)" }}>Average Enjoyment</div>
              <div style={{ fontSize: 24, fontWeight: 700, color: "var(--ypp-purple)" }}>
                {submissions.filter((s) => s.enjoymentRating).length > 0
                  ? (submissions.reduce((sum, s) => sum + (s.enjoymentRating || 0), 0) /
                      submissions.filter((s) => s.enjoymentRating).length).toFixed(1)
                  : "—"} / 5
              </div>
            </div>
            <div>
              <div style={{ fontSize: 13, color: "var(--text-secondary)" }}>Would Recommend</div>
              <div style={{ fontSize: 24, fontWeight: 700, color: "var(--ypp-purple)" }}>
                {submissions.filter((s) => s.wouldRecommend !== null).length > 0
                  ? Math.round(
                      (submissions.filter((s) => s.wouldRecommend === true).length /
                        submissions.filter((s) => s.wouldRecommend !== null).length) *
                        100
                    )
                  : "—"}%
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Submissions needing feedback */}
      {needsFeedback.length > 0 && (
        <div style={{ marginBottom: 32 }}>
          <div className="section-title">Needs Your Feedback ({needsFeedback.length})</div>
          {needsFeedback.map((sub) => (
            <div key={sub.id} className="card" style={{ marginBottom: 16 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start" }}>
                <div>
                  <h4>{sub.student.name}</h4>
                  <div style={{ fontSize: 13, color: "var(--text-secondary)" }}>
                    Submitted {sub.submittedAt ? new Date(sub.submittedAt).toLocaleString() : ""}
                    {sub.group && ` | Group: ${sub.group.groupName}`}
                  </div>
                </div>
                {sub.enjoymentRating && (
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>Enjoyment</div>
                    <div>{"★".repeat(sub.enjoymentRating)}{"☆".repeat(5 - sub.enjoymentRating)}</div>
                  </div>
                )}
              </div>

              {/* Student's work */}
              {sub.workUrl && (
                <div style={{ marginTop: 8 }}>
                  <a href={sub.workUrl} target="_blank" rel="noopener noreferrer" style={{ color: "var(--ypp-purple)", fontSize: 14 }}>
                    View Student&apos;s Work
                  </a>
                </div>
              )}
              {sub.workText && (
                <div style={{ marginTop: 8, padding: 12, background: "var(--surface-alt)", borderRadius: "var(--radius-sm)", fontSize: 14, whiteSpace: "pre-wrap" }}>
                  {sub.workText.slice(0, 300)}
                  {sub.workText.length > 300 && "..."}
                </div>
              )}

              {/* Student's reflection */}
              {sub.studentReflection && (
                <div style={{ marginTop: 12 }}>
                  <strong style={{ fontSize: 13 }}>Student&apos;s Reflection:</strong>
                  <p style={{ fontSize: 13, color: "var(--text-secondary)", marginTop: 4, fontStyle: "italic" }}>
                    &quot;{sub.studentReflection}&quot;
                  </p>
                </div>
              )}

              {/* Feedback Form */}
              <FeedbackClient submissionId={sub.id} offeringId={offeringId} assignmentId={assignmentId} />
            </div>
          ))}
        </div>
      )}

      {/* Already reviewed */}
      {alreadyReviewed.length > 0 && (
        <div>
          <div className="section-title">Reviewed ({alreadyReviewed.length})</div>
          {alreadyReviewed.map((sub) => (
            <div key={sub.id} className="card" style={{ marginBottom: 12 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <strong>{sub.student.name}</strong>
                  <span style={{ marginLeft: 8, fontSize: 13, color: "#16a34a" }}>Feedback given</span>
                </div>
                {sub.completionBadge && (
                  <span className="pill" style={{ background: "#f0fdf4", color: "#16a34a", fontSize: 11 }}>
                    Badge Awarded
                  </span>
                )}
              </div>
              {sub.celebratoryNote && (
                <div style={{ marginTop: 4, fontSize: 13, color: "var(--text-secondary)", fontStyle: "italic" }}>
                  &quot;{sub.celebratoryNote}&quot;
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {submissions.length === 0 && (
        <div className="card">
          <h3>No Submissions Yet</h3>
          <p style={{ color: "var(--text-secondary)" }}>
            Students haven&apos;t submitted work for this assignment yet.
          </p>
        </div>
      )}
    </div>
  );
}

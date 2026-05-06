type ReviewerFeedbackCardProps = {
  applicantFeedback: string | null | undefined;
  reviewedAt: string | null;
};

/**
 * Tiny presentational card that surfaces the latest committed reviewer
 * feedback to the applicant. Kept separate from the main page so we can
 * reuse the same look on the design + library + review subpages.
 */
export function ReviewerFeedbackCard({
  applicantFeedback,
  reviewedAt,
}: ReviewerFeedbackCardProps) {
  if (!applicantFeedback) return null;
  return (
    <div
      style={{
        marginTop: 16,
        padding: 12,
        borderRadius: 10,
        background: "#f5f3ff",
        border: "1px solid #c4b5fd",
      }}
    >
      <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: "#5b21b6" }}>
        Reviewer feedback
      </p>
      <p style={{ margin: "6px 0 0", fontSize: 14, color: "#4c1d95", lineHeight: 1.55 }}>
        {applicantFeedback}
      </p>
      {reviewedAt ? (
        <p style={{ margin: "6px 0 0", fontSize: 11, color: "#6d28d9" }}>
          Sent {new Date(reviewedAt).toLocaleString()}
        </p>
      ) : null}
    </div>
  );
}

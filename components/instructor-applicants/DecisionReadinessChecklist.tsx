"use client";

interface Props {
  hasReviewerNote: boolean;
  hasInterviewReview: boolean;
  hasBothMaterials: boolean;
  hasSubjects: boolean;
}

function CheckItem({ label, ok }: { label: string; ok: boolean }) {
  return (
    <div
      role="listitem"
      style={{ display: "flex", alignItems: "center", gap: 10, padding: "6px 0" }}
    >
      <span
        aria-hidden="true"
        style={{ fontSize: 16, color: ok ? "#16a34a" : "#d97706", flexShrink: 0 }}
      >
        {ok ? "✓" : "–"}
      </span>
      <span
        aria-label={`${label}: ${ok ? "complete" : "incomplete"}`}
        style={{ fontSize: 13, color: ok ? "#166534" : "#b45309" }}
      >
        {label}
      </span>
    </div>
  );
}

export default function DecisionReadinessChecklist({
  hasReviewerNote,
  hasInterviewReview,
  hasBothMaterials,
  hasSubjects,
}: Props) {
  const allReady = hasReviewerNote && hasInterviewReview && hasSubjects;

  return (
    <div
      aria-label={`Decision readiness: ${allReady ? "all checks passed" : "some checks incomplete"}`}
      style={{
        padding: "14px 16px",
        background: allReady ? "#f0fdf4" : "#fffbeb",
        border: `1px solid ${allReady ? "#bbf7d0" : "#fde68a"}`,
        borderRadius: 8,
        marginBottom: 20,
      }}
    >
      <p style={{ margin: "0 0 8px", fontSize: 13, fontWeight: 700, color: "var(--muted)" }} aria-hidden="true">
        Decision Readiness {allReady ? "✓" : "(informational — decision not blocked)"}
      </p>
      <div role="list">
        <CheckItem label="Reviewer note present" ok={hasReviewerNote} />
        <CheckItem label="≥1 submitted interview review" ok={hasInterviewReview} />
        <CheckItem label="Materials uploaded (soft warning only)" ok={hasBothMaterials} />
        <CheckItem label="Subjects of interest declared" ok={hasSubjects} />
      </div>
    </div>
  );
}

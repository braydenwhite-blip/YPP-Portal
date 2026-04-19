"use client";

interface Props {
  hasReviewerNote: boolean;
  hasInterviewReview: boolean;
  hasBothMaterials: boolean;
  hasSubjects: boolean;
}

function CheckItem({ label, ok }: { label: string; ok: boolean }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "6px 0" }}>
      <span style={{ fontSize: 16, color: ok ? "#16a34a" : "#d97706", flexShrink: 0 }}>
        {ok ? "✓" : "–"}
      </span>
      <span style={{ fontSize: 13, color: ok ? "#166534" : "#b45309" }}>{label}</span>
    </div>
  );
}

export default function DecisionReadinessChecklist({
  hasReviewerNote,
  hasInterviewReview,
  hasBothMaterials,
  hasSubjects,
}: Props) {
  const allReady = hasReviewerNote && hasInterviewReview && hasBothMaterials && hasSubjects;

  return (
    <div
      style={{
        padding: "14px 16px",
        background: allReady ? "#f0fdf4" : "#fffbeb",
        border: `1px solid ${allReady ? "#bbf7d0" : "#fde68a"}`,
        borderRadius: 8,
        marginBottom: 20,
      }}
    >
      <p style={{ margin: "0 0 8px", fontSize: 13, fontWeight: 700, color: "var(--muted)" }}>
        Decision Readiness {allReady ? "✓" : "(informational — decision not blocked)"}
      </p>
      <CheckItem label="Reviewer note present" ok={hasReviewerNote} />
      <CheckItem label="≥1 submitted interview review" ok={hasInterviewReview} />
      <CheckItem label="Both materials uploaded (Course Outline + First Class Plan)" ok={hasBothMaterials} />
      <CheckItem label="Subjects of interest declared" ok={hasSubjects} />
    </div>
  );
}

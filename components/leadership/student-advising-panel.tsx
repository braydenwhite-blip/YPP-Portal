// Student-facing advising panel — shows the student's advisor, advising
// status, next steps, and recommended opportunities on their profile.
// Server component; read-only (the advisor acts from /my-advisees).

import Link from "next/link";
import { loadStudentAdvisingPanel } from "@/lib/leadership/queries";
import { RECOMMENDATION_KIND_LABELS, type RecommendationKind } from "@/lib/leadership/constants";
import { AdvisingStatusPill, formatLeadershipDate } from "./ui";

export async function StudentAdvisingPanel({
  studentId,
  showEmptyState = false,
}: {
  studentId: string;
  /** When false (default) the panel renders nothing if no advisor is assigned. */
  showEmptyState?: boolean;
}) {
  const assignment = await loadStudentAdvisingPanel(studentId);

  if (!assignment) {
    if (!showEmptyState) return null;
    return (
      <section className="card" style={{ padding: 16 }}>
        <h2 style={{ marginTop: 0, fontSize: 17 }}>Advising</h2>
        <p style={{ fontSize: 13, color: "var(--muted, #6b7280)", margin: 0 }}>
          No advisor assigned yet.
        </p>
      </section>
    );
  }

  const activeRecommendations = assignment.recommendations.filter(
    (rec) => rec.status === "SUGGESTED" || rec.status === "IN_PROGRESS",
  );

  return (
    <section className="card" style={{ padding: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
        <h2 style={{ margin: 0, fontSize: 17 }}>Advising</h2>
        <AdvisingStatusPill status={assignment.advisingStatus} />
      </div>

      <p style={{ fontSize: 13, margin: "8px 0 0" }}>
        <strong>Advisor:</strong> {assignment.advisor.name}
        <span style={{ color: "var(--muted, #6b7280)" }}>
          {" "}
          · since {formatLeadershipDate(assignment.startDate)}
          {assignment.lastCheckInAt
            ? ` · last check-in ${formatLeadershipDate(assignment.lastCheckInAt)}`
            : ""}
        </span>
      </p>

      {assignment.nextSteps && (
        <div style={{ marginTop: 10 }}>
          <strong style={{ fontSize: 13 }}>Next steps</strong>
          <p style={{ fontSize: 13, margin: "4px 0 0", whiteSpace: "pre-wrap" }}>{assignment.nextSteps}</p>
        </div>
      )}

      {activeRecommendations.length > 0 && (
        <div style={{ marginTop: 10 }}>
          <strong style={{ fontSize: 13 }}>Recommended opportunities</strong>
          <ul style={{ margin: "4px 0 0", paddingLeft: 18, fontSize: 13, display: "grid", gap: 4 }}>
            {activeRecommendations.map((rec) => (
              <li key={rec.id}>
                <span className="pill pill-small pill-info" style={{ marginRight: 6 }}>
                  {RECOMMENDATION_KIND_LABELS[rec.kind as RecommendationKind] ?? rec.kind}
                </span>
                {rec.href ? <Link href={rec.href}>{rec.title}</Link> : rec.title}
                {rec.detail ? (
                  <span style={{ color: "var(--muted, #6b7280)" }}> — {rec.detail}</span>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

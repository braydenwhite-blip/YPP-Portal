import type { TrainingEvidence } from "@/lib/training-evidence";

/**
 * Reviewer-facing training evidence card. Display-only (server-renderable) so
 * it can drop into the admin / chapter-president per-instructor readiness
 * panels. Surfaces the same 5 GOALS the portal reviews against: per-GOAL pass +
 * score, the journey topics a learner struggled with, and the latest Studio
 * rubric.
 *
 * Tokens only — no raw status hex sprinkled inline beyond the small set of
 * semantic accents shared with the rest of the readiness surfaces.
 */

const GOAL_STATUS_ACCENT: Record<TrainingEvidence["goals"][number]["status"], string> = {
  COMPLETE: "#16a34a",
  IN_PROGRESS: "#6366f1",
  NOT_STARTED: "var(--muted)",
};

function rubricScoreTotal(scores: Record<string, number>): number {
  return Object.values(scores).reduce((sum, n) => sum + (Number.isFinite(n) ? n : 0), 0);
}

export default function TrainingEvidenceCard({
  evidence,
}: {
  evidence: TrainingEvidence;
}) {
  const { goals, topicsToProbe, studioRubric, academyComplete } = evidence;

  return (
    <div
      style={{
        marginTop: 10,
        border: "1px solid var(--border)",
        borderRadius: 10,
        padding: 12,
        background: "var(--surface-alt, #fafafa)",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 8,
          marginBottom: 8,
        }}
      >
        <p style={{ margin: 0, fontSize: 12, fontWeight: 700, letterSpacing: 0.2 }}>
          Training evidence · 5 GOALS
        </p>
        <span
          className="pill pill-small"
          style={{
            color: academyComplete ? "#166534" : "var(--muted)",
          }}
        >
          {academyComplete ? "Academy complete" : "Academy in progress"}
        </span>
      </div>

      {/* Per-GOAL pass / score chips */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
        {goals.map((goal) => {
          const accent = GOAL_STATUS_ACCENT[goal.status];
          const label = goal.badge || goal.title;
          const scoreSuffix =
            goal.scorePct !== null
              ? ` · ${goal.scorePct}%${goal.passed === false ? " ✗" : ""}`
              : "";
          return (
            <span
              key={goal.goalKey}
              title={`${goal.title} — ${goal.status.replace(/_/g, " ").toLowerCase()}`}
              style={{
                fontSize: 11,
                fontWeight: 600,
                padding: "2px 8px",
                borderRadius: 999,
                border: `1px solid ${accent}`,
                color: accent,
                whiteSpace: "nowrap",
              }}
            >
              {label}
              {goal.status === "COMPLETE" ? " ✓" : ""}
              {scoreSuffix}
            </span>
          );
        })}
      </div>

      {/* Topics to probe */}
      {topicsToProbe.length > 0 ? (
        <div style={{ marginTop: 10 }}>
          <p style={{ margin: "0 0 4px", fontSize: 11, fontWeight: 600, color: "var(--muted)" }}>
            Topics to probe
          </p>
          <ul style={{ margin: 0, paddingLeft: 16, fontSize: 12 }}>
            {topicsToProbe.map((topic) => (
              <li key={`${topic.goalBadge}-${topic.beatTitle}`} style={{ marginBottom: 2 }}>
                {topic.goalBadge ? (
                  <span style={{ color: "var(--muted)" }}>{topic.goalBadge}: </span>
                ) : null}
                {topic.beatTitle}{" "}
                <span style={{ color: "var(--muted)" }}>
                  ({topic.everCorrect
                    ? `${topic.attempts} tries`
                    : "not yet correct"})
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {/* Studio rubric */}
      {studioRubric ? (
        <div style={{ marginTop: 10 }}>
          <p style={{ margin: "0 0 4px", fontSize: 11, fontWeight: 600, color: "var(--muted)" }}>
            Lesson Design Studio rubric · {studioRubric.status.replace(/_/g, " ").toLowerCase()}
          </p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, fontSize: 11 }}>
            <span className="pill pill-small">Clarity {studioRubric.rubric.scores.clarity}/4</span>
            <span className="pill pill-small">Sequencing {studioRubric.rubric.scores.sequencing}/4</span>
            <span className="pill pill-small">
              Student exp {studioRubric.rubric.scores.studentExperience}/4
            </span>
            <span className="pill pill-small">
              Launch {studioRubric.rubric.scores.launchReadiness}/4
            </span>
            <span className="pill pill-small">
              Total {rubricScoreTotal(studioRubric.rubric.scores)}/16
            </span>
          </div>
          {studioRubric.rubric.summary.trim() ? (
            <p style={{ margin: "6px 0 0", fontSize: 12 }}>{studioRubric.rubric.summary}</p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

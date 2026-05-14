import {
  LEADERSHIP_GOALS,
  LEADERSHIP_STAGES,
  LeadershipStageId,
} from "@/lib/leadership-pathway";

interface ExpectationsMatrixProps {
  highlightStageId?: LeadershipStageId | null;
}

type RubricStage = "INSTRUCTOR" | "SENIOR_INSTRUCTOR" | "LEAD_INSTRUCTOR";

const RUBRIC_STAGES: RubricStage[] = [
  "INSTRUCTOR",
  "SENIOR_INSTRUCTOR",
  "LEAD_INSTRUCTOR",
];

/**
 * The five-goal × three-stage rubric, rendered as a typographic table
 * with subtle column tinting for the current stage. No per-cell card
 * chrome, no per-stage colored backgrounds — just rows, columns, and
 * the right amount of contrast to skim.
 */
export function ExpectationsMatrix({
  highlightStageId,
}: ExpectationsMatrixProps) {
  const focusStage: RubricStage =
    highlightStageId === "SENIOR_INSTRUCTOR"
      ? "SENIOR_INSTRUCTOR"
      : highlightStageId === "LEAD_INSTRUCTOR" ||
          highlightStageId === "ORGANIZATIONAL_LEADERSHIP"
        ? "LEAD_INSTRUCTOR"
        : "INSTRUCTOR";

  return (
    <div
      style={{
        background: "var(--surface)",
        border: "1px solid var(--border)",
        overflowX: "auto",
      }}
    >
      <table
        style={{
          width: "100%",
          minWidth: 720,
          borderCollapse: "collapse",
          fontSize: 13,
          lineHeight: 1.55,
        }}
      >
        <thead>
          <tr>
            <th
              style={{
                width: "22%",
                textAlign: "left",
                padding: "14px 16px 12px",
                borderBottom: "1px solid var(--border)",
                fontSize: 11,
                fontWeight: 600,
                letterSpacing: "0.06em",
                textTransform: "uppercase",
                color: "var(--muted)",
                verticalAlign: "bottom",
              }}
            >
              Growth area
            </th>
            {RUBRIC_STAGES.map((sid) => {
              const stage = LEADERSHIP_STAGES[sid];
              const isFocus = sid === focusStage;
              return (
                <th
                  key={sid}
                  scope="col"
                  style={{
                    textAlign: "left",
                    padding: "14px 16px 12px",
                    borderBottom: "1px solid var(--border)",
                    verticalAlign: "bottom",
                    background: isFocus ? "var(--bg-2, #faf7ff)" : "transparent",
                    width: "26%",
                  }}
                >
                  <div
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 6,
                      fontSize: 12,
                      fontWeight: 700,
                      color: "var(--text)",
                    }}
                  >
                    <span
                      aria-hidden
                      style={{
                        display: "inline-block",
                        width: 8,
                        height: 8,
                        borderRadius: "50%",
                        background: stage.color.accent,
                      }}
                    />
                    {stage.label}
                  </div>
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {LEADERSHIP_GOALS.map((goal, rowIdx) => (
            <tr key={goal.id}>
              <th
                scope="row"
                style={{
                  textAlign: "left",
                  padding: "14px 16px",
                  borderBottom:
                    rowIdx === LEADERSHIP_GOALS.length - 1
                      ? "none"
                      : "1px solid var(--border)",
                  verticalAlign: "top",
                }}
              >
                <div style={{ fontWeight: 600, color: "var(--text)" }}>
                  {goal.title}
                </div>
                <div
                  style={{
                    marginTop: 2,
                    fontSize: 12,
                    color: "var(--muted)",
                    fontWeight: 400,
                  }}
                >
                  {goal.oneLiner}
                </div>
              </th>
              {RUBRIC_STAGES.map((sid) => {
                const isFocus = sid === focusStage;
                const exps = goal.expectations[sid];
                return (
                  <td
                    key={sid}
                    style={{
                      padding: "14px 16px",
                      borderBottom:
                        rowIdx === LEADERSHIP_GOALS.length - 1
                          ? "none"
                          : "1px solid var(--border)",
                      verticalAlign: "top",
                      background: isFocus ? "var(--bg-2, #faf7ff)" : "transparent",
                      color: "var(--text)",
                    }}
                  >
                    <ul
                      style={{
                        margin: 0,
                        paddingLeft: 16,
                        display: "grid",
                        gap: 4,
                      }}
                    >
                      {exps.map((e, i) => (
                        <li key={i}>{e}</li>
                      ))}
                    </ul>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

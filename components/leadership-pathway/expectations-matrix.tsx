import {
  LEADERSHIP_GOALS,
  LEADERSHIP_STAGES,
  LeadershipStageId,
} from "@/lib/leadership-pathway";

interface ExpectationsMatrixProps {
  /** Highlight this stage's column. */
  highlightStageId?: LeadershipStageId | null;
  /** When true, render only the current stage column for tight spaces. */
  singleColumn?: boolean;
}

/**
 * The five-goal × three-stage rubric, rendered as a side-by-side
 * matrix so instructors can see exactly what teaching, family,
 * reliability, community, and growth look like at each role.
 *
 * In single-column mode it collapses to just the current stage —
 * used on the G&R page where we want a focused view.
 */
export function ExpectationsMatrix({
  highlightStageId,
  singleColumn = false,
}: ExpectationsMatrixProps) {
  const focusStage: Exclude<
    LeadershipStageId,
    "WORKSHOP_INSTRUCTOR" | "ORGANIZATIONAL_LEADERSHIP"
  > =
    highlightStageId === "SENIOR_INSTRUCTOR"
      ? "SENIOR_INSTRUCTOR"
      : highlightStageId === "LEAD_INSTRUCTOR" ||
          highlightStageId === "ORGANIZATIONAL_LEADERSHIP"
        ? "LEAD_INSTRUCTOR"
        : "INSTRUCTOR";

  const stagesToRender: Array<
    Exclude<
      LeadershipStageId,
      "WORKSHOP_INSTRUCTOR" | "ORGANIZATIONAL_LEADERSHIP"
    >
  > = singleColumn
    ? [focusStage]
    : ["INSTRUCTOR", "SENIOR_INSTRUCTOR", "LEAD_INSTRUCTOR"];

  return (
    <div
      style={{
        display: "grid",
        gap: 12,
      }}
    >
      <div
        style={{
          display: "grid",
          gridTemplateColumns: singleColumn
            ? "minmax(160px, 220px) 1fr"
            : `minmax(180px, 240px) repeat(${stagesToRender.length}, minmax(220px, 1fr))`,
          gap: 12,
          alignItems: "stretch",
        }}
      >
        {/* Header row */}
        <div />
        {stagesToRender.map((sid) => {
          const stage = LEADERSHIP_STAGES[sid];
          const isFocus = sid === focusStage;
          return (
            <div
              key={sid}
              style={{
                padding: "10px 12px",
                borderRadius: 10,
                background: isFocus ? stage.color.bg : "var(--surface)",
                border: isFocus
                  ? `1.5px solid ${stage.color.border}`
                  : "1px solid var(--border)",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  fontSize: 11,
                  fontWeight: 700,
                  letterSpacing: "0.06em",
                  textTransform: "uppercase",
                  color: stage.color.text,
                  opacity: isFocus ? 1 : 0.85,
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
              <div
                style={{
                  fontSize: 12,
                  color: "var(--muted)",
                  marginTop: 2,
                  lineHeight: 1.4,
                }}
              >
                {stage.tagline}
              </div>
            </div>
          );
        })}

        {/* Goal rows */}
        {LEADERSHIP_GOALS.map((goal) => (
          <ExpectationsMatrixRow
            key={goal.id}
            goal={goal}
            stagesToRender={stagesToRender}
            focusStage={focusStage}
          />
        ))}
      </div>
    </div>
  );
}

interface RowProps {
  goal: (typeof LEADERSHIP_GOALS)[number];
  stagesToRender: Array<
    Exclude<
      LeadershipStageId,
      "WORKSHOP_INSTRUCTOR" | "ORGANIZATIONAL_LEADERSHIP"
    >
  >;
  focusStage: Exclude<
    LeadershipStageId,
    "WORKSHOP_INSTRUCTOR" | "ORGANIZATIONAL_LEADERSHIP"
  >;
}

function ExpectationsMatrixRow({ goal, stagesToRender, focusStage }: RowProps) {
  return (
    <>
      <div
        style={{
          padding: "12px 14px",
          background: "var(--surface)",
          border: "1px solid var(--border)",
          borderRadius: 10,
          display: "flex",
          flexDirection: "column",
          gap: 4,
        }}
      >
        <div
          style={{
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: "0.06em",
            textTransform: "uppercase",
            color: "var(--muted)",
          }}
        >
          Goal {goal.number}
        </div>
        <div
          style={{ fontSize: 14, fontWeight: 700, color: "var(--text)" }}
        >
          {goal.title}
        </div>
        <div
          style={{
            fontSize: 12,
            color: "var(--muted)",
            lineHeight: 1.4,
          }}
        >
          {goal.oneLiner}
        </div>
      </div>

      {stagesToRender.map((sid) => {
        const stage = LEADERSHIP_STAGES[sid];
        const expectations = goal.expectations[sid];
        const isFocus = sid === focusStage;
        return (
          <div
            key={sid}
            style={{
              padding: "12px 14px",
              borderRadius: 10,
              background: isFocus ? stage.color.bg : "var(--surface)",
              border: isFocus
                ? `1.5px solid ${stage.color.border}`
                : "1px solid var(--border)",
            }}
          >
            <ul
              style={{
                margin: 0,
                paddingLeft: 16,
                fontSize: 13,
                lineHeight: 1.55,
                color: isFocus ? stage.color.text : "var(--text)",
                display: "grid",
                gap: 4,
              }}
            >
              {expectations.map((exp, i) => (
                <li key={i}>{exp}</li>
              ))}
            </ul>
          </div>
        );
      })}
    </>
  );
}

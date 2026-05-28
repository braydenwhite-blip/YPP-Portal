/**
 * Goal trajectory — renders each goal's rating arc across review cycles as a
 * sequence of colored dots. Pure presentational; no data fetching.
 */

import { getGoalRatingCopy } from "@/lib/mentorship-rubric-copy";

const RATING_RANK: Record<string, number> = {
  BEHIND_SCHEDULE: 1,
  GETTING_STARTED: 2,
  ACHIEVED: 3,
  ABOVE_AND_BEYOND: 4,
};

export type TrajectoryPoint = { label: string; rating: string };
export type TrajectoryGoal = { title: string; points: TrajectoryPoint[] };

function trend(points: TrajectoryPoint[]): "up" | "down" | "flat" {
  const ranked = points.map((p) => RATING_RANK[p.rating] ?? 0).filter(Boolean);
  if (ranked.length < 2) return "flat";
  const delta = ranked[ranked.length - 1] - ranked[0];
  if (delta > 0) return "up";
  if (delta < 0) return "down";
  return "flat";
}

const TREND_META = {
  up: { glyph: "↗", color: "#16a34a", label: "Improving" },
  down: { glyph: "↘", color: "#dc2626", label: "Slipping" },
  flat: { glyph: "→", color: "var(--muted)", label: "Holding" },
} as const;

export function GoalTrajectory({ goals }: { goals: TrajectoryGoal[] }) {
  if (goals.length === 0) return null;

  return (
    <div
      style={{
        background: "var(--surface)",
        border: "1px solid var(--border)",
        padding: "20px 22px",
        display: "grid",
        gap: 16,
      }}
    >
      <div>
        <h3
          style={{
            margin: 0,
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            color: "var(--muted)",
          }}
        >
          Goal trajectory
        </h3>
        <p style={{ margin: "4px 0 0", fontSize: 12, color: "var(--muted)" }}>
          How each goal&apos;s rating has moved across your recent reviews — oldest to newest.
        </p>
      </div>

      <div style={{ display: "grid", gap: 14 }}>
        {goals.map((goal) => {
          const dir = trend(goal.points);
          const tm = TREND_META[dir];
          return (
            <div key={goal.title}>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  gap: 10,
                  alignItems: "baseline",
                  flexWrap: "wrap",
                }}
              >
                <span style={{ fontWeight: 600, fontSize: 14 }}>{goal.title}</span>
                <span style={{ fontSize: 12, color: tm.color, fontWeight: 600 }}>
                  {tm.glyph} {tm.label}
                </span>
              </div>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  marginTop: 8,
                  flexWrap: "wrap",
                }}
              >
                {goal.points.map((point, i) => {
                  const meta = getGoalRatingCopy(point.rating);
                  return (
                    <div
                      key={`${point.label}-${i}`}
                      style={{ display: "flex", alignItems: "center", gap: 6 }}
                    >
                      {i > 0 && (
                        <span
                          aria-hidden
                          style={{ width: 14, height: 2, background: "var(--border)" }}
                        />
                      )}
                      <span
                        title={`${point.label}: ${meta.label}`}
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 6,
                          padding: "3px 9px",
                          borderRadius: 999,
                          background: meta.background,
                          color: meta.color,
                          fontSize: 11,
                          fontWeight: 600,
                          whiteSpace: "nowrap",
                        }}
                      >
                        <span
                          aria-hidden
                          style={{
                            width: 8,
                            height: 8,
                            borderRadius: "50%",
                            background: meta.color,
                          }}
                        />
                        {point.label}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

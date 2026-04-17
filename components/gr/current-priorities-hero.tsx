"use client";

import RatingBadge from "./rating-badge";
import ProgressStateChip from "./progress-state-chip";

type GoalRatingColor = "BEHIND_SCHEDULE" | "GETTING_STARTED" | "ACHIEVED" | "ABOVE_AND_BEYOND";
type GoalProgressState = "NOT_STARTED" | "IN_PROGRESS" | "DONE" | "BLOCKED";
type GoalPriority = "LOW" | "NORMAL" | "HIGH" | "CRITICAL";

interface PriorityGoal {
  id: string;
  title: string;
  description: string;
  priority: GoalPriority;
  dueDate: string | null;
  progressState: GoalProgressState;
  isOverdue: boolean;
  isDueSoon: boolean;
  rating?: GoalRatingColor | null;
}

interface CurrentPrioritiesHeroProps {
  goals: PriorityGoal[];
}

const PRIORITY_LABEL: Record<GoalPriority, string> = {
  CRITICAL: "Critical",
  HIGH: "High",
  NORMAL: "Normal",
  LOW: "Low",
};

const PRIORITY_DOT: Record<GoalPriority, string> = {
  CRITICAL: "#ef4444",
  HIGH: "#f97316",
  NORMAL: "#6b7280",
  LOW: "#9ca3af",
};

export default function CurrentPrioritiesHero({ goals }: CurrentPrioritiesHeroProps) {
  if (goals.length === 0) {
    return (
      <div className="card" style={{ padding: "1.5rem", textAlign: "center" }}>
        <p style={{ color: "var(--muted)", fontSize: "0.95rem" }}>
          No active priority goals right now. Check back after your next monthly review.
        </p>
      </div>
    );
  }

  return (
    <div className="card" style={{ padding: "1.5rem" }}>
      <h2 style={{ fontSize: "1.1rem", marginBottom: "1rem", display: "flex", alignItems: "center", gap: "0.5rem" }}>
        Current Priorities
        <span className="badge" style={{ background: "var(--ypp-purple-100, #f3e8ff)", color: "var(--ypp-purple-700, #6b21a8)", fontSize: "0.7rem" }}>
          {goals.length} active
        </span>
      </h2>

      <div style={{ display: "grid", gap: "0.75rem" }}>
        {goals.map((goal) => (
          <div
            key={goal.id}
            style={{
              display: "flex",
              gap: "1rem",
              alignItems: "flex-start",
              padding: "0.9rem 1rem",
              borderRadius: "var(--radius-sm, 6px)",
              border: goal.isOverdue
                ? "1px solid #fecaca"
                : goal.isDueSoon
                ? "1px solid #fde68a"
                : "1px solid var(--border)",
              background: goal.isOverdue
                ? "#fff5f5"
                : goal.isDueSoon
                ? "#fffbeb"
                : "var(--surface)",
            }}
          >
            {/* Priority indicator */}
            <span
              style={{
                width: 8,
                height: 8,
                borderRadius: "50%",
                background: PRIORITY_DOT[goal.priority],
                flexShrink: 0,
                marginTop: "0.45rem",
              }}
              title={`${PRIORITY_LABEL[goal.priority]} priority`}
            />

            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "0.4rem", alignItems: "center", marginBottom: "0.25rem" }}>
                <strong style={{ fontSize: "0.95rem" }}>{goal.title}</strong>
                <ProgressStateChip state={goal.progressState} />
                {goal.rating && <RatingBadge rating={goal.rating} />}
              </div>

              {goal.description && (
                <p style={{ fontSize: "0.85rem", color: "var(--muted)", margin: 0, lineHeight: 1.5 }}>
                  {goal.description.length > 120 ? goal.description.slice(0, 117) + "…" : goal.description}
                </p>
              )}

              {goal.dueDate && (
                <p
                  style={{
                    fontSize: "0.78rem",
                    marginTop: "0.35rem",
                    fontWeight: 500,
                    color: goal.isOverdue ? "#b91c1c" : goal.isDueSoon ? "#92400e" : "var(--muted)",
                  }}
                >
                  {goal.isOverdue
                    ? `Overdue · ${new Date(goal.dueDate).toLocaleDateString()}`
                    : goal.isDueSoon
                    ? `Due soon · ${new Date(goal.dueDate).toLocaleDateString()}`
                    : `Due ${new Date(goal.dueDate).toLocaleDateString()}`}
                </p>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

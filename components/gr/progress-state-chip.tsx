"use client";

type GoalProgressState = "NOT_STARTED" | "IN_PROGRESS" | "DONE" | "BLOCKED";

const STATE_CONFIG: Record<GoalProgressState, { label: string; bg: string; color: string }> = {
  NOT_STARTED: { label: "Not Started", bg: "#f1f5f9", color: "#64748b" },
  IN_PROGRESS: { label: "In Progress", bg: "#dbeafe", color: "#1d4ed8" },
  DONE:        { label: "Done",        bg: "#dcfce7", color: "#166534" },
  BLOCKED:     { label: "Blocked",     bg: "#fee2e2", color: "#991b1b" },
};

interface ProgressStateChipProps {
  state: GoalProgressState;
  size?: "sm" | "md";
}

export default function ProgressStateChip({ state, size = "sm" }: ProgressStateChipProps) {
  const cfg = STATE_CONFIG[state] ?? STATE_CONFIG.NOT_STARTED;
  const fontSize = size === "md" ? "0.8rem" : "0.7rem";
  const padding = size === "md" ? "0.25rem 0.65rem" : "0.15rem 0.45rem";

  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        background: cfg.bg,
        color: cfg.color,
        borderRadius: "4px",
        padding,
        fontSize,
        fontWeight: 500,
        whiteSpace: "nowrap",
      }}
    >
      {cfg.label}
    </span>
  );
}

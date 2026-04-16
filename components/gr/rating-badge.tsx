"use client";

type GoalRatingColor = "BEHIND_SCHEDULE" | "GETTING_STARTED" | "ACHIEVED" | "ABOVE_AND_BEYOND";

const RATING_CONFIG: Record<GoalRatingColor, { label: string; bg: string; color: string; dot: string }> = {
  BEHIND_SCHEDULE: { label: "Behind", bg: "#fee2e2", color: "#991b1b", dot: "#ef4444" },
  GETTING_STARTED: { label: "Getting Started", bg: "#fef9c3", color: "#854d0e", dot: "#eab308" },
  ACHIEVED: { label: "On Track", bg: "#dcfce7", color: "#166534", dot: "#22c55e" },
  ABOVE_AND_BEYOND: { label: "Above & Beyond", bg: "#f3e8ff", color: "#6b21a8", dot: "#a855f7" },
};

interface RatingBadgeProps {
  rating: GoalRatingColor;
  size?: "sm" | "md";
  showDot?: boolean;
}

export default function RatingBadge({ rating, size = "sm", showDot = true }: RatingBadgeProps) {
  const cfg = RATING_CONFIG[rating] ?? RATING_CONFIG.GETTING_STARTED;
  const fontSize = size === "md" ? "0.85rem" : "0.75rem";
  const padding = size === "md" ? "0.3rem 0.75rem" : "0.2rem 0.5rem";

  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "0.35rem",
        background: cfg.bg,
        color: cfg.color,
        borderRadius: "999px",
        padding,
        fontSize,
        fontWeight: 600,
        whiteSpace: "nowrap",
      }}
    >
      {showDot && (
        <span
          style={{
            width: size === "md" ? "8px" : "6px",
            height: size === "md" ? "8px" : "6px",
            borderRadius: "50%",
            background: cfg.dot,
            flexShrink: 0,
          }}
        />
      )}
      {cfg.label}
    </span>
  );
}

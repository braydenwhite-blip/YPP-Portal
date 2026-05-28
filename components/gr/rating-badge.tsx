"use client";

import { getGoalRatingCopy } from "@/lib/mentorship-rubric-copy";

type GoalRatingColor = "BEHIND_SCHEDULE" | "GETTING_STARTED" | "ACHIEVED" | "ABOVE_AND_BEYOND";

interface RatingBadgeProps {
  rating: GoalRatingColor;
  size?: "sm" | "md";
  showDot?: boolean;
}

export default function RatingBadge({ rating, size = "sm", showDot = true }: RatingBadgeProps) {
  const cfg = getGoalRatingCopy(rating);
  const fontSize = size === "md" ? "0.85rem" : "0.75rem";
  const padding = size === "md" ? "0.3rem 0.75rem" : "0.2rem 0.5rem";

  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "0.35rem",
        background: cfg.background,
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
            background: cfg.color,
            flexShrink: 0,
          }}
        />
      )}
      {cfg.menteeLabel}
    </span>
  );
}

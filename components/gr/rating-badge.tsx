"use client";

import { getGoalRatingCopy, type RatingAudience } from "@/lib/mentorship-rubric-copy";

type GoalRatingColor = "BEHIND_SCHEDULE" | "GETTING_STARTED" | "ACHIEVED" | "ABOVE_AND_BEYOND";

interface RatingBadgeProps {
  rating: GoalRatingColor;
  size?: "sm" | "md";
  showDot?: boolean;
  /**
   * Whose wording to show. Defaults to "mentee" (supportive) for backward
   * compatibility. Use "mentor"/"admin" on operator surfaces for the
   * operational label + description.
   */
  audience?: RatingAudience;
}

export default function RatingBadge({
  rating,
  size = "sm",
  showDot = true,
  audience = "mentee",
}: RatingBadgeProps) {
  const cfg = getGoalRatingCopy(rating);
  const fontSize = size === "md" ? "0.85rem" : "0.75rem";
  const padding = size === "md" ? "0.3rem 0.75rem" : "0.2rem 0.5rem";
  const label = audience === "mentee" ? cfg.menteeLabel : cfg.label;
  const description =
    audience === "mentee"
      ? cfg.menteeDescription
      : audience === "admin"
        ? cfg.adminDescription
        : cfg.mentorDescription;

  return (
    <span
      title={description}
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
      {label}
    </span>
  );
}

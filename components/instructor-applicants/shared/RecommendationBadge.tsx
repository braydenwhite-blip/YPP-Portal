/**
 * Single source of truth for recommendation + sentiment chips.
 *
 * Replaces the ad-hoc REC_COLOR / REC_LABELS maps that previously appeared
 * inside `ChairComparisonSlideout.tsx` and `ChairQueueBoard.tsx`. Always
 * pairs colour with an icon so deuteranopia and high-contrast modes preserve
 * meaning (WCAG 1.4.1 fix from §2.9 of the redesign plan).
 */

import type { InstructorInterviewRecommendation } from "@prisma/client";
import {
  CheckIcon,
  ThumbsUpIcon,
  MinusIcon,
  AlertTriangleIcon,
  XIcon,
} from "@/components/instructor-applicants/final-review/cockpit-icons";

export type SentimentTag = "STRONG_HIRE" | "HIRE" | "MIXED" | "CONCERN" | "REJECT";

export interface RecommendationBadgeProps {
  recommendation?: InstructorInterviewRecommendation | null;
  sentiment?: SentimentTag | null;
  size?: "sm" | "md";
  showIcon?: boolean;
}

interface BadgeSpec {
  label: string;
  bg: string;
  fg: string;
  Icon: (props: { size?: number }) => JSX.Element;
}

const SENTIMENT_SPEC: Record<SentimentTag, BadgeSpec> = {
  STRONG_HIRE: {
    label: "Strong Hire",
    bg: "rgba(22, 163, 74, 0.12)",
    fg: "#15803d",
    Icon: CheckIcon,
  },
  HIRE: {
    label: "Hire",
    bg: "rgba(34, 197, 94, 0.12)",
    fg: "#15803d",
    Icon: ThumbsUpIcon,
  },
  MIXED: {
    label: "Mixed",
    bg: "rgba(234, 179, 8, 0.14)",
    fg: "#a16207",
    Icon: MinusIcon,
  },
  CONCERN: {
    label: "Concern",
    bg: "rgba(249, 115, 22, 0.14)",
    fg: "#c2410c",
    Icon: AlertTriangleIcon,
  },
  REJECT: {
    label: "Reject",
    bg: "rgba(239, 68, 68, 0.14)",
    fg: "#b91c1c",
    Icon: XIcon,
  },
};

const RECOMMENDATION_TO_SENTIMENT: Record<InstructorInterviewRecommendation, SentimentTag> = {
  ACCEPT: "HIRE",
  ACCEPT_WITH_SUPPORT: "MIXED",
  HOLD: "MIXED",
  REJECT: "REJECT",
};

const RECOMMENDATION_LABEL: Record<InstructorInterviewRecommendation, string> = {
  ACCEPT: "Accept",
  ACCEPT_WITH_SUPPORT: "Accept w/ support",
  HOLD: "Hold",
  REJECT: "Reject",
};

export default function RecommendationBadge({
  recommendation,
  sentiment,
  size = "md",
  showIcon = true,
}: RecommendationBadgeProps) {
  const tag: SentimentTag | null =
    sentiment ?? (recommendation ? RECOMMENDATION_TO_SENTIMENT[recommendation] : null);

  if (!tag) {
    return (
      <span
        className="recommendation-badge muted"
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
          padding: size === "sm" ? "2px 8px" : "4px 10px",
          borderRadius: 999,
          background: "rgba(168, 156, 184, 0.18)",
          color: "var(--ink-muted, #6b5f7a)",
          fontSize: size === "sm" ? 11 : 12,
          fontWeight: 500,
          letterSpacing: "0.04em",
          textTransform: "uppercase",
        }}
      >
        Not yet reviewed
      </span>
    );
  }

  const spec = SENTIMENT_SPEC[tag];
  const label = sentiment ? spec.label : recommendation ? RECOMMENDATION_LABEL[recommendation] : spec.label;

  return (
    <span
      className={`recommendation-badge tone-${tag.toLowerCase()}`}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        padding: size === "sm" ? "2px 8px" : "4px 10px",
        borderRadius: 999,
        background: spec.bg,
        color: spec.fg,
        fontSize: size === "sm" ? 11 : 12,
        fontWeight: 600,
        letterSpacing: "0.04em",
        textTransform: "uppercase",
      }}
    >
      {showIcon ? <spec.Icon size={size === "sm" ? 12 : 14} /> : null}
      {label}
    </span>
  );
}

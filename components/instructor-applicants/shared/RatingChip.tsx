/**
 * Renders a `ProgressStatus` rating (the 4-point
 * BEHIND_SCHEDULE → ABOVE_AND_BEYOND scale) as an icon + label + colour chip.
 * Always pairs colour with an icon (WCAG 1.4.1).
 */

import type { ProgressStatus } from "@prisma/client";
import {
  ArrowUpRightIcon,
  ArrowRightIcon,
  MinusIcon,
  ArrowDownLeftIcon,
} from "@/components/instructor-applicants/final-review/cockpit-icons";

export type RatingChipVariant = "solid" | "outline";
export type RatingChipSize = "xs" | "sm" | "md";

export interface RatingChipProps {
  rating: ProgressStatus | null;
  label?: string;
  variant?: RatingChipVariant;
  size?: RatingChipSize;
}

interface RatingSpec {
  label: string;
  short: string;
  bg: string;
  fg: string;
  border: string;
  Icon: (props: { size?: number }) => JSX.Element;
}

const SPEC: Record<ProgressStatus, RatingSpec> = {
  ABOVE_AND_BEYOND: {
    label: "Above and beyond",
    short: "Above",
    bg: "rgba(22, 163, 74, 0.14)",
    fg: "#15803d",
    border: "rgba(22, 163, 74, 0.4)",
    Icon: ArrowUpRightIcon,
  },
  ON_TRACK: {
    label: "On track",
    short: "On",
    bg: "rgba(34, 197, 94, 0.12)",
    fg: "#16a34a",
    border: "rgba(34, 197, 94, 0.34)",
    Icon: ArrowRightIcon,
  },
  GETTING_STARTED: {
    label: "Getting started",
    short: "Mid",
    bg: "rgba(234, 179, 8, 0.14)",
    fg: "#a16207",
    border: "rgba(234, 179, 8, 0.4)",
    Icon: MinusIcon,
  },
  BEHIND_SCHEDULE: {
    label: "Behind schedule",
    short: "Below",
    bg: "rgba(239, 68, 68, 0.14)",
    fg: "#b91c1c",
    border: "rgba(239, 68, 68, 0.4)",
    Icon: ArrowDownLeftIcon,
  },
};

const SIZE_PADDING: Record<RatingChipSize, string> = {
  xs: "1px 6px",
  sm: "2px 8px",
  md: "4px 10px",
};

const SIZE_FONT: Record<RatingChipSize, number> = {
  xs: 10,
  sm: 11,
  md: 12,
};

const SIZE_ICON: Record<RatingChipSize, number> = {
  xs: 11,
  sm: 12,
  md: 14,
};

export default function RatingChip({
  rating,
  label,
  variant = "solid",
  size = "sm",
}: RatingChipProps) {
  if (!rating) {
    return (
      <span
        className="rating-chip rating-empty"
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 4,
          padding: SIZE_PADDING[size],
          borderRadius: 999,
          border: "1px dashed var(--cockpit-line, rgba(71,85,105,0.28))",
          color: "var(--ink-faint, #a89cb8)",
          fontSize: SIZE_FONT[size],
          letterSpacing: "0.04em",
          textTransform: "uppercase",
        }}
      >
        {label ? `${label} —` : "—"}
      </span>
    );
  }

  const spec = SPEC[rating];
  const isOutline = variant === "outline";
  const display = label ?? spec.short;
  return (
    <span
      className={`rating-chip rating-${rating.toLowerCase()} variant-${variant}`}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 4,
        padding: SIZE_PADDING[size],
        borderRadius: 999,
        background: isOutline ? "transparent" : spec.bg,
        color: spec.fg,
        border: isOutline ? `1px solid ${spec.border}` : "1px solid transparent",
        fontSize: SIZE_FONT[size],
        fontWeight: 600,
        letterSpacing: "0.04em",
        textTransform: "uppercase",
      }}
    >
      <spec.Icon size={SIZE_ICON[size]} />
      {display}
    </span>
  );
}

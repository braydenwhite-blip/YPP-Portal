import type { SVGProps } from "react";

import type { QueueItemType, QueueResolution } from "@/lib/queue/types";

/**
 * Inline queue iconography (no new dependencies). 1.6px strokes on currentColor
 * so they inherit tone from the surrounding text/button.
 */

type IconProps = SVGProps<SVGSVGElement>;

const base = {
  width: 18,
  height: 18,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.6,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true,
};

export function CheckCircleIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M9 12l2 2 4-4" />
      <circle cx="12" cy="12" r="9" />
    </svg>
  );
}

export function DelegateIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M16 19a4 4 0 0 0-8 0" />
      <circle cx="12" cy="8" r="3" />
      <path d="M19 14v4M21 16h-4" />
    </svg>
  );
}

export function DiscussIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M21 12a8 8 0 0 1-11.3 7.3L4 21l1.7-5.7A8 8 0 1 1 21 12Z" />
    </svg>
  );
}

export function DeferIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </svg>
  );
}

export function ArrowRightIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M5 12h14M13 6l6 6-6 6" />
    </svg>
  );
}

export function BoltIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M13 2 4.5 13.5H11l-1 8.5L19.5 10.5H13l0-8.5Z" />
    </svg>
  );
}

export function TriageIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M3 6h18M6 12h12M10 18h4" />
    </svg>
  );
}

export function CalendarIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <rect x="3" y="4.5" width="18" height="16" rx="2" />
      <path d="M3 9h18M8 3v3M16 3v3" />
    </svg>
  );
}

export function CloseIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M6 6l12 12M18 6 6 18" />
    </svg>
  );
}

export function SparkleIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8L12 3Z" />
    </svg>
  );
}

export const RESOLUTION_ICON: Record<QueueResolution, (p: IconProps) => JSX.Element> = {
  resolve: CheckCircleIcon,
  delegate: DelegateIcon,
  discuss: DiscussIcon,
  defer: DeferIcon,
};

/** Tone classes per resolution — the calm, premium accent set. */
export const RESOLUTION_STYLE: Record<
  QueueResolution,
  { tile: string; icon: string; label: string }
> = {
  resolve: {
    tile: "border-success-700/20 bg-success-100/50 hover:border-success-700/40 hover:bg-success-100",
    icon: "text-success-700",
    label: "text-success-700",
  },
  delegate: {
    tile: "border-info-700/20 bg-info-100/50 hover:border-info-700/40 hover:bg-info-100",
    icon: "text-info-700",
    label: "text-info-700",
  },
  discuss: {
    tile: "border-brand-400/30 bg-brand-50 hover:border-brand-400/60 hover:bg-brand-100",
    icon: "text-brand-700",
    label: "text-brand-700",
  },
  defer: {
    tile: "border-warning-700/20 bg-warning-100/50 hover:border-warning-700/40 hover:bg-warning-100",
    icon: "text-warning-700",
    label: "text-warning-700",
  },
};

const TYPE_GLYPH: Record<QueueItemType, string> = {
  action: "◆",
  follow_up: "↻",
  meeting: "▦",
  meeting_prep: "▦",
  decision: "✦",
  initiative: "✸",
  partner_request: "⬡",
  partner_follow_up: "⬡",
  advisor_check_in: "◎",
  application: "▤",
  mentorship: "◍",
  class_setup: "▣",
  person: "◐",
};

export function typeGlyph(type: QueueItemType): string {
  return TYPE_GLYPH[type] ?? "◆";
}

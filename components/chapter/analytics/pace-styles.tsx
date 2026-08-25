import type { PaceStatus } from "@/lib/chapters/analytics-pace";
import { PACE_STATUS_LABELS } from "@/lib/chapters/analytics-pace";

/**
 * Pace palette for the analytics heatmap.
 * Soft washes only — status reads from tint + bar, not loud borders.
 */
export const PACE_COLORS: Record<
  PaceStatus,
  {
    wash: string;
    washHover: string;
    bar: string;
    text: string;
    muted: string;
    dot: string;
    /** Legacy aliases used by modal tiles */
    bg: string;
    border: string;
    soft: string;
    ring: string;
  }
> = {
  above: {
    wash: "bg-brand-50",
    washHover: "hover:bg-brand-100",
    bar: "bg-brand-600",
    text: "text-brand-900",
    muted: "text-brand-700/60",
    dot: "bg-brand-600",
    bg: "bg-brand-50",
    border: "border-transparent",
    soft: "bg-surface-soft",
    ring: "focus-visible:ring-brand-400/40",
  },
  on_track: {
    wash: "bg-complete-50",
    washHover: "hover:bg-[#dcefe4]",
    bar: "bg-complete-700",
    text: "text-complete-700",
    muted: "text-complete-700/55",
    dot: "bg-complete-700",
    bg: "bg-complete-50",
    border: "border-transparent",
    soft: "bg-complete-50",
    ring: "focus-visible:ring-complete-700/25",
  },
  needs_attention: {
    wash: "bg-progress-50",
    washHover: "hover:bg-[#f8e6c8]",
    bar: "bg-progress-700",
    text: "text-progress-700",
    muted: "text-progress-700/55",
    dot: "bg-progress-700",
    bg: "bg-progress-50",
    border: "border-transparent",
    soft: "bg-progress-50",
    ring: "focus-visible:ring-progress-700/25",
  },
  at_risk: {
    wash: "bg-blocked-50",
    washHover: "hover:bg-[#f6d9d5]",
    bar: "bg-blocked-700",
    text: "text-blocked-700",
    muted: "text-blocked-700/55",
    dot: "bg-blocked-700",
    bg: "bg-blocked-50",
    border: "border-transparent",
    soft: "bg-blocked-50",
    ring: "focus-visible:ring-blocked-700/25",
  },
};

export function PaceLegend({ compact = false }: { compact?: boolean }) {
  const items = (Object.keys(PACE_STATUS_LABELS) as PaceStatus[]).map((status) => ({
    status,
    label: PACE_STATUS_LABELS[status],
    hint:
      status === "above"
        ? "Ahead of pace"
        : status === "on_track"
          ? "Meeting expected pace"
          : status === "needs_attention"
            ? "Slightly behind pace"
            : "Significantly behind pace",
  }));

  return (
    <div
      className={`flex flex-wrap items-center gap-x-3.5 gap-y-1.5 ${compact ? "text-[11.5px]" : "text-[12.5px]"}`}
    >
      {items.map((item) => (
        <span key={item.status} className="inline-flex items-center gap-1.5 text-ink-muted">
          <span className={`h-2 w-2 rounded-full ${PACE_COLORS[item.status].dot}`} />
          <span className="font-medium text-ink">{item.label}</span>
          {!compact ? <span className="text-ink-muted">({item.hint})</span> : null}
        </span>
      ))}
    </div>
  );
}

export const CATEGORY_ACCENT: Record<string, string> = {
  students: "#3b82f6",
  instructors: "#7c3aed",
  partners: "#f97316",
  quality: "#16a34a",
};

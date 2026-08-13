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
    wash: "bg-[#f3ecff]",
    washHover: "hover:bg-[#ebe0ff]",
    bar: "bg-brand-500",
    text: "text-brand-900",
    muted: "text-brand-700/55",
    dot: "bg-brand-500",
    bg: "bg-[#f3ecff]",
    border: "border-transparent",
    soft: "bg-[#f8f4ff]",
    ring: "focus-visible:ring-brand-400/40",
  },
  on_track: {
    wash: "bg-[#eef8f2]",
    washHover: "hover:bg-[#e4f3ea]",
    bar: "bg-[#2f9e63]",
    text: "text-[#0f5132]",
    muted: "text-[#0f5132]/50",
    dot: "bg-[#2f9e63]",
    bg: "bg-[#eef8f2]",
    border: "border-transparent",
    soft: "bg-[#f5faf7]",
    ring: "focus-visible:ring-[#2f9e63]/30",
  },
  needs_attention: {
    wash: "bg-[#fff6eb]",
    washHover: "hover:bg-[#ffefd9]",
    bar: "bg-[#d97706]",
    text: "text-[#9a3412]",
    muted: "text-[#9a3412]/50",
    dot: "bg-[#d97706]",
    bg: "bg-[#fff6eb]",
    border: "border-transparent",
    soft: "bg-[#fffaf3]",
    ring: "focus-visible:ring-[#d97706]/30",
  },
  at_risk: {
    wash: "bg-[#fdf1f0]",
    washHover: "hover:bg-[#fbe7e5]",
    bar: "bg-[#dc5a4e]",
    text: "text-[#9f2d23]",
    muted: "text-[#9f2d23]/50",
    dot: "bg-[#dc5a4e]",
    bg: "bg-[#fdf1f0]",
    border: "border-transparent",
    soft: "bg-[#fdf7f6]",
    ring: "focus-visible:ring-[#dc5a4e]/30",
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
    <div className={`flex flex-wrap items-center gap-x-4 gap-y-1.5 ${compact ? "text-[11px]" : "text-[12px]"}`}>
      {items.map((item) => (
        <span key={item.status} className="inline-flex items-center gap-1.5 text-[#5b6472]">
          <span className={`h-2 w-2 rounded-sm ${PACE_COLORS[item.status].dot}`} />
          <span className="font-medium text-[#374151]">{item.label}</span>
          {!compact ? <span className="text-[#9aa2b1]">({item.hint})</span> : null}
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

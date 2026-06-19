import Link from "next/link";

import { cn } from "./cn";

/**
 * Click-to-filter stat tile. `href` is required by design (master plan §3):
 * a count that can't be clicked into its filtered list is decoration, and
 * decoration is debt. Use `tone="attention"` only when the count demands
 * action (overdue, blocked) — calm by default.
 *
 * YPP Portal reskin: value-first layout with an optional 3px top accent bar
 * (`accent`) and a `selected` (current filter) state, matching the mockup's
 * stat-filter cards.
 */
const ACCENT: Record<
  NonNullable<StatCardAccent>,
  { bar: string; value: string }
> = {
  danger: { bar: "bg-blocked-700", value: "text-blocked-700" },
  warning: { bar: "bg-progress-700", value: "text-progress-700" },
  brand: { bar: "bg-brand-600", value: "text-brand-600" },
  success: { bar: "bg-complete-700", value: "text-complete-700" },
  teal: { bar: "bg-teal-700", value: "text-teal-700" },
  neutral: { bar: "bg-idle-700", value: "text-ink" },
};

export type StatCardAccent =
  | "danger"
  | "warning"
  | "brand"
  | "success"
  | "teal"
  | "neutral";

export function StatCardV2({
  label,
  value,
  detail,
  href,
  tone = "default",
  accent,
  selected = false,
  className,
}: {
  label: string;
  value: string | number;
  /** Concrete qualifier ("3 overdue", "next: 10:00 AM") — never a vague delta. */
  detail?: string;
  href: string;
  tone?: "default" | "attention";
  /** Colored 3px top bar + value color (mockup stat-filter card). */
  accent?: StatCardAccent;
  /** Highlight as the currently active filter. */
  selected?: boolean;
  className?: string;
}) {
  const a = accent ? ACCENT[accent] : null;
  return (
    <Link
      href={href}
      aria-current={selected ? "true" : undefined}
      className={cn(
        "group relative flex min-w-[150px] flex-1 flex-col gap-1 overflow-hidden rounded-[13px] border bg-surface p-4 pt-[15px]",
        "shadow-card transition-colors duration-150",
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-400",
        selected
          ? "border-brand-300 bg-surface-soft"
          : tone === "attention"
            ? "border-danger-700/20 hover:border-danger-700/40"
            : "border-line-card hover:border-brand-400",
        className
      )}
    >
      {a ? <span aria-hidden className={cn("absolute inset-x-0 top-0 h-[3px]", a.bar)} /> : null}
      <span
        className={cn(
          "text-[28px] font-bold leading-none tracking-[-0.01em]",
          a ? a.value : tone === "attention" ? "text-blocked-700" : "text-ink"
        )}
      >
        {value}
      </span>
      <span className="text-[11px] font-bold uppercase tracking-[0.06em] text-ink-muted">
        {label}
      </span>
      {detail ? (
        <span
          className={cn(
            "text-[11.5px] font-medium leading-snug",
            tone === "attention" && !a ? "text-blocked-700" : "text-ink-muted"
          )}
        >
          {detail}
        </span>
      ) : null}
    </Link>
  );
}

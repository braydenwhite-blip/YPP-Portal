import { cn } from "./cn";
import { StatCardV2 } from "./stat-card";

export type MetricStripItem = {
  label: string;
  value: string | number;
  /** Concrete qualifier ("3 overdue", "next: 10:00 AM") — never a vague delta. */
  detail?: string;
  /** Required: a metric you can't click into its list is decoration (§3). */
  href: string;
  tone?: "default" | "attention";
};

/**
 * The summary-card strip (Design System 2.0). Renders a calm, responsive row
 * of click-to-filter StatCards from data, and HARD-CAPS the count.
 *
 * Intuitiveness doctrine (docs/ypp-global-intuitiveness-design-system.md §7):
 * a page gets 3–5 summary cards, max. More than that and the page stops
 * telling the user what matters and starts dumping a dashboard. The cap is
 * enforced here so no page can quietly grow a seventh tile — surface the next
 * metric inside a list/section, not as another headline number.
 */
export function MetricStrip({
  metrics,
  max = 5,
  className,
  "aria-label": ariaLabel,
}: {
  metrics: MetricStripItem[];
  /** Headline-tile budget. The executive Home is the only sanctioned 6. */
  max?: number;
  className?: string;
  "aria-label"?: string;
}) {
  const shown = metrics.slice(0, max);
  if (shown.length === 0) return null;
  return (
    <div
      role="group"
      aria-label={ariaLabel ?? "Summary"}
      className={cn("flex flex-wrap gap-3", className)}
    >
      {shown.map((metric) => (
        <StatCardV2
          key={metric.label}
          label={metric.label}
          value={metric.value}
          detail={metric.detail}
          href={metric.href}
          tone={metric.tone}
        />
      ))}
    </div>
  );
}

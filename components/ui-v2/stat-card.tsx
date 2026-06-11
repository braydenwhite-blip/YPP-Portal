import Link from "next/link";

import { cn } from "./cn";

/**
 * Click-to-filter stat tile. `href` is required by design (master plan §3):
 * a count that can't be clicked into its filtered list is decoration, and
 * decoration is debt. Use `tone="attention"` only when the count demands
 * action (overdue, blocked) — calm by default.
 */
export function StatCardV2({
  label,
  value,
  detail,
  href,
  tone = "default",
  className,
}: {
  label: string;
  value: string | number;
  /** Concrete qualifier ("3 overdue", "next: 10:00 AM") — never a vague delta. */
  detail?: string;
  href: string;
  tone?: "default" | "attention";
  className?: string;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "group flex min-w-[150px] flex-1 flex-col gap-1 rounded-[12px] border bg-surface p-4",
        "shadow-card transition-colors duration-150",
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-400",
        tone === "attention"
          ? "border-danger-700/20 hover:border-danger-700/40"
          : "border-line-soft hover:border-brand-400",
        className
      )}
    >
      <span className="text-[11.5px] font-bold uppercase tracking-[0.06em] text-ink-muted">
        {label}
      </span>
      <span
        className={cn(
          "text-[26px] font-bold leading-none tracking-[-0.01em]",
          tone === "attention" ? "text-danger-700" : "text-ink"
        )}
      >
        {value}
      </span>
      {detail ? (
        <span
          className={cn(
            "text-[12px] font-medium",
            tone === "attention" ? "text-danger-700" : "text-ink-muted"
          )}
        >
          {detail}
        </span>
      ) : null}
    </Link>
  );
}

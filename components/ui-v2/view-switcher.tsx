import Link from "next/link";

import { cn } from "./cn";

export type SwitcherView = {
  /** Stable key for React + active comparison. */
  key: string;
  label: string;
  href: string;
  active?: boolean;
  /** Optional count shown as a quiet pill (omit for calm switchers). */
  count?: number;
};

/**
 * The one view switcher (Design System 2.0). A segmented control that answers
 * "which slice of this page am I looking at?" — deliberately distinct from the
 * FilterBar, which answers "narrow this slice down."
 *
 * Intuitiveness doctrine (docs/ypp-global-intuitiveness-design-system.md §8):
 * every tracker page gets ONE switcher with a handful of plain-English views;
 * everything sharper than a top-level view belongs in AdvancedFilters. Views
 * are LINKS (server-driven URLs) so a switched view is shareable and
 * back-button friendly, exactly like StatCard click-to-filter.
 */
export function ViewSwitcher({
  views,
  className,
  "aria-label": ariaLabel,
}: {
  views: SwitcherView[];
  className?: string;
  "aria-label"?: string;
}) {
  return (
    <nav
      role="tablist"
      aria-label={ariaLabel ?? "Views"}
      className={cn(
        "inline-flex max-w-full flex-wrap items-center gap-1 rounded-[10px] border border-line-soft bg-surface-soft p-1",
        className
      )}
    >
      {views.map((view) => (
        <Link
          key={view.key}
          href={view.href}
          role="tab"
          aria-selected={view.active ? "true" : "false"}
          aria-current={view.active ? "page" : undefined}
          className={cn(
            "inline-flex items-center gap-1.5 rounded-[7px] px-3 py-1.5",
            "text-[13px] font-semibold transition-colors duration-150",
            "focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-brand-400",
            view.active
              ? "bg-surface text-ink shadow-card"
              : "text-ink-muted hover:text-ink"
          )}
        >
          {view.label}
          {typeof view.count === "number" ? (
            <span
              className={cn(
                "rounded-full px-1.5 text-[11px] font-bold tabular-nums",
                view.active ? "bg-brand-50 text-brand-700" : "bg-line-soft text-ink-muted"
              )}
            >
              {view.count}
            </span>
          ) : null}
        </Link>
      ))}
    </nav>
  );
}

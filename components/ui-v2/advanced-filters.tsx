import { cn } from "./cn";

/**
 * The one "More filters" disclosure (Design System 2.0). Native <details> —
 * no client JS, server-renderable, keyboard-accessible for free.
 *
 * Intuitiveness doctrine (docs/ypp-global-intuitiveness-design-system.md §9):
 * a page shows ONLY the one or two filters behind the reason someone opened it.
 * Everything sharper — status pickers, owners, date windows, saved views —
 * lives here, collapsed by default. Open it automatically (`defaultOpen`) only
 * when an active deep-filter is already applied, so the user can see and clear
 * what's narrowing their view.
 */
export function AdvancedFilters({
  label = "More filters",
  hint,
  defaultOpen = false,
  children,
  className,
}: {
  label?: string;
  /** Quiet right-aligned context, e.g. "1 active" or the current filter name. */
  hint?: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <details
      open={defaultOpen}
      className={cn(
        "group rounded-[10px] border border-line-soft bg-surface px-3.5 py-2",
        className
      )}
    >
      <summary className="flex cursor-pointer list-none items-center justify-between gap-2 text-[12.5px] font-semibold text-ink-muted transition-colors hover:text-ink">
        <span className="inline-flex items-center gap-1.5">
          <span aria-hidden className="text-[11px] transition-transform group-open:rotate-90">
            ▸
          </span>
          {label}
        </span>
        {hint ? <span className="text-[11.5px] font-medium text-brand-700">{hint}</span> : null}
      </summary>
      <div className="mt-2.5 flex flex-wrap items-center gap-2 border-t border-line-soft pt-2.5">
        {children}
      </div>
    </details>
  );
}

import { cn } from "./cn";

/**
 * Docked right-rail preview chassis for master-database layouts: the selected
 * row renders here before any full-page navigation (preview-first, master
 * plan §2). Sticky on wide screens; pages collapse it to a drawer below
 * desktop widths.
 */
export function PreviewPanel({
  children,
  onClose,
  title,
  className,
}: {
  children: React.ReactNode;
  onClose?: () => void;
  /** Accessible label for the region ("Partner preview"). */
  title: string;
  className?: string;
}) {
  return (
    <aside
      aria-label={title}
      className={cn(
        "sticky top-6 flex max-h-[calc(100vh-3rem)] flex-col overflow-hidden",
        "rounded-[12px] border border-line-soft bg-surface shadow-card",
        className
      )}
    >
      {onClose ? (
        <button
          type="button"
          onClick={onClose}
          aria-label="Close preview"
          className="absolute right-3 top-3 z-10 flex size-7 items-center justify-center rounded-full text-[14px] text-ink-muted hover:bg-brand-50 hover:text-ink"
        >
          ×
        </button>
      ) : null}
      <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
    </aside>
  );
}

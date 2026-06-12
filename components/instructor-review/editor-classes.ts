/**
 * Review editor vocabulary — the shared Tailwind class strings for the
 * initial-review and interview-review editors (Design System 2.0). One
 * place so both editors stay visually identical; replaces the legacy
 * `.review-editor-*` / `.review-rating-*` globals.css families.
 */

export const EDITOR_PANEL =
  "flex flex-col gap-4 rounded-[12px] border border-line-soft bg-surface p-[22px] shadow-card " +
  "[&>div>h2]:m-0 [&>div>h2]:text-[16px] [&>div>h2]:font-bold [&>div>h2]:text-ink " +
  "[&>div>p]:m-0 [&>div>p]:mt-1 [&>div>p]:text-[12.5px] [&>div>p]:text-ink-muted";

export const EDITOR_NOTICE =
  "rounded-[10px] border border-line-soft bg-surface-soft px-3.5 py-2.5 text-[13px] text-ink-muted [&>p]:m-0";

export const EDITOR_CALLOUT =
  "rounded-[10px] border border-brand-200 bg-brand-50/60 px-3.5 py-2.5 text-[12.5px] text-ink";

export const EDITOR_WARNING =
  "rounded-[10px] border border-amber-200 bg-amber-50 px-3.5 py-2.5 text-[12.5px] font-medium text-amber-900";

export const CATEGORY_CARD =
  "flex flex-col gap-2.5 rounded-[10px] border border-line-soft bg-surface-soft/60 p-3.5";

export const CATEGORY_TITLE = "text-[13.5px] font-bold text-ink";
export const CATEGORY_DESCRIPTION = "text-[12px] leading-relaxed text-ink-muted";

export const RATING_GRID = "grid gap-1.5 sm:grid-cols-2 lg:grid-cols-4";

/** Rating option button; the data-driven color comes via inline style. */
export function ratingOptionClass(selected: boolean): string {
  return (
    "flex cursor-pointer flex-col items-start gap-0.5 rounded-[8px] border px-2.5 py-2 text-left " +
    "text-[12px] transition-colors duration-100 disabled:cursor-not-allowed disabled:opacity-60 " +
    "[&>div]:font-bold [&>span]:text-[11px] [&>span]:text-ink-muted " +
    (selected
      ? "border-current bg-surface shadow-card"
      : "border-line bg-surface hover:bg-surface-soft")
  );
}

export const CHECKBOX_ROW =
  "inline-flex cursor-pointer items-center gap-2 text-[13px] font-medium text-ink";

export const EDITOR_ACTIONS = "flex flex-wrap items-center justify-end gap-2";

export const FIELD_LABEL =
  "flex flex-col gap-1.5 text-[12.5px] font-bold text-ink";

export const FIELD_INPUT =
  "w-full rounded-[8px] border border-line bg-surface px-2.5 py-2 text-[13px] font-normal text-ink " +
  "focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-brand-400 disabled:opacity-60";

import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "./cn";

/**
 * The single source of status colors in Design System 2.0.
 *
 * Vague-metric rule (master plan §19): a badge may summarize a state, but the
 * concrete reason must be visible at the same altitude — pass `title` (or
 * render the reasons beside it) whenever the label is a derived level.
 */
const statusBadgeVariants = cva(
  "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11.5px] font-bold uppercase tracking-[0.04em]",
  {
    variants: {
      tone: {
        neutral: "bg-brand-50 text-brand-800",
        success: "bg-success-100 text-success-700",
        warning: "bg-warning-100 text-warning-700",
        danger: "bg-danger-100 text-danger-700",
        info: "bg-info-100 text-info-700",
        brand: "bg-brand-100 text-brand-700",
      },
    },
    defaultVariants: { tone: "neutral" },
  }
);

export type StatusTone = NonNullable<
  VariantProps<typeof statusBadgeVariants>["tone"]
>;

export function StatusBadge({
  tone,
  children,
  className,
  title,
  withDot = false,
}: {
  children: React.ReactNode;
  className?: string;
  /** Tooltip carrying the concrete reason behind a derived state. */
  title?: string;
  withDot?: boolean;
} & VariantProps<typeof statusBadgeVariants>) {
  return (
    <span className={cn(statusBadgeVariants({ tone }), className)} title={title}>
      {withDot ? (
        <span aria-hidden className="size-1.5 rounded-full bg-current" />
      ) : null}
      {children}
    </span>
  );
}

/** Map the existing Entity360 tone vocabulary onto DS 2.0 badge tones. */
export const ENTITY_TONE_TO_BADGE: Record<string, StatusTone> = {
  neutral: "neutral",
  info: "info",
  success: "success",
  warning: "warning",
  overdue: "danger",
  purple: "brand",
};

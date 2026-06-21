import type { GoalRatingColor } from "@prisma/client";

import { cn } from "@/components/ui-v2";
import { RATING_LABELS } from "@/lib/people-strategy/check-in-rating";
import type { CheckInCalendarDot } from "@/lib/people-strategy/people-performance-selectors";

/**
 * Monthly check-in dots over fixed calendar months (ui-v2). Each dot maps to
 * one concrete state — the four GoalRatingColor levels, "completed, no
 * rating", or an explicit hollow "missing" dot — with the month + state in
 * the accessible label, never color alone.
 */

const RATED_DOT_CLASS: Record<GoalRatingColor, string> = {
  BEHIND_SCHEDULE: "bg-danger-700",
  GETTING_STARTED: "bg-warning-700",
  ACHIEVED: "bg-success-700",
  ABOVE_AND_BEYOND: "bg-brand-500",
};

function dotTitle(dot: CheckInCalendarDot): string {
  if (dot.state === "not_due") return `${dot.monthLabel}: not due yet`;
  if (dot.state === "missing") return `${dot.monthLabel}: no check-in`;
  if (dot.state === "completed") return `${dot.monthLabel}: check-in completed (no rating)`;
  return `${dot.monthLabel}: ${dot.rating ? RATING_LABELS[dot.rating] : "rated"}`;
}

export function MonthlyCheckInDots({
  dots,
  className,
}: {
  dots: CheckInCalendarDot[];
  className?: string;
}) {
  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      {dots.map((dot) => {
        const title = dotTitle(dot);
        return (
          <span
            key={dot.monthKey}
            className="inline-flex flex-col items-center gap-1"
            title={title}
          >
            <span
              role="img"
              aria-label={title}
              className={cn(
                "size-3 rounded-full",
                dot.state === "not_due" && "bg-surface-soft",
                dot.state === "missing" && "border-2 border-line bg-transparent",
                dot.state === "completed" && "bg-ink-muted",
                dot.state === "rated" && dot.rating && RATED_DOT_CLASS[dot.rating]
              )}
            />
            <span aria-hidden className="text-[10.5px] leading-none text-ink-muted">
              {dot.monthLabel}
            </span>
          </span>
        );
      })}
    </span>
  );
}

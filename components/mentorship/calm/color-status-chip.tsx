import type { GoalRatingColor } from "@prisma/client";

import { cn } from "@/components/ui-v2";
import { getRatingCopyForAudience, type RatingAudience } from "@/lib/mentorship-rubric-copy";

/**
 * The canonical Purple/Green/Yellow/Red status pill. Reuses the single rubric
 * source (`lib/mentorship-rubric-copy`) so colors + copy stay consistent with
 * every other mentorship surface (rating-legend, goal-trajectory, …). Renders
 * nothing when there is no released rating, keeping calm surfaces quiet.
 */
export function ColorStatusChip({
  rating,
  audience = "mentor",
  className,
}: {
  rating: GoalRatingColor | string | null | undefined;
  /** Mentee surfaces get supportive labels; mentor/admin get operational ones. */
  audience?: RatingAudience;
  className?: string;
}) {
  if (!rating) return null;
  const copy = getRatingCopyForAudience(rating, audience);
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11.5px] font-bold uppercase tracking-[0.04em]",
        className
      )}
      style={{ background: copy.background, color: copy.color }}
      title={copy.description}
    >
      <span aria-hidden className="size-1.5 rounded-full bg-current" />
      {copy.label}
    </span>
  );
}

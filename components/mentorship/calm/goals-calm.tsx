import Link from "next/link";
import type { GoalRatingColor } from "@prisma/client";

import { SimpleListCard } from "@/components/command-center/simple";

import { ColorStatusChip } from "./color-status-chip";

/**
 * Calm active-goals list (Phase 7), mentee-facing. Leads the goals surface with
 * the few goals that are actually in motion, each carrying its released rubric
 * color in supportive (mentee) language, plus one calm "update progress" move.
 * The full G&R document (every lifecycle goal, KPIs, history) stays one toggle
 * away in Executive, so this never re-implements it. Renders nothing-but-empty
 * copy when there are no active goals yet.
 */

export type CalmGoal = {
  id: string;
  title: string;
  /** Latest released rubric color (mentee-safe); null hides the chip. */
  rating?: GoalRatingColor | string | null;
  /** One quiet line of context — e.g. "Due Jun 30" or a progress label. */
  meta?: string | null;
};

export function GoalsCalm({
  goals,
  updateHref = "/mentorship?view=me&section=reflection",
  updateLabel = "Update progress →",
  empty = "Once you're paired with a mentor, your goals show up here.",
}: {
  goals: CalmGoal[];
  updateHref?: string;
  updateLabel?: string;
  empty?: string;
}) {
  return (
    <SimpleListCard
      title="Your active goals"
      action={
        goals.length > 0 ? (
          <Link
            href={updateHref}
            className="text-[12.5px] font-semibold text-brand-700 hover:text-brand-800"
          >
            {updateLabel}
          </Link>
        ) : null
      }
      empty={
        goals.length === 0 ? (
          <p className="m-0 text-[12.5px] text-ink-muted">{empty}</p>
        ) : undefined
      }
    >
      {goals.map((goal) => (
        <div key={goal.id} className="flex items-center gap-3 px-3 py-3">
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[14px] font-semibold text-ink">{goal.title}</span>
            {goal.meta ? (
              <span className="block truncate text-[12.5px] text-ink-muted">{goal.meta}</span>
            ) : null}
          </span>
          {goal.rating ? <ColorStatusChip rating={goal.rating} audience="mentee" /> : null}
        </div>
      ))}
    </SimpleListCard>
  );
}

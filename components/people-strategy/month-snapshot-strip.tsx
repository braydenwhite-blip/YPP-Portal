import { cn } from "@/components/ui-v2";
import type { MonthSnapshot } from "@/lib/people-strategy/people-performance-selectors";

/**
 * People & Performance — the compact "This month" strip.
 *
 * A quick operating snapshot of concrete workflow counts only: feedback
 * requested / received / ready to review, check-ins done / missing, and
 * quarterly reviews needing attention. No synthetic "people health" score and
 * no vague status language — every number is a real count leadership can act on.
 */

type Cell = {
  label: string;
  value: number;
  /** Highlight when the number is something to act on (missing, to review). */
  attention?: boolean;
  /** Hidden when the quarterly-review feature is off. */
  show?: boolean;
};

export function MonthSnapshotStrip({
  snapshot,
  monthLabel,
  quarterlyEnabled,
}: {
  snapshot: MonthSnapshot;
  /** "June 2026" */
  monthLabel: string;
  quarterlyEnabled: boolean;
}) {
  const cells: Cell[] = [
    { label: "Feedback requested", value: snapshot.feedbackRequested },
    { label: "Responses received", value: snapshot.feedbackReceived },
    {
      label: "Ready to review",
      value: snapshot.feedbackToReview,
      attention: snapshot.feedbackToReview > 0,
    },
    { label: "Check-ins compiled", value: snapshot.checkInsCompleted },
    {
      label: "Check-ins missing",
      value: snapshot.checkInsMissing,
      attention: snapshot.checkInsMissing > 0,
    },
    {
      label: "Reviews to attend",
      value: snapshot.reviewsToAttend,
      attention: snapshot.reviewsToAttend > 0,
      show: quarterlyEnabled,
    },
  ].filter((c) => c.show !== false);

  return (
    <section
      aria-label={`This month — ${monthLabel}`}
      className="flex flex-col gap-2 rounded-[12px] border border-line-soft bg-surface p-4 shadow-card"
    >
      <p className="m-0 text-[11.5px] font-bold uppercase tracking-[0.06em] text-ink-muted">
        This month · {monthLabel}
      </p>
      <dl className="m-0 grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-3 lg:grid-cols-6">
        {cells.map((cell) => (
          <div key={cell.label} className="flex flex-col gap-0.5">
            <dd
              className={cn(
                "m-0 text-[22px] font-bold leading-none tracking-[-0.01em]",
                cell.attention ? "text-danger-700" : "text-ink"
              )}
            >
              {cell.value}
            </dd>
            <dt className="text-[11.5px] font-medium text-ink-muted">{cell.label}</dt>
          </div>
        ))}
      </dl>
    </section>
  );
}

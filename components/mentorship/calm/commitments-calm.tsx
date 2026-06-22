import { SimpleListCard } from "@/components/command-center/simple";
import { StatusBadge } from "@/components/ui-v2";
import { updateMentorshipActionItemStatus } from "@/lib/mentorship-hub-actions";

/**
 * Calm open-commitments list — each open commitment shows its owner + due label
 * and the single next move: mark it complete. Mentorship next steps are now
 * canonical `ActionItem`s created directly by the relationship flow, so the old
 * one-click "convert to Action" bridge is gone; an already-bridged legacy row
 * still shows a quiet "Tracked" badge so it is never acted on in two places.
 */

export type CalmCommitment = {
  id: string;
  title: string;
  ownerName?: string | null;
  dueLabel?: string | null;
  overdue?: boolean;
  /** True for a legacy row already represented by a canonical Action. */
  linked?: boolean;
};

export function CommitmentsCalm({
  commitments,
  empty = "No open commitments right now.",
}: {
  commitments: CalmCommitment[];
  empty?: string;
}) {
  return (
    <SimpleListCard
      title="Open commitments"
      empty={
        commitments.length === 0 ? (
          <p className="m-0 text-[12.5px] text-ink-muted">{empty}</p>
        ) : undefined
      }
    >
      {commitments.map((commitment) => {
        const meta = [
          commitment.ownerName ? `Owner: ${commitment.ownerName}` : "Shared",
          commitment.dueLabel,
        ]
          .filter(Boolean)
          .join(" · ");
        return (
          <div key={commitment.id} className="flex flex-col gap-2 px-3 py-3">
            <div className="flex items-center gap-3">
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[14px] font-semibold text-ink">
                  {commitment.title}
                </span>
                {meta ? (
                  <span className="block truncate text-[12.5px] text-ink-muted">{meta}</span>
                ) : null}
              </span>
              {commitment.overdue ? <StatusBadge tone="danger">Overdue</StatusBadge> : null}
              {commitment.linked ? <StatusBadge tone="info">Tracked</StatusBadge> : null}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <form action={updateMentorshipActionItemStatus}>
                <input type="hidden" name="itemId" value={commitment.id} />
                <input type="hidden" name="status" value="COMPLETE" />
                <button
                  type="submit"
                  className="inline-flex items-center rounded-full bg-success-100 px-3 py-1 text-[12px] font-semibold text-success-700 transition-colors hover:bg-success-200"
                >
                  Mark complete
                </button>
              </form>
            </div>
          </div>
        );
      })}
    </SimpleListCard>
  );
}

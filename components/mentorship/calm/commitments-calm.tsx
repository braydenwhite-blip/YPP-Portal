import { SimpleListCard } from "@/components/command-center/simple";
import { StatusBadge } from "@/components/ui-v2";
import {
  convertMentorshipCommitmentToAction,
  updateMentorshipActionItemStatus,
} from "@/lib/mentorship-hub-actions";

/**
 * Calm open-commitments list (Phase 7) — the interactive counterpart to the
 * static commitments column in `RelationshipDetailCalm`. Each open commitment
 * shows its owner + due label and the single next move: mark it complete, or
 * bridge it into the org Action Tracker (one click, idempotent). Once bridged,
 * the row shows a quiet "Tracked" badge instead of the convert button so the
 * commitment is never tracked in two places. The bridge button only renders
 * when the viewer can create org Actions (`canConvert`); completion is always
 * available to anyone who can act on the relationship.
 */

export type CalmCommitment = {
  id: string;
  title: string;
  ownerName?: string | null;
  dueLabel?: string | null;
  overdue?: boolean;
  /** True once this commitment has been bridged into a live org Action. */
  linked?: boolean;
};

export function CommitmentsCalm({
  commitments,
  canConvert,
  empty = "No open commitments right now.",
}: {
  commitments: CalmCommitment[];
  /** Whether the viewer may bridge a commitment into an org Action. */
  canConvert: boolean;
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
              {canConvert && !commitment.linked ? (
                <form action={convertMentorshipCommitmentToAction}>
                  <input type="hidden" name="itemId" value={commitment.id} />
                  <button
                    type="submit"
                    className="inline-flex items-center rounded-full px-3 py-1 text-[12px] font-semibold text-brand-700 transition-colors hover:bg-surface-soft"
                  >
                    Create Action →
                  </button>
                </form>
              ) : null}
            </div>
          </div>
        );
      })}
    </SimpleListCard>
  );
}

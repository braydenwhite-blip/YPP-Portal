import Link from "next/link";

import { MentorshipFocusCard, MentorshipRow } from "@/components/mentorship/calm";
import type { MentorshipViewModel } from "@/lib/mentorship/view-model";

/** How many mentees the calm list shows before deferring to the full roster. */
const CALM_LIST_LIMIT = 6;

/**
 * Mentor home — one next move, then a short mentee list. No widget grid.
 */
export function MentorHomeCalm({
  vm,
  needsYouCount,
}: {
  vm: MentorshipViewModel;
  needsYouCount: number;
}) {
  const shown = vm.relationships.slice(0, CALM_LIST_LIMIT);
  const remaining = vm.relationships.length - shown.length;

  return (
    <div className="flex flex-col gap-6">
      {vm.focus ? (
        <MentorshipFocusCard focus={vm.focus} />
      ) : (
        <div className="rounded-[16px] border border-line-soft bg-surface-soft/60 px-5 py-6 text-center">
          <p className="m-0 text-[15px] font-semibold text-ink">You&apos;re caught up</p>
          <p className="m-0 mt-1 text-[13.5px] text-ink-muted">
            {needsYouCount > 0
              ? "A few mentees still need attention — open someone below."
              : "Nothing is waiting on you right now."}
          </p>
        </div>
      )}

      {vm.relationships.length > 0 ? (
        <section className="overflow-hidden rounded-[16px] border border-line bg-surface">
          <div className="flex items-baseline justify-between gap-3 border-b border-line-soft px-5 py-4">
            <div>
              <h2 className="m-0 text-[15px] font-semibold text-ink">Your mentees</h2>
              <p className="m-0 mt-0.5 text-[13px] text-ink-muted">
                {vm.relationships.length} active
              </p>
            </div>
            <Link
              href="/mentorship/mentees"
              className="shrink-0 text-[13px] font-medium text-brand-700 no-underline hover:text-brand-800"
            >
              {remaining > 0 ? `View all ${vm.relationships.length}` : "Roster"} →
            </Link>
          </div>
          <ul className="m-0 list-none divide-y divide-line-soft p-0">
            {shown.map((relationship) => (
              <li key={relationship.id}>
                <MentorshipRow relationship={relationship} />
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}

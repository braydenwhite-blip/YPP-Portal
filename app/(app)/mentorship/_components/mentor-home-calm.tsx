import Link from "next/link";

import {
  EmptySimpleState,
  SimpleListCard,
} from "@/components/command-center/simple";
import { MentorshipFocusCard, MentorshipRow } from "@/components/mentorship/calm";
import type { MentorshipViewModel } from "@/lib/mentorship/view-model";

/** How many mentees the calm list shows before deferring to the full roster. */
const CALM_LIST_LIMIT = 5;

/**
 * Calm mentor home — one obvious next move plus a short, scannable roster.
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
    <div className="flex flex-col gap-5">
      {vm.focus ? (
        <MentorshipFocusCard focus={vm.focus} />
      ) : (
        <EmptySimpleState icon="check">
          {needsYouCount > 0
            ? "A few mentees need you — open the list below."
            : "You're all caught up. Nothing is waiting on you."}
        </EmptySimpleState>
      )}

      {vm.relationships.length > 0 ? (
        <SimpleListCard
          title="Your mentees"
          action={
            remaining > 0 ? (
              <Link
                href="/mentorship/mentees"
                className="text-[12.5px] font-semibold text-brand-700 hover:text-brand-800"
              >
                View all {vm.relationships.length} →
              </Link>
            ) : null
          }
        >
          {shown.map((relationship) => (
            <MentorshipRow key={relationship.id} relationship={relationship} />
          ))}
        </SimpleListCard>
      ) : null}
    </div>
  );
}

import Link from "next/link";

import {
  EmptySimpleState,
  SimpleActionStrip,
  SimpleListCard,
  type SimpleAction,
} from "@/components/command-center/simple";
import { MentorshipFocusCard, MentorshipRow } from "@/components/mentorship/calm";
import type { MentorshipViewModel } from "@/lib/mentorship/view-model";

/** How many mentees the calm list shows before deferring to the full roster. */
const CALM_LIST_LIMIT = 5;

/**
 * Calm mentor home — one obvious next move plus a short, scannable roster. The
 * focus card is the single highest-priority thing waiting on the mentor (a
 * kickoff, a review, a follow-up); the list shows a few mentees with their cycle
 * state and rubric color. Everything denser — the kanban, engagement panels,
 * the full workspace grid — lives in Executive mode, one toggle away.
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

  const actions: SimpleAction[] = [
    // Approvals render right on the Mentorship home now — no separate inbox.
    { label: "Schedule", href: "/mentorship/schedule", icon: "calendar" },
    { label: "Feedback", href: "/mentorship/feedback", icon: "send" },
  ];

  return (
    <div className="flex flex-col gap-5">
      {vm.focus ? (
        <MentorshipFocusCard focus={vm.focus} />
      ) : (
        <EmptySimpleState icon="check">
          {needsYouCount > 0
            ? "A few mentees need you — open the roster below to see who."
            : "You're all caught up. Nothing is waiting on you right now."}
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

      <SimpleActionStrip actions={actions} />
    </div>
  );
}

import { ButtonLink, CardV2 } from "@/components/ui-v2";
import type { CycleState } from "@/lib/mentorship/lifecycle";

/**
 * One next step. No jargon.
 */

function plainStep(cycleState: CycleState): string {
  const action = cycleState.nextAction;

  if (action.key === "all-caught-up") {
    return "You're all set for now.";
  }

  if (action.key.startsWith("await-") || action.href == null) {
    if (action.label.toLowerCase().startsWith("waiting")) {
      return action.label;
    }
    const who =
      action.ownerName?.trim() ||
      (action.ownerRole === "subject"
        ? "them"
        : action.ownerRole === "writer"
          ? "you"
          : action.ownerRole === "approver"
            ? "the chair"
            : null);
    if (who) return `Waiting on ${who}.`;
    return action.label;
  }

  return action.label;
}

export function ActiveReviewCycleCard({
  cycleState,
  canTakeNextAction,
}: {
  cycleState: CycleState;
  canTakeNextAction: boolean;
}) {
  const title = plainStep(cycleState);
  const showButton =
    canTakeNextAction &&
    !!cycleState.nextAction.href &&
    cycleState.nextAction.key !== "all-caught-up" &&
    !cycleState.nextAction.key.startsWith("await-");

  return (
    <CardV2 className="border-l-[3px] border-l-brand-600">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="m-0 min-w-0 text-[18px] font-semibold leading-snug text-ink">
          {title}
        </p>
        {showButton ? (
          <ButtonLink href={cycleState.nextAction.href!} size="sm">
            Do this →
          </ButtonLink>
        ) : null}
      </div>
    </CardV2>
  );
}

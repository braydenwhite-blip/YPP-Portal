import { ButtonLink, CardV2, StatusBadge, type StatusTone } from "@/components/ui-v2";
import type { CycleState } from "@/lib/mentorship/lifecycle";

/**
 * The organizing element of the Review & G&R flow: current stage in plain
 * language, the one next action, who owns it, and a single "take next
 * action" control. Everything else on the page supports this one card —
 * this is the fix for "eight co-equal sections" (a stack of features)
 * reading as one continuous flow instead.
 */

const STAGE_LABELS: Record<string, string> = {
  KICKOFF_PENDING: "Kickoff not held yet",
  REFLECTION_DUE: "Waiting on reflection",
  REFLECTION_SUBMITTED: "Waiting on the review",
  REVIEW_SUBMITTED: "Waiting on Role Chair approval",
  CHANGES_REQUESTED: "Changes requested",
  APPROVED: "Released",
  PAUSED: "Paused",
  COMPLETE: "Complete",
};

const STAGE_TONE: Record<string, StatusTone> = {
  KICKOFF_PENDING: "warning",
  REFLECTION_DUE: "warning",
  REFLECTION_SUBMITTED: "info",
  REVIEW_SUBMITTED: "info",
  CHANGES_REQUESTED: "danger",
  APPROVED: "success",
  PAUSED: "neutral",
  COMPLETE: "neutral",
};

const OWNER_LABELS: Record<string, string> = {
  subject: "Them",
  writer: "Mentor",
  approver: "Chair",
  leadership: "Leadership",
};

export function ActiveReviewCycleCard({
  cycleState,
  canTakeNextAction,
}: {
  cycleState: CycleState;
  canTakeNextAction: boolean;
}) {
  const stage = cycleState.stage ?? "KICKOFF_PENDING";
  const stageLabel =
    cycleState.nextAction.key === "record-mentor-check-in"
      ? "Mentor Check-in due"
      : cycleState.nextAction.key === "write-review"
        ? "Progress Update due"
        : STAGE_LABELS[stage] ?? stage;
  const tone = STAGE_TONE[stage] ?? "neutral";

  return (
    <CardV2 className="border-l-[3px] border-l-brand-600">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="m-0 text-[11.5px] font-semibold uppercase tracking-[0.04em] text-[#9a9ab0]">
            Current mentorship cycle
          </p>
          <div className="mt-1.5 flex items-center gap-2">
            <StatusBadge tone={tone}>{stageLabel}</StatusBadge>
            {cycleState.blockingReason ? (
              <span className="text-[12.5px] text-[#9a9ab0]">{cycleState.blockingReason}</span>
            ) : null}
          </div>
        </div>
        {canTakeNextAction &&
        cycleState.nextAction.href &&
        cycleState.nextAction.key !== "all-caught-up" ? (
          <ButtonLink href={cycleState.nextAction.href} size="sm">
            {cycleState.nextAction.label}
          </ButtonLink>
        ) : null}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-4 text-[13px] text-[#4a4a5e]">
        <span>
          <strong className="font-semibold text-[#1c1a2e]">Next:</strong> {cycleState.nextAction.label}
        </span>
        <span>
          <strong className="font-semibold text-[#1c1a2e]">Owner:</strong>{" "}
          {cycleState.nextAction.ownerName ??
            OWNER_LABELS[cycleState.nextAction.ownerRole] ??
            cycleState.nextAction.ownerRole}
        </span>
        {cycleState.commentsSubstate ? (
          <span>
            <strong className="font-semibold text-[#1c1a2e]">Comments:</strong>{" "}
            {cycleState.commentsSubstate.submitted}/{cycleState.commentsSubstate.requested} in
            {cycleState.commentsSubstate.overdue > 0
              ? ` · ${cycleState.commentsSubstate.overdue} overdue`
              : ""}
          </span>
        ) : null}
      </div>

      {cycleState.nextAction.reason ? (
        <p className="m-0 mt-2 text-[12.5px] text-[#717189]">{cycleState.nextAction.reason}</p>
      ) : null}
    </CardV2>
  );
}

import type {
  WorkHubDecisionWithoutAction,
  WorkHubInitiativeCard,
} from "@/lib/work/work-hub";

import { buildReasonString } from "./ranking";
import { buildResolutionActions, pickPrimaryResolution } from "./resolution";
import {
  emptyQueueSignals,
  type QueueItem,
  type QueueSeverity,
  type QueueSignals,
  type QueueTone,
  QUEUE_ITEM_TYPE_LABELS,
} from "./types";

/**
 * Initiative + meeting-decision folders.
 *
 * Initiatives become cleanup loops ONLY when they have a concrete problem
 * (no owner, no next move, overdue linked work, past target, or drifting
 * health). Healthy, owned, moving initiatives are not loops — they don't belong
 * in a queue. Meeting decisions that never became actions are their own loop:
 * the decision was made, but nothing is tracked.
 */

const HEALTH_TONE_TO_SEVERITY: Record<WorkHubInitiativeCard["healthTone"], QueueSeverity> = {
  danger: "critical",
  warning: "high",
  info: "medium",
  neutral: "low",
  success: "low",
};

const HEALTH_TONE_TO_QUEUE_TONE: Record<WorkHubInitiativeCard["healthTone"], QueueTone> = {
  danger: "danger",
  warning: "warning",
  info: "info",
  neutral: "neutral",
  success: "success",
};

/** Does this initiative have an open operating problem worth a cleanup loop? */
export function initiativeNeedsCleanup(card: WorkHubInitiativeCard): boolean {
  return (
    !card.owner ||
    !card.nextStep ||
    card.overdueActions > 0 ||
    card.pastTargetDate ||
    card.healthTone === "danger" ||
    card.healthTone === "warning" ||
    card.healthTone === "info"
  );
}

export function queueItemFromInitiativeCard(card: WorkHubInitiativeCard): QueueItem | null {
  if (!initiativeNeedsCleanup(card)) return null;

  const overdue = card.overdueActions > 0 || card.pastTargetDate;
  const flagship = Boolean(card.flagship);
  const signals: QueueSignals = {
    ...emptyQueueSignals(),
    overdue,
    missingOwner: !card.owner,
    missingNextStep: !card.nextStep,
    flagshipInitiative: flagship,
    stale: card.healthTone === "info" || card.healthTone === "warning",
    needsDecision: flagship && card.healthTone === "danger",
  };

  let severity = HEALTH_TONE_TO_SEVERITY[card.healthTone];
  if (overdue && severity === "low") severity = "high";

  const reasons = card.healthReasons.length
    ? card.healthReasons.join(" · ")
    : [
        !card.owner ? "no owner" : null,
        card.overdueActions > 0 ? `${card.overdueActions} overdue actions` : null,
        !card.nextStep ? "no next move" : null,
        card.pastTargetDate ? "past target date" : null,
      ]
        .filter(Boolean)
        .join(" · ");

  const recommendedMove =
    card.nextStep ??
    (signals.missingOwner
      ? "Name an owner for this initiative."
      : signals.missingNextStep
        ? "Define the next concrete move."
        : "Open it and unblock the linked work.");

  const { resolutions, actions } = buildResolutionActions({
    href: card.href,
    type: "initiative",
    signals,
    resolveLabel: "Open initiative",
  });
  const primaryKey = pickPrimaryResolution(signals, resolutions);
  const primaryAction = actions[primaryKey] ?? actions.resolve!;
  const secondaryActions = resolutions
    .filter((key) => key !== primaryKey)
    .map((key) => actions[key]!);

  return {
    id: `init:${card.id}`,
    type: "initiative",
    typeLabel: QUEUE_ITEM_TYPE_LABELS.initiative,
    title: card.title,
    severity,
    tone: HEALTH_TONE_TO_QUEUE_TONE[card.healthTone],
    source: { type: "initiative", id: card.id, label: card.title },
    ownerName: card.owner,
    ownerId: null,
    relatedMeeting: null,
    relatedInitiative: { id: card.id, title: card.title },
    relatedPerson: null,
    why: `${card.statusLabel}${reasons ? ` — ${reasons}` : ""}.`,
    recommendedMove,
    primaryAction,
    secondaryActions,
    resolutions,
    statusLabel: card.healthLabel,
    ageLabel: card.pastTargetDate ? "past target" : null,
    dueISO: card.targetDateISO,
    createdISO: null,
    updatedISO: null,
    signals,
    reason: buildReasonString(signals),
    score: 0,
    href: card.href,
  };
}

export function queueItemFromDecision(decision: WorkHubDecisionWithoutAction): QueueItem {
  const signals: QueueSignals = {
    ...emptyQueueSignals(),
    missingNextStep: true,
    connectedToMeeting: true,
    needsDecision: false,
  };

  const { resolutions, actions } = buildResolutionActions({
    href: decision.meetingHref,
    type: "decision",
    signals,
    relatedMeetingId: decision.meetingId,
    resolveLabel: "Convert to action",
    resolveHint: "Turn the decision into an owned, tracked action.",
  });

  return {
    id: `dec:${decision.id}`,
    type: "decision",
    typeLabel: QUEUE_ITEM_TYPE_LABELS.decision,
    title: decision.decision,
    severity: "high",
    tone: "warning",
    source: { type: "meeting", id: decision.meetingId, label: decision.meetingTitle },
    ownerName: null,
    ownerId: null,
    relatedMeeting: { id: decision.meetingId, title: decision.meetingTitle },
    relatedInitiative: null,
    relatedPerson: null,
    why: `Decided in ${decision.meetingTitle} but never became a tracked action.`,
    recommendedMove: "Convert this decision into an owned action so it actually happens.",
    primaryAction: actions.resolve!,
    secondaryActions: resolutions.filter((k) => k !== "resolve").map((k) => actions[k]!),
    resolutions,
    statusLabel: "Needs an action",
    ageLabel: null,
    dueISO: null,
    createdISO: null,
    updatedISO: null,
    signals,
    reason: buildReasonString(signals),
    score: 0,
    href: decision.meetingHref,
  };
}

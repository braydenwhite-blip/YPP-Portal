import type { WorkHubRow } from "@/lib/work/work-hub-rows";

import { buildReasonString } from "./ranking";
import { buildResolutionActions, pickPrimaryResolution } from "./resolution";
import {
  emptyQueueSignals,
  type QueueInline,
  type QueueItem,
  type QueueItemType,
  type QueueSeverity,
  type QueueSignals,
  type QueueTone,
  QUEUE_ITEM_TYPE_LABELS,
} from "./types";

const FOLLOW_UP_ID_PREFIX = "follow_up:";

/**
 * The real inline workflow for a row, when one is safe to run in My Queue:
 *   • an editable action → structured complete / block (the same mutations the
 *     detail card uses; `capture` is only present when the viewer may edit), and
 *   • a meeting follow-up → mark handled / convert to a tracked action.
 * Everything else returns null and routes to its full record.
 */
function inlineForRow(row: WorkHubRow): QueueInline | null {
  if (row.kind === "action" && row.capture) {
    return {
      kind: "action",
      actionId: row.capture.actionId,
      blockedReason: row.capture.blockedReason,
      completionNote: row.capture.completionNote,
      completionOutcome: row.capture.completionOutcome,
      nextFollowUpISO: row.capture.nextFollowUpISO,
    };
  }
  if (row.kind === "follow_up" && row.id.startsWith(FOLLOW_UP_ID_PREFIX)) {
    const followUpId = row.id.slice(FOLLOW_UP_ID_PREFIX.length);
    if (followUpId) return { kind: "follow_up", followUpId };
  }
  return null;
}

/**
 * Fold a unified Work Hub row (the existing cross-domain "someone must do
 * something" shape) into a canonical QueueItem. This is the widest folder: it
 * covers tracker actions, meeting follow-ups, meetings, partner requests,
 * partner follow-ups, overdue advisor check-ins, applications on a leadership
 * step, and quiet mentorships — every row `loadWorkHub` already produces.
 *
 * Pure: no DB, no clock except the injected `now` (used only to phrase "due"
 * status). One row in, one loop out, 1:1 with a real record.
 */

const KIND_TO_TYPE: Record<WorkHubRow["kind"], QueueItemType> = {
  action: "action",
  follow_up: "follow_up",
  meeting: "meeting",
  initiative: "initiative",
  partner_request: "partner_request",
  partner_follow_up: "partner_follow_up",
  advisor_check_in: "advisor_check_in",
  application: "application",
  mentorship: "mentorship",
};

const SINGLE_STEP_KINDS = new Set<WorkHubRow["kind"]>([
  "follow_up",
  "advisor_check_in",
  "mentorship",
  "partner_follow_up",
]);

const NEEDS_NEXT_STEP_KINDS = new Set<WorkHubRow["kind"]>([
  "action",
  "follow_up",
  "mentorship",
  "partner_request",
  "partner_follow_up",
]);

function toneToQueueTone(tone: WorkHubRow["tone"]): QueueTone {
  return tone;
}

function severityForRow(row: WorkHubRow): QueueSeverity {
  if (row.overdue && (row.blocked || row.tone === "danger")) return "critical";
  if (row.overdue || row.blocked || row.tone === "danger") return "high";
  if (row.tone === "warning") return "medium";
  return "low";
}

function ageLabelForRow(status: string): string | null {
  return /overdue|quiet|without movement|\bday/i.test(status) ? status : null;
}

function whyForRow(row: WorkHubRow): string {
  const kind = row.kindLabel.toLowerCase();
  if (row.blocked) return `Blocked — this ${kind} can't move until the blocker is cleared.`;
  if (row.overdue)
    return row.ownerName
      ? `${row.ownerName} is past the due date on this ${kind}.`
      : `This ${kind} is past its due date and nobody owns it.`;
  if (row.unassigned) return `Nobody owns this ${kind} yet, so it is quietly drifting.`;
  if (/decision needed/i.test(row.status)) return `A leadership decision is required to move this forward.`;
  if (row.nextStep) return row.nextStep;
  return `${row.status}${row.sourceLabel ? ` · ${row.sourceLabel}` : ""}.`;
}

function resolveLabelForRow(row: WorkHubRow, isUpcomingMeeting: boolean): string {
  if (isUpcomingMeeting) return "Prep meeting";
  switch (row.kind) {
    case "follow_up":
      return "Close follow-up";
    case "meeting":
      return "Close follow-ups";
    case "advisor_check_in":
      return "Log check-in";
    case "partner_request":
    case "partner_follow_up":
      return "Log next step";
    case "mentorship":
      return "Log activity";
    case "application":
      return "Advance application";
    default:
      return "Resolve";
  }
}

export function queueItemFromWorkHubRow(row: WorkHubRow, now: Date): QueueItem {
  const isUpcomingMeeting =
    row.kind === "meeting" && !row.overdue && /^starts/i.test(row.status);
  const type: QueueItemType = isUpcomingMeeting ? "meeting_prep" : KIND_TO_TYPE[row.kind];

  const needsDecision = /decision needed/i.test(row.status);
  const stale = /quiet|stale|without movement/i.test(row.status);

  const signals: QueueSignals = {
    ...emptyQueueSignals(),
    overdue: row.overdue,
    blocking: row.blocked,
    missingOwner: row.unassigned,
    missingNextStep: !row.nextStep && NEEDS_NEXT_STEP_KINDS.has(row.kind),
    connectedToMeeting: Boolean(row.meetingId) || row.kind === "meeting",
    stale,
    mine: row.mine,
    needsDecision,
    waitingOn: Boolean(row.ownerName) && !row.mine && !row.overdue && !row.unassigned,
    quickWin: !row.overdue && !row.blocked && SINGLE_STEP_KINDS.has(row.kind),
  };

  const source =
    row.previewType && row.previewId
      ? { type: row.previewType, id: row.previewId, label: row.title }
      : row.entityType && row.entityId
        ? { type: row.entityType, id: row.entityId, label: row.entityLabel ?? row.title }
        : null;

  const relatedPerson =
    row.entityType === "person" && row.entityId
      ? { type: "person" as const, id: row.entityId, label: row.entityLabel ?? row.title }
      : null;

  const relatedMeeting =
    row.kind === "meeting" && row.previewId
      ? { id: row.previewId, title: row.title }
      : row.meetingId
        ? { id: row.meetingId, title: row.sourceLabel?.replace(/^From meeting:\s*/i, "") ?? "Meeting" }
        : null;

  const { resolutions, actions } = buildResolutionActions({
    href: row.href,
    type,
    signals,
    relatedMeetingId: relatedMeeting?.id ?? null,
    resolveLabel: resolveLabelForRow(row, isUpcomingMeeting),
  });

  // The dominant move: an owner-less loop wants Delegate; otherwise Resolve.
  const primaryKey = pickPrimaryResolution(signals, resolutions);
  const primaryAction = actions[primaryKey] ?? actions.resolve!;
  const secondaryActions = resolutions
    .filter((key) => key !== primaryKey)
    .map((key) => actions[key]!)
    .filter(Boolean);

  // Keep the record-specific verb available too ("Convert to action", etc.).
  if (row.quickActionLabel && row.quickActionHref && row.quickActionHref !== row.href) {
    secondaryActions.push({
      resolution: "open",
      label: row.quickActionLabel,
      href: row.quickActionHref,
    });
  }

  const recommendedMove =
    row.nextStep ??
    (signals.missingOwner
      ? "Assign an owner so this stops drifting."
      : signals.blocking
        ? "Clear the blocker or escalate it."
        : signals.overdue
          ? "Reschedule it or close it out today."
          : primaryAction.hint ?? null);

  return {
    id: `wh:${row.id}`,
    type,
    typeLabel: isUpcomingMeeting ? QUEUE_ITEM_TYPE_LABELS.meeting_prep : row.kindLabel,
    title: row.title,
    severity: severityForRow(row),
    tone: toneToQueueTone(row.tone),
    source,
    ownerName: row.ownerName,
    ownerId: null,
    relatedMeeting,
    relatedInitiative: null,
    relatedPerson,
    why: whyForRow(row),
    recommendedMove,
    primaryAction,
    secondaryActions,
    resolutions,
    inline: inlineForRow(row),
    statusLabel: row.status,
    ageLabel: ageLabelForRow(row.status),
    dueISO: row.dueISO,
    createdISO: null,
    updatedISO: null,
    signals,
    reason: buildReasonString(signals),
    score: 0,
    href: row.href,
  };
}

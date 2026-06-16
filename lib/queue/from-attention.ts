import type {
  AttentionCategory,
  AttentionItem,
  AttentionKind,
} from "@/lib/operations/attention";
import type { OperationalReviewSeverity } from "@/lib/people-strategy/operational-digest";

import { buildReasonString } from "./ranking";
import { buildResolutionActions, pickPrimaryResolution } from "./resolution";
import {
  emptyQueueSignals,
  type QueueItem,
  type QueueItemType,
  type QueueSeverity,
  type QueueSignals,
  type QueueTone,
  QUEUE_ITEM_TYPE_LABELS,
} from "./types";

/**
 * Fold a Needs Attention item (the cross-domain triage signal the digest +
 * signals engine already produce) into a canonical QueueItem. These power the
 * Triage Desk lens and the decision / missing-owner sessions. The attention
 * engine already explains WHY and suggests the next move, so this folder mostly
 * translates its category into deterministic ranking signals.
 */

const KIND_TO_TYPE: Record<AttentionKind, QueueItemType> = {
  action: "action",
  meeting: "meeting",
  decision: "decision",
  class: "class_setup",
  instructor: "application",
  person: "person",
  partner: "partner_request",
  mentorship: "mentorship",
  applicant: "application",
  area: "action",
};

const SEVERITY_MAP: Record<OperationalReviewSeverity, QueueSeverity> = {
  critical: "critical",
  warning: "high",
  watch: "medium",
  neutral: "low",
};

const CATEGORY_TONE: Record<AttentionCategory, QueueTone> = {
  urgent: "danger",
  missing_owner: "warning",
  missing_next_step: "warning",
  stalled: "info",
  upcoming_risk: "warning",
  data_incomplete: "neutral",
};

function signalsForAttention(item: AttentionItem): QueueSignals {
  const signals = emptyQueueSignals();
  switch (item.category) {
    case "urgent":
      signals.overdue = true;
      break;
    case "missing_owner":
      signals.missingOwner = true;
      break;
    case "missing_next_step":
      signals.missingNextStep = true;
      break;
    case "stalled":
      signals.stale = true;
      break;
    case "upcoming_risk":
      signals.connectedToMeeting = item.kind === "meeting";
      break;
    case "data_incomplete":
      signals.missingNextStep = true;
      break;
  }
  if (item.kind === "decision") signals.needsDecision = true;
  if (item.kind === "meeting") signals.connectedToMeeting = true;
  return signals;
}

export function queueItemFromAttentionItem(item: AttentionItem): QueueItem {
  const type = KIND_TO_TYPE[item.kind];
  const signals = signalsForAttention(item);

  const source =
    item.entityType && item.entityId
      ? { type: item.entityType, id: item.entityId, label: item.relatedLabel ?? item.title }
      : null;

  const relatedPerson =
    item.entityType === "person" && item.entityId
      ? { type: "person" as const, id: item.entityId, label: item.relatedLabel ?? item.title }
      : null;

  const { resolutions, actions } = buildResolutionActions({
    href: item.href,
    type,
    signals,
    resolveLabel: item.kind === "decision" ? "Convert to action" : "Resolve",
  });

  const primaryKey = pickPrimaryResolution(signals, resolutions);
  const primaryAction = actions[primaryKey] ?? actions.resolve!;
  const secondaryActions = resolutions
    .filter((key) => key !== primaryKey)
    .map((key) => actions[key]!)
    .filter(Boolean);

  return {
    id: `att:${item.id}`,
    type,
    typeLabel: QUEUE_ITEM_TYPE_LABELS[type],
    title: item.title,
    severity: SEVERITY_MAP[item.severity],
    tone: CATEGORY_TONE[item.category],
    source,
    ownerName: null,
    ownerId: null,
    relatedMeeting: null,
    relatedInitiative: null,
    relatedPerson,
    why: item.why,
    recommendedMove: item.suggestedStep,
    primaryAction,
    secondaryActions,
    resolutions,
    // Triage signals route to their record; no generic inline mutation here.
    inline: null,
    statusLabel: item.ageLabel ?? item.category.replaceAll("_", " "),
    ageLabel: item.ageLabel,
    dueISO: null,
    createdISO: null,
    updatedISO: null,
    signals,
    reason: buildReasonString(signals),
    score: 0,
    href: item.href,
  };
}

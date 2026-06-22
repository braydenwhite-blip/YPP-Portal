import type { AttentionItem } from "@/lib/operations/attention";
import {
  emptyQueueSignals,
  type QueueItem,
  type QueueSignals,
} from "@/lib/queue/types";
import type {
  WorkHubDecisionWithoutAction,
  WorkHubInitiativeCard,
} from "@/lib/work/work-hub";
import type { WorkHubRow } from "@/lib/work/work-hub-rows";

/**
 * Shared deterministic fixtures for the Queue Engine unit tests. Each factory
 * spread-merges overrides LAST so an explicit `null` (e.g. `owner: null`) wins
 * over the default — important for the "missing owner / no next step" cases.
 */

export function makeSignals(overrides: Partial<QueueSignals> = {}): QueueSignals {
  return { ...emptyQueueSignals(), ...overrides };
}

export function makeQueueItem(overrides: Partial<QueueItem> = {}): QueueItem {
  return {
    id: "wh:action:1",
    type: "action",
    typeLabel: "Action",
    title: "Untitled loop",
    severity: "low",
    tone: "neutral",
    source: null,
    ownerName: null,
    ownerId: null,
    relatedMeeting: null,
    relatedInitiative: null,
    relatedPerson: null,
    why: "Because it matters.",
    recommendedMove: null,
    primaryAction: { resolution: "resolve", label: "Resolve", href: "/x" },
    secondaryActions: [],
    resolutions: ["resolve"],
    inline: null,
    statusLabel: "Open",
    ageLabel: null,
    dueISO: null,
    createdISO: null,
    updatedISO: null,
    signals: emptyQueueSignals(),
    reason: "open",
    score: 0,
    href: "/x",
    ...overrides,
  };
}

export function makeWorkHubRow(overrides: Partial<WorkHubRow> = {}): WorkHubRow {
  return {
    id: "action:1",
    kind: "action",
    kindLabel: "Action",
    title: "Send the partnership email",
    status: "In progress",
    tone: "info",
    ownerName: "Mia Ward",
    dueISO: null,
    priorityLabel: null,
    sourceLabel: null,
    meetingId: null,
    entityType: "action",
    entityId: null,
    entityLabel: null,
    nextStep: null,
    overdue: false,
    blocked: false,
    unassigned: false,
    mine: false,
    href: "/actions/1",
    quickActionLabel: null,
    quickActionHref: null,
    previewType: "action",
    previewId: "1",
    capture: null,
    ...overrides,
  };
}

export function makeAttentionItem(overrides: Partial<AttentionItem> = {}): AttentionItem {
  return {
    id: "review:action:1",
    kind: "action",
    category: "urgent",
    title: "Overdue action",
    why: "It is past due.",
    suggestedStep: "Reschedule or close it.",
    ageLabel: "3 days overdue",
    severity: "critical",
    score: 40,
    href: "/actions/1",
    ...overrides,
  };
}

export function makeInitiativeCard(
  overrides: Partial<WorkHubInitiativeCard> = {}
): WorkHubInitiativeCard {
  return {
    id: "init-1",
    title: "Fall recruiting push",
    statusLabel: "Active",
    healthLabel: "At risk",
    healthTone: "warning",
    healthReasons: ["2 overdue actions"],
    owner: "Mia Ward",
    openActions: 4,
    overdueActions: 2,
    progressLabel: "40% of milestones",
    nextStep: "Confirm interview slate",
    targetDateISO: null,
    pastTargetDate: false,
    flagship: false,
    href: "/operations/initiatives/init-1",
    ...overrides,
  };
}

export function makeDecision(
  overrides: Partial<WorkHubDecisionWithoutAction> = {}
): WorkHubDecisionWithoutAction {
  return {
    id: "decision-1",
    decision: "Move interviews to Tuesdays",
    meetingId: "meeting-1",
    meetingTitle: "Ops sync",
    meetingHref: "/meetings/meeting-1",
    ...overrides,
  };
}

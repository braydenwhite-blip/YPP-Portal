import type { QueueEngine } from "@/lib/queue/engine";
import {
  selectDecisionQueue,
  selectOwnerAccountabilityQueue,
  selectWaitingQueue,
} from "@/lib/queue/selectors";
import type { OwnerLane, QueueItem, QueueResolution } from "@/lib/queue/types";

import {
  type CcDecisionLogEntry,
  countWhere,
  dayDelta,
  dueLabel,
  initialsFromName,
  isUnowned,
  isWaiting,
  needsDecision,
  needsMeeting,
  pluralize,
} from "./shared";

/**
 * Decide — the decision operating system. Leadership choices, ownership gaps,
 * and blockers, aggregated from the Queue Engine into clear decision items: what
 * needs a call, what needs an owner, what needs a meeting, what's waiting for
 * context, and what was recently decided.
 */

export type CcDecisionOption = {
  id: string;
  name: string;
  initials: string;
  reason: string;
  recommended: boolean;
};

export type CcDecisionActionSet = {
  chooseHref: string;
  chooseLabel: string;
  assignHref: string | null;
  meetingHref: string | null;
  deferHref: string | null;
};

export type CcFocusDecision = {
  id: string;
  title: string;
  decisionNeeded: string;
  whyItMatters: string;
  ownerName: string | null;
  ownerFallback: string | null;
  deadlineLabel: string | null;
  dueToday: boolean;
  relatedMeeting: { id: string; title: string } | null;
  relatedInitiative: { id: string; title: string } | null;
  options: CcDecisionOption[];
  recommendation: string | null;
  recommendedNextMove: string | null;
  actions: CcDecisionActionSet;
  isOwnershipDecision: boolean;
};

export type DecideWorkspaceVM = {
  brief: string;
  flagshipBlockers: number;
  summary: {
    needsDecisionToday: number;
    needsOwner: number;
    needsMeeting: number;
    waitingForContext: number;
    recentlyDecided: number;
  };
  lanes: {
    needsDecisionToday: QueueItem[];
    needsOwner: QueueItem[];
    needsMeeting: QueueItem[];
  };
  focus: CcFocusDecision | null;
  relatedMeeting: { id: string; title: string } | null;
  waitingOn: QueueItem[];
  recentlyDecided: CcDecisionLogEntry[];
  decisionLog: CcDecisionLogEntry[];
};

function resolutionHref(item: QueueItem, resolution: QueueResolution): string | null {
  const all = [item.primaryAction, ...item.secondaryActions];
  const match = all.find((action) => action.resolution === resolution);
  return match?.href ?? null;
}

/**
 * Deterministic owner suggestions for an ownership decision: real people who
 * already carry load, ranked by who has the most capacity right now (fewest
 * overdue, then fewest open). Operational, never evaluative.
 */
function suggestOwners(ownerLanes: OwnerLane[]): CcDecisionOption[] {
  const candidates = ownerLanes
    .filter((lane) => !lane.unowned && lane.ownerName)
    .sort((a, b) => a.overdue - b.overdue || a.open - b.open || a.ownerName.localeCompare(b.ownerName))
    .slice(0, 3);

  return candidates.map((lane, index) => ({
    id: lane.ownerId ?? lane.ownerName,
    name: lane.ownerName,
    initials: initialsFromName(lane.ownerName),
    reason:
      lane.overdue === 0 && lane.open < 4
        ? "most capacity right now"
        : `${pluralize(lane.open, "open loop")}${lane.overdue > 0 ? `, ${lane.overdue} overdue` : ""}`,
    recommended: index === 0,
  }));
}

function buildFocus(engine: QueueEngine, now: Date): CcFocusDecision | null {
  const decisions = selectDecisionQueue(engine.items);
  const ownerGaps = selectOwnerAccountabilityQueue(engine.items);
  const item =
    decisions.find((i) => i.signals.flagshipInitiative) ?? decisions[0] ?? ownerGaps[0] ?? null;
  if (!item) return null;

  const isOwnership = item.signals.missingOwner;
  const title = isOwnership
    ? `Who owns ${item.relatedInitiative?.title ?? item.title}?`
    : item.title;

  return {
    id: item.id,
    title,
    decisionNeeded: isOwnership
      ? "Assign the accountable owner."
      : item.recommendedMove ?? "Make the leadership call.",
    whyItMatters: item.why,
    ownerName: item.ownerName,
    ownerFallback: item.ownerName ? null : "Unassigned",
    deadlineLabel: dueLabel(item.dueISO, now),
    dueToday: item.dueISO ? dayDelta(item.dueISO, now) <= 0 : false,
    relatedMeeting: item.relatedMeeting,
    relatedInitiative: item.relatedInitiative,
    options: isOwnership ? suggestOwners(engine.ownerLanes) : [],
    recommendation: item.recommendedMove,
    recommendedNextMove: item.recommendedMove,
    actions: {
      chooseHref: item.primaryAction.href,
      chooseLabel: isOwnership ? "Assign owner" : item.primaryAction.label,
      assignHref: resolutionHref(item, "delegate"),
      meetingHref: resolutionHref(item, "discuss"),
      deferHref: resolutionHref(item, "defer"),
    },
    isOwnershipDecision: isOwnership,
  };
}

function buildBrief(engine: QueueEngine, flagshipBlockers: number): string {
  const decisions = selectDecisionQueue(engine.items).length;
  if (decisions === 0) {
    return "No decisions need leadership right now. Review ownership gaps and upcoming meetings.";
  }
  const lead = `${pluralize(decisions, "decision")} need leadership.`;
  if (flagshipBlockers > 0) {
    return `${lead} ${flagshipBlockers === 1 ? "1 blocks" : `${flagshipBlockers} block`} a flagship initiative.`;
  }
  return lead;
}

export function buildDecideWorkspace(input: {
  engine: QueueEngine;
  recentDecisions: CcDecisionLogEntry[];
  now: Date;
}): DecideWorkspaceVM {
  const { engine, recentDecisions, now } = input;
  const items = engine.items;

  const decisions = selectDecisionQueue(items);
  const needsDecisionToday = decisions.filter((i) => !i.dueISO || dayDelta(i.dueISO, now) <= 0);
  const ownerGaps = selectOwnerAccountabilityQueue(items);
  const needsMeetingItems = items.filter(needsMeeting);
  const waiting = selectWaitingQueue(items);

  const flagshipBlockers = countWhere(
    items,
    (i) => i.signals.flagshipInitiative && (i.signals.blocking || needsDecision(i))
  );

  const focus = buildFocus(engine, now);

  return {
    brief: buildBrief(engine, flagshipBlockers),
    flagshipBlockers,
    summary: {
      needsDecisionToday: needsDecisionToday.length,
      needsOwner: countWhere(items, isUnowned),
      needsMeeting: needsMeetingItems.length,
      waitingForContext: countWhere(items, isWaiting),
      recentlyDecided: recentDecisions.length,
    },
    lanes: {
      needsDecisionToday: (needsDecisionToday.length > 0 ? needsDecisionToday : decisions).slice(0, 5),
      needsOwner: ownerGaps.slice(0, 5),
      needsMeeting: needsMeetingItems.slice(0, 5),
    },
    focus,
    relatedMeeting: focus?.relatedMeeting ?? null,
    waitingOn: waiting.slice(0, 3),
    recentlyDecided: recentDecisions.slice(0, 4),
    decisionLog: recentDecisions,
  };
}

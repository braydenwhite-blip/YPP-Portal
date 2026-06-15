import type { QueueEngine } from "@/lib/queue/engine";
import {
  selectDecisionQueue,
  selectInitiativeCleanupQueue,
  selectMeetingPrepQueue,
  selectMyQueue,
  selectOwnerAccountabilityQueue,
  selectQuickWins,
  selectWaitingQueue,
} from "@/lib/queue/selectors";
import type { QueueItem } from "@/lib/queue/types";

import {
  type CcChange,
  type CcMeeting,
  countWhere,
  formatLongDate,
  greetingForHour,
  isOverdue,
  isWaiting,
  joinClauses,
  type OperationalTone,
  pluralize,
  recentlyTouchedISO,
  sentence,
  whenLabel,
} from "./shared";

/**
 * Today / Command Center — the daily operating cockpit. It answers, in five
 * seconds: what is today's mission, what to do first (Now / Next / Later), what
 * meeting is current, what decisions matter, who we're waiting on, and what just
 * changed. Every value is a deterministic projection of the Queue Engine.
 */

export type CcStep = {
  phase: "now" | "next" | "later";
  title: string;
  detail: string;
  ctaLabel: string;
  ctaHref: string;
  icon: string;
  tone: OperationalTone;
};

export type TodayWorkspaceVM = {
  greeting: string;
  viewerFirstName: string;
  dateLabel: string;
  mission: string;
  flow: { now: CcStep | null; next: CcStep | null; later: CcStep | null };
  meeting: CcMeeting | null;
  decisions: QueueItem[];
  waitingOn: QueueItem[];
  waitingOnCount: number;
  recentlyChanged: CcChange[];
  counts: {
    open: number;
    overdue: number;
    needsDecision: number;
    waiting: number;
    clearedThisWeek: number;
  };
  browse: QueueItem[];
};

function firstName(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) return "there";
  return trimmed.split(/\s+/)[0]!;
}

const PHASE_ICON: Record<CcStep["phase"], string> = {
  now: "bolt",
  next: "calendar",
  later: "clock",
};

function stepFromItem(item: QueueItem, phase: CcStep["phase"], ctaLabel: string): CcStep {
  return {
    phase,
    title: item.title,
    detail: item.why,
    ctaLabel,
    ctaHref: item.primaryAction.href,
    icon: PHASE_ICON[phase],
    tone: phase === "now" ? item.tone : phase === "next" ? "info" : "neutral",
  };
}

/** Pick the soonest current/upcoming meeting for the cockpit. */
function pickTodayMeeting(meetings: CcMeeting[]): CcMeeting | null {
  const live = meetings.find((m) => m.live);
  if (live) return live;
  const upcoming = meetings
    .filter((m) => m.status === "today" || m.status === "upcoming" || m.status === "needs_follow_up")
    .sort((a, b) => new Date(a.startISO).getTime() - new Date(b.startISO).getTime());
  return upcoming[0] ?? meetings[0] ?? null;
}

function buildMission(engine: QueueEngine, now: Date): string {
  const items = engine.items;
  const meetingPrep = selectMeetingPrepQueue(items)[0] ?? null;
  const ownerGap =
    selectOwnerAccountabilityQueue(items).find((i) => i.signals.flagshipInitiative) ??
    selectOwnerAccountabilityQueue(items)[0] ??
    null;
  const overdueFollowUps = countWhere(
    items,
    (i) => isOverdue(i) && (i.type === "follow_up" || i.type === "partner_follow_up")
  );
  const overdueAny = engine.summary.overdue;

  const prepClause = meetingPrep
    ? `prep ${meetingPrep.relatedMeeting?.title ?? meetingPrep.title}`
    : null;
  const ownerClause = ownerGap
    ? `assign an owner to ${ownerGap.relatedInitiative?.title ?? ownerGap.title}`
    : null;
  const clearClause =
    overdueFollowUps > 0
      ? `clear ${pluralize(overdueFollowUps, "overdue follow-up")}`
      : overdueAny > 0
        ? `clear ${pluralize(overdueAny, "overdue item")}`
        : null;

  const assembled = joinClauses([prepClause, ownerClause, clearClause]);
  if (!assembled) {
    if (engine.summary.openLoops === 0) {
      return "Your leadership queue is clear. Review upcoming meetings and plan next week.";
    }
    const decisions = selectDecisionQueue(items)[0];
    return decisions
      ? sentence(`make the call on ${decisions.title}, then run your queue.`)
      : "Run your queue and keep the open loops moving.";
  }
  return `${sentence(assembled)}.`;
}

function buildFlow(engine: QueueEngine): TodayWorkspaceVM["flow"] {
  const items = engine.items;
  const used = new Set<string>();

  const mine = selectMyQueue(items);
  const nowItem = mine.find((i) => i.signals.overdue || i.signals.blocking) ?? mine[0] ?? items[0] ?? null;
  if (nowItem) used.add(nowItem.id);

  const meetingPrep = selectMeetingPrepQueue(items).find((i) => !used.has(i.id));
  const nextItem =
    meetingPrep ?? items.find((i) => !used.has(i.id) && i.signals.connectedToMeeting) ?? items.find((i) => !used.has(i.id)) ?? null;
  if (nextItem) used.add(nextItem.id);

  const laterItem =
    selectQuickWins(items).find((i) => !used.has(i.id)) ??
    selectInitiativeCleanupQueue(items).find((i) => !used.has(i.id)) ??
    items.find((i) => !used.has(i.id) && !i.signals.overdue && !i.signals.blocking) ??
    null;

  const nextIsMeeting = Boolean(nextItem?.signals.connectedToMeeting || nextItem?.type === "meeting_prep");

  return {
    now: nowItem ? stepFromItem(nowItem, "now", "Start now") : null,
    next: nextItem ? stepFromItem(nextItem, "next", nextIsMeeting ? "Prep meeting" : "Open") : null,
    later: laterItem ? stepFromItem(laterItem, "later", "Review later") : null,
  };
}

const CHANGE_ICON_BY_TYPE: Record<string, string> = {
  meeting: "calendar",
  meeting_prep: "calendar",
  follow_up: "inbox",
  decision: "scale",
  initiative: "flag",
  action: "check",
  application: "user",
  partner_request: "handoff",
  partner_follow_up: "handoff",
};

export function buildRecentChanges(items: QueueItem[], now: Date, max: number): CcChange[] {
  const windowMs = 4 * 24 * 60 * 60 * 1000;
  return items
    .map((item) => ({ item, iso: recentlyTouchedISO(item) }))
    .filter((entry): entry is { item: QueueItem; iso: string } => Boolean(entry.iso))
    .filter((entry) => now.getTime() - new Date(entry.iso).getTime() <= windowMs)
    .sort((a, b) => new Date(b.iso).getTime() - new Date(a.iso).getTime())
    .slice(0, max)
    .map(({ item, iso }) => ({
      id: item.id,
      title: item.title,
      detail: item.ownerName ? `By ${item.ownerName}` : item.typeLabel,
      whenISO: iso,
      whenLabel: whenLabel(iso, now),
      tone: item.signals.recentlyCreated ? "brand" : "neutral",
      icon: CHANGE_ICON_BY_TYPE[item.type] ?? "activity",
      href: item.href,
    }));
}

export function buildTodayWorkspace(input: {
  engine: QueueEngine;
  meetings: CcMeeting[];
  viewerName: string;
  now: Date;
}): TodayWorkspaceVM {
  const { engine, meetings, viewerName, now } = input;
  const items = engine.items;

  return {
    greeting: greetingForHour(now),
    viewerFirstName: firstName(viewerName),
    dateLabel: formatLongDate(now),
    mission: buildMission(engine, now),
    flow: buildFlow(engine),
    meeting: pickTodayMeeting(meetings),
    decisions: selectDecisionQueue(items).slice(0, 2),
    waitingOn: selectWaitingQueue(items).slice(0, 3),
    waitingOnCount: countWhere(items, isWaiting),
    recentlyChanged: buildRecentChanges(items, now, 4),
    counts: {
      open: engine.summary.openLoops,
      overdue: engine.summary.overdue,
      needsDecision: engine.summary.needsDecision,
      waiting: countWhere(items, isWaiting),
      clearedThisWeek: engine.summary.clearedThisWeek,
    },
    browse: items.slice(0, 24),
  };
}
